package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/syabanf/pm-platform/backend/internal/db"
)

// auditLog records who changed what. It is middleware, not a call in every
// handler, so it cannot drift as handlers are added or renamed and it covers
// every mutation by construction.
//
// It logs a successful POST/PATCH/DELETE under /api/v1 once the handler has run,
// attributing it to the resolved session. The auth endpoints are skipped: a
// login has no session yet, and logging around credentials is a liability, not
// an asset. The insert is best-effort — the mutation already committed, so a
// failure to log it must never turn a 200 into a 500.
func (s *Server) auditLog() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			method := c.Request().Method
			if method != http.MethodPost && method != http.MethodPatch && method != http.MethodDelete {
				return next(c)
			}
			path := c.Path()
			if strings.HasPrefix(path, "/api/v1/auth/") {
				return next(c) // credential flow, not a domain mutation
			}

			// For a create, the new id is in the response body, not the URL, so
			// capture the body to recover it. Reads and the other verbs do not
			// need this, so only POST pays the buffering cost.
			var cap *captureWriter
			if method == http.MethodPost {
				cap = &captureWriter{ResponseWriter: c.Response().Writer}
				c.Response().Writer = cap
			}

			err := next(c)

			status := c.Response().Status
			auth := currentUser(c)
			// Only successful, attributed mutations are worth a row.
			if err == nil && auth != nil && status >= 200 && status < 300 {
				kind, id := auditTarget(c, method, cap)
				// Detached context: the request may be finishing, but the log
				// entry should still land. Best-effort — swallow the error.
				_ = s.q.InsertActivity(context.WithoutCancel(c.Request().Context()),
					db.InsertActivityParams{
						ActorID:    auth.UserID,
						ActorEmail: auth.Email,
						Action:     auditAction(method),
						TargetKind: kind,
						TargetID:   id,
						Method:     method,
						Path:       c.Request().URL.Path,
					})
			}
			return err
		}
	}
}

func auditAction(method string) string {
	switch method {
	case http.MethodPost:
		return "create"
	case http.MethodPatch:
		return "update"
	case http.MethodDelete:
		return "delete"
	default:
		return strings.ToLower(method)
	}
}

// auditTarget names the thing acted on. For PATCH/DELETE it is the last path
// segment and its id param; for POST it is the created resource, whose kind is
// the trailing collection and whose id is read from the response body.
func auditTarget(c echo.Context, method string, cap *captureWriter) (kind, id string) {
	kind = lastCollection(c.Path())
	if method == http.MethodPost {
		if cap != nil {
			id = idFromBody(cap.body)
		}
		return kind, id
	}
	// PATCH/DELETE: the id is the last path parameter.
	names := c.ParamNames()
	if len(names) > 0 {
		id = c.Param(names[len(names)-1])
	}
	return kind, id
}

// lastCollection returns the last non-parameter path segment, e.g.
// "/api/v1/modules/:moduleId/sprints" -> "sprints",
// "/api/v1/clients/:clientId" -> "clients".
//
// Verb-suffixed action routes (…/archive, …/restore, …/capture) are named for
// the resource they act on, not the verb — otherwise the log reads "created a
// capture" for a snapshot run across every active sprint.
func lastCollection(path string) string {
	segs := strings.Split(strings.Trim(path, "/"), "/")
	for i := len(segs) - 1; i >= 0; i-- {
		if strings.HasPrefix(segs[i], ":") {
			continue
		}
		switch segs[i] {
		case "archive", "restore", "capture":
			continue // skip the verb, name the resource under it
		}
		return segs[i]
	}
	return ""
}

// idFromBody pulls "id" out of a JSON object body, tolerating anything else.
func idFromBody(body []byte) string {
	var m map[string]json.RawMessage
	if json.Unmarshal(body, &m) != nil {
		return ""
	}
	var id string
	if raw, ok := m["id"]; ok {
		_ = json.Unmarshal(raw, &id)
	}
	return id
}

// captureWriter tees the response body so the audit log can read the created
// id without disturbing what the client receives.
type captureWriter struct {
	http.ResponseWriter
	body []byte
}

func (w *captureWriter) Write(b []byte) (int, error) {
	// Cap the copy: an id lives in the first bytes, and a huge list response
	// (a POST that returns many rows) should not be buffered whole.
	if len(w.body) < 4096 {
		w.body = append(w.body, b[:min(len(b), 4096-len(w.body))]...)
	}
	return w.ResponseWriter.Write(b)
}
