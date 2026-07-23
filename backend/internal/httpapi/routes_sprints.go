package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
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
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListSprintsByProduct(c.Request().Context(), db.ListSprintsByProductParams{
		ProductID: productID,
		Lim:       limit + 1,
		Off:       offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) listSprintsByModule(c echo.Context) error {
	moduleID, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListSprintsByModule(c.Request().Context(), db.ListSprintsByModuleParams{
		ModuleID: ptr(moduleID),
		Lim:      limit + 1,
		Off:      offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
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

	id := deref(req.ID)
	if id == "" {
		id = newSprintScopedID("spr")
	}

	workingDays := int32(10)
	if req.WorkingDays != nil {
		workingDays = *req.WorkingDays
	}
	daysLeft := int32(10)
	if req.DaysLeft != nil {
		daysLeft = *req.DaysLeft
	}

	status := orDefault(deref(req.Status), "planning")
	risk := orDefault(deref(req.Risk), "low")

	// Explicit number: the caller owns it, so a clash is genuinely a conflict.
	if req.Number != nil {
		row, err := s.q.CreateSprint(ctx, db.CreateSprintParams{
			ID:          id,
			ProductID:   productID,
			ModuleID:    req.ModuleID,
			Number:      *req.Number,
			Name:        req.Name,
			Goal:        req.Goal,
			StartDate:   req.StartDate,
			EndDate:     req.EndDate,
			WorkingDays: workingDays,
			DaysLeft:    daysLeft,
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

	// Auto-numbered: lock the product, then read the next number and insert it.
	// The lock makes a burst queue up and each create take the next number,
	// instead of every request reading the same MAX and fighting over
	// UNIQUE (product_id, number).
	var row db.Sprint
	err = s.withTx(ctx, func(q *db.Queries) error {
		if _, lockErr := q.LockProductForUpdate(ctx, productID); lockErr != nil {
			return lockErr
		}
		number, numErr := q.NextSprintNumber(ctx, productID)
		if numErr != nil {
			return numErr
		}
		var createErr error
		row, createErr = q.CreateSprint(ctx, db.CreateSprintParams{
			ID:          id,
			ProductID:   productID,
			ModuleID:    req.ModuleID,
			Number:      number,
			Name:        req.Name,
			Goal:        req.Goal,
			StartDate:   req.StartDate,
			EndDate:     req.EndDate,
			WorkingDays: workingDays,
			DaysLeft:    daysLeft,
			Status:      status,
			Committed:   deref(req.Committed),
			Completed:   deref(req.Completed),
			Progress:    deref(req.Progress),
			Risk:        risk,
		})
		return createErr
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusBadRequest, "productId does not exist")
		}
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

	// Partial update: only the named fields are written.
	arg := db.UpdateSprintParams{
		ID:          id,
		ModuleID:    req.ModuleID,
		Number:      req.Number,
		Name:        req.Name,
		Goal:        req.Goal,
		StartDate:   req.StartDate,
		EndDate:     req.EndDate,
		WorkingDays: req.WorkingDays,
		DaysLeft:    req.DaysLeft,
		Status:      req.Status,
		Committed:   req.Committed,
		Completed:   req.Completed,
		Progress:    req.Progress,
		Risk:        req.Risk,
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

	ctx := c.Request().Context()

	add := func(q *db.Queries, position int32) (db.SprintBacklogItem, error) {
		return q.AddSprintBacklogItem(ctx, db.AddSprintBacklogItemParams{
			SprintID:      sprintID,
			BacklogItemID: itemID,
			Position:      position,
		})
	}

	var row db.SprintBacklogItem
	if req.Position != nil {
		row, err = add(s.q, *req.Position)
	} else {
		// Appending needs a lock, or a burst of adds all read the same MAX and
		// pile onto position 0. Take the backlog item before the sprint: the
		// insert's own foreign-key check will lock the item anyway, and a
		// cascading parent delete walks backlog_items first — locking in the
		// other order is an AB-BA cycle that deadlocks every such delete.
		err = s.withTx(ctx, func(q *db.Queries) error {
			if _, lockErr := q.LockBacklogItemForShare(ctx, itemID); lockErr != nil {
				return lockErr
			}
			if _, lockErr := q.LockSprintForUpdate(ctx, sprintID); lockErr != nil {
				return lockErr
			}
			position, posErr := q.NextSprintBacklogPosition(ctx, sprintID)
			if posErr != nil {
				return posErr
			}
			var addErr error
			row, addErr = add(q, position)
			return addErr
		})
	}
	if err != nil {
		// The insert joins the item to the sprint's product, so no row means
		// either the sprint is unknown or the item belongs elsewhere.
		if errors.Is(err, pgx.ErrNoRows) {
			if _, getErr := s.q.GetSprint(ctx, sprintID); getErr == nil {
				return echo.NewHTTPError(http.StatusBadRequest,
					"that backlog item does not exist or belongs to a different module")
			}
		}
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
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListBacklogItemsByProduct(c.Request().Context(), db.ListBacklogItemsByProductParams{
		ProductID: productID,
		Lim:       limit + 1,
		Off:       offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) listBacklogItemsByModule(c echo.Context) error {
	moduleID, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListBacklogItemsByModule(c.Request().Context(), db.ListBacklogItemsByModuleParams{
		ModuleID: ptr(moduleID),
		Lim:      limit + 1,
		Off:      offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
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
		Type:               orDefault(deref(req.Type), "story"),
		Priority:           orDefault(deref(req.Priority), "medium"),
		Readiness:          orDefault(deref(req.Readiness), "draft"),
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

	// Partial update: only the named fields are written. A supplied but empty
	// array still clears the column — nil is the "not supplied" signal.
	arg := db.UpdateBacklogItemParams{
		ID:                 id,
		ModuleID:           req.ModuleID,
		Title:              req.Title,
		Story:              req.Story,
		AcceptanceCriteria: derefSlice(req.AcceptanceCriteria),
		Type:               req.Type,
		Priority:           req.Priority,
		Readiness:          req.Readiness,
		Estimate:           req.Estimate,
		AiSuggestions:      derefSlice(req.AiSuggestions),
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
