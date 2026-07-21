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

// ------------------------------------------------------------------- ids ---

// newClientScopedID builds a unique TEXT id with the given prefix.
func newClientScopedID(prefix string) string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return prefix + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return prefix + "-" + strconv.FormatInt(time.Now().Unix(), 36) + "-" + hex.EncodeToString(buf)
}

func newClientID() string  { return newClientScopedID("cli") }
func newProjectID() string { return newClientScopedID("prj") }

// --------------------------------------------------------------- requests ---

type createClientRequest struct {
	ID           *string          `json:"id"`
	Name         string           `json:"name"`
	Industry     *string          `json:"industry"`
	Status       *string          `json:"status"`
	ClientPic    *string          `json:"clientPic"`
	WitOwner     *string          `json:"witOwner"`
	ContractType *string          `json:"contractType"`
	Health       *string          `json:"health"`
	Risk         *string          `json:"risk"`
	Notes        *string          `json:"notes"`
	ActionNeeded []string         `json:"actionNeeded"`
	AiInsight    *json.RawMessage `json:"aiInsight"`
}

type updateClientRequest struct {
	Name         *string          `json:"name"`
	Industry     *string          `json:"industry"`
	Status       *string          `json:"status"`
	ClientPic    *string          `json:"clientPic"`
	WitOwner     *string          `json:"witOwner"`
	ContractType *string          `json:"contractType"`
	Health       *string          `json:"health"`
	Risk         *string          `json:"risk"`
	Notes        *string          `json:"notes"`
	ActionNeeded []string         `json:"actionNeeded"`
	AiInsight    *json.RawMessage `json:"aiInsight"`
}

type createProjectRequest struct {
	ID        *string `json:"id"`
	ClientID  string  `json:"clientId"`
	Name      string  `json:"name"`
	Objective *string `json:"objective"`
	Status    *string `json:"status"`
}

type updateProjectRequest struct {
	ClientID  *string `json:"clientId"`
	Name      *string `json:"name"`
	Objective *string `json:"objective"`
	Status    *string `json:"status"`
}

// pickClientString returns *p when set, otherwise the current value.
func pickClientString(p *string, current string) string {
	if p == nil {
		return current
	}
	return *p
}

// rawToClientBytes converts an optional JSON blob to the []byte column type.
func rawToClientBytes(p *json.RawMessage, current []byte) []byte {
	if p == nil {
		return current
	}
	return []byte(*p)
}

// ----------------------------------------------------------------- routes ---

func (s *Server) registerClientRoutes(g *echo.Group) {
	g.GET("/clients", s.listClients)
	g.POST("/clients", s.createClient)
	g.GET("/clients/:clientId", s.getClient)
	g.PATCH("/clients/:clientId", s.updateClient)
	g.DELETE("/clients/:clientId", s.deleteClient)
	g.GET("/clients/:clientId/projects", s.listProjectsByClient)

	g.GET("/projects", s.listProjects)
	g.POST("/projects", s.createProject)
	g.GET("/projects/:projectId", s.getProject)
	g.PATCH("/projects/:projectId", s.updateProject)
	g.DELETE("/projects/:projectId", s.deleteProject)
}

// ---------------------------------------------------------------- clients ---

func (s *Server) listClients(c echo.Context) error {
	rows, err := s.q.ListClients(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) createClient(c echo.Context) error {
	req, err := bind[createClientRequest](c)
	if err != nil {
		return err
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	id := deref(req.ID)
	if id == "" {
		id = newClientID()
	}
	actionNeeded := req.ActionNeeded
	if actionNeeded == nil {
		actionNeeded = []string{}
	}

	arg := db.CreateClientParams{
		ID:           id,
		Name:         req.Name,
		Industry:     deref(req.Industry),
		Status:       deref(req.Status),
		ClientPic:    deref(req.ClientPic),
		WitOwner:     deref(req.WitOwner),
		ContractType: deref(req.ContractType),
		Health:       deref(req.Health),
		Risk:         deref(req.Risk),
		Notes:        deref(req.Notes),
		ActionNeeded: actionNeeded,
		AiInsight:    rawToClientBytes(req.AiInsight, nil),
	}

	row, err := s.q.CreateClient(c.Request().Context(), arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getClient(c echo.Context) error {
	id, err := param(c, "clientId")
	if err != nil {
		return err
	}
	row, err := s.q.GetClient(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateClient(c echo.Context) error {
	id, err := param(c, "clientId")
	if err != nil {
		return err
	}
	req, err := bind[updateClientRequest](c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	cur, err := s.q.GetClient(ctx, id)
	if err != nil {
		return dbErr(err)
	}

	actionNeeded := cur.ActionNeeded
	if req.ActionNeeded != nil {
		actionNeeded = req.ActionNeeded
	}

	arg := db.UpdateClientParams{
		ID:           id,
		Name:         pickClientString(req.Name, cur.Name),
		Industry:     pickClientString(req.Industry, cur.Industry),
		Status:       pickClientString(req.Status, cur.Status),
		ClientPic:    pickClientString(req.ClientPic, cur.ClientPic),
		WitOwner:     pickClientString(req.WitOwner, cur.WitOwner),
		ContractType: pickClientString(req.ContractType, cur.ContractType),
		Health:       pickClientString(req.Health, cur.Health),
		Risk:         pickClientString(req.Risk, cur.Risk),
		Notes:        pickClientString(req.Notes, cur.Notes),
		ActionNeeded: actionNeeded,
		AiInsight:    rawToClientBytes(req.AiInsight, cur.AiInsight),
	}

	row, err := s.q.UpdateClient(ctx, arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteClient(c echo.Context) error {
	id, err := param(c, "clientId")
	if err != nil {
		return err
	}
	if err := s.q.DeleteClient(c.Request().Context(), id); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (s *Server) listProjectsByClient(c echo.Context) error {
	id, err := param(c, "clientId")
	if err != nil {
		return err
	}
	rows, err := s.q.ListProjectsByClient(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

// --------------------------------------------------------------- projects ---

func (s *Server) listProjects(c echo.Context) error {
	rows, err := s.q.ListProjects(c.Request().Context())
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) createProject(c echo.Context) error {
	req, err := bind[createProjectRequest](c)
	if err != nil {
		return err
	}
	if req.ClientID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "clientId is required")
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	id := deref(req.ID)
	if id == "" {
		id = newProjectID()
	}

	arg := db.CreateProjectParams{
		ID:        id,
		ClientID:  req.ClientID,
		Name:      req.Name,
		Objective: deref(req.Objective),
		Status:    deref(req.Status),
	}

	row, err := s.q.CreateProject(c.Request().Context(), arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusCreated, row)
}

func (s *Server) getProject(c echo.Context) error {
	id, err := param(c, "projectId")
	if err != nil {
		return err
	}
	row, err := s.q.GetProject(c.Request().Context(), id)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) updateProject(c echo.Context) error {
	id, err := param(c, "projectId")
	if err != nil {
		return err
	}
	req, err := bind[updateProjectRequest](c)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	cur, err := s.q.GetProject(ctx, id)
	if err != nil {
		return dbErr(err)
	}

	arg := db.UpdateProjectParams{
		ID:        id,
		ClientID:  pickClientString(req.ClientID, cur.ClientID),
		Name:      pickClientString(req.Name, cur.Name),
		Objective: pickClientString(req.Objective, cur.Objective),
		Status:    pickClientString(req.Status, cur.Status),
	}

	row, err := s.q.UpdateProject(ctx, arg)
	if err != nil {
		return dbErr(err)
	}
	return c.JSON(http.StatusOK, row)
}

func (s *Server) deleteProject(c echo.Context) error {
	id, err := param(c, "projectId")
	if err != nil {
		return err
	}
	if err := s.q.DeleteProject(c.Request().Context(), id); err != nil {
		return dbErr(err)
	}
	return c.NoContent(http.StatusNoContent)
}
