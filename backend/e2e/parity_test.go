package e2e

import (
	"net/http"
	"strings"
	"testing"
)

// DATE columns come back as RFC 3339 midnight, like every other date here.
func dateIs(got, want string) bool { return strings.HasPrefix(got, want) }

// TestProjectStartDateDefaultsToToday: a project files under the year it
// starts, so the column is required and an omitted date means today.
func TestProjectStartDate(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	client := h.expect(h.do("POST", "/api/v1/clients", admin, map[string]any{"name": "C"}),
		http.StatusCreated, "client")
	clientID := str(client.body, "id")

	dated := h.expect(h.do("POST", "/api/v1/projects", admin, map[string]any{
		"clientId": clientID, "name": "P", "startDate": "2025-03-01",
	}), http.StatusCreated, "dated project")
	if got := str(dated.body, "startDate"); !dateIs(got, "2025-03-01") {
		t.Errorf("startDate should round-trip as a date, got %q", got)
	}
	undated := h.expect(h.do("POST", "/api/v1/projects", admin, map[string]any{
		"clientId": clientID, "name": "Q",
	}), http.StatusCreated, "undated project")
	if got := str(undated.body, "startDate"); len(got) < 10 {
		t.Errorf("omitted startDate should default to today, got %q", got)
	}
	moved := h.expect(h.do("PATCH", "/api/v1/projects/"+str(dated.body, "id"), admin,
		map[string]any{"startDate": "2026-01-15"}), http.StatusOK, "move start")
	if got := str(moved.body, "startDate"); !dateIs(got, "2026-01-15") {
		t.Errorf("patch should move startDate, got %q", got)
	}
	h.expect(h.do("PATCH", "/api/v1/projects/"+str(dated.body, "id"), admin,
		map[string]any{"startDate": "not a date"}), http.StatusBadRequest, "bad date")
}

// TestTaskBlockersAndDueDate pins the task fields the board and calendar read:
// a list of blockers that replaces as a whole, and a due date.
func TestTaskBlockersAndDueDate(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, itemID, _ := scaffoldSprint(h, admin)

	created := h.expect(h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "T", "dueDate": "2026-10-30",
		"blockers": []map[string]any{{"id": "b1", "category": "Waiting on client", "text": "Sign-off", "days": 2}},
	}), http.StatusCreated, "task with blockers")
	blockers, _ := created.body["blockers"].([]any)
	if len(blockers) != 1 {
		t.Fatalf("blockers should round-trip, got %v", created.body["blockers"])
	}
	if got := str(created.body, "dueDate"); !dateIs(got, "2026-10-30") {
		t.Errorf("dueDate should round-trip, got %q", got)
	}

	bare := h.expect(h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "U",
	}), http.StatusCreated, "task without blockers")
	if got, ok := bare.body["blockers"].([]any); !ok || len(got) != 0 {
		t.Errorf("omitted blockers should be an empty list, got %v", bare.body["blockers"])
	}
	if bare.body["dueDate"] != nil {
		t.Errorf("omitted dueDate should be null, got %v", bare.body["dueDate"])
	}

	id := str(created.body, "id")
	renamed := h.expect(h.do("PATCH", "/api/v1/tasks/"+id, admin, map[string]any{"title": "T2"}),
		http.StatusOK, "rename")
	if got, _ := renamed.body["blockers"].([]any); len(got) != 1 {
		t.Errorf("a patch without blockers should keep them, got %v", renamed.body["blockers"])
	}
	cleared := h.expect(h.do("PATCH", "/api/v1/tasks/"+id, admin, map[string]any{"blockers": []any{}}),
		http.StatusOK, "clear blockers")
	if got, _ := cleared.body["blockers"].([]any); len(got) != 0 {
		t.Errorf("an empty list should clear blockers, got %v", cleared.body["blockers"])
	}
}

// TestMasterListsRenameAndReadAll pins the two new list operations: every
// list in one response, and a rename that refuses to land on an existing value.
func TestMasterListsRenameAndReadAll(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	all := h.expect(h.do("GET", "/api/v1/lists", admin, nil), http.StatusOK, "all lists")
	industries, _ := all.body["industries"].([]any)
	if len(industries) == 0 || industries[0] != "Manufacturing" {
		t.Fatalf("industries should be seeded in position order, got %v", all.body["industries"])
	}
	if _, old := all.body["industry"]; old {
		t.Errorf("the old 'industry' key should be gone")
	}

	renamed := h.expect(h.do("PATCH", "/api/v1/lists/industries/Retail", admin,
		map[string]any{"value": "Retail & FMCG"}), http.StatusOK, "rename")
	if str(renamed.body, "value") != "Retail & FMCG" {
		t.Errorf("rename should return the new value, got %v", renamed.body)
	}
	h.expect(h.do("PATCH", "/api/v1/lists/industries/Banking", admin,
		map[string]any{"value": "Automotive"}), http.StatusConflict, "rename onto existing")
	h.expect(h.do("PATCH", "/api/v1/lists/industries/Nope", admin,
		map[string]any{"value": "X"}), http.StatusNotFound, "rename missing")
	h.expect(h.do("PATCH", "/api/v1/lists/industries/Banking", admin,
		map[string]any{"value": ""}), http.StatusBadRequest, "rename to empty")
}

// TestReportTemplateSectionsAreObjects: a section carries its title, flag,
// prose and block, and the migration turned the seeded titles into that shape.
func TestReportTemplateSectionsAreObjects(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	list := h.expect(h.do("GET", "/api/v1/report-templates", admin, nil), http.StatusOK, "list")
	var seeded map[string]any
	for _, raw := range list.list {
		row, _ := raw.(map[string]any)
		if row["id"] == "tpl-sprint" {
			seeded = row
		}
	}
	if seeded == nil {
		t.Fatalf("seeded template missing: %s", list.raw)
	}
	sections, _ := seeded["sections"].([]any)
	first, _ := sections[0].(map[string]any)
	if first["title"] != "Goal" || first["enabled"] != true || first["id"] != "goal" {
		t.Errorf("migrated section should be an enabled object, got %v", first)
	}

	saved := h.expect(h.do("PUT", "/api/v1/report-templates", admin, map[string]any{
		"name": "Weekly", "frequency": "Weekly", "formats": []string{"PDF"},
		"sections": []map[string]any{{"id": "s1", "title": "Summary", "enabled": true, "body": "{{sprint.goal}}", "autoBlock": ""}},
	}), http.StatusOK, "upsert")
	if saved.body["frequency"] != "Weekly" {
		t.Errorf("frequency should persist, got %v", saved.body["frequency"])
	}
	formats, _ := saved.body["formats"].([]any)
	if len(formats) != 1 || formats[0] != "PDF" {
		t.Errorf("formats should persist, got %v", saved.body["formats"])
	}
	got, _ := saved.body["sections"].([]any)
	sec, _ := got[0].(map[string]any)
	if sec["body"] != "{{sprint.goal}}" {
		t.Errorf("section body should persist, got %v", saved.body["sections"])
	}
}
