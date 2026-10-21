package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"

	"github.com/syabanf/pm-platform/backend/internal/db"
)

// trashTable is one table of a deleted subtree, with the column that ties its
// rows to the ids collected on the way down. Order matters twice: this is the
// order rows are filed, and the order they are put back, so every parent
// exists before its children.
type trashTable struct {
	name string
	by   string // filter column
	ids  string // which id set the column is matched against
}

var trashTables = []trashTable{
	{"clients", "id", "clients"},
	{"projects", "id", "projects"},
	{"modules", "id", "modules"},
	{"components", "module_id", "modules"},
	{"backlog_items", "module_id", "modules"},
	{"sprints", "module_id", "modules"},
	{"sprint_members", "sprint_id", "sprints"},
	{"sprint_backlog_items", "sprint_id", "sprints"},
	{"sprint_daily_snapshots", "sprint_id", "sprints"},
	{"tasks", "sprint_id", "sprints"},
	{"task_dod", "task_id", "tasks"},
	{"decisions", "module_id", "modules"},
	{"retro_notes", "sprint_id", "sprints"},
	{"retro_actions", "sprint_id", "sprints"},
	{"demo_items", "sprint_id", "sprints"},
	{"client_feedback", "sprint_id", "sprints"},
	{"report_queue", "module_id", "modules"},
	{"generated_reports", "module_id", "modules"},
}

type deletedResponse struct {
	TrashID string `json:"trashId"`
}

// stashTree files everything under one client, project or module in the trash
// before the cascade removes it. It runs inside the delete's transaction, so a
// failed delete leaves no trash row and a failed stash leaves the rows alone.
func (s *Server) stashTree(ctx context.Context, c echo.Context, q *db.Queries, tx pgx.Tx, kind, rootID string) (string, error) {
	ids := map[string][]string{}
	var err error
	switch kind {
	case "client":
		ids["clients"] = []string{rootID}
		if ids["projects"], err = q.ProjectIDsByClient(ctx, rootID); err != nil {
			return "", err
		}
	case "project":
		ids["projects"] = []string{rootID}
	case "module":
		ids["modules"] = []string{rootID}
	}
	if kind != "module" {
		if ids["modules"], err = q.ModuleIDsByProjects(ctx, ids["projects"]); err != nil {
			return "", err
		}
	}
	if ids["sprints"], err = q.SprintIDsByModules(ctx, ids["modules"]); err != nil {
		return "", err
	}
	if ids["tasks"], err = q.TaskIDsBySprints(ctx, ids["sprints"]); err != nil {
		return "", err
	}

	payload := map[string]json.RawMessage{}
	for _, t := range trashTables {
		var rows json.RawMessage
		sql := fmt.Sprintf("SELECT coalesce(jsonb_agg(t), '[]') FROM %s t WHERE t.%s = ANY($1)", t.name, t.by)
		if err := tx.QueryRow(ctx, sql, ids[t.ids]).Scan(&rows); err != nil {
			return "", err
		}
		payload[t.name] = rows
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	var label string
	if err := tx.QueryRow(ctx, fmt.Sprintf("SELECT name FROM %ss WHERE id = $1", kind), rootID).Scan(&label); err != nil {
		return "", err // pgx.ErrNoRows: the root is already gone, a 404 as before
	}
	deletedBy := ""
	if auth := currentUser(c); auth != nil {
		deletedBy = auth.Email
	}
	id := newPrefixedID("trash")
	if err := q.InsertTrash(ctx, db.InsertTrashParams{
		ID: id, Kind: kind, RootID: rootID, Label: label, Payload: raw, DeletedBy: deletedBy,
	}); err != nil {
		return "", err
	}
	return id, q.SweepTrash(ctx)
}

func (s *Server) registerTrashRoutes(g *echo.Group) {
	g.POST("/trash/:trashId/restore", s.restoreTrash)
}

// restoreTrash puts a filed subtree back, parents first, in one transaction.
// A row that exists again under the same id, or a parent that has since been
// deleted, makes the whole restore fail with a 409.
func (s *Server) restoreTrash(c echo.Context) error {
	id, err := param(c, "trashId")
	if err != nil {
		return err
	}
	ctx := c.Request().Context()
	err = s.deleteTx(ctx, func(q *db.Queries, tx pgx.Tx) error {
		row, err := q.GetTrash(ctx, id)
		if err != nil {
			return err
		}
		var payload map[string]json.RawMessage
		if err := json.Unmarshal(row.Payload, &payload); err != nil {
			return err
		}
		for _, t := range trashTables {
			rows, ok := payload[t.name]
			if !ok {
				continue
			}
			sql := fmt.Sprintf("INSERT INTO %s SELECT * FROM jsonb_populate_recordset(NULL::%s, $1)", t.name, t.name)
			if t.name == "modules" {
				// current_sprint_id points at a sprint that comes back later in
				// the order; it is filled in once the sprints exist.
				sql = "INSERT INTO modules SELECT * FROM jsonb_populate_recordset(NULL::modules, " +
					"(SELECT coalesce(jsonb_agg(m - 'current_sprint_id'), '[]') FROM jsonb_array_elements($1::jsonb) m))"
			}
			if _, err := tx.Exec(ctx, sql, rows); err != nil {
				return err
			}
		}
		if rows, ok := payload["modules"]; ok {
			_, err := tx.Exec(ctx, "UPDATE modules m SET current_sprint_id = x.current_sprint_id "+
				"FROM jsonb_to_recordset($1::jsonb) AS x(id text, current_sprint_id text) WHERE m.id = x.id", rows)
			if err != nil {
				return err
			}
		}
		return q.DeleteTrash(ctx, id)
	})
	if err != nil {
		if status, msg, ok := constraintError(err); ok && status != http.StatusConflict {
			// A parent deleted after this subtree, or a member it referred to.
			return echo.NewHTTPError(http.StatusConflict, "cannot restore: "+msg)
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusNotFound, "nothing to restore")
		}
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}
