package cli

import (
	"fmt"
	"strings"

	"github.com/nkenji09/scholia/internal/model"
)

// parseSupersedeLinks は "<oldUlid>[:<mode>]" 群を SupersedeLink へ解析する
// （#45 D7）。selfID への自己参照は拒否・mode は3値検証・重複 id は最後の指定を
// 採る前に error にはしない（呼び出し側の validate で重複検査する）。
func parseSupersedeLinks(specs []string, selfID string) ([]model.SupersedeLink, error) {
	var out []model.SupersedeLink
	seen := make(map[string]bool)
	for _, spec := range specs {
		id, mode, err := parseSupersedeSpec(spec)
		if err != nil {
			return nil, err
		}
		if id == selfID {
			return nil, fmt.Errorf("supersedes: decision は自分自身（%s）を supersede できません", selfID)
		}
		if seen[id] {
			return nil, fmt.Errorf("supersedes: 旧 decision %q が重複指定されています", id)
		}
		seen[id] = true
		out = append(out, model.SupersedeLink{ID: id, Mode: mode})
	}
	return out, nil
}

// parseSupersedeSpec は "<id>[:<mode>]" を分解する。mode 省略時は "" を返す
// （保存は "" のまま——derive 側で amend として補完する・model.SupersedeMode）。
func parseSupersedeSpec(spec string) (id, mode string, err error) {
	parts := strings.SplitN(spec, ":", 2)
	id = strings.TrimSpace(parts[0])
	if id == "" {
		return "", "", fmt.Errorf("supersedes: id が空です（%q）", spec)
	}
	if len(parts) == 2 {
		mode = strings.TrimSpace(parts[1])
	}
	if !model.ValidSupersedeMode(mode) {
		return "", "", fmt.Errorf("supersedes: mode %q は supersede|amend|exception のいずれかである必要があります（%q）", mode, spec)
	}
	return id, mode, nil
}

// validateSupersedeTargets は各 link の旧 decision が実在するかを検査する
// （実在照合・#45 D7）。
func validateSupersedeTargets(all []model.Decision, links []model.SupersedeLink) error {
	if len(links) == 0 {
		return nil
	}
	exists := make(map[string]bool, len(all))
	for _, d := range all {
		exists[d.ID] = true
	}
	for _, l := range links {
		if !exists[l.ID] {
			return fmt.Errorf("supersedes: 旧 decision %q が実在しません", l.ID)
		}
	}
	return nil
}

// supersededIDs は「mode=supersede で他 decision から指された decision の id 集合」
// を返す（#45 D7・derive は保守的に supersede のみ失効扱い）。amend/exception は
// 旧を失効させない。superseded-by の逆リンクもここから derive できる。
func supersededIDs(all []model.Decision) map[string]bool {
	out := make(map[string]bool)
	for _, d := range all {
		for _, l := range d.Supersedes {
			if l.SupersedeMode() == model.ModeSupersede {
				out[l.ID] = true
			}
		}
	}
	return out
}

// supersededByIndex は id → その id を指した (fromID, mode) 群、の逆索引を返す
// （superseded-by バッジ・decision show 用の derive・保存しない）。
type supersededByRef struct {
	FromID string
	Mode   string
}

func supersededByIndex(all []model.Decision) map[string][]supersededByRef {
	out := make(map[string][]supersededByRef)
	for _, d := range all {
		for _, l := range d.Supersedes {
			out[l.ID] = append(out[l.ID], supersededByRef{FromID: d.ID, Mode: l.SupersedeMode()})
		}
	}
	return out
}

// supersedeCreatesCycle は「newID の supersedes に candidate 群を足すと、
// decision の supersede 有向グラフ（新→旧）に閉路ができるか」を返す（#45 D7・
// decision link の後付け結線で使う）。all は現在の全 decision（newID 自身を含む）。
// 新規 decide では newID が未保存なので閉路は構造的に起きないが、link は既存
// decision を編集するため検査が要る。
func supersedeCreatesCycle(all []model.Decision, newID string, candidates []model.SupersedeLink) bool {
	// 隣接リスト（id → supersede 先 id 群）を組み、candidates を newID に足す。
	adj := make(map[string][]string, len(all)+1)
	for _, d := range all {
		for _, l := range d.Supersedes {
			adj[d.ID] = append(adj[d.ID], l.ID)
		}
	}
	for _, l := range candidates {
		adj[newID] = append(adj[newID], l.ID)
	}
	// newID から DFS して newID に戻れれば閉路（自己参照は parse 段で弾き済みだが
	// 多段の閉路 A→B→A をここで拾う）。
	const (
		white = 0
		gray  = 1
		black = 2
	)
	color := make(map[string]int)
	var hasCycle bool
	var visit func(string)
	visit = func(u string) {
		color[u] = gray
		for _, v := range adj[u] {
			switch color[v] {
			case gray:
				hasCycle = true
			case white:
				visit(v)
			}
		}
		color[u] = black
	}
	visit(newID)
	return hasCycle
}
