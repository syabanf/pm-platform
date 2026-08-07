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
	ID          *string `json:"id"`
	ComponentID *string `json:"componentId"`
	Number      *int32  `json:"number"`
	Name        string  `json:"name"`
	Goal        string  `json:"goal"`
	StartDate   *string `json:"startDate"`
	EndDate     *string `json:"endDate"`
	WorkingDays *int32  `json:"workingDays"`
	DaysLeft    *int32  `json:"daysLeft"`
	Status      *string `json:"status"`
	Committed   *int32  `json:"committed"`
	Completed   *int32  `json:"completed"`
	Progress    *int32  `json:"progress"`
	Risk        *string `json:"risk"`
}

type updateSprintRequest struct {
	ComponentID *string `json:"componentId"`
	Number      *int32  `json:"number"`
	Name        *string `json:"name"`
	Goal        *string `json:"goal"`
	StartDate   *string `json:"startDate"`
	EndDate     *string `json:"endDate"`
	WorkingDays *int32  `json:"workingDays"`
	DaysLeft    *int32  `json:"daysLeft"`
	Status      *string `json:"status"`
	Committed   *int32  `json:"committed"`
	Completed   *int32  `json:"completed"`
	Progress    *int32  `json:"progress"`
	Risk        *string `json:"risk"`
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
	ComponentID        *string  `json:"componentId"`
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
	ComponentID        *string   `json:"componentId"`
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
// and the module backlog.
func (s *Server) registerSprintRoutes(g *echo.Group) {
	g.GET("/modules/:moduleId/sprints", s.listSprintsByModule)
	g.POST("/modules/:moduleId/sprints", s.createSprint)
	g.GET("/components/:componentId/sprints", s.listSprintsByComponent)

	g.GET("/sprints/:sprintId", s.getSprint)
	g.PATCH("/sprints/:sprintId", s.updateSprint)
	g.DELETE("/sprints/:sprintId", s.deleteSprint)

	g.GET("/sprints/:sprintId/members", s.listSprintMembers)
	g.PUT("/sprints/:sprintId/members/:memberId", s.addSprintMember)
	g.DELETE("/sprints/:sprintId/members/:memberId", s.removeSprintMember)

	g.GET("/sprints/:sprintId/backlog", s.listSprintBacklogItems)
	g.PUT("/sprints/:sprintId/backlog/:itemId", s.addSprintBacklogItem)
	g.DELETE("/sprints/:sprintId/backlog/:itemId", s.removeSprintBacklogItem)

	g.GET("/modules/:moduleId/backlog", s.listBacklogItemsByModule)
	g.POST("/modules/:moduleId/backlog", s.createBacklogItem)
	g.GET("/components/:componentId/backlog", s.listBacklogItemsByComponent)

	g.GET("/backlog/:itemId", s.getBacklogItem)
	g.PATCH("/backlog/:itemId", s.updateBacklogItem)
	g.DELETE("/backlog/:itemId", s.deleteBacklogItem)
}

// -------------------------------------------------------------- sprints ---

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
		ModuleID: moduleID,
		Lim:      limit + 1,
		Off:      offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) listSprintsByComponent(c echo.Context) error {
	componentID, err := param(c, "componentId")
	if err != nil {
		return err
	}
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListSprintsByComponent(c.Request().Context(), db.ListSprintsByComponentParams{
		ComponentID: ptr(componentID),
		Lim:         limit + 1,
		Off:         offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createSprint(c echo.Context) error {
	ctx := c.Request().Context()

	moduleID, err := param(c, "moduleId")
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
	startDate, err := parseDate(req.StartDate)
	if err != nil {
		return err
	}
	endDate, err := parseDate(req.EndDate)
	if err != nil {
		return err
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
			ModuleID:    moduleID,
			ComponentID: req.ComponentID,
			Number:      *req.Number,
			Name:        req.Name,
			Goal:        req.Goal,
			StartDate:   startDate,
			EndDate:     endDate,
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

	// Auto-numbered: lock the module, then read the next number and insert it.
	// The lock makes a burst queue up and each create take the next number,
	// instead of every request reading the same MAX and fighting over
	// UNIQUE (module_id, number).
	var row db.Sprint
	err = s.withTx(ctx, func(q *db.Queries) error {
		if _, lockErr := q.LockModuleForUpdate(ctx, moduleID); lockErr != nil {
			return lockErr
		}
		number, numErr := q.NextSprintNumber(ctx, moduleID)
		if numErr != nil {
			return numErr
		}
		var createErr error
		row, createErr = q.CreateSprint(ctx, db.CreateSprintParams{
			ID:          id,
			ModuleID:    moduleID,
			ComponentID: req.ComponentID,
			Number:      number,
			Name:        req.Name,
			Goal:        req.Goal,
			StartDate:   startDate,
			EndDate:     endDate,
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
			return echo.NewHTTPError(http.StatusBadRequest, "moduleId does not exist")
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

	startDate, err := parseDate(req.StartDate)
	if err != nil {
		return err
	}
	endDate, err := parseDate(req.EndDate)
	if err != nil {
		return err
	}

	// Partial update: only the named fields are written.
	arg := db.UpdateSprintParams{
		ID:          id,
		ComponentID: req.ComponentID,
		Number:      req.Number,
		Name:        req.Name,
		Goal:        req.Goal,
		StartDate:   startDate,
		EndDate:     endDate,
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
	ctx := c.Request().Context()
	// The FK modules.current_sprint_id ON DELETE SET NULL updates the module
	// row as a side effect of this delete. Every other writer locks module →
	// sprint; deleting without the module lock is the other order, and that
	// AB-BA cycle deadlocked 15.5% of overlapping module deletes before they
	// learned the same lesson. Same fix here: lock the owner first.
	err = s.deleteTx(ctx, func(q *db.Queries) error {
		sprint, err := q.GetSprint(ctx, id)
		if err != nil {
			return err
		}
		if _, err := q.LockModuleForUpdate(ctx, sprint.ModuleID); err != nil {
			return err
		}
		return q.DeleteSprint(ctx, id)
	})
	if err != nil {
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
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListSprintMembers(c.Request().Context(), db.ListSprintMembersParams{
		SprintID: sprintID,
		Lim:      limit + 1,
		Off:      offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
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
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListSprintBacklogItems(c.Request().Context(), db.ListSprintBacklogItemsParams{
		SprintID: sprintID,
		Lim:      limit + 1,
		Off:      offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
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
		// The insert joins the item to the sprint's module, so no row means
		// either the sprint is unknown or the item belongs elsewhere.
		if errors.Is(err, pgx.ErrNoRows) {
			if _, getErr := s.q.GetSprint(ctx, sprintID); getErr == nil {
				return echo.NewHTTPError(http.StatusBadRequest,
					"that backlog item does not exist or belongs to a different component")
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
		ModuleID: moduleID,
		Lim:      limit + 1,
		Off:      offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) listBacklogItemsByComponent(c echo.Context) error {
	componentID, err := param(c, "componentId")
	if err != nil {
		return err
	}
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListBacklogItemsByComponent(c.Request().Context(), db.ListBacklogItemsByComponentParams{
		ComponentID: ptr(componentID),
		Lim:         limit + 1,
		Off:         offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createBacklogItem(c echo.Context) error {
	moduleID, err := param(c, "moduleId")
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
		ModuleID:           moduleID,
		ComponentID:        req.ComponentID,
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
		ComponentID:        req.ComponentID,
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
