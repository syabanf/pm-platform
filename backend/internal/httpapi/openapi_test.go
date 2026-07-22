package httpapi

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// TestOpenAPIMatchesRouter keeps openapi.yaml honest. Documentation drifts the
// moment it is maintained by hand and remembering, so this fails the build when
// a route is added, renamed or removed without the spec following it.
//
// It reads the spec as text rather than parsing YAML, which keeps the backend
// free of a YAML dependency it otherwise has no use for. That works because the
// file's shape is fixed: path keys sit at two spaces, methods at four.
func TestOpenAPIMatchesRouter(t *testing.T) {
	specOps, err := operationsInSpec("../../openapi.yaml")
	if err != nil {
		t.Fatalf("reading spec: %v", err)
	}
	routerOps, err := operationsInRouter(".")
	if err != nil {
		t.Fatalf("reading routes: %v", err)
	}

	if len(routerOps) == 0 {
		t.Fatal("found no routes — the extraction is broken, not the spec")
	}

	for _, op := range sortedKeys(routerOps) {
		if !specOps[op] {
			t.Errorf("route is not in openapi.yaml: %s", op)
		}
	}
	for _, op := range sortedKeys(specOps) {
		if !routerOps[op] {
			t.Errorf("openapi.yaml documents a route that is not registered: %s", op)
		}
	}
	t.Logf("%d operations, spec and router agree", len(routerOps))
}

var (
	// `  /clients/{clientId}:` — a path key, two spaces in.
	specPathRe = regexp.MustCompile(`^ {2}(/\S*):\s*$`)
	// `    get:` — a method under it, four spaces in.
	specMethodRe = regexp.MustCompile(`^ {4}(get|post|put|patch|delete):\s*$`)
	// `g.GET("/clients", ...)` and `e.GET("/livez", ...)`
	routeRe = regexp.MustCompile(`[ge]\.(GET|POST|PUT|PATCH|DELETE)\("([^"]*)"`)
	// `:clientId` -> `{clientId}`
	paramRe = regexp.MustCompile(`:(\w+)`)
)

func operationsInSpec(path string) (map[string]bool, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	ops := map[string]bool{}
	current := ""
	inPaths := false
	for _, line := range strings.Split(string(raw), "\n") {
		switch {
		case line == "paths:":
			inPaths = true
		case inPaths && line == "components:":
			inPaths = false
		}
		if !inPaths {
			continue
		}
		if m := specPathRe.FindStringSubmatch(line); m != nil {
			current = m[1]
			continue
		}
		if m := specMethodRe.FindStringSubmatch(line); m != nil && current != "" {
			ops[strings.ToUpper(m[1])+" "+current] = true
		}
	}
	return ops, nil
}

func operationsInRouter(dir string) (map[string]bool, error) {
	files, err := filepath.Glob(filepath.Join(dir, "*.go"))
	if err != nil {
		return nil, err
	}
	ops := map[string]bool{}
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		raw, err := os.ReadFile(f)
		if err != nil {
			return nil, err
		}
		for _, m := range routeRe.FindAllStringSubmatch(string(raw), -1) {
			ops[m[1]+" "+paramRe.ReplaceAllString(m[2], "{$1}")] = true
		}
	}
	return ops, nil
}

func sortedKeys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
