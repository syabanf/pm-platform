package e2e

import (
	"net/http"
	"testing"
)

func num(m map[string]any, key string) float64 {
	f, _ := m[key].(float64)
	return f
}

// TestPortfolioRollup builds a small portfolio and checks the dashboard counters
// against what was created — the numbers the frontend used to sum in the browser.
func TestPortfolioRollup(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()

	// Two clients, one archived (so it drops out of activeClients).
	c1 := h.do("POST", "/api/v1/clients", admin, map[string]any{"name": "One"})
	c2 := h.do("POST", "/api/v1/clients", admin, map[string]any{"name": "Two"})
	h.expect(h.do("POST", "/api/v1/clients/"+str(c2.body, "id")+"/archive", admin, nil),
		http.StatusNoContent, "archive c2")

	// A project and two modules under c1, one of them high-risk.
	proj := h.do("POST", "/api/v1/projects", admin, map[string]any{
		"clientId": str(c1.body, "id"), "name": "P"})
	h.do("POST", "/api/v1/modules", admin, map[string]any{
		"projectId": str(proj.body, "id"), "name": "Low"})
	h.do("POST", "/api/v1/modules", admin, map[string]any{
		"projectId": str(proj.body, "id"), "name": "Risky", "risk": "high"})

	r := h.expect(h.do("GET", "/api/v1/rollup/portfolio", admin, nil),
		http.StatusOK, "portfolio rollup")
	if got := num(r.body, "activeClients"); got != 1 {
		t.Errorf("activeClients: got %v want 1 (one of two archived)", got)
	}
	if got := num(r.body, "projects"); got != 1 {
		t.Errorf("projects: got %v want 1", got)
	}
	if got := num(r.body, "modules"); got != 2 {
		t.Errorf("modules: got %v want 2", got)
	}
	if got := num(r.body, "atRiskModules"); got != 1 {
		t.Errorf("atRiskModules: got %v want 1", got)
	}
}

// TestModuleRollup sums one module's own numbers and refuses a missing id.
func TestModuleRollup(t *testing.T) {
	h := newHarness(t)
	admin := h.adminToken()
	sprintID, itemID, _ := scaffoldSprint(h, admin)

	// The scaffold made one component, one sprint, one backlog item. Add two
	// tasks, one blocked.
	h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "Working", "boardColumn": "in-progress"})
	h.do("POST", "/api/v1/sprints/"+sprintID+"/tasks", admin, map[string]any{
		"backlogItemId": itemID, "title": "Stuck", "boardColumn": "blocked"})

	// Recover the module id from the sprint.
	sprint := h.expect(h.do("GET", "/api/v1/sprints/"+sprintID, admin, nil),
		http.StatusOK, "get sprint")
	moduleID := str(sprint.body, "moduleId")

	r := h.expect(h.do("GET", "/api/v1/modules/"+moduleID+"/rollup", admin, nil),
		http.StatusOK, "module rollup")
	if got := num(r.body, "components"); got != 1 {
		t.Errorf("components: got %v want 1", got)
	}
	if got := num(r.body, "sprints"); got != 1 {
		t.Errorf("sprints: got %v want 1", got)
	}
	if got := num(r.body, "backlogItems"); got != 1 {
		t.Errorf("backlogItems: got %v want 1", got)
	}
	if got := num(r.body, "blockedTasks"); got != 1 {
		t.Errorf("blockedTasks: got %v want 1 (one of two tasks blocked)", got)
	}

	// A rollup of a module that isn't there is a 404, not a row of zeros.
	h.expect(h.do("GET", "/api/v1/modules/does-not-exist/rollup", admin, nil),
		http.StatusNotFound, "rollup of missing module")
}
