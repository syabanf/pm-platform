package e2e

import (
	"net/http"
	"testing"
)

// TestAuthLifecycle walks the whole account story: register, be refused until
// verified, verify, sign in, use the session, sign out, be refused again.
func TestAuthLifecycle(t *testing.T) {
	h := newHarness(t)

	// Register. Outside production the verification token rides the response,
	// which is what lets this test (and a developer) complete the loop.
	r := h.expect(h.do("POST", "/api/v1/auth/register", "", map[string]string{
		"email": "dina@example.com", "password": "correct-horse-battery", "name": "Dina",
	}), http.StatusCreated, "register")
	verifyToken := str(r.body, "verificationToken")
	if verifyToken == "" {
		t.Fatalf("register outside production must return the verification token: %s", r.raw)
	}

	// Login before verifying: refused, and told why.
	h.expect(h.do("POST", "/api/v1/auth/login", "", map[string]string{
		"email": "dina@example.com", "password": "correct-horse-battery",
	}), http.StatusForbidden, "login before verify")

	h.expect(h.do("POST", "/api/v1/auth/verify", "", map[string]string{
		"token": verifyToken,
	}), http.StatusOK, "verify")

	token := h.login("dina@example.com", "correct-horse-battery")

	// The session works.
	h.expect(h.do("GET", "/api/v1/clients", token, nil), http.StatusOK, "GET with session")

	// Logout revokes it immediately, and revoking twice is still signed out.
	h.expect(h.do("POST", "/api/v1/auth/logout", token, nil), http.StatusNoContent, "logout")
	h.expect(h.do("GET", "/api/v1/clients", token, nil), http.StatusUnauthorized, "GET after logout")
	h.expect(h.do("POST", "/api/v1/auth/logout", token, nil), http.StatusUnauthorized, "second logout")
}

// TestExpiredSessionIsRefused guards the one security property that lives
// entirely in a SQL clause (users.sql: "AND s.expires_at > now()"). requireAuth
// does no Go-side expiry check, so deleting that clause would keep every other
// test green while stale tokens kept working. This is the test that goes red.
func TestExpiredSessionIsRefused(t *testing.T) {
	h := newHarness(t)

	// A real login, then age its session into the past directly in the schema.
	token := h.adminToken()
	h.exec(t, "UPDATE sessions SET expires_at = now() - interval '1 hour'")

	h.expect(h.do("GET", "/api/v1/clients", token, nil),
		http.StatusUnauthorized, "expired session")
}

// TestAuthRefusals pins down what the door looks like from outside: no token,
// a fake token, and the same words for a wrong password as for a wrong email.
func TestAuthRefusals(t *testing.T) {
	h := newHarness(t)

	h.expect(h.do("GET", "/api/v1/clients", "", nil), http.StatusUnauthorized, "no token")
	h.expect(h.do("GET", "/api/v1/clients", "not-a-real-token", nil), http.StatusUnauthorized, "bogus token")

	wrongPassword := h.do("POST", "/api/v1/auth/login", "", map[string]string{
		"email": adminEmail, "password": "wrong",
	})
	unknownEmail := h.do("POST", "/api/v1/auth/login", "", map[string]string{
		"email": "nobody@example.com", "password": "wrong",
	})
	h.expect(wrongPassword, http.StatusUnauthorized, "wrong password")
	h.expect(unknownEmail, http.StatusUnauthorized, "unknown email")
	if string(wrongPassword.raw) != string(unknownEmail.raw) {
		t.Errorf("wrong-password and unknown-email answers differ, which confirms which emails exist:\n%s\n%s",
			wrongPassword.raw, unknownEmail.raw)
	}
}

// TestRBAC exercises the role policy through real accounts: a member reads but
// cannot write, and only an admin may even look at /users.
func TestRBAC(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	// An admin-created account; POST /users deliberately refuses a role field,
	// so this account is a plain member.
	h.expect(h.do("POST", "/api/v1/users", admin, map[string]string{
		"email": "member@example.com", "password": "member-password-1", "name": "Member",
	}), http.StatusCreated, "create member user")
	member := h.login("member@example.com", "member-password-1")

	// Reading: both may.
	h.expect(h.do("GET", "/api/v1/clients", admin, nil), http.StatusOK, "admin reads")
	h.expect(h.do("GET", "/api/v1/clients", member, nil), http.StatusOK, "member reads")

	// Writing: the member's role grants read only.
	h.expect(h.do("POST", "/api/v1/clients", admin, map[string]string{
		"name": "Aurora Steel",
	}), http.StatusCreated, "admin writes")
	h.expect(h.do("POST", "/api/v1/clients", member, map[string]string{
		"name": "Should Not Exist",
	}), http.StatusForbidden, "member write refused")

	// Accounts are admin territory, even to read.
	h.expect(h.do("GET", "/api/v1/users", member, nil), http.StatusForbidden, "member lists users")
	h.expect(h.do("POST", "/api/v1/users", member, map[string]string{
		"email": "x@example.com", "password": "xxxxxxxxxxxx", "name": "X",
	}), http.StatusForbidden, "member creates user")
	h.expect(h.do("GET", "/api/v1/users", admin, nil), http.StatusOK, "admin lists users")

	// A member can still log themselves out.
	h.expect(h.do("POST", "/api/v1/auth/logout", member, nil), http.StatusNoContent, "member logout")
}

// TestNoSelfPromotionViaRoles is the regression net for the escalation the
// review found: role and settings writes define authority, so they must be
// admin-only. Left at the write tier, a lead could PUT its own role to
// {"all":true} and be admin on the next request. GET /roles stays open so the
// role picker keeps working.
func TestNoSelfPromotionViaRoles(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	// A write-capable non-admin. Seed one directly: the API deliberately gives
	// every self-served account the 'member' role, and this test needs 'lead'.
	h.expect(h.do("POST", "/api/v1/users", admin, map[string]string{
		"email": "lead@example.com", "password": "lead-password-1", "name": "Lead",
	}), http.StatusCreated, "create user")
	h.exec(t, "UPDATE users SET role = 'lead' WHERE email = 'lead@example.com'")
	lead := h.login("lead@example.com", "lead-password-1")

	// The lead can write domain data...
	h.expect(h.do("POST", "/api/v1/clients", lead, map[string]any{"name": "Lead's Client"}),
		http.StatusCreated, "lead writes a client")

	// ...but not rewrite the authority model.
	h.expect(h.do("PUT", "/api/v1/roles", lead, map[string]any{
		"id": "lead", "label": "Delivery Lead", "permissions": map[string]bool{"all": true},
	}), http.StatusForbidden, "lead promotes itself via /roles")
	h.expect(h.do("PUT", "/api/v1/settings", lead, map[string]any{"settings": map[string]any{}}),
		http.StatusForbidden, "lead rewrites workspace settings")

	// The role really did not change: the lead still cannot reach /users.
	h.expect(h.do("GET", "/api/v1/users", lead, nil), http.StatusForbidden, "still not admin")

	// GET /roles stays available to any session — the picker reads it.
	h.expect(h.do("GET", "/api/v1/roles", lead, nil), http.StatusOK, "lead reads roles")

	// And an admin can still do both.
	h.expect(h.do("PUT", "/api/v1/roles", admin, map[string]any{
		"id": "observer", "label": "Observer", "permissions": map[string]bool{"read": true},
	}), http.StatusOK, "admin writes a role")
}
