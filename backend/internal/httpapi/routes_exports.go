package httpapi

import (
	"encoding/csv"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
)

// CSV exports, genuinely streamed. The rows are read from the database with a
// cursor and each is written to the response as it is scanned, so peak memory is
// one row, not the whole set — the queries are unpaginated on purpose (an export
// is the whole set) and a large tenant's export must not build up in the heap
// first. encoding/csv handles the quoting a hand-joined comma gets wrong.
func (s *Server) registerExportRoutes(g *echo.Group) {
	g.GET("/clients/export.csv", s.exportClients)
	g.GET("/modules/:moduleId/tasks/export.csv", s.exportModuleTasks)
}

// sanitizeCSVCell neutralizes spreadsheet formula injection. A value beginning
// with =, +, -, @, TAB or CR is a formula when the file is opened in Excel or
// Sheets — so a task titled `=WEBSERVICE(...)` written by one user would run when
// a delivery lead opens the export. Prefixing a single quote makes the cell
// literal text. encoding/csv escapes CSV grammar; this handles the spreadsheet
// semantics it cannot know about.
func sanitizeCSVCell(v string) string {
	if v == "" {
		return v
	}
	switch v[0] {
	case '=', '+', '-', '@', '\t', '\r':
		return "'" + v
	}
	return v
}

// csvStream sets the CSV headers, then runs write against a fresh csv.Writer,
// flushing at the end and surfacing any writer error. The header row and the
// per-row scanning live in write.
func csvStream(c echo.Context, filename string, write func(*csv.Writer) error) error {
	h := c.Response().Header()
	h.Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	h.Set(echo.HeaderContentDisposition, `attachment; filename="`+filename+`"`)
	c.Response().WriteHeader(http.StatusOK)
	w := csv.NewWriter(c.Response())
	if err := write(w); err != nil {
		return err
	}
	w.Flush()
	return w.Error()
}

func (s *Server) exportClients(c echo.Context) error {
	ctx := c.Request().Context()
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, industry, status, health, risk, contract_type,
		       (archived_at IS NOT NULL) AS archived
		FROM clients
		ORDER BY name, id`)
	if err != nil {
		return dbErr(err)
	}
	defer rows.Close()

	return csvStream(c, "clients.csv", func(w *csv.Writer) error {
		if err := w.Write([]string{"id", "name", "industry", "status", "health", "risk", "contract", "archived"}); err != nil {
			return err
		}
		for rows.Next() {
			var id, name, industry, status, health, risk, contract string
			var archived bool
			if err := rows.Scan(&id, &name, &industry, &status, &health, &risk, &contract, &archived); err != nil {
				return err
			}
			if err := w.Write([]string{
				id, sanitizeCSVCell(name), sanitizeCSVCell(industry),
				sanitizeCSVCell(status), sanitizeCSVCell(health), sanitizeCSVCell(risk),
				sanitizeCSVCell(contract), strconv.FormatBool(archived),
			}); err != nil {
				return err
			}
		}
		return rows.Err()
	})
}

func (s *Server) exportModuleTasks(c echo.Context) error {
	id, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	ctx := c.Request().Context()
	// 404 a missing module before streaming a 200, so an empty file is
	// unambiguously "no tasks", not "wrong id".
	if _, err := s.q.GetModule(ctx, id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "no such module")
		}
		return dbErr(err)
	}
	rows, err := s.pool.Query(ctx, `
		SELECT t.id, s.number, t.title, t.component_name,
		       t.board_column, t.priority, t.estimate,
		       COALESCE(m.name, '')
		FROM tasks t
		JOIN sprints s ON s.id = t.sprint_id
		LEFT JOIN members m ON m.id = t.assignee_id
		WHERE s.module_id = $1
		ORDER BY s.number, t.created_at, t.id`, id)
	if err != nil {
		return dbErr(err)
	}
	defer rows.Close()

	return csvStream(c, "tasks.csv", func(w *csv.Writer) error {
		if err := w.Write([]string{"id", "sprint", "title", "component", "column", "priority", "estimate", "assignee"}); err != nil {
			return err
		}
		for rows.Next() {
			var tid, title, component, column, priority, assignee string
			var sprintNumber, estimate int32
			if err := rows.Scan(&tid, &sprintNumber, &title, &component, &column, &priority, &estimate, &assignee); err != nil {
				return err
			}
			if err := w.Write([]string{
				tid, strconv.FormatInt(int64(sprintNumber), 10),
				sanitizeCSVCell(title), sanitizeCSVCell(component),
				sanitizeCSVCell(column), sanitizeCSVCell(priority),
				strconv.FormatInt(int64(estimate), 10), sanitizeCSVCell(assignee),
			}); err != nil {
				return err
			}
		}
		return rows.Err()
	})
}
