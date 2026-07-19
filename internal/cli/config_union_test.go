package cli

import (
	"testing"

	"github.com/nkenji09/scholia/internal/model"
	"github.com/nkenji09/scholia/internal/store"
)

// seedObjectTagKinds は object 宣言（behaviors/description 付き）の tagKinds を
// store に直接書き込む（CLI にはまだ behaviors 編集コマンドが無いのでテスト用）。
func seedObjectTagKinds(t *testing.T, dir string) {
	t.Helper()
	s, err := store.Open(dir)
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	cfg, err := s.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	cfg.TagKinds = []model.KindDecl{
		{ID: "requirement"},
		{ID: "concern"},
		{ID: "subject"},
		{ID: "axis", Description: "網羅検査の軸", Behaviors: []string{"axis"}},
	}
	if err := s.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
}

func loadCfg(t *testing.T, dir string) model.Config {
	t.Helper()
	s, err := store.Open(dir)
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	cfg, err := s.LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	return cfg
}

// #45 D9 レイヤ5: `config set viewer.port` は tagKinds の object 宣言を破壊しない。
func TestCLI_ConfigSetViewerPortPreservesTagKindObjects(t *testing.T) {
	dir := t.TempDir()
	mustRun(t, dir, "init")
	seedObjectTagKinds(t, dir)

	mustRun(t, dir, "config", "set", "viewer.port", "5001")

	cfg := loadCfg(t, dir)
	if cfg.Viewer.Port != 5001 {
		t.Fatalf("port = %d, want 5001", cfg.Viewer.Port)
	}
	if !cfg.KindHasBehavior("axis", "axis") {
		t.Fatalf("axis behavior lost after config set viewer.port: %+v", cfg.TagKinds)
	}
}

// #45 D9 レイヤ5: `config set tagKinds <csv>` は CSV を id 集合として解釈し、id が
// 残る限り object メタ（description/behaviors）を保持する。
func TestCLI_ConfigSetTagKindsPreservesObjectMetaByID(t *testing.T) {
	dir := t.TempDir()
	mustRun(t, dir, "init")
	seedObjectTagKinds(t, dir)

	// axis を含む CSV で再設定（順序を変えても id が残れば object メタは保持）。
	mustRun(t, dir, "config", "set", "tagKinds", "subject,axis,requirement,concern")

	cfg := loadCfg(t, dir)
	if !cfg.KindHasBehavior("axis", "axis") {
		t.Fatalf("axis behavior lost after config set tagKinds: %+v", cfg.TagKinds)
	}
	var axisDecl *model.KindDecl
	for i := range cfg.TagKinds {
		if cfg.TagKinds[i].ID == "axis" {
			axisDecl = &cfg.TagKinds[i]
		}
	}
	if axisDecl == nil || axisDecl.Description != "網羅検査の軸" {
		t.Fatalf("axis description lost: %+v", cfg.TagKinds)
	}

	// 新規 id は string 宣言で追加される（縮退で保存）。
	mustRun(t, dir, "config", "set", "tagKinds", "subject,axis,requirement,concern,extra")
	cfg = loadCfg(t, dir)
	found := false
	for _, d := range cfg.TagKinds {
		if d.ID == "extra" {
			found = true
			if d.Description != "" || len(d.Behaviors) != 0 {
				t.Fatalf("new id should be bare string decl: %+v", d)
			}
		}
	}
	if !found {
		t.Fatalf("new id 'extra' not added: %+v", cfg.TagKinds)
	}
}

// #45 D9 レイヤ5: condition kind の description 付き object 宣言は `kind set condition`
// の CSV set で id が残る限り保持される。
func TestCLI_KindSetConditionPreservesObjectMetaByID(t *testing.T) {
	dir := t.TempDir()
	mustRun(t, dir, "init")
	// object 宣言の condition kinds を種として書く。
	s, _ := store.Open(dir)
	cfg, _ := s.LoadConfig()
	cfg.Kinds.Condition = []model.KindDecl{
		{ID: "input", Label: "入力", Description: "呼び出しの形"},
		{ID: "env", Label: "環境", Description: "プロセス外"},
	}
	if err := s.SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	// 順序変更＋新規 id 追加。既存 object メタは保持、新規は string。
	mustRun(t, dir, "kind", "set", "condition", "env,input,store")
	cfg = loadCfg(t, dir)
	byID := map[string]model.KindDecl{}
	for _, d := range cfg.Kinds.Condition {
		byID[d.ID] = d
	}
	if byID["input"].Description != "呼び出しの形" || byID["env"].Description != "プロセス外" {
		t.Fatalf("condition object meta lost: %+v", cfg.Kinds.Condition)
	}
	if d, ok := byID["store"]; !ok || d.Description != "" {
		t.Fatalf("new condition id 'store' should be bare: %+v", cfg.Kinds.Condition)
	}
}
