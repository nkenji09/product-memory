// acceptance.go — flow finding の typed 容認畳み（#45 D6）。
//
// flow の finding（subset-shadow・total-gap・overlap）には従来 rule id と対象の
// 対応が未定義だった。容認キーを〔rule × 対象〕と仕様化する:
//   - total-gap: 対象 = 欠落した軸タグ（axis）または欠落値 condition（vocab）。
//     どちらか宛ての decision が acknowledges で total-gap を名指ししていれば畳む。
//   - subset-shadow / overlap: 対象 = 関与する transition。いずれかの
//     transition 宛ての decision が acknowledges で当該 rule を名指ししていれば畳む。
//
// 「同じ穴が複数 finding で出る場合は出る finding の rule を全列挙して
// acknowledges に書く」（skill 規約）を前提にした畳み——複数 rule のいずれかが
// マッチで各 finding を畳む（各 finding は自分の rule 名で照合する）。
//
// 祖先 decision では畳まない（direct decision のみ）——untyped 容認の偽陰性を
// 作らないため（D6 の核）。
package flow

import (
	"github.com/nkenji09/scholia/internal/model"
)

// ackIndex は (targetType, targetID, rule) → 容認 decision id の索引（direct のみ）。
type ackIndex struct {
	byTarget map[ackKey]string
}

type ackKey struct {
	targetType string
	targetID   string
	rule       string
}

func buildAckIndex(decisions []model.Decision) *ackIndex {
	idx := &ackIndex{byTarget: make(map[ackKey]string)}
	for _, d := range decisions {
		for _, rule := range d.Acknowledges {
			k := ackKey{targetType: d.Target.Type, targetID: d.Target.ID, rule: rule}
			// 同一キーを複数 decision が容認したら辞書順最小 id を残す（表示の決定性）。
			if prev, ok := idx.byTarget[k]; !ok || d.ID < prev {
				idx.byTarget[k] = d.ID
			}
		}
	}
	return idx
}

// forTags は与えた tag id 集合のいずれか宛てで rule を acknowledge する decision
// id を返す（direct・複数あれば辞書順最小）。
func (i *ackIndex) forTag(tagID, rule string) (string, bool) {
	id, ok := i.byTarget[ackKey{targetType: model.DecisionTargetTag, targetID: tagID, rule: rule}]
	return id, ok
}

func (i *ackIndex) forVocab(vocabID, rule string) (string, bool) {
	id, ok := i.byTarget[ackKey{targetType: model.DecisionTargetVocab, targetID: vocabID, rule: rule}]
	return id, ok
}

func (i *ackIndex) forTransition(txID, rule string) (string, bool) {
	id, ok := i.byTarget[ackKey{targetType: model.DecisionTargetTransition, targetID: txID, rule: rule}]
	return id, ok
}

// forAnyTransition は与えた transition 集合のいずれか宛てで rule を acknowledge
// する decision id を返す（辞書順で最初にマッチした transition の decision）。
func (i *ackIndex) forAnyTransition(txIDs []string, rule string) (string, bool) {
	best := ""
	for _, tx := range txIDs {
		if id, ok := i.forTransition(tx, rule); ok {
			if best == "" || id < best {
				best = id
			}
		}
	}
	return best, best != ""
}

// applyAcceptance は report の flow finding に typed 容認の AcknowledgedBy を
// 書き込む（畳む finding を消しはしない——「容認済み」に落とすだけで、表示側が
// 別枠にする。lint の requirement-gap と同じ扱い）。
func applyAcceptance(report *Report, decisions []model.Decision) {
	idx := buildAckIndex(decisions)

	for i := range report.SubsetShadows {
		s := &report.SubsetShadows[i]
		if id, ok := idx.forAnyTransition([]string{s.Subset, s.Superset}, RuleSubsetShadow); ok {
			s.AcknowledgedBy = id
		}
	}
	for i := range report.TotalGaps {
		g := &report.TotalGaps[i]
		if id, ok := idx.forTag(g.AxisID, RuleTotalGap); ok {
			g.AcknowledgedBy = id
		} else if id, ok := idx.forVocab(g.Value, RuleTotalGap); ok {
			g.AcknowledgedBy = id
		}
	}
	for i := range report.Overlaps {
		o := &report.Overlaps[i]
		if id, ok := idx.forAnyTransition(o.Transitions, RuleOverlap); ok {
			o.AcknowledgedBy = id
		}
	}
}
