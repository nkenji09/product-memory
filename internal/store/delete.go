package store

import (
	"fmt"
	"os"
	"sort"
	"strings"
)

// RemoveVocabResult summarizes `pmem vocab rm` (§6).
type RemoveVocabResult struct {
	ID string `json:"id"`
}

// RemoveVocab deletes a vocab entry, refusing if any transition still
// references it via action/given/then (§6 "未参照限定" — symmetric with the
// write-time validation that keeps vocab-ref lint green).
func (s *Store) RemoveVocab(id string) (RemoveVocabResult, error) {
	if !s.VocabExists(id) {
		return RemoveVocabResult{}, fmt.Errorf("vocab %q が見つかりません", id)
	}
	snap, err := s.LoadAll()
	if err != nil {
		return RemoveVocabResult{}, err
	}

	var refs []string
	for _, t := range snap.Transitions {
		if t.Action == id || containsID(t.Given, id) || containsID(t.Then, id) {
			refs = append(refs, t.ID)
		}
	}
	if len(refs) > 0 {
		sort.Strings(refs)
		return RemoveVocabResult{}, fmt.Errorf(
			"vocab %q は %d 件の transition から参照されています（未参照になってから rm してください）: %s",
			id, len(refs), strings.Join(refs, ", "))
	}

	if err := os.Remove(s.vocabPath(id)); err != nil {
		return RemoveVocabResult{}, err
	}
	return RemoveVocabResult{ID: id}, nil
}

func containsID(list []string, want string) bool {
	for _, v := range list {
		if v == want {
			return true
		}
	}
	return false
}
