package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"

	"github.com/syabanf/pm-platform/backend/internal/db"
)

// ------------------------------------------------------------------ ids ---

// newTaskScopedID builds a short unique TEXT id with the given prefix.
func newTaskScopedID(prefix string) string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return prefix + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return prefix + "-" + strconv.FormatInt(time.Now().Unix(), 36) + "-" + hex.EncodeToString(b[:])
}

// parseTaskScopedDate accepts an RFC3339 timestamp or a plain YYYY-MM-DD date.
func parseTaskScopedDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, echo.NewHTTPError(http.StatusBadRequest, "invalid date, expected YYYY-MM-DD or RFC3339")
	}
	return t, nil
}

// --------------------------------------------------------------- routes ---

func (s *Server) registerTaskRoutes(g *echo.Group) {
	g.GET("/sprints/:sprintId/tasks", s.listTasksBySprint)
	g.POST("/sprints/:sprintId/tasks", s.createTask)
	g.GET("/tasks/:taskId", s.getTask)
	g.PATCH("/tasks/:taskId", s.updateTask)
	g.PATCH("/tasks/:taskId/column", s.moveTask)
	g.DELETE("/tasks/:taskId", s.deleteTask)

	g.GET("/tasks/:taskId/dod", s.listTaskDod)
	g.PUT("/tasks/:taskId/dod", s.setTaskDodItem)
	g.PATCH("/tasks/:taskId/dod/:position", s.toggleTaskDodItem)

	g.GET("/members", s.listMembers)
	g.POST("/members", s.createMember)
	g.GET("/members/:memberId", s.getMember)
	g.PATCH("/members/:memberId", s.updateMember)
	g.DELETE("/members/:memberId", s.deleteMember)

	g.GET("/products/:productId/decisions", s.listDecisionsByProduct)
	g.POST("/products/:productId/decisions", s.createDecision)
	g.PATCH("/decisions/:decisionId", s.updateDecision)
	g.DELETE("/decisions/:decisionId", s.deleteDecision)
}

// ---------------------------------------------------------------- tasks ---

type createTaskRequest struct {
	ID            *string `json:"id"`
	BacklogItemID string  `json:"backlogItemId"`
	Title         string  `json:"title"`
	ModuleName    string  `json:"moduleName"`
	AssigneeID    *string `json:"assigneeId"`
	Estimate      *int32  `json:"estimate"`
	BoardColumn   *string `json:"boardColumn"`
	Priority      *string `json:"priority"`
	BlockedReason *string `json:"blockedReason"`
	BlockedDays   *int32  `json:"blockedDays"`
	OffGoal       *bool   `json:"offGoal"`
}

type updateTaskRequest struct {
	Title         *string `json:"title"`
	ModuleName    *string `json:"moduleName"`
	AssigneeID    *string `json:"assigneeId"`
	Estimate      *int32  `json:"estimate"`
	BoardColumn   *string `json:"boardColumn"`
	Priority      *string `json:"priority"`
	BlockedReason *string `json:"blockedReason"`
	BlockedDays   *int32  `json:"blockedDays"`
	OffGoal       *bool   `json:"offGoal"`
}

type moveTaskRequest struct {
	BoardColumn string `json:"boardColumn"`
}

func (s *Server) listTasksBySprint(c echo.Context) error {
	sprintID, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListTasksBySprint(c.Request().Context(), db.ListTasksBySprintParams{
		SprintID: sprintID,
		Lim:      limit + 1,
		Off:      offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createTask(c echo.Context) error {
	sprintID, err := param(c, "sprintId")
	if err != nil {
		return err
	}
	req, err := bind[createTaskRequest](c)
	if err != nil {
		return err
	}
	if req.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}
	if req.BacklogItemID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "backlogItemId is required")
	}

	id := deref(req.ID)
	if id == "" {
		id = newTaskScopedID("tsk")
	}
	boardColumn := orDefault(deref(req.BoardColumn), "selected")
	priority := orDefault(deref(req.Priority), "medium")

	ctx := c.Request().Context()
	row, err := s.q.CreateTask(ctx, db.CreateTaskParams{
		ID:            id,
		SprintID:      sprintID,
		BacklogItemID: req.BacklogItemID,
		Title:         req.Title,
		ModuleName:    req.ModuleName,
		AssigneeID:    req.AssigneeID,
		Estimate:      deref(req.Estimate),
		BoardColumn:   boardColumn,
		Priority:      priority,
		BlockedReason: req.BlockedReason,
		BlockedDays:   req.BlockedDays,
		OffGoal:       deref(req.OffGoal),
	})
	if err != nil {
		// The insert joins the backlog item to the sprint's product, so no row
		// means either the sprint is unknown or the item belongs elsewhere.
		if errors.Is(err, pgx.ErrNoRows) {
			if _, getErr := s.q.GetSprint(ctx, sprintID); getErr == nil {
				return echo.NewHTTPError(http.StatusBadRequest,
					"that backlog item does not exist or belongs to a different module")
			}
		}
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getTask(c echo.Context) error {
	taskID, err := param(c, "taskId")
	if err != nil {
		return err
	}
	row, err := s.q.GetTask(c.Request().Context(), taskID)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateTask(c echo.Context) error {
	taskID, err := param(c, "taskId")
	if err != nil {
		return err
	}
	req, err := bind[updateTaskRequest](c)
	if err != nil {
		return err
	}

	// Partial update: renaming a card while someone else drags it to another
	// column no longer sends it back to where it started.
	arg := db.UpdateTaskParams{
		ID:            taskID,
		Title:         req.Title,
		ModuleName:    req.ModuleName,
		AssigneeID:    req.AssigneeID,
		Estimate:      req.Estimate,
		BoardColumn:   req.BoardColumn,
		Priority:      req.Priority,
		BlockedReason: req.BlockedReason,
		BlockedDays:   req.BlockedDays,
		OffGoal:       req.OffGoal,
	}

	row, err := s.q.UpdateTask(c.Request().Context(), arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) moveTask(c echo.Context) error {
	taskID, err := param(c, "taskId")
	if err != nil {
		return err
	}
	req, err := bind[moveTaskRequest](c)
	if err != nil {
		return err
	}
	if req.BoardColumn == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "boardColumn is required")
	}
	row, err := s.q.MoveTask(c.Request().Context(), db.MoveTaskParams{
		ID:          taskID,
		BoardColumn: req.BoardColumn,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteTask(c echo.Context) error {
	taskID, err := param(c, "taskId")
	if err != nil {
		return err
	}
	// task_dod cascades from tasks, so one statement is enough — and unlike the
	// old two-step it cannot half-succeed.
	if err := s.q.DeleteTask(c.Request().Context(), taskID); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ------------------------------------------------------------- task_dod ---

type setTaskDodItemRequest struct {
	Position int32  `json:"position"`
	Label    string `json:"label"`
	Done     *bool  `json:"done"`
}

func (s *Server) listTaskDod(c echo.Context) error {
	taskID, err := param(c, "taskId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListTaskDod(c.Request().Context(), taskID)
	if err != nil {
		return dbErr(err)
	}
	if rows == nil {
		rows = []db.TaskDod{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) setTaskDodItem(c echo.Context) error {
	taskID, err := param(c, "taskId")
	if err != nil {
		return err
	}
	req, err := bind[setTaskDodItemRequest](c)
	if err != nil {
		return err
	}
	if req.Label == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "label is required")
	}
	row, err := s.q.SetTaskDodItem(c.Request().Context(), db.SetTaskDodItemParams{
		TaskID:   taskID,
		Position: req.Position,
		Label:    req.Label,
		Done:     deref(req.Done),
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) toggleTaskDodItem(c echo.Context) error {
	taskID, err := param(c, "taskId")
	if err != nil {
		return err
	}
	raw, err := param(c, "position")
	if err != nil {
		return err
	}
	pos, convErr := strconv.ParseInt(raw, 10, 32)
	if convErr != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "position must be an integer")
	}
	row, err := s.q.ToggleTaskDodItem(c.Request().Context(), db.ToggleTaskDodItemParams{
		TaskID:   taskID,
		Position: int32(pos),
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

// -------------------------------------------------------------- members ---

type createMemberRequest struct {
	ID           *string  `json:"id"`
	Name         string   `json:"name"`
	Email        string   `json:"email"`
	Role         string   `json:"role"`
	RoleLabel    *string  `json:"roleLabel"`
	SkillTags    []string `json:"skillTags"`
	Allocation   *int32   `json:"allocation"`
	CapacityDays *float64 `json:"capacityDays"`
	Workload     *int32   `json:"workload"`
	Status       *string  `json:"status"`
}

type updateMemberRequest struct {
	Name         *string  `json:"name"`
	Email        *string  `json:"email"`
	Role         *string  `json:"role"`
	RoleLabel    *string  `json:"roleLabel"`
	SkillTags    []string `json:"skillTags"`
	Allocation   *int32   `json:"allocation"`
	CapacityDays *float64 `json:"capacityDays"`
	Workload     *int32   `json:"workload"`
	Status       *string  `json:"status"`
}

func (s *Server) listMembers(c echo.Context) error {
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListMembers(c.Request().Context(), db.ListMembersParams{Lim: limit + 1, Off: offset})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createMember(c echo.Context) error {
	req, err := bind[createMemberRequest](c)
	if err != nil {
		return err
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	id := deref(req.ID)
	if id == "" {
		id = newTaskScopedID("mbr")
	}
	roleLabel := deref(req.RoleLabel)
	if roleLabel == "" {
		roleLabel = req.Role
	}
	status := orDefault(deref(req.Status), "active")
	tags := req.SkillTags
	if tags == nil {
		tags = []string{}
	}
	allocation := int32(100)
	if req.Allocation != nil {
		allocation = *req.Allocation
	}

	row, err := s.q.CreateMember(c.Request().Context(), db.CreateMemberParams{
		ID:           id,
		Name:         req.Name,
		Email:        req.Email,
		Role:         req.Role,
		RoleLabel:    roleLabel,
		SkillTags:    tags,
		Allocation:   allocation,
		CapacityDays: deref(req.CapacityDays),
		Workload:     deref(req.Workload),
		Status:       status,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getMember(c echo.Context) error {
	memberID, err := param(c, "memberId")
	if err != nil {
		return err
	}
	row, err := s.q.GetMember(c.Request().Context(), memberID)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateMember(c echo.Context) error {
	memberID, err := param(c, "memberId")
	if err != nil {
		return err
	}
	req, err := bind[updateMemberRequest](c)
	if err != nil {
		return err
	}

	// Partial update: only the named fields are written.
	arg := db.UpdateMemberParams{
		ID:           memberID,
		Name:         req.Name,
		Email:        req.Email,
		Role:         req.Role,
		RoleLabel:    req.RoleLabel,
		SkillTags:    req.SkillTags,
		Allocation:   req.Allocation,
		CapacityDays: req.CapacityDays,
		Workload:     req.Workload,
		Status:       req.Status,
	}

	row, err := s.q.UpdateMember(c.Request().Context(), arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteMember(c echo.Context) error {
	memberID, err := param(c, "memberId")
	if err != nil {
		return err
	}
	if err := s.q.DeleteMember(c.Request().Context(), memberID); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ------------------------------------------------------------ decisions ---

type createDecisionRequest struct {
	ID        *string `json:"id"`
	DecidedOn *string `json:"decidedOn"`
	Title     string  `json:"title"`
	Detail    string  `json:"detail"`
	Owner     string  `json:"owner"`
	Status    *string `json:"status"`
}

type updateDecisionRequest struct {
	DecidedOn *string `json:"decidedOn"`
	Title     *string `json:"title"`
	Detail    *string `json:"detail"`
	Owner     *string `json:"owner"`
	Status    *string `json:"status"`
}

func (s *Server) listDecisionsByProduct(c echo.Context) error {
	productID, err := param(c, "productId")
	if err != nil {
		return err
	}
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListDecisionsByProduct(c.Request().Context(), db.ListDecisionsByProductParams{
		ProductID: productID,
		Lim:       limit + 1,
		Off:       offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createDecision(c echo.Context) error {
	productID, err := param(c, "productId")
	if err != nil {
		return err
	}
	req, err := bind[createDecisionRequest](c)
	if err != nil {
		return err
	}
	if req.Title == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "title is required")
	}

	decidedOn := time.Now().UTC()
	if req.DecidedOn != nil && *req.DecidedOn != "" {
		decidedOn, err = parseTaskScopedDate(*req.DecidedOn)
		if err != nil {
			return err
		}
	}

	id := deref(req.ID)
	if id == "" {
		id = newTaskScopedID("dec")
	}
	status := orDefault(deref(req.Status), "open")

	row, err := s.q.CreateDecision(c.Request().Context(), db.CreateDecisionParams{
		ID:        id,
		ProductID: productID,
		DecidedOn: decidedOn,
		Title:     req.Title,
		Detail:    req.Detail,
		Owner:     req.Owner,
		Status:    status,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) updateDecision(c echo.Context) error {
	decisionID, err := param(c, "decisionId")
	if err != nil {
		return err
	}
	req, err := bind[updateDecisionRequest](c)
	if err != nil {
		return err
	}

	// Partial update: only the named fields are written.
	arg := db.UpdateDecisionParams{
		ID:     decisionID,
		Title:  req.Title,
		Detail: req.Detail,
		Owner:  req.Owner,
		Status: req.Status,
	}
	if req.DecidedOn != nil && *req.DecidedOn != "" {
		d, perr := parseTaskScopedDate(*req.DecidedOn)
		if perr != nil {
			return perr
		}
		arg.DecidedOn = &d
	}

	row, err := s.q.UpdateDecision(c.Request().Context(), arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteDecision(c echo.Context) error {
	decisionID, err := param(c, "decisionId")
	if err != nil {
		return err
	}
	if err := s.q.DeleteDecision(c.Request().Context(), decisionID); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}
