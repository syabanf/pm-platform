package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/syabanf/pm-platform/backend/internal/db"
)

// registerSettingsRoutes mounts report templates, the report queue, generated
// reports, roles, master lists and workspace settings.
func (s *Server) registerSettingsRoutes(g *echo.Group) {
	g.GET("/report-templates", s.listReportTemplates)
	g.PUT("/report-templates", s.upsertReportTemplate)
	g.DELETE("/report-templates/:id", s.deleteReportTemplate)

	g.GET("/report-queue", s.listReportQueue)
	g.POST("/report-queue", s.createReportQueueItem)
	g.PATCH("/report-queue/:id", s.updateReportQueueStatus)
	g.DELETE("/report-queue/:id", s.deleteReportQueueItem)

	g.GET("/products/:productId/generated-reports", s.listGeneratedReportsByProduct)
	g.POST("/generated-reports", s.createGeneratedReport)
	g.PATCH("/generated-reports/:id/sent", s.markGeneratedReportSent)

	g.GET("/roles", s.listRoles)
	g.PUT("/roles", s.upsertRole)

	g.GET("/lists/:key", s.listMasterValues)
	g.POST("/lists/:key", s.addMasterValue)
	g.DELETE("/lists/:key/:value", s.deleteMasterValue)

	g.GET("/settings", s.getWorkspaceSettings)
	g.PUT("/settings", s.upsertWorkspaceSettings)
}

// ------------------------------------------------------------- local utils ---

// newSettingsID generates a short, unique TEXT id for settings-owned rows.
func newSettingsID(prefix string) string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return prefix + "-" + time.Now().UTC().Format("20060102150405.000000000")
	}
	return prefix + "-" + hex.EncodeToString(b[:])
}

// parseSettingsDate accepts "2006-01-02" or RFC3339 and returns a DATE value.
func parseSettingsDate(raw *string) (*time.Time, error) {
	if raw == nil || *raw == "" {
		return nil, nil
	}
	if t, err := time.Parse("2006-01-02", *raw); err == nil {
		return ptr(t), nil
	}
	if t, err := time.Parse(time.RFC3339, *raw); err == nil {
		return ptr(t.UTC().Truncate(24 * time.Hour)), nil
	}
	return nil, echo.NewHTTPError(http.StatusBadRequest, "invalid date: expected YYYY-MM-DD")
}

// ---------------------------------------------------------- report_templates ---

type upsertReportTemplateRequest struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Audience   string   `json:"audience"`
	Visibility string   `json:"visibility"`
	Sections   []string `json:"sections"`
}

func (s *Server) listReportTemplates(c echo.Context) error {
	rows, err := s.q.ListReportTemplates(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	if rows == nil {
		rows = []db.ReportTemplate{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) upsertReportTemplate(c echo.Context) error {
	req, err := bind[upsertReportTemplateRequest](c)
	if err != nil {
		return err
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}
	if req.ID == "" {
		req.ID = newSettingsID("tpl")
	}
	if req.Sections == nil {
		req.Sections = []string{}
	}

	row, err := s.q.UpsertReportTemplate(c.Request().Context(), db.UpsertReportTemplateParams{
		ID:         req.ID,
		Name:       req.Name,
		Audience:   req.Audience,
		Visibility: orDefault(req.Visibility, "internal"),
		Sections:   req.Sections,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteReportTemplate(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	if err := s.q.DeleteReportTemplate(c.Request().Context(), id); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// -------------------------------------------------------------- report_queue ---

type createReportQueueRequest struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	ProductID string  `json:"productId"`
	Client    string  `json:"client"`
	Type      string  `json:"type"`
	Template  string  `json:"template"`
	Due       *string `json:"due"`
	Status    string  `json:"status"`
}

type updateReportQueueStatusRequest struct {
	Status string `json:"status"`
}

func (s *Server) listReportQueue(c echo.Context) error {
	rows, err := s.q.ListReportQueue(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	if rows == nil {
		rows = []db.ReportQueue{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) createReportQueueItem(c echo.Context) error {
	req, err := bind[createReportQueueRequest](c)
	if err != nil {
		return err
	}
	if req.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}
	if req.ProductID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "productId is required")
	}
	due, err := parseSettingsDate(req.Due)
	if err != nil {
		return err
	}
	if req.ID == "" {
		req.ID = newSettingsID("rq")
	}

	row, err := s.q.CreateReportQueueItem(c.Request().Context(), db.CreateReportQueueItemParams{
		ID:        req.ID,
		Title:     req.Title,
		ProductID: req.ProductID,
		Client:    req.Client,
		Type:      req.Type,
		Template:  req.Template,
		Due:       due,
		Status:    orDefault(req.Status, "open"),
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) updateReportQueueStatus(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	req, err := bind[updateReportQueueStatusRequest](c)
	if err != nil {
		return err
	}
	if req.Status == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "status is required")
	}

	row, err := s.q.UpdateReportQueueStatus(c.Request().Context(), db.UpdateReportQueueStatusParams{
		ID:     id,
		Status: req.Status,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteReportQueueItem(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	if err := s.q.DeleteReportQueueItem(c.Request().Context(), id); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// --------------------------------------------------------- generated_reports ---

type createGeneratedReportRequest struct {
	ID          string  `json:"id"`
	ProductID   string  `json:"productId"`
	SprintID    *string `json:"sprintId"`
	Type        string  `json:"type"`
	Template    string  `json:"template"`
	Period      string  `json:"period"`
	GeneratedOn *string `json:"generatedOn"`
	Status      string  `json:"status"`
}

func (s *Server) listGeneratedReportsByProduct(c echo.Context) error {
	productID, err := param(c, "productId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListGeneratedReportsByProduct(c.Request().Context(), productID)
	if err != nil {
		return dbErr(err)
	}
	if rows == nil {
		rows = []db.GeneratedReport{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) createGeneratedReport(c echo.Context) error {
	req, err := bind[createGeneratedReportRequest](c)
	if err != nil {
		return err
	}
	if req.ProductID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "productId is required")
	}
	generatedOn, err := parseSettingsDate(req.GeneratedOn)
	if err != nil {
		return err
	}
	if generatedOn == nil {
		now := time.Now().UTC()
		generatedOn = ptr(time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC))
	}
	if req.ID == "" {
		req.ID = newSettingsID("rep")
	}

	row, err := s.q.CreateGeneratedReport(c.Request().Context(), db.CreateGeneratedReportParams{
		ID:          req.ID,
		ProductID:   req.ProductID,
		SprintID:    req.SprintID,
		Type:        req.Type,
		Template:    req.Template,
		Period:      req.Period,
		GeneratedOn: deref(generatedOn),
		Status:      orDefault(req.Status, "draft"),
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) markGeneratedReportSent(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	row, err := s.q.MarkGeneratedReportSent(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

// --------------------------------------------------------------------- roles ---

type upsertRoleRequest struct {
	ID          string          `json:"id"`
	Label       string          `json:"label"`
	Permissions json.RawMessage `json:"permissions"`
}

func (s *Server) listRoles(c echo.Context) error {
	rows, err := s.q.ListRoles(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	if rows == nil {
		rows = []db.Role{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) upsertRole(c echo.Context) error {
	req, err := bind[upsertRoleRequest](c)
	if err != nil {
		return err
	}
	if req.Label == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "label is required")
	}
	if req.ID == "" {
		req.ID = newSettingsID("role")
	}
	permissions := []byte(req.Permissions)
	if len(permissions) == 0 {
		permissions = []byte(`{}`)
	}

	row, err := s.q.UpsertRole(c.Request().Context(), db.UpsertRoleParams{
		ID:          req.ID,
		Label:       req.Label,
		Permissions: permissions,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

// -------------------------------------------------------------- master_lists ---

type addMasterValueRequest struct {
	Value    string `json:"value"`
	Position int32  `json:"position"`
}

func (s *Server) listMasterValues(c echo.Context) error {
	key, err := param(c, "key")
	if err != nil {
		return err
	}
	rows, err := s.q.ListMasterValues(c.Request().Context(), key)
	if err != nil {
		return dbErr(err)
	}
	if rows == nil {
		rows = []db.MasterList{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) addMasterValue(c echo.Context) error {
	key, err := param(c, "key")
	if err != nil {
		return err
	}
	req, err := bind[addMasterValueRequest](c)
	if err != nil {
		return err
	}
	if req.Value == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "value is required")
	}

	row, err := s.q.AddMasterValue(c.Request().Context(), db.AddMasterValueParams{
		Key:      key,
		Value:    req.Value,
		Position: req.Position,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) deleteMasterValue(c echo.Context) error {
	key, err := param(c, "key")
	if err != nil {
		return err
	}
	value, err := param(c, "value")
	if err != nil {
		return err
	}
	if err := s.q.DeleteMasterValue(c.Request().Context(), db.DeleteMasterValueParams{
		Key:   key,
		Value: value,
	}); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// -------------------------------------------------------- workspace_settings ---

type upsertWorkspaceSettingsRequest struct {
	Name        string          `json:"name"`
	Settings    json.RawMessage `json:"settings"`
	DodTemplate []string        `json:"dodTemplate"`
}

func (s *Server) getWorkspaceSettings(c echo.Context) error {
	row, err := s.q.GetWorkspaceSettings(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) upsertWorkspaceSettings(c echo.Context) error {
	req, err := bind[upsertWorkspaceSettingsRequest](c)
	if err != nil {
		return err
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}
	settings := []byte(req.Settings)
	if len(settings) == 0 {
		settings = []byte(`{}`)
	}
	if req.DodTemplate == nil {
		req.DodTemplate = []string{}
	}

	row, err := s.q.UpsertWorkspaceSettings(c.Request().Context(), db.UpsertWorkspaceSettingsParams{
		Name:        req.Name,
		Settings:    settings,
		DodTemplate: req.DodTemplate,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}
