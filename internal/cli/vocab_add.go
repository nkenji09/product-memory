package cli

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/nkenji09/scholia/internal/lint"
	"github.com/nkenji09/scholia/internal/model"
	"github.com/nkenji09/scholia/internal/store"
)

func newVocabAddCmd() *cobra.Command {
	var label, kind, owner, description, descFile, ref string
	var altLabels, establishes []string
	var editDesc bool
	var asJSON bool
	var gate *gateFlags
	cmd := &cobra.Command{
		Use:   "add <condition|action|effect> <id>",
		Short: "語彙を 1 件追加する",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			category, id := args[0], args[1]
			if category != model.CategoryCondition && category != model.CategoryAction && category != model.CategoryEffect {
				return fmt.Errorf("category は condition|action|effect のいずれかである必要があります（実際は %q）", category)
			}
			if label == "" {
				return fmt.Errorf("--label は必須です")
			}
			if owner != "" && category != model.CategoryEffect {
				return fmt.Errorf("--owner は effect カテゴリでのみ指定できます")
			}

			s, err := openStore()
			if err != nil {
				return err
			}
			if s.VocabExists(id) {
				return fmt.Errorf("vocab %q は既に存在します", id)
			}

			snap, err := s.LoadAll()
			if err != nil {
				return err
			}
			if kind != "" && !containsStr(snap.Config.KindsFor(category), kind) {
				return fmt.Errorf("kind %q は config.kinds.%s に未宣言です", kind, category)
			}
			establishes = dedupeStrings(establishes)
			if err := validateEstablishes(snap, category, establishes); err != nil {
				return err
			}

			descValue, _, err := descSource{
				direct:    description,
				directSet: cmd.Flags().Changed("description"),
				file:      descFile,
				edit:      editDesc,
			}.resolve()
			if err != nil {
				return err
			}

			v := model.VocabEntry{ID: id, Category: category, Label: label, Kind: kind, Owner: owner,
				Description: descValue, Ref: ref, AltLabels: dedupeStrings(altLabels), Establishes: establishes}
			// 書き込みゲート二層（#45 U3）: 新規 id の id-policy は reject。
			// desc/label への advisory は保存後に表示。
			advisories, allowed, gateErr := runWriteGate(cmd, snap, lint.WriteOp{Vocab: &v, IsNew: true}, gate)
			if gateErr != nil {
				return gateErr
			}
			if err := s.SaveVocab(v); err != nil {
				return err
			}

			if asJSON {
				return emitWriteJSON(cmd, v, advisories, allowed, false)
			}
			fmt.Fprintf(cmd.OutOrStdout(), "vocab %s を作成しました\n", id)
			printWriteGateText(cmd, allowed, advisories)
			return nil
		},
	}
	cmd.Flags().StringVar(&label, "label", "", "表示ラベル（必須）")
	cmd.Flags().StringVar(&kind, "kind", "", "kind（config.kinds の宣言集合に含まれる必要がある）")
	cmd.Flags().StringVar(&owner, "owner", "", "効果を起こす主体（effect のみ）")
	cmd.Flags().StringVar(&description, "description", "", "説明（markdown・任意・--desc-file/--edit と排他）")
	cmd.Flags().StringVar(&descFile, "desc-file", "", "説明をファイルから読み込む（--description/--edit と排他）")
	cmd.Flags().BoolVar(&editDesc, "edit", false, "$EDITOR で説明を入力する（--description/--desc-file と排他）")
	cmd.Flags().StringVar(&ref, "ref", "", "外部契約・仕様本文へのアンカー（#45 D5・file:line は ref-freshness で警告）")
	cmd.Flags().StringArrayVar(&altLabels, "alt-label", nil, "別表記・同義語（繰り返し可・検索編入で重複新設を防ぐ・#45 D5）")
	cmd.Flags().StringArrayVar(&establishes, "establishes", nil, "この効果が成立させる condition の id（effect のみ・繰り返し可・実在検証・#45 D5）")
	cmd.Flags().BoolVar(&asJSON, "json", false, "作成したレコードを応答封筒 { record, advisories } の JSON で出力する")
	gate = addGateAllowFlags(cmd)
	return cmd
}

func containsStr(list []string, want string) bool {
	for _, v := range list {
		if v == want {
			return true
		}
	}
	return false
}

// dedupeStrings は順序を保ちつつ重複と空要素を落とす（--alt-label/--establishes
// の繰り返しフラグの正規化）。
func dedupeStrings(in []string) []string {
	seen := make(map[string]bool, len(in))
	out := make([]string, 0, len(in))
	for _, s := range in {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// validateEstablishes は establishes の write-time ゲート（#45 D5）:
// effect カテゴリでのみ許容し、各値が現存 condition の id に解決することを検証
// する（lint の参照整合と同じ不変条件を保存前に強制する）。
func validateEstablishes(snap store.Snapshot, category string, establishes []string) error {
	if len(establishes) == 0 {
		return nil
	}
	if category != model.CategoryEffect {
		return fmt.Errorf("--establishes は effect カテゴリでのみ指定できます（実際は %s）", category)
	}
	byID := make(map[string]model.VocabEntry, len(snap.Vocab))
	for _, v := range snap.Vocab {
		byID[v.ID] = v
	}
	for _, condID := range establishes {
		c, ok := byID[condID]
		if !ok {
			return fmt.Errorf("--establishes %q が実在しません（現存 condition の id を指定してください）", condID)
		}
		if c.Category != model.CategoryCondition {
			return fmt.Errorf("--establishes %q は condition ではありません（実際は %s）", condID, c.Category)
		}
	}
	return nil
}
