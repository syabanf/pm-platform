package httpapi

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/syabanf/pm-platform/backend/internal/db"
)

// registerReviewRoutes mounts the retrospective and sprint-review records.
//
// All four hang off a sprint, but they list at the top level with an optional
// ?sprintId= filter: the retro page wants one sprint, the workspace store wants
// them all, and one route shape serves both.
func (s *Server) registerReviewRoutes(g *echo.Group) {
	g.GET("/retro-notes", s.listRetroNotes)
	g.POST("/retro-notes", s.createRetroNote)
	g.PATCH("/retro-notes/:id", s.updateRetroNote)
	g.DELETE("/retro-notes/:id", s.deleteRetroNote)

	g.GET("/retro-actions", s.listRetroActions)
	g.POST("/retro-actions", s.createRetroAction)
	g.PATCH("/retro-actions/:id", s.updateRetroAction)
	g.DELETE("/retro-actions/:id", s.deleteRetroAction)

	g.GET("/demo-items", s.listDemoItems)
	g.POST("/demo-items", s.createDemoItem)
	g.PATCH("/demo-items/:id", s.updateDemoItem)
	g.DELETE("/demo-items/:id", s.deleteDemoItem)

	g.GET("/client-feedback", s.listClientFeedback)
	g.POST("/client-feedback", s.createClientFeedback)
	g.PATCH("/client-feedback/:id", s.updateClientFeedback)
	g.DELETE("/client-feedback/:id", s.deleteClientFeedback)
}

// sprintFilter reads the optional ?sprintId= query: nil means every sprint.
func sprintFilter(c echo.Context) *string {
	if v := c.QueryParam("sprintId"); v != "" {
		return &v
	}
	return nil
}

// deletedOrNotFound turns an execrows result into 204 or 404.
func deletedOrNotFound(c echo.Context, n int64, err error) error {
	if err != nil {
		return dbErr(err)
	}
	if n == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "not found")
	}
	return c.NoContent(http.StatusNoContent)
}

// ------------------------------------------------------------ retro notes ---

type createRetroNoteRequest struct {
	ID       string `json:"id"`
	SprintID string `json:"sprintId"`
	Kind     string `json:"kind"`
	Text     string `json:"text"`
}

type updateRetroNoteRequest struct {
	Kind *string `json:"kind"`
	Text *string `json:"text"`
}

func (s *Server) listRetroNotes(c echo.Context) error {
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListRetroNotes(c.Request().Context(), db.ListRetroNotesParams{
		SprintID: sprintFilter(c), Lim: limit + 1, Off: offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createRetroNote(c echo.Context) error {
	req, err := bind[createRetroNoteRequest](c)
	if err != nil {
		return err
	}
	if req.SprintID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "sprintId is required")
	}
	if req.Text == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "text is required")
	}
	row, err := s.q.CreateRetroNote(c.Request().Context(), db.CreateRetroNoteParams{
		ID:       orDefault(req.ID, newID("rn")),
		SprintID: req.SprintID,
		Kind:     orDefault(req.Kind, "went-well"),
		Text:     req.Text,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) updateRetroNote(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	req, err := bind[updateRetroNoteRequest](c)
	if err != nil {
		return err
	}
	row, err := s.q.UpdateRetroNote(c.Request().Context(), db.UpdateRetroNoteParams{
		ID: id, Kind: req.Kind, Text: req.Text,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteRetroNote(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	n, err := s.q.DeleteRetroNote(c.Request().Context(), id)
	return deletedOrNotFound(c, n, err)
}

// ---------------------------------------------------------- retro actions ---

type createRetroActionRequest struct {
	ID       string  `json:"id"`
	SprintID string  `json:"sprintId"`
	Action   string  `json:"action"`
	OwnerID  *string `json:"ownerId"`
	Due      *string `json:"due"`
	Status   string  `json:"status"`
}

type updateRetroActionRequest struct {
	Action  *string `json:"action"`
	OwnerID *string `json:"ownerId"`
	Due     *string `json:"due"`
	Status  *string `json:"status"`
}

func (s *Server) listRetroActions(c echo.Context) error {
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListRetroActions(c.Request().Context(), db.ListRetroActionsParams{
		SprintID: sprintFilter(c), Lim: limit + 1, Off: offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createRetroAction(c echo.Context) error {
	req, err := bind[createRetroActionRequest](c)
	if err != nil {
		return err
	}
	if req.SprintID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "sprintId is required")
	}
	if req.Action == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "action is required")
	}
	due, err := parseDate(req.Due)
	if err != nil {
		return err
	}
	row, err := s.q.CreateRetroAction(c.Request().Context(), db.CreateRetroActionParams{
		ID:       orDefault(req.ID, newID("ra")),
		SprintID: req.SprintID,
		Action:   req.Action,
		OwnerID:  req.OwnerID,
		Due:      due,
		Status:   orDefault(req.Status, "open"),
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) updateRetroAction(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	req, err := bind[updateRetroActionRequest](c)
	if err != nil {
		return err
	}
	due, err := parseDate(req.Due)
	if err != nil {
		return err
	}
	row, err := s.q.UpdateRetroAction(c.Request().Context(), db.UpdateRetroActionParams{
		ID: id, Action: req.Action, OwnerID: req.OwnerID, Due: due, Status: req.Status,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteRetroAction(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	n, err := s.q.DeleteRetroAction(c.Request().Context(), id)
	return deletedOrNotFound(c, n, err)
}

// ------------------------------------------------------------- demo items ---

type createDemoItemRequest struct {
	ID       string `json:"id"`
	SprintID string `json:"sprintId"`
	Label    string `json:"label"`
	Done     bool   `json:"done"`
}

type updateDemoItemRequest struct {
	Label *string `json:"label"`
	Done  *bool   `json:"done"`
}

func (s *Server) listDemoItems(c echo.Context) error {
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListDemoItems(c.Request().Context(), db.ListDemoItemsParams{
		SprintID: sprintFilter(c), Lim: limit + 1, Off: offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createDemoItem(c echo.Context) error {
	req, err := bind[createDemoItemRequest](c)
	if err != nil {
		return err
	}
	if req.SprintID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "sprintId is required")
	}
	if req.Label == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "label is required")
	}
	row, err := s.q.CreateDemoItem(c.Request().Context(), db.CreateDemoItemParams{
		ID:       orDefault(req.ID, newID("demo")),
		SprintID: req.SprintID,
		Label:    req.Label,
		Done:     req.Done,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) updateDemoItem(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	req, err := bind[updateDemoItemRequest](c)
	if err != nil {
		return err
	}
	row, err := s.q.UpdateDemoItem(c.Request().Context(), db.UpdateDemoItemParams{
		ID: id, Label: req.Label, Done: req.Done,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteDemoItem(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	n, err := s.q.DeleteDemoItem(c.Request().Context(), id)
	return deletedOrNotFound(c, n, err)
}

// -------------------------------------------------------- client feedback ---

type createClientFeedbackRequest struct {
	ID          string `json:"id"`
	SprintID    string `json:"sprintId"`
	From        string `json:"from"`
	Note        string `json:"note"`
	Disposition string `json:"disposition"`
}

type updateClientFeedbackRequest struct {
	From        *string `json:"from"`
	Note        *string `json:"note"`
	Disposition *string `json:"disposition"`
}

func (s *Server) listClientFeedback(c echo.Context) error {
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListClientFeedback(c.Request().Context(), db.ListClientFeedbackParams{
		SprintID: sprintFilter(c), Lim: limit + 1, Off: offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createClientFeedback(c echo.Context) error {
	req, err := bind[createClientFeedbackRequest](c)
	if err != nil {
		return err
	}
	if req.SprintID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "sprintId is required")
	}
	if req.Note == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "note is required")
	}
	row, err := s.q.CreateClientFeedback(c.Request().Context(), db.CreateClientFeedbackParams{
		ID:          orDefault(req.ID, newID("cf")),
		SprintID:    req.SprintID,
		FromName:    req.From,
		Note:        req.Note,
		Disposition: req.Disposition,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) updateClientFeedback(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	req, err := bind[updateClientFeedbackRequest](c)
	if err != nil {
		return err
	}
	row, err := s.q.UpdateClientFeedback(c.Request().Context(), db.UpdateClientFeedbackParams{
		ID: id, FromName: req.From, Note: req.Note, Disposition: req.Disposition,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteClientFeedback(c echo.Context) error {
	id, err := param(c, "id")
	if err != nil {
		return err
	}
	n, err := s.q.DeleteClientFeedback(c.Request().Context(), id)
	return deletedOrNotFound(c, n, err)
}
