package e2e

import (
	"net/http"
	"testing"
)

// scaffoldSprint builds client→project→module→component→sprint→backlog and
// returns the sprint id and a backlog item id ready to hang tasks on.
func scaffoldSprint(h *harness, admin string) (sprintID, itemID, memberID string) {
	client := h.do("POST", "/api/v1/clients", admin, map[string]any{"name": "C"})
	project := h.do("POST", "/api/v1/projects", admin, map[string]any{
		"clientId": str(client.body, "id"), "name": "P"})
	module := h.do("POST", "/api/v1/modules", admin, map[string]any{
		"projectId": str(project.body, "id"), "name": "M"})
	moduleID := str(module.body, "id")
	component := h.do("POST", "/api/v1/modules/"+moduleID+"/components", admin,
		map[string]any{"name": "K"})
	sprint := h.do("POST", "/api/v1/modules/"+moduleID+"/sprints", admin, map[string]any{
		"componentId": str(component.body, "id"), "name": "S", "goal": "g"})
	item := h.do("POST", "/api/v1/modules/"+moduleID+"/backlog", admin, map[string]any{
		"componentId": str(component.body, "id"), "title": "T", "story": "s"})
	member := h.do("POST", "/api/v1/members", admin, map[string]any{
		"name": "Dewi", "email": "dewi@wit.id", "role": "dev"})
	return str(sprint.body, "id"), str(item.body, "id"), str(member.body, "id")
}

// TestTaskListCarriesAssigneeName pins the N+1 fix: the sprint's task list must
// include the assignee's name, so the board renders without a members lookup
// per card. An unassigned task carries a null name, not an error.
func TestTaskListCarriesAssigneeName(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, itemID, memberID := scaffoldSprint(h, admin)

	h.expect(h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "Assigned", "assigneeId": memberID,
	}), http.StatusCreated, "assigned task")
	h.expect(h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "Unassigned",
	}), http.StatusCreated, "unassigned task")

	list := h.expect(h.do("GET", "/api/v1/sprints/"+sprintID+"/tasks", admin, nil),
		http.StatusOK, "list tasks")
	var sawName, sawNull bool
	for _, raw := range list.list {
		row, _ := raw.(map[string]any)
		switch row["title"] {
		case "Assigned":
			if row["assigneeName"] != "Dewi" {
				t.Errorf("assigned task should carry the name, got %v", row["assigneeName"])
			}
			sawName = true
		case "Unassigned":
			if row["assigneeName"] != nil {
				t.Errorf("unassigned task's name should be null, got %v", row["assigneeName"])
			}
			sawNull = true
		}
	}
	if !sawName || !sawNull {
		t.Fatalf("expected both tasks in the list: %s", list.raw)
	}
}

// TestDeleteOneDodItem pins the new endpoint: a checklist can shrink, and
// deleting a position that isn't there is a clean 404, not a silent success.
func TestDeleteOneDodItem(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, itemID, _ := scaffoldSprint(h, admin)
	task := h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "Has a checklist",
	})
	taskID := str(task.body, "id")

	// Two checklist lines.
	for i, label := range []string{"Tests pass", "Reviewed"} {
		h.expect(h.do("PUT", "/api/v1/tasks/"+taskID+"/dod", admin, map[string]any{
			"position": i, "label": label, "done": false,
		}), http.StatusOK, "set dod "+label)
	}

	// Delete the second, and confirm only the first remains.
	h.expect(h.do("DELETE", "/api/v1/tasks/"+taskID+"/dod/1", admin, nil),
		http.StatusNoContent, "delete dod item")
	after := h.expect(h.do("GET", "/api/v1/tasks/"+taskID+"/dod", admin, nil),
		http.StatusOK, "list dod")
	if len(after.list) != 1 {
		t.Fatalf("checklist should have one item left, got %d: %s", len(after.list), after.raw)
	}

	// Deleting the same position again is a 404, not a silent 204.
	h.expect(h.do("DELETE", "/api/v1/tasks/"+taskID+"/dod/1", admin, nil),
		http.StatusNotFound, "delete missing dod item")
}
