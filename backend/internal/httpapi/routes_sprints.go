package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/syabanf/pm-platform/backend/internal/db"
)

// ------------------------------------------------------------------ ids ---

// newSprintScopedID mints a TEXT id for sprint/backlog rows: a prefix, a
// millisecond timestamp and 4 random bytes. Self-contained on purpose.
func newSprintScopedID(prefix string) string {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return fmt.Sprintf("%s_%d_%s", prefix, time.Now().UnixMilli(), hex.EncodeToString(buf))
}

// --------------------------------------------------------------- bodies ---

type createSprintRequest struct {
	ID          *string    `json:"id"`
	ModuleID    *string    `json:"moduleId"`
	Number      *int32     `json:"number"`
	Name        string     `json:"name"`
	Goal        string     `json:"goal"`
	StartDate   *time.Time `json:"startDate"`
	EndDate     *time.Time `json:"endDate"`
	WorkingDays *int32     `json:"workingDays"`
	DaysLeft    *int32     `json:"daysLeft"`
	Status      *string    `json:"status"`
	Committed   *int32     `json:"committed"`
	Completed   *int32     `json:"completed"`
	Progress    *int32     `json:"progress"`
	Risk        *string    `json:"risk"`
}

type updateSprintRequest struct {
	ModuleID    *string    `json:"moduleId"`
	Number      *int32     `json:"number"`
	Name        *string    `json:"name"`
	Goal        *string    `json:"goal"`
	StartDate   *time.Time `json:"startDate"`
	EndDate     *time.Time `json:"endDate"`
	WorkingDays *int32     `json:"workingDays"`
	DaysLeft    *int32     `json:"daysLeft"`
	Status      *string    `json:"status"`
	Committed   *int32     `json:"committed"`
	Completed   *int32     `json:"completed"`
	Progress    *int32     `json:"progress"`
	Risk        *string    `json:"risk"`
}

type addSprintMemberRequest struct {
	Allocation   *int32   `json:"allocation"`
	CapacityDays *float64 `json:"capacityDays"`
}

type addSprintBacklogItemRequest struct {
	Position *int32 `json:"position"`
}

type createBacklogItemRequest struct {
	ID                 *string  `json:"id"`
	ModuleID           *string  `json:"moduleId"`
	Title              string   `json:"title"`
	Story              string   `json:"story"`
	AcceptanceCriteria []string `json:"acceptanceCriteria"`
	Type               *string  `json:"type"`
	Priority           *string  `json:"priority"`
	Readiness          *string  `json:"readiness"`
	Estimate           *int32   `json:"estimate"`
	AiSuggestions      []string `json:"aiSuggestions"`
}

type updateBacklogItemRequest struct {
	ModuleID           *string   `json:"moduleId"`
	Title              *string   `json:"title"`
	Story              *string   `json:"story"`
	AcceptanceCriteria *[]string `json:"acceptanceCriteria"`
	Type               *string   `json:"type"`
	Priority           *string   `json:"priority"`
	Readiness          *string   `json:"readiness"`
	Estimate           *int32    `json:"estimate"`
	AiSuggestions      *[]string `json:"aiSuggestions"`
}

// --------------------------------------------------------------- routes ---

// registerSprintRoutes mounts sprints, sprint membership, the sprint backlog
// and the product backlog.
func (s *Server) registerSprintRoutes(g *echo.Group) {
	g.GET("/products/:productId/sprints", s.listSprintsByProduct)
	g.POST("/products/:productId/sprints", s.createSprint)
	g.GET("/modules/:moduleId/sprints", s.listSprintsByModule)

	g.GET("/sprints/:sprintId", s.getSprint)
	g.PATCH("/sprints/:sprintId", s.updateSprint)
	g.DELETE("/sprints/:sprintId", s.deleteSprint)

	g.GET("/sprints/:sprintId/members", s.listSprintMembers)
	g.PUT("/sprints/:sprintId/members/:memberId", s.addSprintMember)
	g.DELETE("/sprints/:sprintId/members/:memberId", s.removeSprintMember)

	g.GET("/sprints/:sprintId/backlog", s.listSprintBacklogItems)
	g.PUT("/sprints/:sprintId/backlog/:itemId", s.addSprintBacklogItem)
	g.DELETE("/sprints/:sprintId/backlog/:itemId", s.removeSprintBacklogItem)

	g.GET("/products/:productId/backlog", s.listBacklogItemsByProduct)
	g.POST("/products/:productId/backlog", s.createBacklogItem)
	g.GET("/modules/:moduleId/backlog", s.listBacklogItemsByModule)

	g.GET("/backlog/:itemId", s.getBacklogItem)
	g.PATCH("/backlog/:itemId", s.updateBacklogItem)
	g.DELETE("/backlog/:itemId", s.deleteBacklogItem)
}

// -------------------------------------------------------------- sprints ---

func (s *Server) listSprintsByProduct(c echo.Context) error {
	productID, err := param(c, "productId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListSprintsByProduct(c.Request().Context(), productID)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) listSprintsByModule(c echo.Context) error {
	moduleID, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListSprintsByModule(c.Request().Context(), ptr(moduleID))
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) createSprint(c echo.Context) error {
	ctx := c.Request().Context()

	productID, err := param(c, "productId")
	if err != nil {
		return err
	}
	req, err := bind[createSprintRequest](c)
	if err != nil {
		return err
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	number := deref(req.Number)
	if req.Number == nil {
		number, err = s.q.NextSprintNumber(ctx, productID)
		if err != nil {
			return dbErr(err)
		}
	}

	id := deref(req.ID)
	if id == "" {
		id = newSprintScopedID("spr")
	}

	status := deref(req.Status)
	if status == "" {
		status = "planned"
	}
	risk := deref(req.Risk)
	if risk == "" {
		risk = "low"
	}

	row, err := s.q.CreateSprint(ctx, db.CreateSprintParams{
		ID:          id,
		ProductID:   productID,
		ModuleID:    req.ModuleID,
		Number:      number,
		Name:        req.Name,
		Goal:        req.Goal,
		StartDate:   req.StartDate,
		EndDate:     req.EndDate,
		WorkingDays: deref(req.WorkingDays),
		DaysLeft:    deref(req.DaysLeft),
		Status:      status,
		Committed:   deref(req.Committed),
		Completed:   deref(req.Completed),
		Progress:    deref(req.Progress),
		Risk:        risk,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getSprint(c echo.Context) error {
	id, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	row, err := s.q.GetSprint(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateSprint(c echo.Context) error {
	ctx := c.Request().Context()

	id, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	req, err := bind[updateSprintRequest](c)
	if err != nil {
		return err
	}

	cur, err := s.q.GetSprint(ctx, id)
	if err != nil {
		return dbErr(err)
	}

	arg := db.UpdateSprintParams{
		ID:          cur.ID,
		ModuleID:    cur.ModuleID,
		Number:      cur.Number,
		Name:        cur.Name,
		Goal:        cur.Goal,
		StartDate:   cur.StartDate,
		EndDate:     cur.EndDate,
		WorkingDays: cur.WorkingDays,
		DaysLeft:    cur.DaysLeft,
		Status:      cur.Status,
		Committed:   cur.Committed,
		Completed:   cur.Completed,
		Progress:    cur.Progress,
		Risk:        cur.Risk,
	}
	if req.ModuleID != nil {
		arg.ModuleID = req.ModuleID
	}
	if req.Number != nil {
		arg.Number = *req.Number
	}
	if req.Name != nil {
		arg.Name = *req.Name
	}
	if req.Goal != nil {
		arg.Goal = *req.Goal
	}
	if req.StartDate != nil {
		arg.StartDate = req.StartDate
	}
	if req.EndDate != nil {
		arg.EndDate = req.EndDate
	}
	if req.WorkingDays != nil {
		arg.WorkingDays = *req.WorkingDays
	}
	if req.DaysLeft != nil {
		arg.DaysLeft = *req.DaysLeft
	}
	if req.Status != nil {
		arg.Status = *req.Status
	}
	if req.Committed != nil {
		arg.Committed = *req.Committed
	}
	if req.Completed != nil {
		arg.Completed = *req.Completed
	}
	if req.Progress != nil {
		arg.Progress = *req.Progress
	}
	if req.Risk != nil {
		arg.Risk = *req.Risk
	}

	row, err := s.q.UpdateSprint(ctx, arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteSprint(c echo.Context) error {
	id, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	if err := s.q.DeleteSprint(c.Request().Context(), id); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ------------------------------------------------------- sprint members ---

func (s *Server) listSprintMembers(c echo.Context) error {
	sprintID, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListSprintMembers(c.Request().Context(), sprintID)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) addSprintMember(c echo.Context) error {
	sprintID, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	memberID, err := param(c, "memberId")
	if err != nil {
		return err
	}
	req, err := bind[addSprintMemberRequest](c)
	if err != nil {
		return err
	}

	allocation := int32(100)
	if req.Allocation != nil {
		allocation = *req.Allocation
	}

	row, err := s.q.AddSprintMember(c.Request().Context(), db.AddSprintMemberParams{
		SprintID:     sprintID,
		MemberID:     memberID,
		Allocation:   allocation,
		CapacityDays: deref(req.CapacityDays),
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) removeSprintMember(c echo.Context) error {
	sprintID, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	memberID, err := param(c, "memberId")
	if err != nil {
		return err
	}
	err = s.q.RemoveSprintMember(c.Request().Context(), db.RemoveSprintMemberParams{
		SprintID: sprintID,
		MemberID: memberID,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ------------------------------------------------------- sprint backlog ---

func (s *Server) listSprintBacklogItems(c echo.Context) error {
	sprintID, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListSprintBacklogItems(c.Request().Context(), sprintID)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) addSprintBacklogItem(c echo.Context) error {
	sprintID, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	itemID, err := param(c, "itemId")
	if err != nil {
		return err
	}
	req, err := bind[addSprintBacklogItemRequest](c)
	if err != nil {
		return err
	}

	row, err := s.q.AddSprintBacklogItem(c.Request().Context(), db.AddSprintBacklogItemParams{
		SprintID:      sprintID,
		BacklogItemID: itemID,
		Position:      deref(req.Position),
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) removeSprintBacklogItem(c echo.Context) error {
	sprintID, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	itemID, err := param(c, "itemId")
	if err != nil {
		return err
	}
	err = s.q.RemoveSprintBacklogItem(c.Request().Context(), db.RemoveSprintBacklogItemParams{
		SprintID:      sprintID,
		BacklogItemID: itemID,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// -------------------------------------------------------- backlog items ---

func (s *Server) listBacklogItemsByProduct(c echo.Context) error {
	productID, err := param(c, "productId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListBacklogItemsByProduct(c.Request().Context(), productID)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) listBacklogItemsByModule(c echo.Context) error {
	moduleID, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListBacklogItemsByModule(c.Request().Context(), ptr(moduleID))
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) createBacklogItem(c echo.Context) error {
	productID, err := param(c, "productId")
	if err != nil {
		return err
	}
	req, err := bind[createBacklogItemRequest](c)
	if err != nil {
		return err
	}
	if req.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}

	id := deref(req.ID)
	if id == "" {
		id = newSprintScopedID("bli")
	}

	itemType := deref(req.Type)
	if itemType == "" {
		itemType = "story"
	}
	priority := deref(req.Priority)
	if priority == "" {
		priority = "medium"
	}
	readiness := deref(req.Readiness)
	if readiness == "" {
		readiness = "draft"
	}

	acceptance := req.AcceptanceCriteria
	if acceptance == nil {
		acceptance = []string{}
	}
	suggestions := req.AiSuggestions
	if suggestions == nil {
		suggestions = []string{}
	}

	row, err := s.q.CreateBacklogItem(c.Request().Context(), db.CreateBacklogItemParams{
		ID:                 id,
		ProductID:          productID,
		ModuleID:           req.ModuleID,
		Title:              req.Title,
		Story:              req.Story,
		AcceptanceCriteria: acceptance,
		Type:               itemType,
		Priority:           priority,
		Readiness:          readiness,
		Estimate:           deref(req.Estimate),
		AiSuggestions:      suggestions,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getBacklogItem(c echo.Context) error {
	id, err := param(c, "itemId")
	if err != nil {
		return err
	}
	row, err := s.q.GetBacklogItem(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateBacklogItem(c echo.Context) error {
	ctx := c.Request().Context()

	id, err := param(c, "itemId")
	if err != nil {
		return err
	}
	req, err := bind[updateBacklogItemRequest](c)
	if err != nil {
		return err
	}

	cur, err := s.q.GetBacklogItem(ctx, id)
	if err != nil {
		return dbErr(err)
	}

	arg := db.UpdateBacklogItemParams{
		ID:                 cur.ID,
		ModuleID:           cur.ModuleID,
		Title:              cur.Title,
		Story:              cur.Story,
		AcceptanceCriteria: cur.AcceptanceCriteria,
		Type:               cur.Type,
		Priority:           cur.Priority,
		Readiness:          cur.Readiness,
		Estimate:           cur.Estimate,
		AiSuggestions:      cur.AiSuggestions,
	}
	if req.ModuleID != nil {
		arg.ModuleID = req.ModuleID
	}
	if req.Title != nil {
		arg.Title = *req.Title
	}
	if req.Story != nil {
		arg.Story = *req.Story
	}
	if req.AcceptanceCriteria != nil {
		arg.AcceptanceCriteria = *req.AcceptanceCriteria
	}
	if req.Type != nil {
		arg.Type = *req.Type
	}
	if req.Priority != nil {
		arg.Priority = *req.Priority
	}
	if req.Readiness != nil {
		arg.Readiness = *req.Readiness
	}
	if req.Estimate != nil {
		arg.Estimate = *req.Estimate
	}
	if req.AiSuggestions != nil {
		arg.AiSuggestions = *req.AiSuggestions
	}
	if arg.AcceptanceCriteria == nil {
		arg.AcceptanceCriteria = []string{}
	}
	if arg.AiSuggestions == nil {
		arg.AiSuggestions = []string{}
	}

	row, err := s.q.UpdateBacklogItem(ctx, arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteBacklogItem(c echo.Context) error {
	id, err := param(c, "itemId")
	if err != nil {
		return err
	}
	if err := s.q.DeleteBacklogItem(c.Request().Context(), id); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}
