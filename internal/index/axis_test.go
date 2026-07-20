package index

import (
	"reflect"
	"testing"

	"github.com/nkenji09/scholia/internal/model"
	"github.com/nkenji09/scholia/internal/store"
)

func axisSnapshot() *store.Snapshot {
	return &store.Snapshot{
		Vocab: []model.VocabEntry{
			{ID: "act.update", Category: model.CategoryAction, Label: "更新", Kind: "user"},
			{ID: "cond.platform-unix", Category: model.CategoryCondition, Label: "unix", Tags: []string{"axis.update.platform"}},
			{ID: "cond.platform-windows", Category: model.CategoryCondition, Label: "windows", Tags: []string{"axis.update.platform"}},
			{ID: "eff.done", Category: model.CategoryEffect, Label: "完了"},
		},
		Tags: []model.Tag{
			{ID: "axis.update.platform", Name: "プラットフォーム軸", Kind: "axis", Total: true},
		},
		Transitions: []model.Transition{
			{ID: "T-unix", Action: "act.update", Given: []string{"cond.platform-unix"}, Then: []string{"eff.done"}},
			{ID: "T-win", Action: "act.update", Given: []string{"cond.platform-windows"}, Then: []string{"eff.done"}},
		},
	}
}

func TestBuildAxisStructure_ValuesAndActions(t *testing.T) {
	ix := Build(axisSnapshot())
	got := BuildAxisStructure(ix, "axis.update.platform", true)
	if got == nil {
		t.Fatal("BuildAxisStructure returned nil for an axis tag with values")
	}
	if !got.Total {
		t.Fatal("Total should mirror Tag.Total=true")
	}
	if len(got.Values) != 2 {
		t.Fatalf("values = %+v, want 2 (unix, windows)", got.Values)
	}
	// id-sorted: cond.platform-unix < cond.platform-windows.
	if got.Values[0].Condition.ID != "cond.platform-unix" || got.Values[1].Condition.ID != "cond.platform-windows" {
		t.Fatalf("value order = %v/%v, want unix then windows", got.Values[0].Condition.ID, got.Values[1].Condition.ID)
	}
	if !reflect.DeepEqual(got.Values[0].Actions, []string{"act.update"}) {
		t.Fatalf("unix actions = %v, want [act.update]", got.Values[0].Actions)
	}
}

func TestBuildAxisStructure_NonAxisReturnsNil(t *testing.T) {
	ix := Build(axisSnapshot())
	if got := BuildAxisStructure(ix, "axis.update.platform", false); got != nil {
		t.Fatalf("non-axis kind should return nil, got %+v", got)
	}
}

func TestBuildAxisStructure_NoValuesReturnsNil(t *testing.T) {
	snap := axisSnapshot()
	// Strip the axis tag off both conditions → axis has no declared values.
	for i := range snap.Vocab {
		snap.Vocab[i].Tags = nil
	}
	ix := Build(snap)
	if got := BuildAxisStructure(ix, "axis.update.platform", true); got != nil {
		t.Fatalf("axis with no values should return nil, got %+v", got)
	}
}
