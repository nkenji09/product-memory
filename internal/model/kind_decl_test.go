package model

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

// KindDecl は string|object の union（#45 D9）。string は id のみに縮退宣言、
// object は全欄。UnmarshalJSON はどちらからも復元し、MarshalJSON は縮退で書く。
func TestKindDeclUnmarshalStringAndObject(t *testing.T) {
	var s KindDecl
	if err := json.Unmarshal([]byte(`"axis"`), &s); err != nil {
		t.Fatalf("string decode: %v", err)
	}
	if s.ID != "axis" || s.Label != "" || s.Description != "" || len(s.Behaviors) != 0 {
		t.Fatalf("string decode = %+v, want bare {ID:axis}", s)
	}

	var o KindDecl
	obj := `{"id":"env","label":"環境","description":"プロセス外","behaviors":["axis"]}`
	if err := json.Unmarshal([]byte(obj), &o); err != nil {
		t.Fatalf("object decode: %v", err)
	}
	if o.ID != "env" || o.Label != "環境" || o.Description != "プロセス外" || !reflect.DeepEqual(o.Behaviors, []string{"axis"}) {
		t.Fatalf("object decode = %+v, want all fields", o)
	}
}

// 縮退 Marshal: label/description/behaviors がいずれも空なら string ID に縮退する
// （既存 string 宣言を round-trip で object に膨らませない＝git diff を汚さない・不変条件①）。
func TestKindDeclMarshalDegradesToString(t *testing.T) {
	bare := KindDecl{ID: "requirement"}
	data, err := json.Marshal(bare)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != `"requirement"` {
		t.Fatalf("bare KindDecl marshaled to %s, want \"requirement\" (string form)", data)
	}

	full := KindDecl{ID: "input", Label: "入力", Description: "呼び出しの形", Behaviors: []string{"axis"}}
	data, err = json.Marshal(full)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(data), "{") {
		t.Fatalf("full KindDecl marshaled to %s, want object form", data)
	}
	var back KindDecl
	if err := json.Unmarshal(data, &back); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(back, full) {
		t.Fatalf("object round-trip = %+v, want %+v", back, full)
	}
}

// 後方互換: 旧 string 形式の config.json（tagKinds が string 配列・axis 含む・
// ownerKind なし）が従来と同一に parse され、Marshal で string 形に戻る（不変条件①）。
func TestConfigLegacyStringTagKindsRoundTrip(t *testing.T) {
	legacy := `{"schemaVersion":1,"kinds":{"condition":[],"action":["user"],"effect":["log"]},` +
		`"tagKinds":["requirement","concern","subject","axis"],"facetKinds":["subject"],` +
		`"traceabilityKinds":["requirement"],"idPrefix":{"condition":"cond.","action":"act.","effect":"eff."},` +
		`"roots":[],"viewer":{"port":4577}}`
	var cfg Config
	if err := json.Unmarshal([]byte(legacy), &cfg); err != nil {
		t.Fatalf("legacy config must decode: %v", err)
	}
	if got := cfg.TagKindIDs(); !reflect.DeepEqual(got, []string{"requirement", "concern", "subject", "axis"}) {
		t.Fatalf("TagKindIDs = %v, want [requirement concern subject axis]", got)
	}
	if cfg.OwnerKind != "" {
		t.Fatalf("legacy config OwnerKind = %q, want empty (unwired)", cfg.OwnerKind)
	}
	// Marshal で tagKinds は string 配列に戻る（object に膨らまない）。
	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"tagKinds":["requirement","concern","subject","axis"]`) {
		t.Fatalf("re-marshaled tagKinds not in string form: %s", data)
	}
	// ownerKind は未宣言なら omitempty で現れない。
	if strings.Contains(string(data), "ownerKind") {
		t.Fatalf("ownerKind must be omitted when empty: %s", data)
	}
}

// DefaultConfig の tagKinds は縮退 Marshal で string 形になる（既定 config が
// object に膨らまない・不変条件①）。ownerKind は既定空で現れない。
func TestDefaultConfigTagKindsMarshalString(t *testing.T) {
	data, err := json.Marshal(DefaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"tagKinds":["requirement","concern","subject"]`) {
		t.Fatalf("default tagKinds not string form: %s", data)
	}
	if strings.Contains(string(data), "ownerKind") {
		t.Fatalf("default ownerKind must be omitted: %s", data)
	}
}

// object 宣言（description 付き condition kind）が round-trip で保全される。
func TestConfigObjectConditionKindsRoundTrip(t *testing.T) {
	src := `{"schemaVersion":1,"kinds":{"condition":[` +
		`{"id":"input","label":"入力","description":"呼び出しの形"},` +
		`{"id":"env","label":"環境","description":"プロセス外"}],` +
		`"action":["user"],"effect":["log"]},` +
		`"tagKinds":["subject"],"facetKinds":["subject"],"traceabilityKinds":["requirement"],` +
		`"idPrefix":{"condition":"cond.","action":"act.","effect":"eff."},"roots":[],"viewer":{"port":4577}}`
	var cfg Config
	if err := json.Unmarshal([]byte(src), &cfg); err != nil {
		t.Fatalf("object condition kinds must decode: %v", err)
	}
	if len(cfg.Kinds.Condition) != 2 || cfg.Kinds.Condition[0].Description != "呼び出しの形" {
		t.Fatalf("condition kinds = %+v, want 2 with descriptions", cfg.Kinds.Condition)
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"description":"呼び出しの形"`) {
		t.Fatalf("object condition kind description lost on round-trip: %s", data)
	}
}

// TagKindLabel の3段解決（object Label → 互換 map → 素の id・#45 D9）。
func TestTagKindLabelResolution(t *testing.T) {
	cfg := Config{
		TagKinds:      []KindDecl{{ID: "env", Label: "環境"}, {ID: "subject"}},
		TagKindLabels: map[string]string{"subject": "主題"},
	}
	if got := cfg.TagKindLabel("env"); got != "環境" {
		t.Fatalf("object Label wins: got %q, want 環境", got)
	}
	if got := cfg.TagKindLabel("subject"); got != "主題" {
		t.Fatalf("compat map fallback: got %q, want 主題", got)
	}
	if got := cfg.TagKindLabel("unknown"); got != "unknown" {
		t.Fatalf("bare id fallback: got %q, want unknown", got)
	}
}

// KindHasBehavior: 明示宣言・axis 互換・非該当（#45 D9・不変条件③）。
func TestKindHasBehavior(t *testing.T) {
	cfg := Config{TagKinds: []KindDecl{
		{ID: "axis"}, // 旧 string axis 宣言相当（Behaviors 未宣言）
		{ID: "dimension", Behaviors: []string{"axis"}}, // 別名 kind の明示 axis 宣言
		{ID: "subject"}, // axis 挙動なし
	}}
	if !cfg.KindHasBehavior("axis", "axis") {
		t.Fatal("compat: kind=axis without explicit behaviors must have axis behavior")
	}
	if !cfg.KindHasBehavior("dimension", "axis") {
		t.Fatal("explicit behaviors:[axis] must have axis behavior")
	}
	if cfg.KindHasBehavior("subject", "axis") {
		t.Fatal("subject must not have axis behavior")
	}
	if cfg.KindHasBehavior("axis", "exclusive") {
		t.Fatal("unknown behavior must be false")
	}
}

// #45 D9: axis の axis 挙動が declaration の behaviors:["axis"] を読んで解決する
// （compat fallback＝id=="axis" に依存しない）ことを固定する。旗艦 axis kind を
// object 宣言（behaviors:["axis"]）にしたときの本来の解決経路。compat fallback を
// 意図的に無効化した別 id の kind でも declaration だけで true になることで、
// 「declaration 経由の解決」と「compat による解決」を分離して証明する。
func TestKindHasBehavior_ResolvesFromDeclarationNotCompat(t *testing.T) {
	// (1) id=="axis" だが behaviors を明示宣言した object 形。declaration が
	// あれば明示が勝つ——compat と同じ true だが、経路は declaration。
	declared := Config{TagKinds: []KindDecl{
		{ID: "axis", Label: "軸", Description: "状態次元", Behaviors: []string{"axis"}},
	}}
	if !declared.KindHasBehavior("axis", "axis") {
		t.Fatal("axis with explicit behaviors:[axis] must resolve axis via declaration")
	}

	// (2) compat が効かない別 id（"dim"）でも declaration だけで true。
	// compat は id=="axis" のときしか効かないので、これが true なのは
	// 「declaration の behaviors を読んでいる」ことの独立した証拠。
	aliasOnly := Config{TagKinds: []KindDecl{
		{ID: "dim", Behaviors: []string{"axis"}},
	}}
	if !aliasOnly.KindHasBehavior("dim", "axis") {
		t.Fatal("alias kind with behaviors:[axis] must resolve via declaration (compat cannot help a non-axis id)")
	}
	// compat が効かないことの裏取り: behaviors を宣言しない別 id は false。
	noDecl := Config{TagKinds: []KindDecl{{ID: "dim"}}}
	if noDecl.KindHasBehavior("dim", "axis") {
		t.Fatal("alias kind WITHOUT behaviors must be false (compat only rescues id==axis)")
	}
}

// #45 D9: config.tagKinds の混在 union（一部 string・一部 object）が round-trip で
// 非破壊——bare string の requirement/concern/subject は string のまま、object の
// axis（behaviors/description）は object のまま。縮退が axis を string に潰さず、
// 他3つを object に膨らませないことを固定する（旗艦 kind の実データ形を反映）。
func TestConfigMixedTagKindsRoundTripNonDestructive(t *testing.T) {
	src := `{"schemaVersion":1,"kinds":{"condition":[],"action":["user"],"effect":["log"]},` +
		`"tagKinds":["requirement","concern","subject",` +
		`{"id":"axis","label":"軸","description":"状態次元","behaviors":["axis"]}],` +
		`"facetKinds":["subject"],"traceabilityKinds":["requirement"],` +
		`"idPrefix":{"condition":"cond.","action":"act.","effect":"eff."},"roots":[],"viewer":{"port":4577}}`
	var cfg Config
	if err := json.Unmarshal([]byte(src), &cfg); err != nil {
		t.Fatalf("mixed tagKinds must decode: %v", err)
	}
	// 復元の中身: 先頭3つは bare（Label/Description/Behaviors 空）・axis は object。
	if len(cfg.TagKinds) != 4 {
		t.Fatalf("tagKinds len = %d, want 4", len(cfg.TagKinds))
	}
	for _, id := range []string{"requirement", "concern", "subject"} {
		var d *KindDecl
		for i := range cfg.TagKinds {
			if cfg.TagKinds[i].ID == id {
				d = &cfg.TagKinds[i]
			}
		}
		if d == nil || d.Label != "" || d.Description != "" || len(d.Behaviors) != 0 {
			t.Fatalf("%s must decode as bare KindDecl, got %+v", id, d)
		}
	}
	if !cfg.KindHasBehavior("axis", "axis") {
		t.Fatalf("axis object decl must carry axis behavior")
	}

	// Marshal で混在が保存される: 先頭3つは string 形・axis は object 形。
	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	s := string(data)
	if !strings.Contains(s, `"tagKinds":["requirement","concern","subject",{`) {
		t.Fatalf("mixed tagKinds not round-tripped (string prefix + object axis): %s", s)
	}
	if !strings.Contains(s, `"behaviors":["axis"]`) || !strings.Contains(s, `"description":"状態次元"`) {
		t.Fatalf("axis object metadata lost on marshal: %s", s)
	}
	// axis が string に潰れていない（"axis" 単独文字列で現れない）。
	if strings.Contains(s, `,"axis"]`) || strings.Contains(s, `,"axis",`) {
		t.Fatalf("axis must stay object, must not degrade to string: %s", s)
	}
}
