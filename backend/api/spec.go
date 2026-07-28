// Package api holds the service's own description of itself.
//
// The OpenAPI document lives here rather than at the repository root so it can
// be embedded: go:embed cannot reach outside the package directory, and a spec
// the binary carries with it is a spec that cannot be missing in production or
// drift from the build that is running.
package api

import _ "embed"

// Spec is the OpenAPI 3.1 description of the API, served at /openapi.yaml and,
// converted, at /openapi.json.
//
//go:embed openapi.yaml
var Spec []byte
