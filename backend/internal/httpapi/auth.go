package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// authInfo is what a resolved session knows about its caller. Handlers read it
// from the context under authKey when they need to attribute an action.
type authInfo struct {
	UserID   string
	Email    string
	Role     string
	MemberID *string
	CanWrite bool
	IsAdmin  bool
}

const authKey = "wit.auth"

// currentUser returns the caller's session, or nil on the public endpoints.
func currentUser(c echo.Context) *authInfo {
	if v, ok := c.Get(authKey).(*authInfo); ok {
		return v
	}
	return nil
}

// rolePermissions is the shape of roles.permissions. Absent keys are false, so
// a role gets exactly what its JSON grants and nothing by accident.
type rolePermissions struct {
	All   bool `json:"all"`
	Write bool `json:"write"`
	Read  bool `json:"read"`
}

// publicOps are the operations that must work before anyone has a session:
// the registration flow and login itself. Everything else under /api/v1 needs
// a bearer token. Keyed by route path (c.Path), not raw URL, so a query string
// cannot dress a protected route up as a public one.
var publicOps = map[string]bool{
	"/api/v1/auth/register":            true,
	"/api/v1/auth/verify":              true,
	"/api/v1/auth/resend-verification": true,
	"/api/v1/auth/login":               true,
	// Resetting a forgotten password happens when you cannot sign in, so these
	// two must work without a session. The token is the credential.
	"/api/v1/auth/forgot-password": true,
	"/api/v1/auth/reset-password":  true,
}

// adminWritePrefixes name resources that DEFINE authority rather than hold
// domain data. Writing a role's permissions is how you decide what every
// account may do; writing workspace settings rewrites global config. Both must
// be admin-only, or the /users admin gate is theatre — a "write"-tier lead
// could PUT /roles {"id":"lead","permissions":{"all":true}} and be admin on
// its next request. Reads stay at the session tier (the role picker needs
// GET /roles), so only the write methods are gated here.
var adminWritePrefixes = []string{
	"/api/v1/roles",
	"/api/v1/settings",
}

func isAdminWrite(method, path string) bool {
	if method == http.MethodGet || method == http.MethodHead {
		return false
	}
	for _, p := range adminWritePrefixes {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

// requireAuth resolves the bearer token and enforces the role policy:
//
//	public ops            no token needed
//	any valid session     every GET, and logout
//	write or all          POST/PATCH/DELETE on domain resources
//	all only              anything under /users — accounts grant authority,
//	                      so even reading the list is an admin action
//
// The policy lives here, in one place, rather than sprinkled across handlers —
// a handler that forgets to check is the vulnerability this middleware exists
// to make impossible.
func (s *Server) requireAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if publicOps[c.Path()] {
				return next(c)
			}

			token := bearerToken(c)
			if token == "" {
				return echo.NewHTTPError(http.StatusUnauthorized,
					"authentication required: send Authorization: Bearer <token> from POST /auth/login")
			}

			row, err := s.q.GetSessionUser(c.Request().Context(), hashToken(token))
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					// Same answer for a bogus token and an expired one, so a
					// probe learns nothing about which it was.
					return echo.NewHTTPError(http.StatusUnauthorized,
						"invalid or expired session: sign in again")
				}
				return dbErr(err)
			}

			var perms rolePermissions
			// A malformed permissions document grants nothing; the constraint
			// on roles.permissions makes this unreachable, but unreachable is
			// not a privilege policy.
			_ = json.Unmarshal(row.Permissions, &perms)

			auth := &authInfo{
				UserID:   row.UserID,
				Email:    row.Email,
				Role:     row.Role,
				MemberID: row.MemberID,
				CanWrite: perms.All || perms.Write,
				IsAdmin:  perms.All,
			}
			c.Set(authKey, auth)

			path := c.Path()
			if path == "/api/v1/auth/logout" || path == "/api/v1/auth/logout-all" {
				return next(c) // logging out — here or everywhere — is every session's right
			}
			// Accounts and the things that grant authority — roles, workspace
			// settings — are admin territory. Roles especially: they are the
			// definition of what a session may do, so leaving them at the write
			// tier would let a lead promote itself.
			if !auth.IsAdmin &&
				(strings.HasPrefix(path, "/api/v1/users") ||
					isAdminWrite(c.Request().Method, path)) {
				return echo.NewHTTPError(http.StatusForbidden,
					"this action requires the admin role")
			}
			switch c.Request().Method {
			case http.MethodGet, http.MethodHead:
				return next(c)
			default:
				if !auth.CanWrite {
					return echo.NewHTTPError(http.StatusForbidden,
						"your role ("+auth.Role+") can read but not change things")
				}
				return next(c)
			}
		}
	}
}

// bearerToken extracts the token from "Authorization: Bearer <token>".
func bearerToken(c echo.Context) string {
	h := c.Request().Header.Get(echo.HeaderAuthorization)
	const prefix = "Bearer "
	if len(h) > len(prefix) && strings.EqualFold(h[:len(prefix)], prefix) {
		return strings.TrimSpace(h[len(prefix):])
	}
	return ""
}
