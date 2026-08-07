package httpapi

import "github.com/labstack/echo/v4"

// routes mounts every resource group under /api/v1.
//
// The URL shape mirrors the delivery hierarchy
//
//	client -> project -> module("Component") -> component("Component") -> sprint
//
// while keeping each resource individually addressable by id.
func (s *Server) routes(g *echo.Group) {
	s.registerClientRoutes(g)
	s.registerModuleRoutes(g)
	s.registerSprintRoutes(g)
	s.registerTaskRoutes(g)
	s.registerSettingsRoutes(g)
	s.registerUserRoutes(g)
}
