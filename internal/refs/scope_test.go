package refs

import (
	"reflect"
	"testing"
)

func TestFilterScope(t *testing.T) {
	files := []string{"app/main.go", "apps/other.go", "app.txt", "lib/util.go", "lib/gen/out.go"}

	cases := []struct {
		name string
		opts Options
		want []string
	}{
		{
			name: "no scope configured returns files unchanged",
			opts: Options{},
			want: files,
		},
		{
			name: "scan limits to prefix at a path boundary (does not swallow apps/ or app.txt)",
			opts: Options{Scan: []string{"app"}},
			want: []string{"app/main.go"},
		},
		{
			name: "exclude removes a prefix on top of everything else",
			opts: Options{Exclude: []string{"lib/gen"}},
			want: []string{"app/main.go", "apps/other.go", "app.txt", "lib/util.go"},
		},
		{
			name: "scan and exclude combine",
			opts: Options{Scan: []string{"lib"}, Exclude: []string{"lib/gen"}},
			want: []string{"lib/util.go"},
		},
		{
			name: "an exact-file scan entry matches only that file",
			opts: Options{Scan: []string{"app.txt"}},
			want: []string{"app.txt"},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := filterScope(files, c.opts)
			if !reflect.DeepEqual(got, c.want) {
				t.Fatalf("filterScope(...) = %v, want %v", got, c.want)
			}
		})
	}
}

func TestExecute_ScopeOptionsAreOptionalAndDefaultToNoNarrowing(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, "app/handler.go", "// see req.foo\n")
	writeFile(t, root, "apps/other.go", "// see req.foo\n")

	// No Options at all — must behave exactly as before this feature existed.
	reportNoOpts, err := Execute(root, []Pair{{OldID: "req.foo", NewID: "req.bar"}}, false)
	if err != nil {
		t.Fatalf("Execute (no opts): %v", err)
	}
	if len(reportNoOpts.Matches) != 2 {
		t.Fatalf("expected 2 matches with no scope configured, got %+v", reportNoOpts.Matches)
	}

	// Zero-value Options must behave identically to omitting it.
	reportZero, err := Execute(root, []Pair{{OldID: "req.foo", NewID: "req.bar"}}, false, Options{})
	if err != nil {
		t.Fatalf("Execute (zero-value opts): %v", err)
	}
	if len(reportZero.Matches) != 2 {
		t.Fatalf("expected 2 matches with zero-value scope, got %+v", reportZero.Matches)
	}

	// A real scan scope narrows to just that subtree, and does not swallow
	// the sibling "apps/" directory.
	reportScoped, err := Execute(root, []Pair{{OldID: "req.foo", NewID: "req.bar"}}, false, Options{Scan: []string{"app"}})
	if err != nil {
		t.Fatalf("Execute (scoped): %v", err)
	}
	if len(reportScoped.Matches) != 1 || reportScoped.Matches[0].Path != "app/handler.go" {
		t.Fatalf("expected only app/handler.go to match, got %+v", reportScoped.Matches)
	}
}

func TestScanIDs_ScopeOptionsAreOptional(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, "app/handler.go", "// see req.foo\n")
	writeFile(t, root, "apps/other.go", "// see req.foo\n")

	reportAll, err := ScanIDs(root, []string{"req.foo"})
	if err != nil {
		t.Fatalf("ScanIDs (no opts): %v", err)
	}
	if len(reportAll.Matches) != 2 {
		t.Fatalf("expected 2 matches with no scope configured, got %+v", reportAll.Matches)
	}

	reportScoped, err := ScanIDs(root, []string{"req.foo"}, Options{Exclude: []string{"apps"}})
	if err != nil {
		t.Fatalf("ScanIDs (scoped): %v", err)
	}
	if len(reportScoped.Matches) != 1 || reportScoped.Matches[0].Path != "app/handler.go" {
		t.Fatalf("expected apps/ excluded, got %+v", reportScoped.Matches)
	}
}
