package e2e

import (
	"net/http"
	"testing"
)

// TestPasswordReset walks the whole forgotten-password loop: request a token,
// use it to set a new password, and confirm the old one no longer works and the
// new one does. Also that the token is single-use.
func TestPasswordReset(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	// A member account to reset (the admin is bootstrap-only).
	h.expect(h.do("POST", "/api/v1/users", admin, map[string]string{
		"email": "reset-me@example.com", "password": "original-password", "name": "Reset Me",
	}), http.StatusCreated, "create user")

	// Request a reset. Dev returns the token in the response.
	forgot := h.expect(h.do("POST", "/api/v1/auth/forgot-password", "", map[string]string{
		"email": "reset-me@example.com",
	}), http.StatusOK, "forgot-password")
	token := str(forgot.body, "resetToken")
	if token == "" {
		t.Fatalf("dev forgot-password must return the reset token: %s", forgot.raw)
	}

	// Unknown address answers 200 too, with no token — no account enumeration.
	unknown := h.expect(h.do("POST", "/api/v1/auth/forgot-password", "", map[string]string{
		"email": "nobody@example.com",
	}), http.StatusOK, "forgot unknown")
	if str(unknown.body, "resetToken") != "" {
		t.Errorf("an unknown address must not get a token: %s", unknown.raw)
	}

	// Reset with the token.
	h.expect(h.do("POST", "/api/v1/auth/reset-password", "", map[string]string{
		"token": token, "password": "brand-new-password",
	}), http.StatusOK, "reset-password")

	// Old password fails, new one works.
	h.expect(h.do("POST", "/api/v1/auth/login", "", map[string]string{
		"email": "reset-me@example.com", "password": "original-password",
	}), http.StatusUnauthorized, "old password rejected")
	h.login("reset-me@example.com", "brand-new-password")

	// The token is single-use.
	h.expect(h.do("POST", "/api/v1/auth/reset-password", "", map[string]string{
		"token": token, "password": "another-password",
	}), http.StatusBadRequest, "token reused")
}

// TestResetRevokesSessions proves a reset is a clean slate: an existing session
// dies the moment the password changes, so a stolen token cannot ride past it.
func TestResetRevokesSessions(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	h.expect(h.do("POST", "/api/v1/users", admin, map[string]string{
		"email": "sessions@example.com", "password": "first-password", "name": "S",
	}), http.StatusCreated, "create user")

	token := h.login("sessions@example.com", "first-password")
	h.expect(h.do("GET", "/api/v1/clients", token, nil), http.StatusOK, "session works")

	forgot := h.do("POST", "/api/v1/auth/forgot-password", "", map[string]string{"email": "sessions@example.com"})
	h.expect(h.do("POST", "/api/v1/auth/reset-password", "", map[string]string{
		"token": str(forgot.body, "resetToken"), "password": "second-password",
	}), http.StatusOK, "reset")

	// The session from before the reset is dead.
	h.expect(h.do("GET", "/api/v1/clients", token, nil), http.StatusUnauthorized, "old session revoked")
}

// TestLogoutAll revokes every session at once. Two sessions, one logout-all,
// both gone.
func TestLogoutAll(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	h.expect(h.do("POST", "/api/v1/users", admin, map[string]string{
		"email": "multi@example.com", "password": "the-password-1", "name": "Multi",
	}), http.StatusCreated, "create user")

	a := h.login("multi@example.com", "the-password-1")
	b := h.login("multi@example.com", "the-password-1")
	h.expect(h.do("GET", "/api/v1/clients", a, nil), http.StatusOK, "session a works")
	h.expect(h.do("GET", "/api/v1/clients", b, nil), http.StatusOK, "session b works")

	// Sign out everywhere from one of them.
	h.expect(h.do("POST", "/api/v1/auth/logout-all", a, nil), http.StatusNoContent, "logout-all")

	h.expect(h.do("GET", "/api/v1/clients", a, nil), http.StatusUnauthorized, "session a gone")
	h.expect(h.do("GET", "/api/v1/clients", b, nil), http.StatusUnauthorized, "session b gone")
}

// TestAccountLockout locks an account after enough wrong passwords and refuses
// even the right one while locked — the persistent guard the in-memory IP
// limiter cannot provide. LOGIN_MAX_FAILURES defaults to 10.
func TestAccountLockout(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	h.expect(h.do("POST", "/api/v1/users", admin, map[string]string{
		"email": "lockme@example.com", "password": "correct-password", "name": "Lock",
	}), http.StatusCreated, "create user")

	// Ten wrong passwords → locked. Each is a 401 until the lock trips.
	for i := 0; i < 10; i++ {
		h.do("POST", "/api/v1/auth/login", "", map[string]string{
			"email": "lockme@example.com", "password": "wrong",
		})
	}

	// Now even the correct password is refused with 429, not 401 — the lock is
	// checked before the password.
	locked := h.do("POST", "/api/v1/auth/login", "", map[string]string{
		"email": "lockme@example.com", "password": "correct-password",
	})
	if locked.status != http.StatusTooManyRequests {
		t.Fatalf("a locked account must answer 429 even to the right password, got %d: %s",
			locked.status, locked.raw)
	}
}

// TestLockResetsAfterExpiry is the regression for the sustained-lockout DoS: a
// lock that has expired resets the failure streak, so one wrong attempt after
// the window does not immediately re-lock. The right password then works.
func TestLockResetsAfterExpiry(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	h.expect(h.do("POST", "/api/v1/users", admin, map[string]string{
		"email": "expiry@example.com", "password": "correct-password", "name": "Exp",
	}), http.StatusCreated, "create user")

	// Lock it with ten wrong passwords.
	for i := 0; i < 10; i++ {
		h.do("POST", "/api/v1/auth/login", "", map[string]string{
			"email": "expiry@example.com", "password": "wrong",
		})
	}
	// Confirm it is locked.
	h.expect(h.do("POST", "/api/v1/auth/login", "", map[string]string{
		"email": "expiry@example.com", "password": "correct-password",
	}), http.StatusTooManyRequests, "locked")

	// Fast-forward: expire the lock directly.
	h.exec(t, "UPDATE users SET locked_until = now() - interval '1 minute' WHERE email = 'expiry@example.com'")

	// One more wrong attempt: resets the streak to 1, must NOT re-lock (401, not 429).
	after := h.do("POST", "/api/v1/auth/login", "", map[string]string{
		"email": "expiry@example.com", "password": "wrong",
	})
	if after.status != http.StatusUnauthorized {
		t.Fatalf("an expired lock must reset the streak, not re-lock on one attempt: got %d %s",
			after.status, after.raw)
	}
	// And the correct password now works — the account is not stuck locked.
	h.login("expiry@example.com", "correct-password")
}
