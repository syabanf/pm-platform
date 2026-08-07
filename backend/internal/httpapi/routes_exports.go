package httpapi

import (
	"encoding/csv"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// CSV exports. encoding/csv handles the quoting and escaping that hand-joined
// commas get wrong the moment a value contains a comma, a quote or a newline.
// Rows are written to the response one at a time rather than built into one
// string, and the queries are unpaginated on purpose — an export is the whole
// set.
func (s *Server) registerExportRoutes(g *echo.Group) {
	g.GET("/clients/export.csv", s.exportClients)
	g.GET("/modules/:moduleId/tasks/export.csv", s.exportModuleTasks)
}

// csvResponse sets the headers and returns a writer to stream rows into. The
// filename is what a browser saves it as.
func csvResponse(c echo.Context, filename string) (*csv.Writer, func() error) {
	h := c.Response().Header()
	h.Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	h.Set(echo.HeaderContentDisposition, `attachment; filename="`+filename+`"`)
	c.Response().WriteHeader(http.StatusOK)
	w := csv.NewWriter(c.Response())
	return w, func() error {
		w.Flush()
		return w.Error()
	}
}

func (s *Server) exportClients(c echo.Context) error {
	rows, err := s.q.ExportClients(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	w, done := csvResponse(c, "clients.csv")
	_ = w.Write([]string{"id", "name", "industry", "status", "health", "risk", "contract", "archived"})
	for _, r := range rows {
		_ = w.Write([]string{
			r.ID, r.Name, r.Industry, r.Status, r.Health, r.Risk, r.ContractType,
			strconv.FormatBool(r.Archived),
		})
	}
	return done()
}

func (s *Server) exportModuleTasks(c echo.Context) error {
	id, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	ctx := c.Request().Context()
	// 404 a missing module before streaming a 200 with an empty body, so an
	// empty file is unambiguously "no tasks", not "wrong id".
	if _, err := s.q.GetModule(ctx, id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "no such module")
		}
		return dbErr(err)
	}
	rows, err := s.q.ExportModuleTasks(ctx, id)
	if err != nil {
		return dbErr(err)
	}
	w, done := csvResponse(c, "tasks.csv")
	_ = w.Write([]string{"id", "sprint", "title", "component", "column", "priority", "estimate", "assignee"})
	for _, r := range rows {
		_ = w.Write([]string{
			r.ID, strconv.FormatInt(int64(r.SprintNumber), 10), r.Title, r.ComponentName,
			r.BoardColumn, r.Priority, strconv.FormatInt(int64(r.Estimate), 10), r.Assignee,
		})
	}
	return done()
}
