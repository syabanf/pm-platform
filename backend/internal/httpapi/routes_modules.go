package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"

	"github.com/syabanf/pm-platform/backend/internal/db"
)

// ---------------------------------------------------------------- ids ---

// newProductScopedID builds a unique TEXT id with the given prefix.
func newProductScopedID(prefix string) string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return prefix + "_" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return prefix + "_" + strconv.FormatInt(time.Now().UnixMilli(), 36) + hex.EncodeToString(b[:])
}

// ------------------------------------------------------------ requests ---

// clientId is deliberately absent from both module bodies: it is derived from
// the project, so a caller can never point a module at a client that does not
// own it (and then delete that client out from under it).
// currentSprintId is absent too: a module being created has no sprints yet, so
// any value would be another module's — and nothing validated it.
// Use PATCH /modules/:id/current-sprint once a sprint exists.
type createProductRequest struct {
	ID           *string          `json:"id"`
	ProjectID    string           `json:"projectId"`
	Name         string           `json:"name"`
	Goal         *string          `json:"goal"`
	Owner        *string          `json:"owner"`
	DeliveryLead *string          `json:"deliveryLead"`
	Status       *string          `json:"status"`
	Health       *int32           `json:"health"`
	Risk         *string          `json:"risk"`
	Velocity     *int32           `json:"velocity"`
	BlockedCount *int32           `json:"blockedCount"`
	AiInsight    *json.RawMessage `json:"aiInsight"`
}

type updateProductRequest struct {
	ProjectID    *string          `json:"projectId"`
	Name         *string          `json:"name"`
	Goal         *string          `json:"goal"`
	Owner        *string          `json:"owner"`
	DeliveryLead *string          `json:"deliveryLead"`
	Status       *string          `json:"status"`
	Health       *int32           `json:"health"`
	Risk         *string          `json:"risk"`
	Velocity     *int32           `json:"velocity"`
	BlockedCount *int32           `json:"blockedCount"`
	AiInsight    *json.RawMessage `json:"aiInsight"`
}

// optional, not *string: this endpoint has to tell an absent key (leave the
// pointer alone) apart from an explicit null (clear it), and a plain pointer
// reports both as nil. Every other PATCH treats them the same, but this one
// must not mutate on an empty body.
type setProductCurrentSprintRequest struct {
	CurrentSprintID optional[string] `json:"currentSprintId"`
}

type createProductModuleRequest struct {
	ID       *string `json:"id"`
	Name     string  `json:"name"`
	Owner    *string `json:"owner"`
	Status   *string `json:"status"`
	Position *int32  `json:"position"`
}

type updateProductModuleRequest struct {
	Name     *string `json:"name"`
	Owner    *string `json:"owner"`
	Status   *string `json:"status"`
	Position *int32  `json:"position"`
}

type updateProductModuleStatusRequest struct {
	Status string `json:"status"`
}

// -------------------------------------------------------------- routes ---

func (s *Server) registerProductRoutes(g *echo.Group) {
	g.GET("/modules", s.listProducts)
	g.POST("/modules", s.createProduct)
	g.GET("/modules/:moduleId", s.getProduct)
	g.PATCH("/modules/:moduleId", s.updateModule)
	g.PATCH("/modules/:moduleId/current-sprint", s.setProductCurrentSprint)
	g.DELETE("/modules/:moduleId", s.deleteProduct)

	g.GET("/modules/:moduleId/components", s.listModulesByProduct)
	g.POST("/modules/:moduleId/components", s.createModule)

	g.GET("/components/:componentId", s.getModule)
	g.PATCH("/components/:componentId", s.updateComponent)
	g.PATCH("/components/:componentId/status", s.updateComponentStatus)
	g.DELETE("/components/:componentId", s.deleteModule)
}

// ------------------------------------------------------------ modules ---

func (s *Server) listProducts(c echo.Context) error {
	ctx := c.Request().Context()
	limit, offset, err := page(c)
	if err != nil {
		return err
	}

	if projectID := c.QueryParam("projectId"); projectID != "" {
		rows, err := s.q.ListProductsByProject(ctx, db.ListProductsByProjectParams{
			ProjectID: projectID,
			Lim:       limit + 1,
			Off:       offset,
		})
		if err != nil {
			return dbErr(err)
		}
		return paged(c, rows, limit)
	}

	if clientID := c.QueryParam("clientId"); clientID != "" {
		rows, err := s.q.ListProductsByClient(ctx, db.ListProductsByClientParams{
			ClientID: clientID,
			Lim:      limit + 1,
			Off:      offset,
		})
		if err != nil {
			return dbErr(err)
		}
		return paged(c, rows, limit)
	}

	rows, err := s.q.ListProducts(ctx, db.ListProductsParams{Lim: limit + 1, Off: offset})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createProduct(c echo.Context) error {
	req, err := bind[createProductRequest](c)
	if err != nil {
		return err
	}
	if req.ProjectID == "" || req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "projectId and name are required")
	}

	id := deref(req.ID)
	if id == "" {
		id = newProductScopedID("prd")
	}

	// health has a CHECK (0..100) and DEFAULT 100; an absent value must not
	// become 0, which would silently record a failing module.
	health := int32(100)
	if req.Health != nil {
		health = *req.Health
	}

	arg := db.CreateProductParams{
		ID:           id,
		ProjectID:    req.ProjectID,
		Name:         req.Name,
		Goal:         deref(req.Goal),
		Owner:        deref(req.Owner),
		DeliveryLead: deref(req.DeliveryLead),
		Status:       orDefault(deref(req.Status), "discovery"),
		Health:       health,
		Risk:         orDefault(deref(req.Risk), "low"),
		Velocity:     deref(req.Velocity),
		BlockedCount: deref(req.BlockedCount),
		AiInsight:    rawOrNil(req.AiInsight),
	}

	row, err := s.q.CreateProduct(c.Request().Context(), arg)
	if err != nil {
		// The insert selects from projects, so an unknown project produces no
		// row rather than a foreign-key violation.
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusBadRequest, "projectId does not exist")
		}
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getProduct(c echo.Context) error {
	id, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	row, err := s.q.GetModule(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateModule(c echo.Context) error {
	id, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	req, err := bind[updateProductRequest](c)
	if err != nil {
		return err
	}

	// Partial update: absent fields stay nil and the UPDATE leaves those
	// columns untouched, so concurrent PATCHes no longer overwrite each other.
	arg := db.UpdateProductParams{
		ID:           id,
		ProjectID:    req.ProjectID,
		Name:         req.Name,
		Goal:         req.Goal,
		Owner:        req.Owner,
		DeliveryLead: req.DeliveryLead,
		Status:       req.Status,
		Health:       req.Health,
		Risk:         req.Risk,
		Velocity:     req.Velocity,
		BlockedCount: req.BlockedCount,
		AiInsight:    rawOrNil(req.AiInsight),
	}

	row, err := s.q.UpdateProduct(c.Request().Context(), arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) setProductCurrentSprint(c echo.Context) error {
	id, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	req, err := bind[setProductCurrentSprintRequest](c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()

	// No key in the body means no instruction — not "clear it".
	if !req.CurrentSprintID.Set {
		row, getErr := s.q.GetModule(ctx, id)
		if getErr != nil {
			return dbErr(getErr)
		}
		return c.JSON(http.StatusOK, row)
	}

	// Present: either an explicit null (clear the pointer) or a sprint id.
	row, err := s.q.SetProductCurrentSprint(ctx, db.SetProductCurrentSprintParams{
		ID:              id,
		CurrentSprintID: req.CurrentSprintID.Value,
	})
	if err != nil {
		// No row means either the module is gone or the sprint belongs to a
		// different module; only the second is the caller's mistake.
		if errors.Is(err, pgx.ErrNoRows) {
			if _, getErr := s.q.GetModule(ctx, id); getErr == nil {
				return echo.NewHTTPError(http.StatusBadRequest,
					"currentSprintId must be a sprint of this module")
			}
		}
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteProduct(c echo.Context) error {
	id, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	// The cascade origin: it locks the module first by itself, so this only
	// needs the larger statement budget.
	if err := s.deleteTx(c.Request().Context(), func(q *db.Queries) error {
		return q.DeleteProduct(c.Request().Context(), id)
	}); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ------------------------------------------------------------- components ---

func (s *Server) listModulesByProduct(c echo.Context) error {
	moduleID, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	limit, offset, err := page(c)
	if err != nil {
		return err
	}
	rows, err := s.q.ListModulesByProduct(c.Request().Context(), db.ListModulesByProductParams{
		ModuleID: moduleID,
		Lim:      limit + 1,
		Off:      offset,
	})
	if err != nil {
		return dbErr(err)
	}
	return paged(c, rows, limit)
}

func (s *Server) createModule(c echo.Context) error {
	moduleID, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	req, err := bind[createProductModuleRequest](c)
	if err != nil {
		return err
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	id := deref(req.ID)
	if id == "" {
		id = newProductScopedID("mod")
	}

	ctx := c.Request().Context()
	create := func(q *db.Queries, position int32) (db.Component, error) {
		return q.CreateModule(ctx, db.CreateModuleParams{
			ID:       id,
			ModuleID: moduleID,
			Name:     req.Name,
			Owner:    orDefault(deref(req.Owner), "Unassigned"),
			Status:   orDefault(deref(req.Status), "planned"),
			Position: position,
		})
	}

	var row db.Component
	if req.Position != nil {
		row, err = create(s.q, *req.Position)
	} else {
		// Appending needs the module locked first — see LockModuleForUpdate.
		err = s.withTx(ctx, func(q *db.Queries) error {
			if _, lockErr := q.LockModuleForUpdate(ctx, moduleID); lockErr != nil {
				return lockErr
			}
			position, posErr := q.NextModulePosition(ctx, moduleID)
			if posErr != nil {
				return posErr
			}
			var createErr error
			row, createErr = create(q, position)
			return createErr
		})
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return echo.NewHTTPError(http.StatusBadRequest, "moduleId does not exist")
		}
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getModule(c echo.Context) error {
	id, err := param(c, "componentId")
	if err != nil {
		return err
	}
	row, err := s.q.GetComponent(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateComponent(c echo.Context) error {
	id, err := param(c, "componentId")
	if err != nil {
		return err
	}
	req, err := bind[updateProductModuleRequest](c)
	if err != nil {
		return err
	}

	arg := db.UpdateModuleParams{
		ID:       id,
		Name:     req.Name,
		Owner:    req.Owner,
		Status:   req.Status,
		Position: req.Position,
	}

	row, err := s.q.UpdateModule(c.Request().Context(), arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateComponentStatus(c echo.Context) error {
	id, err := param(c, "componentId")
	if err != nil {
		return err
	}
	req, err := bind[updateProductModuleStatusRequest](c)
	if err != nil {
		return err
	}
	if req.Status == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "status is required")
	}

	row, err := s.q.UpdateModuleStatus(c.Request().Context(), db.UpdateModuleStatusParams{
		ID:     id,
		Status: req.Status,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteModule(c echo.Context) error {
	id, err := param(c, "componentId")
	if err != nil {
		return err
	}
	ctx := c.Request().Context()

	// Same reasoning as deleteSprint: this clears component_id on the module's
	// sprints and backlog items, which the module cascade also touches. Lock
	// the module first so the two orders cannot cross.
	err = s.deleteTx(ctx, func(q *db.Queries) error {
		component, getErr := q.GetComponent(ctx, id)
		if getErr != nil {
			if errors.Is(getErr, pgx.ErrNoRows) {
				return nil
			}
			return getErr
		}
		if _, lockErr := q.LockModuleForUpdate(ctx, component.ModuleID); lockErr != nil {
			return lockErr
		}
		return q.DeleteModule(ctx, id)
	})
	if err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}
