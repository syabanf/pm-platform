package e2e

import (
	"net/http"
	"testing"
)

// TestDeleteFilesTheSubtreeAndRestorePutsItBack: a cascade delete answers
// with a trash id, and restoring it brings back every row beneath the root,
// the module's current sprint pointer included.
func TestDeleteFilesTheSubtreeAndRestorePutsItBack(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, itemID, memberID := scaffoldSprint(h, admin)
	sprint := h.expect(h.do("GET", "/api/v1/sprints/"+sprintID, admin, nil), http.StatusOK, "sprint")
	moduleID := str(sprint.body, "moduleId")
	module := h.expect(h.do("GET", "/api/v1/modules/"+moduleID, admin, nil), http.StatusOK, "module")
	projectID := str(module.body, "projectId")
	project := h.expect(h.do("GET", "/api/v1/projects/"+projectID, admin, nil), http.StatusOK, "project")
	clientID := str(project.body, "clientId")

	h.expect(h.do("PATCH", "/api/v1/modules/"+moduleID+"/current-sprint", admin,
		map[string]any{"currentSprintId": sprintID}), http.StatusOK, "point module at sprint")
	h.expect(h.do("PUT", "/api/v1/sprints/"+sprintID+"/members/"+memberID, admin,
		map[string]any{"allocation": 100}), http.StatusOK, "sprint member")
	task := h.expect(h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "T", "assigneeId": memberID,
	}), http.StatusCreated, "task")
	taskID := str(task.body, "id")
	h.expect(h.do("PUT", "/api/v1/tasks/"+taskID+"/dod", admin,
		map[string]any{"position": 0, "label": "Reviewed", "done": true}), http.StatusOK, "dod")
	note := h.expect(h.do("POST", "/api/v1/retro-notes", admin, map[string]any{
		"sprintId": sprintID, "kind": "went-well", "text": "Shipped",
	}), http.StatusCreated, "retro note")

	deleted := h.expect(h.do("DELETE", "/api/v1/clients/"+clientID, admin, nil), http.StatusOK, "delete client")
	trashID := str(deleted.body, "trashId")
	if trashID == "" {
		t.Fatalf("delete should answer with a trash id, got %s", deleted.raw)
	}
	h.expect(h.do("GET", "/api/v1/tasks/"+taskID, admin, nil), http.StatusNotFound, "task gone")

	h.expect(h.do("POST", "/api/v1/trash/"+trashID+"/restore", admin, nil), http.StatusNoContent, "restore")

	back := h.expect(h.do("GET", "/api/v1/modules/"+moduleID, admin, nil), http.StatusOK, "module back")
	if str(back.body, "currentSprintId") != sprintID {
		t.Errorf("module should point at its sprint again, got %v", back.body["currentSprintId"])
	}
	taskBack := h.expect(h.do("GET", "/api/v1/tasks/"+taskID, admin, nil), http.StatusOK, "task back")
	if str(taskBack.body, "assigneeId") != memberID {
		t.Errorf("task should keep its assignee, got %v", taskBack.body["assigneeId"])
	}
	dod := h.expect(h.do("GET", "/api/v1/tasks/"+taskID+"/dod", admin, nil), http.StatusOK, "dod back")
	if len(dod.list) != 1 {
		t.Errorf("dod items should come back, got %s", dod.raw)
	}
	members := h.expect(h.do("GET", "/api/v1/sprints/"+sprintID+"/members", admin, nil), http.StatusOK, "members back")
	if len(members.list) != 1 {
		t.Errorf("sprint members should come back, got %s", members.raw)
	}
	notes := h.expect(h.do("GET", "/api/v1/retro-notes?sprintId="+sprintID, admin, nil), http.StatusOK, "notes back")
	if len(notes.list) != 1 || notes.list[0].(map[string]any)["id"] != note.body["id"] {
		t.Errorf("retro notes should come back, got %s", notes.raw)
	}

	h.expect(h.do("POST", "/api/v1/trash/"+trashID+"/restore", admin, nil), http.StatusNotFound, "restore twice")
}

// TestRestoreRefusesWhenTheRootExistsAgain: a client recreated under the same
// id after the delete keeps the trash entry from landing on top of it.
func TestRestoreRefusesWhenTheRootExistsAgain(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	created := h.expect(h.do("POST", "/api/v1/clients", admin, map[string]any{"id": "cli-again", "name": "C"}),
		http.StatusCreated, "client")
	deleted := h.expect(h.do("DELETE", "/api/v1/clients/"+str(created.body, "id"), admin, nil),
		http.StatusOK, "delete")
	h.expect(h.do("POST", "/api/v1/clients", admin, map[string]any{"id": "cli-again", "name": "C2"}),
		http.StatusCreated, "recreate")
	h.expect(h.do("POST", "/api/v1/trash/"+str(deleted.body, "trashId")+"/restore", admin, nil),
		http.StatusConflict, "restore onto a live row")
}
