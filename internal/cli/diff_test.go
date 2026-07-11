package cli

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func gitInitT(t *testing.T, dir string) {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	for _, args := range [][]string{
		{"init", "-q"},
		{"config", "user.email", "test@example.com"},
		{"config", "user.name", "test"},
	} {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
}

func gitCommitAllT(t *testing.T, dir, msg string) {
	t.Helper()
	for _, args := range [][]string{{"add", "-A"}, {"commit", "-q", "-m", msg}} {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
}

func TestDiff_NoChanges(t *testing.T) {
	dir := t.TempDir()
	gitInitT(t, dir)
	seedListFixture(t, dir)
	gitCommitAllT(t, dir, "seed")

	out, err := run(t, dir, "diff")
	if err != nil {
		t.Fatalf("diff: %v\n%s", err, out)
	}
	if !strings.Contains(out, "差分なし") {
		t.Fatalf("expected 差分なし, got:\n%s", out)
	}
}

func TestDiff_VocabAddDetected(t *testing.T) {
	dir := t.TempDir()
	gitInitT(t, dir)
	seedListFixture(t, dir)
	gitCommitAllT(t, dir, "seed")

	if out, err := run(t, dir, "vocab", "add", "condition", "cond.new", "--label", "新しい条件"); err != nil {
		t.Fatalf("vocab add: %v\n%s", err, out)
	}

	out, err := run(t, dir, "diff", "--json")
	if err != nil {
		t.Fatalf("diff: %v\n%s", err, out)
	}
	if !strings.Contains(out, "cond.new") {
		t.Fatalf("expected diff to report added vocab cond.new:\n%s", out)
	}
}

func TestDiff_ThenReorderDetected(t *testing.T) {
	dir := t.TempDir()
	gitInitT(t, dir)
	seedListFixture(t, dir)
	if out, err := run(t, dir, "vocab", "add", "effect", "eff.second", "--label", "2 つめの効果"); err != nil {
		t.Fatalf("vocab add: %v\n%s", err, out)
	}
	if out, err := run(t, dir, "tx", "add", "T-reorder", "--action", "act.submit", "--then", "eff.token,eff.second"); err != nil {
		t.Fatalf("tx add: %v\n%s", err, out)
	}
	gitCommitAllT(t, dir, "seed")

	txPath := filepath.Join(dir, ".pmem", "transitions", "T-reorder.json")
	writeRawJSON(t, txPath, `{"id":"T-reorder","action":"act.submit","given":[],"then":["eff.second","eff.token"]}`)

	out, err := run(t, dir, "diff")
	if err != nil {
		t.Fatalf("diff: %v\n%s", err, out)
	}
	if !strings.Contains(out, "並び替え") {
		t.Fatalf("expected then-reorder to be reported:\n%s", out)
	}
}

func TestDiff_DecisionRemovalIsErrorExit(t *testing.T) {
	dir := t.TempDir()
	gitInitT(t, dir)
	seedListFixture(t, dir)
	decPath := filepath.Join(dir, ".pmem", "decisions", "d1.json")
	writeRawJSON(t, decPath, `{"id":"d1","target":{"type":"transition","id":"T-happy"},"why":"why","at":"2026-01-01T00:00:00Z"}`)
	gitCommitAllT(t, dir, "seed")

	if err := os.Remove(decPath); err != nil {
		t.Fatal(err)
	}

	out, err := run(t, dir, "diff")
	if err == nil {
		t.Fatalf("expected diff to fail (exit non-zero) on decision removal, output:\n%s", out)
	}
	if !strings.Contains(out, "append-only 違反") {
		t.Fatalf("expected append-only violation message, got:\n%s", out)
	}
}

// gap G8: pmem diff はベースライン（.pmem）が無い初回でも詰まらない。

func TestDiff_NoCommitsIsGracefulOnFirstRun(t *testing.T) {
	dir := t.TempDir()
	gitInitT(t, dir)

	if out, err := run(t, dir, "init"); err != nil {
		t.Fatalf("pmem init: %v\n%s", err, out)
	}
	if out, err := run(t, dir, "vocab", "add", "condition", "cond.a", "--label", "a"); err != nil {
		t.Fatalf("vocab add: %v\n%s", err, out)
	}

	out, err := run(t, dir, "diff")
	if err != nil {
		t.Fatalf("expected diff to succeed (exit 0) on first run with zero commits: %v\n%s", err, out)
	}
	if !strings.Contains(out, "ベースライン") {
		t.Fatalf("expected a baseline-missing notice, got:\n%s", out)
	}
	if !strings.Contains(out, "cond.a") {
		t.Fatalf("expected current records to show up as added, got:\n%s", out)
	}
}

func TestDiff_PmemUncommittedIsGracefulOnFirstRun(t *testing.T) {
	dir := t.TempDir()
	gitInitT(t, dir)

	if out, err := run(t, dir, "init"); err != nil {
		t.Fatalf("pmem init: %v\n%s", err, out)
	}
	// .pmem は git add せず、README だけ commit して HEAD を作る。
	writeRawJSON(t, filepath.Join(dir, "README.md"), "hello")
	cmd := exec.Command("git", "add", "README.md")
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git add README.md: %v\n%s", err, out)
	}
	cmd = exec.Command("git", "commit", "-q", "-m", "no pmem yet")
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git commit: %v\n%s", err, out)
	}
	if out, err := run(t, dir, "vocab", "add", "condition", "cond.a", "--label", "a"); err != nil {
		t.Fatalf("vocab add: %v\n%s", err, out)
	}

	out, err := run(t, dir, "diff")
	if err != nil {
		t.Fatalf("expected diff to succeed (exit 0) when .pmem/ isn't committed yet: %v\n%s", err, out)
	}
	if !strings.Contains(out, "ベースライン") {
		t.Fatalf("expected a baseline-missing notice, got:\n%s", out)
	}
	if !strings.Contains(out, "cond.a") {
		t.Fatalf("expected current records to show up as added, got:\n%s", out)
	}
}

func TestDiff_ExplicitInvalidRefStillErrors(t *testing.T) {
	dir := t.TempDir()
	gitInitT(t, dir)
	seedListFixture(t, dir)
	gitCommitAllT(t, dir, "seed")

	out, err := run(t, dir, "diff", "no-such-ref")
	if err == nil {
		t.Fatalf("expected diff --ref no-such-ref to fail (exit non-zero), output:\n%s", out)
	}
}

func TestDiff_DefaultsToHEADAndAcceptsExplicitRef(t *testing.T) {
	dir := t.TempDir()
	gitInitT(t, dir)
	seedListFixture(t, dir)
	gitCommitAllT(t, dir, "seed")

	out, err := run(t, dir, "diff", "HEAD")
	if err != nil {
		t.Fatalf("diff HEAD: %v\n%s", err, out)
	}
	if !strings.Contains(out, "差分なし") {
		t.Fatalf("expected 差分なし for explicit HEAD ref:\n%s", out)
	}
}
