package e2e

import (
	"fmt"
	"net/http"
	"testing"
)

// TestPagination proves the limit/offset contract on a list big enough to
// matter: the page is the size asked for, X-Has-More says whether another page
// exists, and the last page says so by its absence.
func TestPagination(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	for i := 0; i < 7; i++ {
		h.expect(h.do("POST", "/api/v1/clients", admin, map[string]any{
			"name": fmt.Sprintf("Client %02d", i),
		}), http.StatusCreated, "seed client")
	}

	first := h.expect(h.do("GET", "/api/v1/clients?limit=3", admin, nil),
		http.StatusOK, "first page")
	if len(first.list) != 3 {
		t.Fatalf("limit=3 returned %d rows", len(first.list))
	}
	if first.headers.Get("X-Has-More") != "true" {
		t.Errorf("first of 7 with limit 3 must say X-Has-More: true")
	}

	last := h.expect(h.do("GET", "/api/v1/clients?limit=3&offset=6", admin, nil),
		http.StatusOK, "last page")
	if len(last.list) != 1 {
		t.Fatalf("offset=6 of 7 should hold 1 row, got %d", len(last.list))
	}
	if last.headers.Get("X-Has-More") == "true" {
		t.Errorf("the last page must not claim more")
	}

	// The ceiling is enforced, not silently obeyed.
	over := h.do("GET", "/api/v1/clients?limit=99999", admin, nil)
	if over.status != http.StatusBadRequest {
		t.Errorf("limit over the maximum should be refused with 400, got %d", over.status)
	}
}

// TestValidation505s is the "no 500 for bad input" sweep: garbage in the body
// or the query string is the caller's mistake and must be said so.
func TestValidationRefusals(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	cases := []struct {
		name         string
		method, path string
		payload      any
	}{
		{"client without a name", "POST", "/api/v1/clients", map[string]any{"industry": "x"}},
		{"project without clientId", "POST", "/api/v1/projects", map[string]any{"name": "P"}},
		{"module under missing project", "POST", "/api/v1/modules",
			map[string]any{"projectId": "prj-does-not-exist", "name": "M"}},
		{"negative limit", "GET", "/api/v1/clients?limit=-1", nil},
		{"non-numeric offset", "GET", "/api/v1/clients?offset=banana", nil},
	}
	for _, tc := range cases {
		r := h.do(tc.method, tc.path, admin, tc.payload)
		if r.status >= 500 {
			t.Errorf("%s: answered %d — a caller mistake must never be a server error: %s",
				tc.name, r.status, r.raw)
		}
		if r.status < 400 {
			t.Errorf("%s: answered %d — this input should have been refused", tc.name, r.status)
		}
	}
}
