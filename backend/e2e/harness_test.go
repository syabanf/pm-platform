// Package e2e exercises the real HTTP server against a real Postgres.
//
// Nothing here is mocked: requests go through Echo, the middleware stack, the
// handlers, sqlc and pgx to an actual database. What makes that safe to run
// anywhere is the schema trick — each run creates a throwaway schema, pins the
// pool's search_path to it, applies the genuine migration files, and drops the
// schema afterwards. The database it points at is left exactly as found, so
// TEST_DATABASE_URL can be a shared dev database without anyone noticing.
//
// The suite skips politely when TEST_DATABASE_URL is unset, so `go test ./...`
// stays green on a machine with no Postgres.
package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/syabanf/pm-platform/backend/internal/config"
	"github.com/syabanf/pm-platform/backend/internal/httpapi"
)

// bootstrap credentials seeded by migration 000005. Not a secret: the hash is
// in the repo, and every environment is told to rotate it before real use.
const (
	adminEmail    = "admin@wit.id"
	adminPassword = "wit-admin-changeme"
)

type harness struct {
	t      *testing.T
	base   string
	client *http.Client
	pool   *pgxpool.Pool
}

// exec runs one statement against the test schema — the escape hatch for
// setting up state the API deliberately will not, like an expired session.
func (h *harness) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := h.pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("exec %q: %v", sql, err)
	}
}

// newHarness boots the full stack on a throwaway schema and returns a client
// for it. Each call is a fresh, isolated database state.
func newHarness(t *testing.T) *harness {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set — e2e needs a real Postgres")
	}

	schema := fmt.Sprintf("e2e_%d", time.Now().UnixNano())
	ctx := context.Background()

	// One plain connection owns the schema's lifecycle.
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("connecting to %s: %v", dsn, err)
	}
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatalf("creating schema: %v", err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
		_ = admin.Close(context.Background())
	})

	// Apply the real migration files, in order, inside the schema. The files
	// never schema-qualify a name, which is what makes this possible.
	if _, err := admin.Exec(ctx, "SET search_path = "+schema); err != nil {
		t.Fatalf("search_path: %v", err)
	}
	migrations, err := filepath.Glob("../migrations/*.up.sql")
	if err != nil || len(migrations) == 0 {
		t.Fatalf("no migrations found: %v", err)
	}
	sort.Strings(migrations)
	for _, m := range migrations {
		body, err := os.ReadFile(m)
		if err != nil {
			t.Fatalf("reading %s: %v", m, err)
		}
		if _, err := admin.Exec(ctx, string(body)); err != nil {
			t.Fatalf("applying %s: %v", filepath.Base(m), err)
		}
	}

	// The server's pool lives in the same schema. Timeouts mirror production's
	// shape but with room for a laptop under load; the rate limits are high
	// because a test suite is exactly the traffic they exist to refuse.
	pcfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("parsing dsn: %v", err)
	}
	pcfg.ConnConfig.RuntimeParams["search_path"] = schema
	pcfg.ConnConfig.RuntimeParams["statement_timeout"] = "10000"
	pcfg.ConnConfig.RuntimeParams["lock_timeout"] = "5000"
	pcfg.MaxConns = 8
	pool, err := pgxpool.NewWithConfig(ctx, pcfg)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)

	cfg := config.Config{
		Env:               "development", // register returns the token; no mailer needed
		DatabaseURL:       dsn,
		CORSOrigins:       "http://localhost:3000",
		RequestTimeout:    20 * time.Second,
		DeleteTimeout:     60 * time.Second,
		MaxBodySize:       "1M",
		SessionTTL:        time.Hour,
		RateLimitRPS:      10000,
		RateLimitBurst:    10000,
		LoginRatePerMin:   100000,
		LoginMaxFailures:  10,
		LoginLockDuration: 15 * time.Minute,
	}
	srv := httptest.NewServer(httpapi.NewServer(cfg, pool))
	t.Cleanup(srv.Close)

	return &harness{t: t, base: srv.URL, client: srv.Client(), pool: pool}
}

// resp is what every call comes back as: the status, the decoded body when it
// was JSON, and the raw bytes for when a test wants the exact words.
type resp struct {
	status  int
	body    map[string]any
	list    []any
	raw     []byte
	headers http.Header
}

// do performs one request. token "" sends no Authorization header.
func (h *harness) do(method, path, token string, payload any) resp {
	h.t.Helper()
	var body io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			h.t.Fatalf("marshalling %v: %v", payload, err)
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, h.base+path, body)
	if err != nil {
		h.t.Fatalf("building %s %s: %v", method, path, err)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := h.client.Do(req)
	if err != nil {
		h.t.Fatalf("%s %s: %v", method, path, err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)

	out := resp{status: res.StatusCode, raw: raw, headers: res.Header}
	if len(raw) > 0 {
		var m map[string]any
		if json.Unmarshal(raw, &m) == nil {
			out.body = m
		} else {
			var l []any
			if json.Unmarshal(raw, &l) == nil {
				out.list = l
			}
		}
	}
	return out
}

// expect asserts the status and fails with the body in view, because a bare
// "got 500" teaches nobody anything.
func (h *harness) expect(r resp, status int, what string) resp {
	h.t.Helper()
	if r.status != status {
		h.t.Fatalf("%s: got %d, want %d — body: %s", what, r.status, status, r.raw)
	}
	return r
}

// login signs in and returns the bearer token.
func (h *harness) login(email, password string) string {
	h.t.Helper()
	r := h.expect(h.do("POST", "/api/v1/auth/login", "", map[string]string{
		"email": email, "password": password,
	}), http.StatusOK, "login "+email)
	token, _ := r.body["token"].(string)
	if token == "" {
		h.t.Fatalf("login %s returned no token: %s", email, r.raw)
	}
	return token
}

// adminToken is the session most tests act under.
func (h *harness) adminToken() string {
	return h.login(adminEmail, adminPassword)
}

// str reads a string field out of a decoded body, tolerating absence.
func str(m map[string]any, key string) string {
	s, _ := m[key].(string)
	return s
}
