package e2e

import (
	"net/http"
	"testing"
)

// TestReviewRecordsFilterBySprint pins the four retro/review resources: each
// creates under a sprint, lists for one sprint or for all, updates partially,
// and deletes with a 404 for a second delete.
func TestReviewRecordsFilterBySprint(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintA, _, memberID := scaffoldSprint(h, admin)
	moduleID := str(h.expect(h.do("GET", "/api/v1/sprints/"+sprintA, admin, nil),
		http.StatusOK, "sprint A").body, "moduleId")
	sprintB := str(h.expect(h.do("POST", "/api/v1/modules/"+moduleID+"/sprints", admin,
		map[string]any{"name": "S2", "goal": "g"}), http.StatusCreated, "sprint B").body, "id")

	resources := []struct {
		path   string
		create map[string]any
		patch  map[string]any
		field  string
		want   any
	}{
		{"/api/v1/retro-notes",
			map[string]any{"kind": "needs-improvement", "text": "Standups ran long"},
			map[string]any{"kind": "went-well"}, "kind", "went-well"},
		{"/api/v1/retro-actions",
			map[string]any{"action": "Timebox standups", "ownerId": memberID, "due": "2026-11-01"},
			map[string]any{"status": "done"}, "status", "done"},
		{"/api/v1/demo-items",
			map[string]any{"label": "Show the export job"},
			map[string]any{"done": true}, "done", true},
		{"/api/v1/client-feedback",
			map[string]any{"from": "Budi", "note": "Needs the Excel export", "disposition": "Next sprint"},
			map[string]any{"disposition": "Done"}, "disposition", "Done"},
	}

	for _, r := range resources {
		inA := map[string]any{"sprintId": sprintA}
		inB := map[string]any{"sprintId": sprintB}
		for k, v := range r.create {
			inA[k], inB[k] = v, v
		}
		created := h.expect(h.do("POST", r.path, admin, inA), http.StatusCreated, "create in A "+r.path)
		h.expect(h.do("POST", r.path, admin, inB), http.StatusCreated, "create in B "+r.path)

		h.expect(h.do("POST", r.path, admin, r.create), http.StatusBadRequest, "no sprintId "+r.path)

		onlyA := h.expect(h.do("GET", r.path+"?sprintId="+sprintA, admin, nil), http.StatusOK, "list A "+r.path)
		if len(onlyA.list) != 1 {
			t.Errorf("%s: sprint filter should return 1 row, got %d: %s", r.path, len(onlyA.list), onlyA.raw)
		}
		all := h.expect(h.do("GET", r.path, admin, nil), http.StatusOK, "list all "+r.path)
		if len(all.list) != 2 {
			t.Errorf("%s: unfiltered list should return 2 rows, got %d", r.path, len(all.list))
		}

		id := str(created.body, "id")
		updated := h.expect(h.do("PATCH", r.path+"/"+id, admin, r.patch), http.StatusOK, "patch "+r.path)
		if updated.body[r.field] != r.want {
			t.Errorf("%s: patch should set %s=%v, got %v", r.path, r.field, r.want, updated.body[r.field])
		}
		for k, v := range r.create {
			if k == r.field || k == "from" {
				continue
			}
			if updated.body[k] != v && k != "due" {
				t.Errorf("%s: patch should leave %s=%v, got %v", r.path, k, v, updated.body[k])
			}
		}

		h.expect(h.do("DELETE", r.path+"/"+id, admin, nil), http.StatusNoContent, "delete "+r.path)
		h.expect(h.do("DELETE", r.path+"/"+id, admin, nil), http.StatusNotFound, "delete again "+r.path)
	}
}

// TestClientFeedbackFromName pins the one renamed field: the request says
// `from`, the row says `fromName`, because FROM is a reserved word.
func TestClientFeedbackFromName(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, _, _ := scaffoldSprint(h, admin)
	row := h.expect(h.do("POST", "/api/v1/client-feedback", admin, map[string]any{
		"sprintId": sprintID, "from": "Budi", "note": "n",
	}), http.StatusCreated, "create feedback")
	if row.body["fromName"] != "Budi" {
		t.Errorf("fromName should carry the request's from, got %v", row.body["fromName"])
	}
}

// TestDeletingSprintTakesItsReviewRecords: the records belong to the sprint,
// so they go with it.
func TestDeletingSprintTakesItsReviewRecords(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, _, _ := scaffoldSprint(h, admin)
	h.expect(h.do("POST", "/api/v1/demo-items", admin, map[string]any{
		"sprintId": sprintID, "label": "x",
	}), http.StatusCreated, "create demo item")
	h.expect(h.do("DELETE", "/api/v1/sprints/"+sprintID, admin, nil), http.StatusNoContent, "delete sprint")
	left := h.expect(h.do("GET", "/api/v1/demo-items?sprintId="+sprintID, admin, nil), http.StatusOK, "list")
	if len(left.list) != 0 {
		t.Errorf("demo items should go with their sprint, %d left", len(left.list))
	}
}
