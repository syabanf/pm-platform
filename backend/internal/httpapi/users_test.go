package httpapi

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// TestPasswordHashNeverSerialised is the guarantee that matters most here: a
// bcrypt hash is not a secret you can rotate quietly, so it must not be able to
// reach a response. sqlc generates a struct per query, and only the auth query
// selects the column — this fails if a future query adds it to something the
// handlers marshal.
func TestPasswordHashNeverSerialised(t *testing.T) {
	src, err := os.ReadFile("../db/users.sql.go")
	if err != nil {
		t.Fatalf("reading generated users queries: %v", err)
	}

	// Row types are what handlers return; Params types are inputs and may
	// legitimately carry the hash.
	structRe := regexp.MustCompile(`(?s)type (\w+) struct \{(.*?)\n\}`)
	for _, m := range structRe.FindAllStringSubmatch(string(src), -1) {
		name, body := m[1], m[2]
		if !strings.HasSuffix(name, "Row") {
			continue
		}
		if !strings.Contains(body, "PasswordHash") {
			continue
		}
		// GetUserForAuth is the one exception, and it is never written to a
		// client — the login handler reads the field and returns its own map.
		if name == "GetUserForAuthRow" {
			continue
		}
		t.Errorf("%s carries PasswordHash and could be serialised into a response", name)
	}
}

// TestVerificationTokenIsHashed guards the other half: the token in the mail
// must not be recoverable from the table. The handler stores sha256(token), so
// a leaked database cannot be used to verify anyone's address.
func TestVerificationTokenIsHashed(t *testing.T) {
	src, err := os.ReadFile("routes_users.go")
	if err != nil {
		t.Fatalf("reading user routes: %v", err)
	}
	body := string(src)

	if !strings.Contains(body, "sha256.Sum256") {
		t.Error("verification tokens are expected to be stored as a sha256 hash")
	}
	// The raw token may only travel into the response body; it must never be a
	// value handed to CreateVerificationToken.
	createCall := regexp.MustCompile(`(?s)CreateVerificationTokenParams\{(.*?)\}`).FindStringSubmatch(body)
	if createCall == nil {
		t.Fatal("could not find the CreateVerificationToken call")
	}
	if !strings.Contains(createCall[1], "TokenHash: hash") {
		t.Errorf("CreateVerificationToken should store the hash, got: %s", createCall[1])
	}
}

// TestLoginDoesNotDistinguishUnknownEmail keeps the login path from becoming an
// account-enumeration oracle: an unknown address and a wrong password have to
// produce the same answer.
func TestLoginDoesNotDistinguishUnknownEmail(t *testing.T) {
	src, err := os.ReadFile("routes_users.go")
	if err != nil {
		t.Fatalf("reading user routes: %v", err)
	}
	login := regexp.MustCompile(`(?s)func \(s \*Server\) login\(.*?\n\}`).FindString(string(src))
	if login == "" {
		t.Fatal("could not find the login handler")
	}
	if strings.Count(login, `"invalid email or password"`) != 2 {
		t.Error("login should answer identically for an unknown email and a wrong password")
	}
}
