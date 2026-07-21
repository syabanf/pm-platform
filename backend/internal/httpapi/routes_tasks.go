package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strconv"
	"time"

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
	rows, err := s.q.ListTasksBySprint(c.Request().Context(), sprintID)
	if err != nil {
		return dbErr(err)
	}
	if rows == nil {
		rows = []db.Task{}
	}
	return c.JSON(http.StatusOK, rows)
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

	row, err := s.q.CreateTask(c.Request().Context(), db.CreateTaskParams{
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

	ctx := c.Request().Context()
	cur, err := s.q.GetTask(ctx, taskID)
	if err != nil {
		return dbErr(err)
	}

	arg := db.UpdateTaskParams{
		ID:            cur.ID,
		Title:         cur.Title,
		ModuleName:    cur.ModuleName,
		AssigneeID:    cur.AssigneeID,
		Estimate:      cur.Estimate,
		BoardColumn:   cur.BoardColumn,
		Priority:      cur.Priority,
		BlockedReason: cur.BlockedReason,
		BlockedDays:   cur.BlockedDays,
		OffGoal:       cur.OffGoal,
	}
	if req.Title != nil {
		arg.Title = *req.Title
	}
	if req.ModuleName != nil {
		arg.ModuleName = *req.ModuleName
	}
	if req.AssigneeID != nil {
		arg.AssigneeID = req.AssigneeID
	}
	if req.Estimate != nil {
		arg.Estimate = *req.Estimate
	}
	if req.BoardColumn != nil {
		arg.BoardColumn = *req.BoardColumn
	}
	if req.Priority != nil {
		arg.Priority = *req.Priority
	}
	if req.BlockedReason != nil {
		arg.BlockedReason = req.BlockedReason
	}
	if req.BlockedDays != nil {
		arg.BlockedDays = req.BlockedDays
	}
	if req.OffGoal != nil {
		arg.OffGoal = *req.OffGoal
	}

	row, err := s.q.UpdateTask(ctx, arg)
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
	ctx := c.Request().Context()
	if err := s.q.DeleteTaskDod(ctx, taskID); err != nil {
		return dbErr(err)
	}
	if err := s.q.DeleteTask(ctx, taskID); err != nil {
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
	rows, err := s.q.ListMembers(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	if rows == nil {
		rows = []db.Member{}
	}
	return c.JSON(http.StatusOK, rows)
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

	ctx := c.Request().Context()
	cur, err := s.q.GetMember(ctx, memberID)
	if err != nil {
		return dbErr(err)
	}

	arg := db.UpdateMemberParams{
		ID:           cur.ID,
		Name:         cur.Name,
		Email:        cur.Email,
		Role:         cur.Role,
		RoleLabel:    cur.RoleLabel,
		SkillTags:    cur.SkillTags,
		Allocation:   cur.Allocation,
		CapacityDays: cur.CapacityDays,
		Workload:     cur.Workload,
		Status:       cur.Status,
	}
	if req.Name != nil {
		arg.Name = *req.Name
	}
	if req.Email != nil {
		arg.Email = *req.Email
	}
	if req.Role != nil {
		arg.Role = *req.Role
	}
	if req.RoleLabel != nil {
		arg.RoleLabel = *req.RoleLabel
	}
	if req.SkillTags != nil {
		arg.SkillTags = req.SkillTags
	}
	if req.Allocation != nil {
		arg.Allocation = *req.Allocation
	}
	if req.CapacityDays != nil {
		arg.CapacityDays = *req.CapacityDays
	}
	if req.Workload != nil {
		arg.Workload = *req.Workload
	}
	if req.Status != nil {
		arg.Status = *req.Status
	}
	if arg.SkillTags == nil {
		arg.SkillTags = []string{}
	}

	row, err := s.q.UpdateMember(ctx, arg)
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
	rows, err := s.q.ListDecisionsByProduct(c.Request().Context(), productID)
	if err != nil {
		return dbErr(err)
	}
	if rows == nil {
		rows = []db.Decision{}
	}
	return c.JSON(http.StatusOK, rows)
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

	ctx := c.Request().Context()
	cur, err := s.q.GetDecision(ctx, decisionID)
	if err != nil {
		return dbErr(err)
	}

	arg := db.UpdateDecisionParams{
		ID:        cur.ID,
		DecidedOn: cur.DecidedOn,
		Title:     cur.Title,
		Detail:    cur.Detail,
		Owner:     cur.Owner,
		Status:    cur.Status,
	}
	if req.DecidedOn != nil && *req.DecidedOn != "" {
		d, perr := parseTaskScopedDate(*req.DecidedOn)
		if perr != nil {
			return perr
		}
		arg.DecidedOn = d
	}
	if req.Title != nil {
		arg.Title = *req.Title
	}
	if req.Detail != nil {
		arg.Detail = *req.Detail
	}
	if req.Owner != nil {
		arg.Owner = *req.Owner
	}
	if req.Status != nil {
		arg.Status = *req.Status
	}

	row, err := s.q.UpdateDecision(ctx, arg)
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
