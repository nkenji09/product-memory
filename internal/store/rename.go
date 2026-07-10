package store

import (
	"fmt"
	"os"
	"sort"

	"github.com/nkenji09/product-memory/internal/model"
)

// VocabRenameResult summarizes a `pmem vocab rename` (§6).
type VocabRenameResult struct {
	OldID              string   `json:"oldId"`
	NewID              string   `json:"newId"`
	UpdatedTransitions []string `json:"updatedTransitions"`
}

// RenameVocab renames a vocab entry's file and id, then rewrites every
// transition's action/given/then reference to it (§6). Vocab entries are not
// referenced by tags or decisions, so transitions are the only other record
// kind that needs updating.
func (s *Store) RenameVocab(oldID, newID string) (VocabRenameResult, error) {
	if newID == "" {
		return VocabRenameResult{}, fmt.Errorf("newId は必須です")
	}
	if oldID == newID {
		return VocabRenameResult{}, fmt.Errorf("newId %q は oldId と同じです", newID)
	}
	if !s.VocabExists(oldID) {
		return VocabRenameResult{}, fmt.Errorf("vocab %q が見つかりません", oldID)
	}
	if s.VocabExists(newID) {
		return VocabRenameResult{}, fmt.Errorf("vocab %q は既に存在します", newID)
	}

	v, err := s.LoadVocab(oldID)
	if err != nil {
		return VocabRenameResult{}, err
	}
	v.ID = newID
	if err := s.SaveVocab(v); err != nil {
		return VocabRenameResult{}, err
	}

	snap, err := s.LoadAll()
	if err != nil {
		return VocabRenameResult{}, err
	}
	var updated []string
	for _, t := range snap.Transitions {
		if t.ID == "" {
			continue
		}
		changed := false
		if t.Action == oldID {
			t.Action = newID
			changed = true
		}
		for i, g := range t.Given {
			if g == oldID {
				t.Given[i] = newID
				changed = true
			}
		}
		for i, e := range t.Then {
			if e == oldID {
				t.Then[i] = newID
				changed = true
			}
		}
		if !changed {
			continue
		}
		if err := s.SaveTransition(t); err != nil {
			return VocabRenameResult{}, err
		}
		updated = append(updated, t.ID)
	}

	if err := os.Remove(s.vocabPath(oldID)); err != nil {
		return VocabRenameResult{}, err
	}
	sort.Strings(updated)
	return VocabRenameResult{OldID: oldID, NewID: newID, UpdatedTransitions: updated}, nil
}

// TxRenameResult summarizes a `pmem tx rename` (§6).
type TxRenameResult struct {
	OldID            string   `json:"oldId"`
	NewID            string   `json:"newId"`
	UpdatedDecisions []string `json:"updatedDecisions"`
}

// RenameTransition renames a transition's file and id, then rewrites every
// decision whose target points at it (§6 note). Transitions have no
// incoming edges from other transitions/vocab/tags (§2 — no edges), so
// decisions are the only other record kind that references a transition id.
func (s *Store) RenameTransition(oldID, newID string) (TxRenameResult, error) {
	if newID == "" {
		return TxRenameResult{}, fmt.Errorf("newId は必須です")
	}
	if oldID == newID {
		return TxRenameResult{}, fmt.Errorf("newId %q は oldId と同じです", newID)
	}
	if !s.TransitionExists(oldID) {
		return TxRenameResult{}, fmt.Errorf("transition %q が見つかりません", oldID)
	}
	if s.TransitionExists(newID) {
		return TxRenameResult{}, fmt.Errorf("transition %q は既に存在します", newID)
	}

	t, err := s.LoadTransition(oldID)
	if err != nil {
		return TxRenameResult{}, err
	}
	t.ID = newID
	if err := s.SaveTransition(t); err != nil {
		return TxRenameResult{}, err
	}

	snap, err := s.LoadAll()
	if err != nil {
		return TxRenameResult{}, err
	}
	var updated []string
	for _, d := range snap.Decisions {
		if d.Target.Type != model.DecisionTargetTransition || d.Target.ID != oldID {
			continue
		}
		d.Target.ID = newID
		if err := s.SaveDecision(d); err != nil {
			return TxRenameResult{}, err
		}
		updated = append(updated, d.ID)
	}

	if err := os.Remove(s.transitionPath(oldID)); err != nil {
		return TxRenameResult{}, err
	}
	sort.Strings(updated)
	return TxRenameResult{OldID: oldID, NewID: newID, UpdatedDecisions: updated}, nil
}
