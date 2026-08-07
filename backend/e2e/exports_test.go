package e2e

import (
	"encoding/csv"
	"net/http"
	"strings"
	"testing"
)

// TestClientCsvExport checks the export is real CSV — right header, a row per
// client, and a value containing a comma correctly quoted rather than splitting
// the row. That quoting is the whole reason to use encoding/csv over hand-joined
// commas.
func TestClientCsvExport(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	// A name with a comma in it — the case that breaks naive CSV.
	h.expect(h.do("POST", "/api/v1/clients", admin, map[string]any{
		"name": "Acme, Inc.", "industry": "Widgets",
	}), http.StatusCreated, "create client")

	r := h.do("GET", "/api/v1/clients/export.csv", admin, nil)
	if r.status != http.StatusOK {
		t.Fatalf("export: got %d: %s", r.status, r.raw)
	}
	if ct := r.headers.Get("Content-Type"); !strings.HasPrefix(ct, "text/csv") {
		t.Errorf("Content-Type should be text/csv, got %q", ct)
	}
	if cd := r.headers.Get("Content-Disposition"); !strings.Contains(cd, "clients.csv") {
		t.Errorf("Content-Disposition should name clients.csv, got %q", cd)
	}

	// Parse it back with a real CSV reader — the comma-bearing name must round-trip
	// as a single field, proving it was quoted, not split.
	records, err := csv.NewReader(strings.NewReader(string(r.raw))).ReadAll()
	if err != nil {
		t.Fatalf("export is not valid CSV: %v\n%s", err, r.raw)
	}
	if len(records) < 2 {
		t.Fatalf("expected a header and at least one row, got %d", len(records))
	}
	if records[0][1] != "name" {
		t.Errorf("second column should be 'name', got %q", records[0][1])
	}
	var found bool
	for _, row := range records[1:] {
		if row[1] == "Acme, Inc." {
			found = true
		}
	}
	if !found {
		t.Errorf("the comma-bearing name did not round-trip as one field: %s", r.raw)
	}
}

// TestModuleTasksCsvExport exports a module's tasks and 404s a missing module.
func TestModuleTasksCsvExport(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, itemID, _ := scaffoldSprint(h, admin)
	h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "Exported task",
	})
	sprint := h.expect(h.do("GET", "/api/v1/sprints/"+sprintID, admin, nil), http.StatusOK, "get sprint")
	moduleID := str(sprint.body, "moduleId")

	r := h.do("GET", "/api/v1/modules/"+moduleID+"/tasks/export.csv", admin, nil)
	if r.status != http.StatusOK {
		t.Fatalf("tasks export: got %d: %s", r.status, r.raw)
	}
	records, err := csv.NewReader(strings.NewReader(string(r.raw))).ReadAll()
	if err != nil {
		t.Fatalf("not valid CSV: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("header + one task expected, got %d rows: %s", len(records), r.raw)
	}
	if records[1][2] != "Exported task" {
		t.Errorf("the task title should be in the third column, got %q", records[1][2])
	}

	// A missing module 404s rather than streaming an empty 200.
	h.expect(h.do("GET", "/api/v1/modules/nope/tasks/export.csv", admin, nil),
		http.StatusNotFound, "export missing module")
}
