package e2e

import (
	"net/http"
	"testing"
)

// TestClientArchiveRestore proves archiving is a reversible hide: an archived
// client drops out of the active list, shows up under ?archived=true, and comes
// back whole on restore — with its subtree intact the whole time.
func TestClientArchiveRestore(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	client := h.expect(h.do("POST", "/api/v1/clients", admin, map[string]any{
		"name": "Archivable Co",
	}), http.StatusCreated, "create client")
	clientID := str(client.body, "id")
	// A project underneath, to prove the subtree survives the round trip.
	h.expect(h.do("POST", "/api/v1/projects", admin, map[string]any{
		"clientId": clientID, "name": "Kept Project",
	}), http.StatusCreated, "create project")

	inActive := func() bool {
		list := h.expect(h.do("GET", "/api/v1/clients?limit=1000", admin, nil),
			http.StatusOK, "list active")
		for _, raw := range list.list {
			if row, _ := raw.(map[string]any); str(row, "id") == clientID {
				return true
			}
		}
		return false
	}
	inArchived := func() bool {
		list := h.expect(h.do("GET", "/api/v1/clients?archived=true&limit=1000", admin, nil),
			http.StatusOK, "list archived")
		for _, raw := range list.list {
			if row, _ := raw.(map[string]any); str(row, "id") == clientID {
				return true
			}
		}
		return false
	}

	if !inActive() || inArchived() {
		t.Fatal("a fresh client should be active, not archived")
	}

	// Archive: leaves the active list, joins the archived list.
	h.expect(h.do("POST", "/api/v1/clients/"+clientID+"/archive", admin, nil),
		http.StatusNoContent, "archive")
	if inActive() {
		t.Error("an archived client must not appear in the active list")
	}
	if !inArchived() {
		t.Error("an archived client must appear under ?archived=true")
	}
	// Archiving again is idempotent, not an error.
	h.expect(h.do("POST", "/api/v1/clients/"+clientID+"/archive", admin, nil),
		http.StatusNoContent, "archive again")

	// The project underneath is untouched — archive did not cascade a delete.
	projects := h.expect(h.do("GET", "/api/v1/clients/"+clientID+"/projects", admin, nil),
		http.StatusOK, "projects still there")
	if len(projects.list) != 1 {
		t.Errorf("archiving must keep the subtree: got %d projects", len(projects.list))
	}

	// Restore: back to active, gone from archived.
	h.expect(h.do("POST", "/api/v1/clients/"+clientID+"/restore", admin, nil),
		http.StatusNoContent, "restore")
	if !inActive() || inArchived() {
		t.Error("a restored client should be active again")
	}

	// Archiving a client that does not exist is a 404, not a silent 204.
	h.expect(h.do("POST", "/api/v1/clients/does-not-exist/archive", admin, nil),
		http.StatusNotFound, "archive missing client")
}
