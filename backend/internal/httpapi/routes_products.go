package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

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

type createProductRequest struct {
	ID              *string         `json:"id"`
	ProjectID       string          `json:"projectId"`
	ClientID        string          `json:"clientId"`
	Name            string          `json:"name"`
	Goal            *string         `json:"goal"`
	Owner           *string         `json:"owner"`
	DeliveryLead    *string         `json:"deliveryLead"`
	Status          *string         `json:"status"`
	Health          *int32          `json:"health"`
	Risk            *string         `json:"risk"`
	Velocity        *int32          `json:"velocity"`
	BlockedCount    *int32          `json:"blockedCount"`
	CurrentSprintID *string         `json:"currentSprintId"`
	AiInsight       json.RawMessage `json:"aiInsight"`
}

type updateProductRequest struct {
	ProjectID    *string         `json:"projectId"`
	ClientID     *string         `json:"clientId"`
	Name         *string         `json:"name"`
	Goal         *string         `json:"goal"`
	Owner        *string         `json:"owner"`
	DeliveryLead *string         `json:"deliveryLead"`
	Status       *string         `json:"status"`
	Health       *int32          `json:"health"`
	Risk         *string         `json:"risk"`
	Velocity     *int32          `json:"velocity"`
	BlockedCount *int32          `json:"blockedCount"`
	AiInsight    json.RawMessage `json:"aiInsight"`
}

type setProductCurrentSprintRequest struct {
	CurrentSprintID *string `json:"currentSprintId"`
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
	g.GET("/products", s.listProducts)
	g.POST("/products", s.createProduct)
	g.GET("/products/:productId", s.getProduct)
	g.PATCH("/products/:productId", s.updateProduct)
	g.PATCH("/products/:productId/current-sprint", s.setProductCurrentSprint)
	g.DELETE("/products/:productId", s.deleteProduct)

	g.GET("/products/:productId/modules", s.listModulesByProduct)
	g.POST("/products/:productId/modules", s.createModule)

	g.GET("/modules/:moduleId", s.getModule)
	g.PATCH("/modules/:moduleId", s.updateModule)
	g.PATCH("/modules/:moduleId/status", s.updateModuleStatus)
	g.DELETE("/modules/:moduleId", s.deleteModule)
}

// ------------------------------------------------------------ products ---

func (s *Server) listProducts(c echo.Context) error {
	ctx := c.Request().Context()

	if projectID := c.QueryParam("projectId"); projectID != "" {
		rows, err := s.q.ListProductsByProject(ctx, projectID)
		if err != nil {
			return dbErr(err)
		}
		return c.JSON(http.StatusOK, rows)
	}

	if clientID := c.QueryParam("clientId"); clientID != "" {
		rows, err := s.q.ListProductsByClient(ctx, clientID)
		if err != nil {
			return dbErr(err)
		}
		return c.JSON(http.StatusOK, rows)
	}

	rows, err := s.q.ListProducts(ctx)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) createProduct(c echo.Context) error {
	req, err := bind[createProductRequest](c)
	if err != nil {
		return err
	}
	if req.ProjectID == "" || req.ClientID == "" || req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "projectId, clientId and name are required")
	}

	id := deref(req.ID)
	if id == "" {
		id = newProductScopedID("prd")
	}

	// health has a CHECK (0..100) and DEFAULT 100; an absent value must not
	// become 0, which would silently record a failing product.
	health := int32(100)
	if req.Health != nil {
		health = *req.Health
	}

	arg := db.CreateProductParams{
		ID:              id,
		ProjectID:       req.ProjectID,
		ClientID:        req.ClientID,
		Name:            req.Name,
		Goal:            deref(req.Goal),
		Owner:           deref(req.Owner),
		DeliveryLead:    deref(req.DeliveryLead),
		Status:          orDefault(deref(req.Status), "discovery"),
		Health:          health,
		Risk:            orDefault(deref(req.Risk), "low"),
		Velocity:        deref(req.Velocity),
		BlockedCount:    deref(req.BlockedCount),
		CurrentSprintID: req.CurrentSprintID,
		AiInsight:       []byte(req.AiInsight),
	}

	row, err := s.q.CreateProduct(c.Request().Context(), arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getProduct(c echo.Context) error {
	id, err := param(c, "productId")
	if err != nil {
		return err
	}
	row, err := s.q.GetProduct(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateProduct(c echo.Context) error {
	id, err := param(c, "productId")
	if err != nil {
		return err
	}
	req, err := bind[updateProductRequest](c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	cur, err := s.q.GetProduct(ctx, id)
	if err != nil {
		return dbErr(err)
	}

	arg := db.UpdateProductParams{
		ID:           cur.ID,
		ProjectID:    cur.ProjectID,
		ClientID:     cur.ClientID,
		Name:         cur.Name,
		Goal:         cur.Goal,
		Owner:        cur.Owner,
		DeliveryLead: cur.DeliveryLead,
		Status:       cur.Status,
		Health:       cur.Health,
		Risk:         cur.Risk,
		Velocity:     cur.Velocity,
		BlockedCount: cur.BlockedCount,
		AiInsight:    cur.AiInsight,
	}

	if req.ProjectID != nil {
		arg.ProjectID = *req.ProjectID
	}
	if req.ClientID != nil {
		arg.ClientID = *req.ClientID
	}
	if req.Name != nil {
		arg.Name = *req.Name
	}
	if req.Goal != nil {
		arg.Goal = *req.Goal
	}
	if req.Owner != nil {
		arg.Owner = *req.Owner
	}
	if req.DeliveryLead != nil {
		arg.DeliveryLead = *req.DeliveryLead
	}
	if req.Status != nil {
		arg.Status = *req.Status
	}
	if req.Health != nil {
		arg.Health = *req.Health
	}
	if req.Risk != nil {
		arg.Risk = *req.Risk
	}
	if req.Velocity != nil {
		arg.Velocity = *req.Velocity
	}
	if req.BlockedCount != nil {
		arg.BlockedCount = *req.BlockedCount
	}
	if req.AiInsight != nil {
		arg.AiInsight = []byte(req.AiInsight)
	}

	row, err := s.q.UpdateProduct(ctx, arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) setProductCurrentSprint(c echo.Context) error {
	id, err := param(c, "productId")
	if err != nil {
		return err
	}
	req, err := bind[setProductCurrentSprintRequest](c)
	if err != nil {
		return err
	}

	row, err := s.q.SetProductCurrentSprint(c.Request().Context(), db.SetProductCurrentSprintParams{
		ID:              id,
		CurrentSprintID: req.CurrentSprintID,
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteProduct(c echo.Context) error {
	id, err := param(c, "productId")
	if err != nil {
		return err
	}
	if err := s.q.DeleteProduct(c.Request().Context(), id); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ------------------------------------------------------------- modules ---

func (s *Server) listModulesByProduct(c echo.Context) error {
	productID, err := param(c, "productId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListModulesByProduct(c.Request().Context(), productID)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) createModule(c echo.Context) error {
	productID, err := param(c, "productId")
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

	row, err := s.q.CreateModule(c.Request().Context(), db.CreateModuleParams{
		ID:        id,
		ProductID: productID,
		Name:      req.Name,
		Owner:     orDefault(deref(req.Owner), "Unassigned"),
		Status:    orDefault(deref(req.Status), "planned"),
		Position:  deref(req.Position),
	})
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getModule(c echo.Context) error {
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
	req, err := bind[updateProductModuleRequest](c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	cur, err := s.q.GetModule(ctx, id)
	if err != nil {
		return dbErr(err)
	}

	arg := db.UpdateModuleParams{
		ID:       cur.ID,
		Name:     cur.Name,
		Owner:    cur.Owner,
		Status:   cur.Status,
		Position: cur.Position,
	}
	if req.Name != nil {
		arg.Name = *req.Name
	}
	if req.Owner != nil {
		arg.Owner = *req.Owner
	}
	if req.Status != nil {
		arg.Status = *req.Status
	}
	if req.Position != nil {
		arg.Position = *req.Position
	}

	row, err := s.q.UpdateModule(ctx, arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateModuleStatus(c echo.Context) error {
	id, err := param(c, "moduleId")
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
	id, err := param(c, "moduleId")
	if err != nil {
		return err
	}
	if err := s.q.DeleteModule(c.Request().Context(), id); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}
