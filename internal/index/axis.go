package index

import (
	"sort"

	"github.com/nkenji09/scholia/internal/model"
)

// AxisValue is one declared value of an axis (#45 D10b-6): a condition vocab
// tagged with the axis tag, plus the actions it actually affects — the
// distinct actions of transitions whose given lists this condition. The viewer
// links the value to its vocab card and each action to its #/flow/<action>.
type AxisValue struct {
	Condition model.VocabEntry `json:"condition"`
	// Actions are the distinct action ids of transitions that carry this
	// condition in their given (id-sorted) — "この値が効いている action".
	Actions []string `json:"actions"`
}

// AxisStructure is an axis tag's derived structure (#45 D10b-6): its declared
// values (axis-tagged conditions) and, per value, the actions it affects.
// total mirrors Tag.total (declared, non-verified — the viewer says so). This
// is derived once here so the viewer never re-derives axis values from
// transitions client-side (§9); it feeds the axis card's structure section,
// which is why the axis desc no longer needs a hand-written value list
// (#45 診断: 表示の穴が desc への値列挙の複製を誘発していた).
type AxisStructure struct {
	Total  bool        `json:"total"`
	Values []AxisValue `json:"values"`
}

// BuildAxisStructure derives the axis structure for an axis-kind tag. The axis
// values are the conditions directly carrying axisTagID (VocabEntry.Tags
// reverse lookup, id-sorted); each value's affecting actions are the distinct
// actions of transitions whose given includes that condition. Returns nil if
// the tag is not an axis or has no declared values (the viewer then shows
// nothing extra).
func BuildAxisStructure(ix *Index, axisTagID string, isAxisKind bool) *AxisStructure {
	if !isAxisKind {
		return nil
	}
	tag, ok := ix.TagByID[axisTagID]
	if !ok {
		return nil
	}
	conditions := ix.VocabByTag(axisTagID) // id-sorted, VocabEntry.Tags reverse
	if len(conditions) == 0 {
		return nil
	}
	values := make([]AxisValue, 0, len(conditions))
	for _, cond := range conditions {
		actionSet := make(map[string]bool)
		for _, tx := range ix.TransitionsByVocab(cond.ID) {
			// Only a given-slot occurrence means the condition gates the
			// transition; then/action occurrences of a condition id don't
			// happen (conditions are given-only), but guard by checking given
			// so the derivation is about "this value effectively conditions
			// which actions".
			for _, g := range tx.Given {
				if g == cond.ID {
					actionSet[tx.Action] = true
					break
				}
			}
		}
		actions := make([]string, 0, len(actionSet))
		for a := range actionSet {
			actions = append(actions, a)
		}
		sort.Strings(actions)
		values = append(values, AxisValue{Condition: cond, Actions: actions})
	}
	return &AxisStructure{Total: tag.Total, Values: values}
}
