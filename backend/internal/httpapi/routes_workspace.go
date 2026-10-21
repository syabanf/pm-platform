package httpapi

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/syabanf/pm-platform/backend/internal/db"
)

// registerWorkspaceRoutes mounts the one-shot snapshot the frontend store
// loads on sign-in.
func (s *Server) registerWorkspaceRoutes(g *echo.Group) {
	g.GET("/workspace", s.workspaceSnapshot)
}

// workspace is every collection the store keeps, fetched once. Nested rows
// (components, sprint members, DoD items) come back inside their parent, so
// the load is one request and the pages keep filtering in memory.
type workspace struct {
	Clients          []db.Client             `json:"clients"`
	Projects         []db.Project            `json:"projects"`
	Modules          []db.SnapshotModulesRow `json:"modules"`
	Members          []db.Member             `json:"members"`
	Backlog          []db.BacklogItem        `json:"backlog"`
	Sprints          []db.SnapshotSprintsRow `json:"sprints"`
	Tasks            []db.SnapshotTasksRow   `json:"tasks"`
	Decisions        []db.Decision           `json:"decisions"`
	RetroNotes       []db.RetroNote          `json:"retroNotes"`
	RetroActions     []db.RetroAction        `json:"retroActions"`
	DemoItems        []db.DemoItem           `json:"demoItems"`
	ClientFeedback   []db.ClientFeedback     `json:"clientFeedback"`
	Roles            []db.Role               `json:"roles"`
	ReportTemplates  []db.ReportTemplate     `json:"reportTemplates"`
	ReportQueue      []db.ReportQueue        `json:"reportQueue"`
	GeneratedReports []db.GeneratedReport    `json:"generatedReports"`
	Masters          map[string][]string     `json:"masters"`
	Settings         db.WorkspaceSetting     `json:"settings"`
}

func (s *Server) workspaceSnapshot(c echo.Context) error {
	ctx := c.Request().Context()
	var w workspace
	var err error

	// The review lists take the same paging the per-resource routes do; a
	// snapshot wants all of them, so it asks for the ceiling.
	all := int32(maxPageSize)
	steps := []func() error{
		func() (e error) { w.Clients, e = s.q.SnapshotClients(ctx); return },
		func() (e error) { w.Projects, e = s.q.SnapshotProjects(ctx); return },
		func() (e error) { w.Modules, e = s.q.SnapshotModules(ctx); return },
		func() (e error) { w.Members, e = s.q.SnapshotMembers(ctx); return },
		func() (e error) { w.Backlog, e = s.q.SnapshotBacklog(ctx); return },
		func() (e error) { w.Sprints, e = s.q.SnapshotSprints(ctx); return },
		func() (e error) { w.Tasks, e = s.q.SnapshotTasks(ctx); return },
		func() (e error) { w.Decisions, e = s.q.SnapshotDecisions(ctx); return },
		func() (e error) {
			w.RetroNotes, e = s.q.ListRetroNotes(ctx, db.ListRetroNotesParams{Lim: all})
			return
		},
		func() (e error) {
			w.RetroActions, e = s.q.ListRetroActions(ctx, db.ListRetroActionsParams{Lim: all})
			return
		},
		func() (e error) {
			w.DemoItems, e = s.q.ListDemoItems(ctx, db.ListDemoItemsParams{Lim: all})
			return
		},
		func() (e error) {
			w.ClientFeedback, e = s.q.ListClientFeedback(ctx, db.ListClientFeedbackParams{Lim: all})
			return
		},
		func() (e error) { w.Roles, e = s.q.SnapshotRoles(ctx); return },
		func() (e error) { w.ReportTemplates, e = s.q.SnapshotReportTemplates(ctx); return },
		func() (e error) { w.ReportQueue, e = s.q.SnapshotReportQueue(ctx); return },
		func() (e error) { w.GeneratedReports, e = s.q.SnapshotGeneratedReports(ctx); return },
		func() (e error) { w.Settings, e = s.q.GetWorkspaceSettings(ctx); return },
		func() error {
			rows, e := s.q.ListAllMasterValues(ctx)
			if e != nil {
				return e
			}
			w.Masters = map[string][]string{}
			for _, r := range rows {
				w.Masters[r.Key] = append(w.Masters[r.Key], r.Value)
			}
			return nil
		},
	}
	for _, step := range steps {
		if err = step(); err != nil {
			return dbErr(err)
		}
	}
	return c.JSON(http.StatusOK, w)
}
