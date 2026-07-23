// Package httpapi wires the REST API on top of the generated query layer.
package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/syabanf/pm-platform/backend/internal/config"
	"github.com/syabanf/pm-platform/backend/internal/db"
)

// readinessTimeout caps the database check behind /readyz.
const readinessTimeout = 500 * time.Millisecond

// Server holds everything a handler needs.
type Server struct {
	cfg  config.Config
	pool *pgxpool.Pool
	q    *db.Queries
}

// NewServer builds the Echo instance with all routes mounted.
func NewServer(cfg config.Config, pool *pgxpool.Pool) *echo.Echo {
	s := &Server{cfg: cfg, pool: pool, q: db.New(pool)}

	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = errorHandler

	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	e.Use(middleware.Logger())
	// Without a ceiling a single request can persist an arbitrarily large row
	// that every later list request then has to serialise again.
	e.Use(middleware.BodyLimit(cfg.MaxBodySize))
	e.Use(requestTimeout(cfg.RequestTimeout))
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: strings.Split(cfg.CORSOrigins, ","),
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
	}))

	// Liveness must not touch the database: when the pool is saturated a
	// DB-backed probe fails precisely when the process is healthiest, and the
	// orchestrator answers by restarting it.
	e.GET("/livez", s.live)
	e.GET("/readyz", s.ready)
	e.GET("/healthz", s.ready)

	api := e.Group("/api/v1")
	s.routes(api)

	return e
}

// requestTimeout bounds a request end to end. It replaces the request context,
// which is what makes the deadline reach the database driver — Echo's own
// Timeout middleware leaves the query running.
func requestTimeout(d time.Duration) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ctx, cancel := context.WithTimeout(c.Request().Context(), d)
			defer cancel()
			c.SetRequest(c.Request().WithContext(ctx))
			return next(c)
		}
	}
}

func (s *Server) live(c echo.Context) error {
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

func (s *Server) ready(c echo.Context) error {
	// Its own short deadline, so a busy pool answers "not ready" quickly
	// instead of hanging for as long as the caller is willing to wait.
	ctx, cancel := context.WithTimeout(c.Request().Context(), readinessTimeout)
	defer cancel()
	if err := s.pool.Ping(ctx); err != nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "database unreachable")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
}

// withTx runs fn inside one transaction. Sequencing a new row after the last
// existing one needs this: the row lock and the MAX() that follows it have to
// be separate statements, or the read happens against a snapshot older than
// the lock and every writer picks the same number.
func (s *Server) withTx(ctx context.Context, fn func(*db.Queries) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	// Rolling back must not ride the request context: once that deadline has
	// passed the rollback fails too, and pgx answers by destroying the
	// connection instead of returning it to the pool.
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()

	// lock_timeout is a connection-level runtime parameter (see cmd/api/main.go),
	// so it already applies here — and, unlike a SET LOCAL, to the DELETE and
	// UPDATE paths that never open a transaction at all.
	if err := fn(s.q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------- helpers ---

// apiError is the single error shape the API returns.
type apiError struct {
	Error string `json:"error"`
}

// errorHandler renders every error as {"error": "..."} with a sane status.
func errorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}

	status := http.StatusInternalServerError
	msg := "internal server error"

	var he *echo.HTTPError
	switch {
	case errors.As(err, &he):
		status = he.Code
		if m, ok := he.Message.(string); ok {
			msg = m
		} else {
			msg = http.StatusText(he.Code)
		}
	case errors.Is(err, pgx.ErrNoRows):
		status, msg = http.StatusNotFound, "not found"
	case errors.Is(err, context.DeadlineExceeded):
		status, msg = http.StatusServiceUnavailable, "the request took too long"
	default:
		if s, m, ok := constraintError(err); ok {
			status, msg = s, m
		} else if s, m, ok := infraError(err); ok {
			status, msg = s, m
		}
	}

	_ = c.JSON(status, apiError{Error: msg})
}

// tableNames is longest-first so stripping a prefix never stops at "sprint"
// when the constraint really belongs to sprint_backlog_items.
var tableNames = []string{
	"sprint_backlog_items", "workspace_settings", "generated_reports",
	"report_templates", "sprint_members", "backlog_items", "master_lists",
	"report_queue", "decisions", "products", "projects", "task_dod",
	"modules", "sprints", "clients", "members", "tasks", "roles",
}

// multiColumnConstraints cover more than one column, so their name is not a
// field name — spelling one out would blame a field the caller never sent.
var multiColumnConstraints = map[string]string{
	"sprints_counts_check":              "the day and story-point counts must not be negative",
	"sprints_dates_check":               "a sprint cannot end before it starts",
	"sprints_product_id_number_key":     "a sprint with that number already exists for this module",
	"projects_id_client_id_key":         "that project already exists",
	"modules_id_product_id_key":         "that component already exists",
	"roles_permissions_check":           "permissions must be a JSON object and under 64 KB",
	"clients_ai_insight_size_check":     "aiInsight is too large (64 KB decoded maximum)",
	"products_ai_insight_size_check":    "aiInsight is too large (64 KB decoded maximum)",
	"workspace_settings_settings_check": "settings must be a JSON object and under 64 KB",
}

// fieldFromConstraint turns "sprint_members_allocation_check" into
// "allocation", and "members_capacity_days_check" into "capacityDays" — the
// name the caller actually sent. The column name is already part of the public
// API; the table name and the constraint's own name are internals worth not
// echoing back.
func fieldFromConstraint(name, suffix string) string {
	trimmed, ok := strings.CutSuffix(name, suffix)
	if !ok {
		return ""
	}
	for _, t := range tableNames {
		rest, ok := strings.CutPrefix(trimmed, t+"_")
		if !ok || rest == "" {
			continue
		}
		return camelCase(rest)
	}
	return ""
}

// camelCase turns a snake_case column name into the JSON field name the API
// exposes: capacity_days -> capacityDays.
func camelCase(s string) string {
	parts := strings.Split(s, "_")
	for i := 1; i < len(parts); i++ {
		if parts[i] != "" {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}

// infraError maps the Postgres codes that mean "the database cannot take this
// request right now" onto 503. They are not the caller's fault and they are not
// bugs, but 500 says both: clients and CDNs do not retry a 500, and on-call
// cannot tell it from a real fault. 503 is retryable and honest.
//
// Connection exhaustion is the common one. The connection budget is per
// process, so replicas x MaxDBConns can quietly exceed the server's
// max_connections and every affected request answers 53300.
func infraError(err error) (int, string, bool) {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return 0, "", false
	}
	switch pgErr.Code {
	case "53300": // too_many_connections
		return http.StatusServiceUnavailable, "the service is at capacity, please retry", true
	case "53100", "53200", "53400": // disk_full, out_of_memory, configuration_limit_exceeded
		return http.StatusServiceUnavailable, "the service is out of resources, please retry", true
	case "57P01", "57P02", "57P03": // admin_shutdown, crash_shutdown, cannot_connect_now
		return http.StatusServiceUnavailable, "the database is restarting, please retry", true
	case "08000", "08003", "08006", "08001", "08004": // connection_exception family
		return http.StatusServiceUnavailable, "lost the database connection, please retry", true
	}
	return 0, "", false
}

// constraintError maps a Postgres error onto a 4xx. Every code here is caused
// by what the client sent, so answering 500 would be a lie — and the client
// cannot fix what it is never told about.
func constraintError(err error) (int, string, bool) {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return 0, "", false
	}
	switch pgErr.Code {
	case "23505": // unique_violation
		if m, ok := multiColumnConstraints[pgErr.ConstraintName]; ok {
			return http.StatusConflict, m, true
		}
		if f := fieldFromConstraint(pgErr.ConstraintName, "_key"); f != "" {
			return http.StatusConflict, fmt.Sprintf("that %s is already taken", f), true
		}
		return http.StatusConflict, "a record with that id already exists", true
	case "23503": // foreign_key_violation
		return http.StatusBadRequest, "referenced record does not exist", true
	case "23514": // check_violation
		if m, ok := multiColumnConstraints[pgErr.ConstraintName]; ok {
			return http.StatusBadRequest, m, true
		}
		if f := fieldFromConstraint(pgErr.ConstraintName, "_check"); f != "" {
			return http.StatusBadRequest, fmt.Sprintf("%s is out of range or not an allowed value", f), true
		}
		return http.StatusBadRequest, "a value is not allowed for this record", true
	case "23502": // not_null_violation
		return http.StatusBadRequest,
			fmt.Sprintf("%s is required", pgErr.ColumnName), true
	case "22001": // string_data_right_truncation
		return http.StatusBadRequest, "a value is too long for its column", true
	case "22003": // numeric_value_out_of_range
		return http.StatusBadRequest, "a number is outside the range this field can store", true
	case "2201X", "2201W": // invalid OFFSET / LIMIT value
		return http.StatusBadRequest, "limit and offset must not be negative", true
	case "22P05", "22021": // untranslatable_character, character_not_in_repertoire
		return http.StatusBadRequest, "text contains characters the database cannot store", true
	case "54000": // program_limit_exceeded
		return http.StatusBadRequest, "a value is too large to store", true
	case "22P02": // invalid_text_representation — e.g. a lone UTF-16 surrogate in JSON
		return http.StatusBadRequest, "a value is not valid JSON", true
	case "57014": // query_canceled — statement_timeout fired
		return http.StatusServiceUnavailable, "the request took too long", true
	case "55P03": // lock_not_available — lock_timeout fired while sequencing
		return http.StatusConflict, "that record is busy, please retry", true
	case "40001", "40P01": // serialization_failure, deadlock_detected
		// Nothing is wrong with the request; it lost a race. Say so instead of
		// reporting an opaque 500 the caller cannot act on.
		return http.StatusConflict, "the request conflicted with a concurrent change, please retry", true
	}
	return 0, "", false
}

// bind decodes and validates the JSON body into dst.
func bind[T any](c echo.Context) (T, error) {
	var dst T
	if err := c.Bind(&dst); err != nil {
		return dst, echo.NewHTTPError(http.StatusBadRequest, "invalid JSON body")
	}
	return dst, nil
}

// dbErr maps a database error onto an HTTP error.
func dbErr(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return echo.NewHTTPError(http.StatusNotFound, "not found")
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "the request took too long")
	}
	if status, msg, ok := constraintError(err); ok {
		return echo.NewHTTPError(status, msg)
	}
	return err
}

// orDefault falls back when a client omits an optional constrained field, so
// the insert uses the column's intended default instead of tripping a CHECK.
func orDefault(v, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}

// param returns a required path parameter.
func param(c echo.Context, name string) (string, error) {
	v := c.Param(name)
	if v == "" {
		return "", echo.NewHTTPError(http.StatusBadRequest, name+" is required")
	}
	return v, nil
}

// deref returns the value behind p, or the zero value when p is nil.
func deref[T any](p *T) T {
	var zero T
	if p == nil {
		return zero
	}
	return *p
}

// derefSlice unwraps an optional array field for a partial update. A nil
// pointer means "not supplied" and leaves the column alone. A supplied array,
// empty included, does replace the column.
func derefSlice[T any](p *[]T) []T {
	if p == nil {
		return nil
	}
	return *p
}

// Page bounds every list endpoint. A body limit caps what one request can
// write; nothing capped what a request could read back, so a handful of rows
// could be replayed into an arbitrarily large response on every call.
const (
	defaultPageSize = 200
	maxPageSize     = 1000
	// Past this, OFFSET is the wrong tool anyway — Postgres walks and discards
	// every skipped row. Bounding it also keeps the value inside the int32 the
	// query takes: converting an out-of-range int silently wrapped to a
	// negative OFFSET, which the database rejected as an opaque 500.
	maxOffset = 1_000_000
)

// page reads ?limit and ?offset. limit is clamped; an offset too large to
// answer is refused rather than quietly turned into a different query.
func page(c echo.Context) (limit, offset int32, err error) {
	limit, offset = defaultPageSize, 0
	if v, convErr := strconv.Atoi(c.QueryParam("limit")); convErr == nil && v > 0 {
		limit = int32(min(v, maxPageSize))
	}
	if raw := c.QueryParam("offset"); raw != "" {
		v, convErr := strconv.Atoi(raw)
		if convErr == nil && v > maxOffset {
			return 0, 0, echo.NewHTTPError(http.StatusBadRequest,
				fmt.Sprintf("offset must not exceed %d — narrow the list by parent id instead", maxOffset))
		}
		if convErr == nil && v > 0 {
			offset = int32(v)
		}
	}
	return limit, offset, nil
}

// paged writes a list response, trimming the extra row that page() asked for
// and using its presence to tell the caller there is another page.
func paged[T any](c echo.Context, rows []T, limit int32) error {
	if rows == nil {
		rows = []T{}
	}
	if int32(len(rows)) > limit {
		rows = rows[:limit]
		c.Response().Header().Set("X-Has-More", "true")
	}
	return c.JSON(http.StatusOK, rows)
}

// optional records whether a JSON key was present at all. A plain pointer
// cannot: encoding/json sets a *T to nil for an explicit null exactly as it
// does for an absent key, so the two are indistinguishable. A type with its own
// UnmarshalJSON is called only when the key is there — null included.
type optional[T any] struct {
	Set   bool
	Value *T
}

func (o *optional[T]) UnmarshalJSON(b []byte) error {
	o.Set = true
	if bytes.Equal(bytes.TrimSpace(b), []byte("null")) {
		o.Value = nil
		return nil
	}
	var v T
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	o.Value = &v
	return nil
}

// jsonObjectOrEmpty normalises a jsonb column that the schema requires to be an
// object. Absent and an explicit null both mean "no permissions/settings", and
// storing the literal null instead would make jsonb_each_text over the table
// fail on that one row.
func jsonObjectOrEmpty(raw json.RawMessage) json.RawMessage {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return json.RawMessage(`{}`)
	}
	return trimmed
}

// ptr returns a pointer to v — handy for optional/nullable columns.
func ptr[T any](v T) *T { return &v }
