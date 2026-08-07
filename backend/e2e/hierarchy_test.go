package e2e

import (
	"fmt"
	"net/http"
	"sync"
	"testing"
)

// TestHierarchyLifecycle drives the whole ladder end to end — client, project,
// module, component, sprint, task — then edits and deletes on the way back up.
// This is the test that would have caught a rename half-landing: every URL
// shape and every payload key is exercised against the live schema.
func TestHierarchyLifecycle(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	client := h.expect(h.do("POST", "/api/v1/clients", admin, map[string]any{
		"name": "Aurora Steel", "industry": "Manufacturing",
	}), http.StatusCreated, "create client")
	clientID := str(client.body, "id")

	project := h.expect(h.do("POST", "/api/v1/projects", admin, map[string]any{
		"clientId": clientID, "name": "Plant Digitalisation",
	}), http.StatusCreated, "create project")
	projectID := str(project.body, "id")

	module := h.expect(h.do("POST", "/api/v1/modules", admin, map[string]any{
		"projectId": projectID, "name": "OEE Platform",
	}), http.StatusCreated, "create module")
	moduleID := str(module.body, "id")
	if got := str(module.body, "clientId"); got != clientID {
		t.Errorf("module.clientId should be derived from the project: got %q want %q", got, clientID)
	}

	component := h.expect(h.do("POST", "/api/v1/modules/"+moduleID+"/components", admin, map[string]any{
		"name": "Data Acquisition",
	}), http.StatusCreated, "create component")
	componentID := str(component.body, "id")

	sprint := h.expect(h.do("POST", "/api/v1/modules/"+moduleID+"/sprints", admin, map[string]any{
		"componentId": componentID, "name": "Ingestion Spike",
		"goal": "Read tags from the two oldest PLCs",
		"startDate": "2026-08-10", "endDate": "2026-08-21",
	}), http.StatusCreated, "create sprint")
	sprintID := str(sprint.body, "id")
	if n, ok := sprint.body["number"].(float64); !ok || n != 1 {
		t.Errorf("first sprint should be number 1, got %v", sprint.body["number"])
	}

	// A task is born from a backlog item — the API refuses an orphan task.
	item := h.expect(h.do("POST", "/api/v1/modules/"+moduleID+"/backlog", admin, map[string]any{
		"componentId": componentID, "title": "PLC ingestion",
		"story": "As an operator I see live tag values",
	}), http.StatusCreated, "create backlog item")
	task := h.expect(h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": str(item.body, "id"),
		"title":         "Map PLC registers", "componentName": "Data Acquisition",
	}), http.StatusCreated, "create task")
	taskID := str(task.body, "id")

	// Edit one field; every other field must survive (PATCH is partial).
	h.expect(h.do("PATCH", "/api/v1/tasks/"+taskID, admin, map[string]any{
		"estimate": 5,
	}), http.StatusOK, "patch task estimate")
	got := h.expect(h.do("GET", "/api/v1/tasks/"+taskID, admin, nil), http.StatusOK, "get task")
	if str(got.body, "title") != "Map PLC registers" {
		t.Errorf("patching estimate must not clobber the title: %s", got.raw)
	}
	if e, _ := got.body["estimate"].(float64); e != 5 {
		t.Errorf("estimate: got %v want 5", got.body["estimate"])
	}

	// The module's current sprint: point it, then confirm deleting the sprint
	// clears it rather than deadlocking or dangling.
	h.expect(h.do("PATCH", "/api/v1/modules/"+moduleID+"/current-sprint", admin, map[string]any{
		"currentSprintId": sprintID,
	}), http.StatusOK, "set current sprint")
	h.expect(h.do("DELETE", "/api/v1/sprints/"+sprintID, admin, nil),
		http.StatusNoContent, "delete current sprint")
	mod := h.expect(h.do("GET", "/api/v1/modules/"+moduleID, admin, nil), http.StatusOK, "get module")
	if v := mod.body["currentSprintId"]; v != nil {
		t.Errorf("deleting the current sprint must null the pointer, got %v", v)
	}

	// Cascade: deleting the client takes the whole subtree with it.
	h.expect(h.do("DELETE", "/api/v1/clients/"+clientID, admin, nil),
		http.StatusNoContent, "delete client")
	h.expect(h.do("GET", "/api/v1/modules/"+moduleID, admin, nil),
		http.StatusNotFound, "module gone with its client")
	h.expect(h.do("GET", "/api/v1/components/"+componentID, admin, nil),
		http.StatusNotFound, "component gone with its client")
}

// TestConflictMessages pins the 409 wording to the constraint that produced
// it. These strings are matched against Postgres constraint names in Go — the
// exact coupling the hierarchy rename could have silently broken — so this is
// the regression net for that class of bug.
func TestConflictMessages(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	client := h.do("POST", "/api/v1/clients", admin, map[string]any{"name": "C"})
	project := h.do("POST", "/api/v1/projects", admin, map[string]any{
		"clientId": str(client.body, "id"), "name": "P"})
	module := h.do("POST", "/api/v1/modules", admin, map[string]any{
		"projectId": str(project.body, "id"), "name": "M"})
	moduleID := str(module.body, "id")
	component := h.do("POST", "/api/v1/modules/"+moduleID+"/components", admin, map[string]any{"name": "K"})
	componentID := str(component.body, "id")

	// Two sprints with the same explicit number.
	h.expect(h.do("POST", "/api/v1/modules/"+moduleID+"/sprints", admin, map[string]any{
		"componentId": componentID, "name": "S1", "goal": "g", "number": 7,
	}), http.StatusCreated, "sprint 7")
	dup := h.do("POST", "/api/v1/modules/"+moduleID+"/sprints", admin, map[string]any{
		"componentId": componentID, "name": "S1 again", "goal": "g", "number": 7,
	})
	h.expect(dup, http.StatusConflict, "duplicate sprint number")
	if want := "a sprint with that number already exists for this module"; str(dup.body, "error") != want {
		t.Errorf("409 lost its specific message.\n got: %s\nwant: %s", dup.raw, want)
	}

	// A sprint pointing at a component of a different module: the composite FK
	// exists precisely to refuse this.
	other := h.do("POST", "/api/v1/modules", admin, map[string]any{
		"projectId": str(project.body, "id"), "name": "Other"})
	foreign := h.do("POST", "/api/v1/modules/"+str(other.body, "id")+"/components", admin,
		map[string]any{"name": "Foreign"})
	cross := h.do("POST", "/api/v1/modules/"+moduleID+"/sprints", admin, map[string]any{
		"componentId": str(foreign.body, "id"), "name": "Cross", "goal": "g",
	})
	if cross.status != http.StatusConflict && cross.status != http.StatusBadRequest {
		t.Errorf("a sprint on another module's component must be refused, got %d: %s",
			cross.status, cross.raw)
	}

	// A date range that ends before it starts trips the CHECK, not a 500.
	bad := h.do("POST", "/api/v1/modules/"+moduleID+"/sprints", admin, map[string]any{
		"componentId": componentID, "name": "Backwards", "goal": "g",
		"startDate": "2026-09-10", "endDate": "2026-09-01",
	})
	if bad.status != http.StatusConflict && bad.status != http.StatusBadRequest {
		t.Errorf("end-before-start must be a client error, got %d: %s", bad.status, bad.raw)
	}
}

// TestConcurrentSprintDeletes is the deadlock regression test. Every sprint
// here is its module's current sprint, so each DELETE fires the ON DELETE SET
// NULL update on the module row — the AB-BA edge — while a PATCH loop keeps
// the module row busy from the other side. Before deleteSprint took the module
// lock first, this reliably produced deadlock 500s.
func TestConcurrentSprintDeletes(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	client := h.do("POST", "/api/v1/clients", admin, map[string]any{"name": "C"})
	project := h.do("POST", "/api/v1/projects", admin, map[string]any{
		"clientId": str(client.body, "id"), "name": "P"})
	module := h.do("POST", "/api/v1/modules", admin, map[string]any{
		"projectId": str(project.body, "id"), "name": "M"})
	moduleID := str(module.body, "id")
	component := h.do("POST", "/api/v1/modules/"+moduleID+"/components", admin, map[string]any{"name": "K"})
	componentID := str(component.body, "id")

	const n = 8
	ids := make([]string, n)
	for i := range ids {
		s := h.expect(h.do("POST", "/api/v1/modules/"+moduleID+"/sprints", admin, map[string]any{
			"componentId": componentID, "name": fmt.Sprintf("S%d", i), "goal": "g",
		}), http.StatusCreated, "seed sprint")
		ids[i] = str(s.body, "id")
	}

	var wg sync.WaitGroup
	errs := make(chan string, n*2)

	// One side: delete every sprint, each delete touching the module row via
	// the FK. Point the module at the sprint first so the edge actually fires.
	for _, id := range ids {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			h.do("PATCH", "/api/v1/modules/"+moduleID+"/current-sprint", admin,
				map[string]any{"currentSprintId": id})
			r := h.do("DELETE", "/api/v1/sprints/"+id, admin, nil)
			// 204 is the happy path; 404 means another goroutine's cascade or
			// pointer-move got there first, which is fine. 409 would be the
			// lock timeout and 500 the deadlock — both are the bug.
			if r.status != http.StatusNoContent && r.status != http.StatusNotFound &&
				r.status != http.StatusOK {
				errs <- fmt.Sprintf("DELETE sprint %s: %d %s", id, r.status, r.raw)
			}
		}(id)
	}
	// Other side: hammer the module row with harmless PATCHes.
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			r := h.do("PATCH", "/api/v1/modules/"+moduleID, admin,
				map[string]any{"health": 50 + i})
			if r.status != http.StatusOK {
				errs <- fmt.Sprintf("PATCH module: %d %s", r.status, r.raw)
			}
		}(i)
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		t.Error(e)
	}
}
