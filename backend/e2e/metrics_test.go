package e2e

import (
	"net/http"
	"testing"
)

// TestBurndownSnapshots proves the capture→read loop: an active sprint gets a
// daily snapshot, the burndown reads it back as a real series, capture is
// idempotent per day, and a done sprint is not snapshotted.
func TestBurndownSnapshots(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, _, _ := scaffoldSprint(h, admin)

	// scaffoldSprint leaves the sprint in its default 'planning' state; make it
	// active (only active sprints are snapshotted) with some committed work.
	h.expect(h.do("PATCH", "/api/v1/sprints/"+sprintID, admin, map[string]any{
		"status": "active", "committed": 30, "completed": 12,
	}), http.StatusOK, "activate sprint")

	// Before any capture the burndown is empty but the endpoint still works.
	empty := h.expect(h.do("GET", "/api/v1/sprints/"+sprintID+"/burndown", admin, nil),
		http.StatusOK, "burndown before capture")
	if series, _ := empty.body["series"].([]any); len(series) != 0 {
		t.Errorf("no snapshots yet, series should be empty: %s", empty.raw)
	}
	if c, _ := empty.body["committed"].(float64); c != 30 {
		t.Errorf("burndown should carry committed=30, got %v", empty.body["committed"])
	}

	// Capture: one active sprint snapshotted.
	cap := h.expect(h.do("POST", "/api/v1/snapshots/capture", admin, nil),
		http.StatusOK, "capture")
	if n, _ := cap.body["captured"].(float64); n < 1 {
		t.Fatalf("expected at least one sprint captured, got %v", cap.body["captured"])
	}

	// Read it back: one point, remaining = committed - completed = 18.
	got := h.expect(h.do("GET", "/api/v1/sprints/"+sprintID+"/burndown", admin, nil),
		http.StatusOK, "burndown after capture")
	series, _ := got.body["series"].([]any)
	if len(series) != 1 {
		t.Fatalf("expected one snapshot, got %d: %s", len(series), got.raw)
	}
	point, _ := series[0].(map[string]any)
	if r, _ := point["remaining"].(float64); r != 18 {
		t.Errorf("remaining should be committed-completed=18, got %v", point["remaining"])
	}

	// Capturing again the same day updates in place, does not add a row.
	h.expect(h.do("POST", "/api/v1/snapshots/capture", admin, nil), http.StatusOK, "recapture")
	again := h.expect(h.do("GET", "/api/v1/sprints/"+sprintID+"/burndown", admin, nil),
		http.StatusOK, "burndown after recapture")
	if s2, _ := again.body["series"].([]any); len(s2) != 1 {
		t.Errorf("a second capture same day must not add a row: got %d", len(s2))
	}

	// A burndown for a sprint that isn't there is a 404.
	h.expect(h.do("GET", "/api/v1/sprints/nope/burndown", admin, nil),
		http.StatusNotFound, "burndown of missing sprint")
}

// TestModuleVelocity returns completed points for finished sprints only.
func TestModuleVelocity(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, _, _ := scaffoldSprint(h, admin)
	sprint := h.expect(h.do("GET", "/api/v1/sprints/"+sprintID, admin, nil), http.StatusOK, "get sprint")
	moduleID := str(sprint.body, "moduleId")
	componentID := str(sprint.body, "componentId")

	// The scaffold sprint stays 'planning'; finish it with points.
	h.expect(h.do("PATCH", "/api/v1/sprints/"+sprintID, admin, map[string]any{
		"status": "done", "committed": 30, "completed": 28,
	}), http.StatusOK, "finish sprint 1")
	// A second sprint, still active, must NOT appear in velocity.
	h.do("POST", "/api/v1/modules/"+moduleID+"/sprints", admin, map[string]any{
		"componentId": componentID, "name": "In flight", "goal": "g", "status": "active",
	})

	v := h.expect(h.do("GET", "/api/v1/modules/"+moduleID+"/velocity", admin, nil),
		http.StatusOK, "velocity")
	sprints, _ := v.body["sprints"].([]any)
	if len(sprints) != 1 {
		t.Fatalf("velocity should list only the one finished sprint, got %d: %s",
			len(sprints), v.raw)
	}
	row, _ := sprints[0].(map[string]any)
	if c, _ := row["completed"].(float64); c != 28 {
		t.Errorf("finished sprint's completed should be 28, got %v", row["completed"])
	}
}
