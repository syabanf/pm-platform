// Package httpapi wires the REST API on top of the generated query layer.
package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/syabanf/pm-platform/backend/internal/config"
	"github.com/syabanf/pm-platform/backend/internal/db"
)

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
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: strings.Split(cfg.CORSOrigins, ","),
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
	}))

	e.GET("/healthz", s.health)

	api := e.Group("/api/v1")
	s.routes(api)

	return e
}

func (s *Server) health(c echo.Context) error {
	if err := s.pool.Ping(c.Request().Context()); err != nil {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "database unreachable")
	}
	return c.JSON(http.StatusOK, echo.Map{"status": "ok"})
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
	}

	_ = c.JSON(status, apiError{Error: msg})
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
	return err
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

// ptr returns a pointer to v — handy for optional/nullable columns.
func ptr[T any](v T) *T { return &v }
