package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"github.com/syabanf/pm-platform/backend/internal/db"
)

// registerUserRoutes mounts the accounts and the one auth primitive the service
// has: verify an email and password. There are no sessions or tokens yet —
// login confirms the credentials and returns the account, and that is all.
func (s *Server) registerUserRoutes(g *echo.Group) {
	g.GET("/users", s.listUsers)
	g.POST("/users", s.createUser)
	g.GET("/users/:userId", s.getUser)

	g.POST("/auth/register", s.register)
	g.POST("/auth/verify", s.verifyEmail)
	g.POST("/auth/resend-verification", s.resendVerification)
	g.POST("/auth/login", s.login)
}

// Registration flow
//
//	POST /auth/register             -> creates a pending account, issues a token
//	POST /auth/verify               -> proves the address, account becomes active
//	POST /auth/resend-verification  -> issues a fresh token, invalidating the old
//	POST /auth/login                -> refuses until the address is verified
//
// There is no mailer wired up, so the link cannot actually be delivered. Rather
// than pretend, the token is returned in the response only when APP_ENV is not
// production, and always written to the log. Wiring a real mailer means sending
// it and dropping it from the body — the rest of the flow does not change.
const verificationTokenTTL = 24 * time.Hour

// newVerificationToken returns the token to put in a link and the hash to store.
// Only the hash is persisted: the table then holds nothing that can verify an
// address on its own.
func newVerificationToken() (token, hash string, err error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", "", err
	}
	token = hex.EncodeToString(b[:])
	sum := sha256.Sum256([]byte(token))
	return token, hex.EncodeToString(sum[:]), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newUserID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "usr-" + time.Now().UTC().Format("20060102150405.000000000")
	}
	return "usr-" + hex.EncodeToString(b[:])
}

type createUserRequest struct {
	ID       *string `json:"id"`
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Name     string  `json:"name"`
	Role     *string `json:"role"`
	MemberID *string `json:"memberId"`
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type verifyRequest struct {
	Token string `json:"token"`
}

type resendRequest struct {
	Email string `json:"email"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) listUsers(c echo.Context) error {
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListUsers(c.Request().Context(), db.ListUsersParams{Lim: limit + 1, Off: offset})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) getUser(c echo.Context) error {
	id, err := param(c, "userId")
	if err != nil {
		return err
	}
	row, err := s.q.GetUser(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) createUser(c echo.Context) error {
	req, err := bind[createUserRequest](c)
	if err != nil {
		return err
	}
	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" || req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "email and name are required")
	}
	// Enforced here rather than at the column so the message is about the
	// password, not a truncated hash. bcrypt itself rejects anything over 72
	// bytes, so cap there too.
	if len(req.Password) < 8 || len(req.Password) > 72 {
		return echo.NewHTTPError(http.StatusBadRequest, "password must be between 8 and 72 characters")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	id := deref(req.ID)
	if id == "" {
		id = newUserID()
	}

	row, err := s.q.CreateUser(c.Request().Context(), db.CreateUserParams{
		ID:           id,
		Email:        email,
		PasswordHash: string(hash),
		Name:         req.Name,
		Role:         orDefault(deref(req.Role), "member"),
		MemberID:     req.MemberID,
	})
	if err != nil {
		// role is a foreign key to roles(id); an unknown one is the caller's
		// mistake, not a missing record in the usual sense.
		if isForeignKeyViolation(err, "users_role_fkey") {
			return echo.NewHTTPError(http.StatusBadRequest, "role does not exist")
		}
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) login(c echo.Context) error {
	req, err := bind[loginRequest](c)
	if err != nil {
		return err
	}
	email := strings.TrimSpace(strings.ToLower(req.Email))

	user, err := s.q.GetUserForAuth(c.Request().Context(), email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Same answer whether the email is unknown or the password is
			// wrong, so the endpoint does not confirm which emails exist.
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid email or password")
		}
		return dbErr(err)
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid email or password")
	}
	if user.Status == "pending" {
		return echo.NewHTTPError(http.StatusForbidden,
			"please verify your email address before signing in")
	}
	if user.Status != "active" {
		return echo.NewHTTPError(http.StatusForbidden, "this account is not active")
	}

	// No session or token yet: success returns the account (without the hash),
	// and it is the caller's job to remember it. Building real sessions is a
	// deliberate next step, not part of this change.
	return c.JSON(http.StatusOK, echo.Map{
		"id":       user.ID,
		"email":    user.Email,
		"name":     user.Name,
		"role":     user.Role,
		"memberId": user.MemberID,
		"status":   user.Status,
	})
}

// ------------------------------------------------------------- registration ---

// issueVerification invalidates any outstanding link for the user and mints a
// new one. It returns the raw token, which the caller decides whether to expose.
func (s *Server) issueVerification(c echo.Context, userID string) (string, error) {
	ctx := c.Request().Context()
	if err := s.q.InvalidateUserVerificationTokens(ctx, userID); err != nil {
		return "", err
	}
	token, hash, err := newVerificationToken()
	if err != nil {
		return "", err
	}
	if _, err := s.q.CreateVerificationToken(ctx, db.CreateVerificationTokenParams{
		TokenHash: hash,
		UserID:    userID,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(verificationTokenTTL), Valid: true},
	}); err != nil {
		return "", err
	}
	// Stands in for the mail that would carry it.
	log.Printf("verification token issued for user %s (expires in %s)", userID, verificationTokenTTL)
	return token, nil
}

// verificationBody assembles the response for register and resend. The token
// only travels in the body outside production, where there is no inbox to
// receive it; in production the caller is told to go and read their mail.
func (s *Server) verificationBody(email, token string) echo.Map {
	body := echo.Map{
		"email":   email,
		"status":  "pending",
		"message": "check your email for a verification link",
	}
	if s.cfg.Env != "production" {
		body["verificationToken"] = token
		body["note"] = "token returned because APP_ENV is not production; no mail was sent"
	}
	return body
}

func (s *Server) register(c echo.Context) error {
	req, err := bind[registerRequest](c)
	if err != nil {
		return err
	}
	email := strings.TrimSpace(strings.ToLower(req.Email))
	name := strings.TrimSpace(req.Name)
	if email == "" || !strings.Contains(email, "@") {
		return echo.NewHTTPError(http.StatusBadRequest, "a valid email is required")
	}
	if name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}
	if len(req.Password) < 8 || len(req.Password) > 72 {
		return echo.NewHTTPError(http.StatusBadRequest, "password must be between 8 and 72 characters")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	user, err := s.q.CreateUser(ctx, db.CreateUserParams{
		ID:           newUserID(),
		Email:        email,
		PasswordHash: string(hash),
		Name:         name,
		Role:         "member",
	})
	if err != nil {
		// An address that is already registered must not be distinguishable
		// from a fresh one, or this endpoint becomes a way to enumerate who has
		// an account. Answer exactly as if it had worked.
		if isUniqueViolation(err, "users_email_key") {
			return c.JSON(http.StatusAccepted, echo.Map{
				"email":   email,
				"status":  "pending",
				"message": "check your email for a verification link",
			})
		}
		return dbErr(err)
	}

	token, err := s.issueVerification(c, user.ID)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, s.verificationBody(user.Email, token))
}

func (s *Server) verifyEmail(c echo.Context) error {
	req, err := bind[verifyRequest](c)
	if err != nil {
		return err
	}
	if req.Token == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "token is required")
	}
	ctx := c.Request().Context()
	hash := hashToken(req.Token)

	claimed, err := s.q.ConsumeVerificationToken(ctx, hash)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return dbErr(err)
		}
		// No row means the token is unknown, already used, or expired. Look it
		// up to say which — an already-verified user clicking their link twice
		// deserves a better answer than "invalid".
		existing, lookupErr := s.q.GetVerificationToken(ctx, hash)
		if lookupErr != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "this verification link is not valid")
		}
		if existing.ConsumedAt.Valid {
			return echo.NewHTTPError(http.StatusConflict, "this verification link has already been used")
		}
		return echo.NewHTTPError(http.StatusGone,
			"this verification link has expired — request a new one")
	}

	user, err := s.q.MarkUserVerified(ctx, claimed.UserID)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, echo.Map{
		"id":              user.ID,
		"email":           user.Email,
		"name":            user.Name,
		"role":            user.Role,
		"status":          user.Status,
		"emailVerifiedAt": user.EmailVerifiedAt,
		"message":         "email verified — you can sign in now",
	})
}

func (s *Server) resendVerification(c echo.Context) error {
	req, err := bind[resendRequest](c)
	if err != nil {
		return err
	}
	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "email is required")
	}

	// Same shape of answer whatever the truth is: unknown address, already
	// verified, or a link genuinely sent. Anything else leaks the register.
	sent := echo.Map{
		"email":   email,
		"message": "if that address needs verifying, a new link is on its way",
	}

	user, err := s.q.GetUserByEmail(c.Request().Context(), email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.JSON(http.StatusAccepted, sent)
		}
		return dbErr(err)
	}
	if user.EmailVerifiedAt.Valid {
		return c.JSON(http.StatusAccepted, sent)
	}

	token, err := s.issueVerification(c, user.ID)
	if err != nil {
		return dbErr(err)
	}
	if s.cfg.Env != "production" {
		sent["verificationToken"] = token
		sent["note"] = "token returned because APP_ENV is not production; no mail was sent"
	}
	return c.JSON(http.StatusAccepted, sent)
}
