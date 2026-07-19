package cli

import (
	"strings"
	"testing"

	"github.com/nkenji09/scholia/internal/store"
)

// setOwnerKind は config.ownerKind を宣言する（CLI にはまだ set コマンドが無いので
// store 経由で直接。テスト用ヘルパ）。
func setOwnerKind(t *testing.T, dir, kind string) {
	t.Helper()
	s, err := store.Open(dir)
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	cfg, err := s.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	cfg.OwnerKind = kind
	if err := s.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
}

// #45 D9: ownerKind 未宣言のプロジェクトでは owner は自由文字列のまま許容される
// （後方互換の不変条件②）。
func TestCLI_VocabAddOwnerFreeStringWhenOwnerKindUnset(t *testing.T) {
	dir := t.TempDir()
	mustRun(t, dir, "init")
	// ownerKind 未宣言。実在しない任意の owner 文字列でも通る。
	mustRun(t, dir, "vocab", "add", "effect", "eff.a", "--label", "a", "--owner", "任意の自由文字列")

	s, _ := store.Open(dir)
	v, err := s.LoadVocab("eff.a")
	if err != nil {
		t.Fatalf("LoadVocab: %v", err)
	}
	if v.Owner != "任意の自由文字列" {
		t.Fatalf("Owner = %q, want free string preserved", v.Owner)
	}
}

// #45 D9: ownerKind 宣言下では owner が kind==ownerKind の実在タグ id であることを
// write-time 検証する。解決するなら通る。
func TestCLI_VocabAddOwnerValidatedWhenOwnerKindSet(t *testing.T) {
	dir := t.TempDir()
	mustRun(t, dir, "init")
	mustRun(t, dir, "tag", "create", "subject.cli", "--name", "CLI", "--kind", "subject")
	setOwnerKind(t, dir, "subject")

	// 実在する subject タグ id を owner に指定 → 通る。
	mustRun(t, dir, "vocab", "add", "effect", "eff.ok", "--label", "ok", "--owner", "subject.cli")

	// 実在しない owner → error（候補提示）。
	out, err := run(t, dir, "vocab", "add", "effect", "eff.bad", "--label", "bad", "--owner", "subject.missing")
	if err == nil {
		t.Fatalf("expected error for owner not resolving to a subject tag; out=%s", out)
	}
	if !strings.Contains(err.Error(), "候補") && !strings.Contains(out, "候補") {
		t.Fatalf("error should list candidates, got err=%v out=%s", err, out)
	}
}

// #45 D9: vocab edit --owner で既存 effect の owner を移行でき、ownerKind 検証が効く。
func TestCLI_VocabEditOwnerMigration(t *testing.T) {
	dir := t.TempDir()
	mustRun(t, dir, "init")
	mustRun(t, dir, "vocab", "add", "effect", "eff.a", "--label", "a", "--owner", "server")
	mustRun(t, dir, "tag", "create", "subject.store", "--name", "ストア", "--kind", "subject")
	setOwnerKind(t, dir, "subject")

	// 自由文字列 owner を subject タグ id へ移行。
	mustRun(t, dir, "vocab", "edit", "eff.a", "--owner", "subject.store")
	s, _ := store.Open(dir)
	v, _ := s.LoadVocab("eff.a")
	if v.Owner != "subject.store" {
		t.Fatalf("Owner = %q, want subject.store", v.Owner)
	}

	// 実在しない owner への edit は弾かれる。
	if _, err := run(t, dir, "vocab", "edit", "eff.a", "--owner", "subject.nope"); err == nil {
		t.Fatalf("expected error editing owner to a non-existent subject tag")
	}
}

// #45 D9: vocab edit --kind で condition の kind を backfill でき、宣言集合検査が効く。
func TestCLI_VocabEditKindBackfill(t *testing.T) {
	dir := t.TempDir()
	mustRun(t, dir, "init")
	mustRun(t, dir, "kind", "set", "condition", "input,env")
	mustRun(t, dir, "vocab", "add", "condition", "cond.a", "--label", "a")

	mustRun(t, dir, "vocab", "edit", "cond.a", "--kind", "input")
	s, _ := store.Open(dir)
	v, _ := s.LoadVocab("cond.a")
	if v.Kind != "input" {
		t.Fatalf("Kind = %q, want input", v.Kind)
	}

	// 未宣言 kind は弾かれる。
	if _, err := run(t, dir, "vocab", "edit", "cond.a", "--kind", "not-declared"); err == nil {
		t.Fatalf("expected error for kind not in config.kinds.condition")
	}
}

// --owner は effect 以外では拒否される（add と同じ制約）。
func TestCLI_VocabEditOwnerRejectedOnNonEffect(t *testing.T) {
	dir := t.TempDir()
	mustRun(t, dir, "init")
	mustRun(t, dir, "vocab", "add", "condition", "cond.a", "--label", "a")
	if _, err := run(t, dir, "vocab", "edit", "cond.a", "--owner", "x"); err == nil {
		t.Fatalf("expected error: --owner on a condition")
	}
}
