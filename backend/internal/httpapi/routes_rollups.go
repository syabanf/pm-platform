package httpapi

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// Rollups: the counters a dashboard needs, computed in the database instead of
// by pulling whole collections and summing in the browser. The home page fired
// a request per sprint to build its KPI strip; these answer the same questions
// in one query.
func (s *Server) registerRollupRoutes(g *echo.Group) {
	g.GET("/rollup/portfolio", s.portfolioRollup)
	g.GET("/modules/:moduleId/rollup", s.moduleRollup)
}

func (s *Server) portfolioRollup(c echo.Context) error {
	r, err := s.q.PortfolioRollup(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, echo.Map{
		"activeClients": r.ActiveClients,
		"projects":      r.Projects,
		"modules":       r.Modules,
		"atRiskModules": r.AtRiskModules,
		"activeSprints": r.ActiveSprints,
		"blockedTasks":  r.BlockedTasks,
		"reportsDue":    r.ReportsDue,
	})
}

func (s *Server) moduleRollup(c echo.Context) error {
	id, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	// A rollup of a module that does not exist is all zeros, which reads as a
	// real empty module. 404 instead, so a missing id is not mistaken for one
	// with no work in it.
	if _, err := s.q.GetModule(c.Request().Context(), id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "no such module")
		}
		return dbErr(err)
	}
	r, err := s.q.ModuleRollup(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, echo.Map{
		"components":      r.Components,
		"sprints":         r.Sprints,
		"backlogItems":    r.BacklogItems,
		"activeSprints":   r.ActiveSprints,
		"committedPoints": r.CommittedPoints,
		"completedPoints": r.CompletedPoints,
		"blockedTasks":    r.BlockedTasks,
	})
}
