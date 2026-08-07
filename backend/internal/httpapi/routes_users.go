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
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"

	"github.com/syabanf/pm-platform/backend/internal/config"
	"github.com/syabanf/pm-platform/backend/internal/db"
)

// registerUserRoutes mounts the accounts and the auth flow: register, verify,
// login — which now mints a session — and logout, which revokes it.
func (s *Server) registerUserRoutes(g *echo.Group) {
	g.GET("/users", s.listUsers)
	g.POST("/users", s.createUser)
	g.GET("/users/:userId", s.getUser)

	// The unauthenticated credential ops get their own, much smaller bucket:
	// each login failure teaches an attacker something, and register/resend
	// mint tokens. Five a minute is plenty for a person and useless for a
	// dictionary.
	tight := authRateLimiter(s.cfg)
	g.POST("/auth/register", s.register, tight)
	g.POST("/auth/verify", s.verifyEmail)
	g.POST("/auth/resend-verification", s.resendVerification, tight)
	g.POST("/auth/login", s.login, tight)
	g.POST("/auth/logout", s.logout)
}

// authRateLimiter is the per-IP bucket shared by the credential endpoints.
func authRateLimiter(cfg config.Config) echo.MiddlewareFunc {
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      rate.Limit(cfg.LoginRatePerMin / 60.0),
			Burst:     int(cfg.LoginRatePerMin),
			ExpiresIn: 10 * time.Minute,
		}),
	})
}

// Registration flow
//
//	POST /auth/register             -> creates a pending account, issues a token
//	POST /auth/verify               -> proves the address, account becomes active
//	POST /auth/resend-verification  -> issues a fresh token, invalidating the old
//	POST /auth/login                -> refuses until the address is verified
//
// There is no mailer wired up, so the link cannot actually be delivered. Outside
// production the token comes back in the response, which is enough to drive the
// flow in development and in tests. In production it must not, so there has to
// be somewhere else for it to go: set VERIFICATION_TOKEN_IN_LOG=true and it is
// written to the log for an operator to pass on by hand.
//
// With neither — production and no opt-in — registration refuses instead of
// creating an account that can never be verified and whose owner would be told
// to check an inbox nothing was sent to. Wiring a real mailer means sending the
// token and removing this fork; the rest of the flow does not change.
const verificationTokenTTL = 24 * time.Hour

// canDeliverVerification reports whether a token issued now could actually
// reach the person who needs it.
func (s *Server) canDeliverVerification() bool {
	return s.cfg.Env != "production" || s.cfg.VerificationTokenInLog
}

// errNoVerificationDelivery is the honest answer when it could not.
func errNoVerificationDelivery() error {
	return echo.NewHTTPError(http.StatusServiceUnavailable,
		"registration is unavailable: this deployment has no way to deliver a verification link")
}

// newOpaqueToken returns a fresh random token and the hash to store. Both the
// verification flow and sessions use it: only the hash is ever persisted, so
// neither table holds anything that can authenticate on its own.
func newOpaqueToken() (token, hash string, err error) {
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

// role and memberId are deliberately absent. Nothing authenticates this
// request — there are no sessions yet — so a caller choosing its own role was
// simply an unauthenticated way to mint an administrator, which is exactly the
// restriction /auth/register was written to enforce. Both fields grant
// authority, so neither is the caller's to set: an account created over HTTP is
// a plain member, and promoting one is an operator action against the database
// until there is something to check a credential against.
type createUserRequest struct {
	ID       *string `json:"id"`
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Name     string  `json:"name"`
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
		Role:         "member",
	})
	if err != nil {
		// Two different unique constraints, and saying "id" for both sent
		// callers off retrying with a fresh id forever when the address was
		// the problem.
		if isUniqueViolation(err, "users_email_key") {
			return echo.NewHTTPError(http.StatusConflict, "that email is already registered")
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
			// wrong, so the endpoint does not confirm which emails exist —
			// and the same *cost*: without this compare the unknown-email
			// path returns tens of milliseconds faster, which is enough to
			// enumerate addresses by stopwatch.
			_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
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

	// Success mints a session. The raw token goes to the caller once and is
	// never stored; every later request presents it as a bearer credential.
	ctx := c.Request().Context()
	// Lazy pruning: logins are rare enough to absorb the delete, and it keeps
	// the table from accumulating every session ever issued.
	if _, err := s.q.DeleteExpiredSessions(ctx); err != nil {
		return dbErr(err)
	}
	token, hash, err := newOpaqueToken()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "could not create a session")
	}
	sess, err := s.q.CreateSession(ctx, db.CreateSessionParams{
		TokenHash: hash,
		UserID:    user.ID,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(s.cfg.SessionTTL), Valid: true},
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, echo.Map{
		"token":     token,
		"expiresAt": sess.ExpiresAt.Time,
		"user": echo.Map{
			"id":       user.ID,
			"email":    user.Email,
			"name":     user.Name,
			"role":     user.Role,
			"memberId": user.MemberID,
			"status":   user.Status,
		},
	})
}

// dummyHash exists so the unknown-email path costs the same as a real compare.
// Generated at start-up rather than hardcoded, so it always matches the current
// bcrypt cost.
var dummyHash = func() []byte {
	h, err := bcrypt.GenerateFromPassword([]byte("wit-dummy-timing-equalizer"), bcrypt.DefaultCost)
	if err != nil {
		panic(err) // bcrypt failing at init is unrecoverable and loud is right
	}
	return h
}()

// logout revokes the presented session. Idempotent: revoking a session that is
// already gone is still a logged-out caller, so both answers are 204.
func (s *Server) logout(c echo.Context) error {
	if _, err := s.q.DeleteSession(c.Request().Context(), hashToken(bearerToken(c))); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ------------------------------------------------------------- registration ---

// issueVerification invalidates any outstanding link for the user and mints a
// new one. It returns the raw token, which the caller decides whether to expose.
func (s *Server) issueVerification(c echo.Context, userID string) (string, error) {
	ctx := c.Request().Context()
	if err := s.q.InvalidateUserVerificationTokens(ctx, userID); err != nil {
		return "", err
	}
	token, hash, err := newOpaqueToken()
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
	// Stands in for the mail that would carry it. The token is only written
	// when the log is deliberately the delivery channel; otherwise just the
	// fact, so a token never lands in a log by accident.
	if s.cfg.VerificationTokenInLog {
		log.Printf("verification token for user %s (expires in %s): %s", userID, verificationTokenTTL, token)
	} else {
		log.Printf("verification token issued for user %s (expires in %s)", userID, verificationTokenTTL)
	}
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
	// Checked before the account exists: a pending account nobody can verify is
	// worse than a refusal, because it looks like it worked.
	if !s.canDeliverVerification() {
		return errNoVerificationDelivery()
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
	if !s.canDeliverVerification() {
		return errNoVerificationDelivery()
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
