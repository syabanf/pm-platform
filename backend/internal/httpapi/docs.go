package httpapi

import (
	_ "embed"
	"encoding/json"
	"net/http"
	"sync"

	"github.com/labstack/echo/v4"
	"gopkg.in/yaml.v3"

	"github.com/syabanf/pm-platform/backend/api"
)

// docsPage renders the embedded specification. It fetches /openapi.json and
// draws the reference itself rather than loading a viewer from a CDN, so the
// documentation works on a laptop with no internet and on a network that does
// not let the browser reach one.
//
//go:embed docs.html
var docsPage []byte

// specJSON converts the YAML document once, on first request. The conversion is
// pure and the input is embedded, so a sync.Once is enough — and a spec that
// fails to convert is a build-time mistake that shows up on the first hit
// rather than costing every request.
var (
	specOnce sync.Once
	specJSON []byte
	specErr  error
)

func openAPIJSON() ([]byte, error) {
	specOnce.Do(func() {
		var doc any
		if specErr = yaml.Unmarshal(api.Spec, &doc); specErr != nil {
			return
		}
		specJSON, specErr = json.Marshal(doc)
	})
	return specJSON, specErr
}

// registerDocsRoutes mounts the reference at the root, beside the probes and
// outside /api/v1: the documentation describes the API, it is not part of it.
func registerDocsRoutes(e *echo.Echo) {
	e.GET("/docs", func(c echo.Context) error {
		// The one HTML route the service serves. Its script and style are inline
		// and baked into the binary, and it fetches only its own /openapi.json —
		// so lock everything else out. 'unsafe-inline' is scoped to this page's
		// own static assets; no external origin, no eval, no framing.
		c.Response().Header().Set("Content-Security-Policy",
			"default-src 'none'; "+
				"script-src 'unsafe-inline'; "+
				"style-src 'unsafe-inline'; "+
				"connect-src 'self'; "+
				"img-src 'self' data:; "+
				"base-uri 'none'; "+
				"form-action 'none'; "+
				"frame-ancestors 'none'")
		return c.HTMLBlob(http.StatusOK, docsPage)
	})

	// The document itself, for generating clients.
	e.GET("/openapi.yaml", func(c echo.Context) error {
		return c.Blob(http.StatusOK, "application/yaml; charset=utf-8", api.Spec)
	})

	e.GET("/openapi.json", func(c echo.Context) error {
		out, err := openAPIJSON()
		if err != nil {
			return err
		}
		return c.Blob(http.StatusOK, echo.MIMEApplicationJSON, out)
	})
}
