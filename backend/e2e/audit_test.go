package e2e

import (
	"net/http"
	"testing"
)

// TestAuditTrail proves the middleware records who changed what: a create and a
// delete both land in the log, attributed to the actor, and the log can be
// filtered to one target. Also that the log is admin-only.
func TestAuditTrail(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	// A mutation to record.
	client := h.expect(h.do("POST", "/api/v1/clients", admin, map[string]any{
		"name": "Audited Co",
	}), http.StatusCreated, "create client")
	clientID := str(client.body, "id")

	// The create is in the log, attributed to the admin, with the created id.
	log := h.expect(h.do("GET", "/api/v1/activity", admin, nil), http.StatusOK, "list activity")
	if len(log.list) == 0 {
		t.Fatalf("the create should have been logged: %s", log.raw)
	}
	var sawCreate bool
	for _, raw := range log.list {
		row, _ := raw.(map[string]any)
		if row["action"] == "create" && row["targetKind"] == "clients" && row["targetId"] == clientID {
			if row["actorEmail"] != adminEmail {
				t.Errorf("create logged under the wrong actor: %v", row["actorEmail"])
			}
			sawCreate = true
		}
	}
	if !sawCreate {
		t.Errorf("no create entry for the new client in %s", log.raw)
	}

	// Delete it, then confirm the delete is logged too, and the per-target
	// filter finds exactly this client's two entries (create + delete).
	h.expect(h.do("DELETE", "/api/v1/clients/"+clientID, admin, nil),
		http.StatusNoContent, "delete client")
	filtered := h.expect(h.do("GET",
		"/api/v1/activity?targetKind=clients&targetId="+clientID, admin, nil),
		http.StatusOK, "activity for target")
	if len(filtered.list) != 2 {
		t.Fatalf("expected create + delete for this client, got %d: %s",
			len(filtered.list), filtered.raw)
	}

	// Reads are not logged — only mutations.
	before := len(h.do("GET", "/api/v1/activity", admin, nil).list)
	h.do("GET", "/api/v1/clients", admin, nil)
	after := len(h.do("GET", "/api/v1/activity", admin, nil).list)
	if after != before {
		t.Errorf("a GET should not add a log entry: before=%d after=%d", before, after)
	}
}

// TestAuditLogIsAdminOnly keeps the log off a member's screen — it names people.
func TestAuditLogIsAdminOnly(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	h.expect(h.do("POST", "/api/v1/users", admin, map[string]string{
		"email": "auditor@example.com", "password": "member-pass-123", "name": "Auditor",
	}), http.StatusCreated, "create member")
	member := h.login("auditor@example.com", "member-pass-123")

	h.expect(h.do("GET", "/api/v1/activity", member, nil), http.StatusForbidden, "member reads log")
	h.expect(h.do("GET", "/api/v1/activity", admin, nil), http.StatusOK, "admin reads log")
}
