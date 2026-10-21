package e2e

import (
	"net/http"
	"testing"
)

// TestWorkspaceSnapshotNestsChildren pins the one-shot load: a module carries
// its components, a sprint its members and backlog ids, a task its DoD items,
// and the master lists arrive keyed by name.
func TestWorkspaceSnapshotNestsChildren(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, itemID, memberID := scaffoldSprint(h, admin)
	h.expect(h.do("PUT", "/api/v1/sprints/"+sprintID+"/members/"+memberID, admin,
		map[string]any{"allocation": 50}), http.StatusOK, "add member")
	h.expect(h.do("PUT", "/api/v1/sprints/"+sprintID+"/backlog/"+itemID, admin,
		map[string]any{}), http.StatusOK, "add backlog item")
	task := h.expect(h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "T",
	}), http.StatusCreated, "task")
	h.expect(h.do("PUT", "/api/v1/tasks/"+str(task.body, "id")+"/dod", admin,
		map[string]any{"position": 0, "label": "Reviewed", "done": true}), http.StatusOK, "dod")

	w := h.expect(h.do("GET", "/api/v1/workspace", admin, nil), http.StatusOK, "snapshot")
	modules, _ := w.body["modules"].([]any)
	module, _ := modules[0].(map[string]any)
	if comps, _ := module["components"].([]any); len(comps) != 1 {
		t.Errorf("module should carry its components, got %v", module["components"])
	}
	sprints, _ := w.body["sprints"].([]any)
	sprint, _ := sprints[0].(map[string]any)
	if ms, _ := sprint["members"].([]any); len(ms) != 1 {
		t.Errorf("sprint should carry its members, got %v", sprint["members"])
	}
	if ids, _ := sprint["backlogItemIds"].([]any); len(ids) != 1 || ids[0] != itemID {
		t.Errorf("sprint should carry its backlog ids, got %v", sprint["backlogItemIds"])
	}
	tasks, _ := w.body["tasks"].([]any)
	first, _ := tasks[0].(map[string]any)
	dod, _ := first["dod"].([]any)
	item, _ := dod[0].(map[string]any)
	if len(dod) != 1 || item["label"] != "Reviewed" || item["done"] != true {
		t.Errorf("task should carry its DoD items, got %v", first["dod"])
	}
	masters, _ := w.body["masters"].(map[string]any)
	if _, ok := masters["industries"]; !ok {
		t.Errorf("masters should be keyed by list name, got %v", w.body["masters"])
	}
	settings, _ := w.body["settings"].(map[string]any)
	if dodTemplate, _ := settings["dodTemplate"].([]any); len(dodTemplate) == 0 {
		t.Errorf("settings should carry the DoD template, got %v", w.body["settings"])
	}
}
