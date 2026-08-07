package httpapi

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// Historical metrics: a burndown reads recorded daily snapshots (history you
// cannot reconstruct after the fact), a velocity reads finished sprints
// straight from the table. The capture endpoint is what a daily cron hits.
func (s *Server) registerMetricsRoutes(g *echo.Group) {
	g.POST("/snapshots/capture", s.captureSnapshots)
	g.GET("/sprints/:sprintId/burndown", s.sprintBurndown)
	g.GET("/modules/:moduleId/velocity", s.moduleVelocity)
}

// captureSnapshots records today's numbers for every active sprint. Idempotent
// per day, so a cron may run it as often as it likes; the latest run wins.
func (s *Server) captureSnapshots(c echo.Context) error {
	n, err := s.q.CaptureActiveSprintSnapshots(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, echo.Map{"captured": n})
}

// sprintBurndown returns the recorded series for one sprint. It also carries the
// committed total, so the reader can draw the ideal line against the real burn
// without a second request.
func (s *Server) sprintBurndown(c echo.Context) error {
	id, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	ctx := c.Request().Context()
	sprint, err := s.q.GetSprint(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "no such sprint")
		}
		return dbErr(err)
	}
	rows, err := s.q.ListSprintBurndown(ctx, id)
	if err != nil {
		return dbErr(err)
	}
	series := make([]echo.Map, 0, len(rows))
	for _, r := range rows {
		series = append(series, echo.Map{
			"date":      r.SnapshotOn.Format("2006-01-02"),
			"remaining": r.RemainingPoints,
			"completed": r.CompletedPoints,
		})
	}
	return c.JSON(http.StatusOK, echo.Map{
		"sprintId":    id,
		"committed":   sprint.Committed,
		"workingDays": sprint.WorkingDays,
		"series":      series,
	})
}

// moduleVelocity returns completed points per finished sprint, in order.
func (s *Server) moduleVelocity(c echo.Context) error {
	id, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	ctx := c.Request().Context()
	if _, err := s.q.GetModule(ctx, id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "no such module")
		}
		return dbErr(err)
	}
	rows, err := s.q.ModuleVelocity(ctx, id)
	if err != nil {
		return dbErr(err)
	}
	out := make([]echo.Map, 0, len(rows))
	for _, r := range rows {
		out = append(out, echo.Map{
			"number":    r.Number,
			"name":      r.Name,
			"committed": r.Committed,
			"completed": r.Completed,
		})
	}
	return c.JSON(http.StatusOK, echo.Map{"sprints": out})
}
