package cli

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/nkenji09/scholia/internal/lint"
	"github.com/nkenji09/scholia/internal/model"
)

func newVocabEditCmd() *cobra.Command {
	var label, kind, owner, description, descFile, ref string
	var altLabels, establishes []string
	var editDesc, clearAltLabels, clearEstablishes bool
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "edit <id>",
		Short: "語彙の label/kind/owner/説明(description)/ref/altLabels/establishes を更新する",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			refChanged := cmd.Flags().Changed("ref")
			kindChanged := cmd.Flags().Changed("kind")
			ownerChanged := cmd.Flags().Changed("owner")
			altSet := cmd.Flags().Changed("alt-label")
			estSet := cmd.Flags().Changed("establishes")
			if clearAltLabels && altSet {
				return fmt.Errorf("--clear-alt-labels と --alt-label は同時に指定できません")
			}
			if clearEstablishes && estSet {
				return fmt.Errorf("--clear-establishes と --establishes は同時に指定できません")
			}

			s, err := openStore()
			if err != nil {
				return err
			}
			v, err := s.LoadVocab(id)
			if err != nil {
				return fmt.Errorf("vocab %q を読み込めません: %w", id, err)
			}

			labelChanged := cmd.Flags().Changed("label")
			if labelChanged {
				if label == "" {
					return fmt.Errorf("--label を空にはできません")
				}
				v.Label = label
			}

			// --owner は effect 限定（vocab add と同じ制約・#45 D9）。
			if ownerChanged && v.Category != model.CategoryEffect {
				return fmt.Errorf("--owner は effect カテゴリでのみ指定できます（実際は %s）", v.Category)
			}

			descValue, descChanged, err := descSource{
				direct:    description,
				directSet: cmd.Flags().Changed("description"),
				file:      descFile,
				edit:      editDesc,
			}.resolve()
			if err != nil {
				return err
			}
			if descChanged {
				v.Description = descValue
			}

			if refChanged {
				v.Ref = ref
			}
			switch {
			case clearAltLabels:
				v.AltLabels = nil
			case altSet:
				v.AltLabels = dedupeStrings(altLabels)
			}
			switch {
			case clearEstablishes:
				v.Establishes = nil
			case estSet:
				v.Establishes = dedupeStrings(establishes)
			}
			if kindChanged {
				v.Kind = kind
			}
			if ownerChanged {
				v.Owner = owner
			}

			anyChanged := labelChanged || kindChanged || ownerChanged || descChanged || refChanged || altSet || estSet || clearAltLabels || clearEstablishes
			if !anyChanged {
				return fmt.Errorf("--label/--kind/--owner/--description/--desc-file/--edit/--ref/--alt-label/--clear-alt-labels/--establishes/--clear-establishes のいずれかを指定してください")
			}

			snap, err := s.LoadAll()
			if err != nil {
				return err
			}
			// establishes の write-time ゲート（effect 限定・実在検証・#45 D5）は
			// vocab 自身のカテゴリで検査する。snap は保存前だが、establishes の
			// 参照先（他 condition）の実在は変わらないためこの snap で十分。
			if err := validateEstablishes(snap, v.Category, v.Establishes); err != nil {
				return err
			}
			// kind backfill: config.kinds.<category> に宣言済みの kind のみ許容
			//（vocab add と同じ検査・空文字クリアは常に許容）。
			if kindChanged && kind != "" && !containsStr(snap.Config.KindsFor(v.Category), kind) {
				return fmt.Errorf("kind %q は config.kinds.%s に未宣言です", kind, v.Category)
			}
			// owner の write-time 実在検証（ownerKind 宣言下のみ・#45 D9）。
			if err := validateOwner(snap, v.Owner); err != nil {
				return err
			}

			// 書き込みゲート二層（#45 U3）: vocab edit に reject 規則は無い
			//（既存 id・total/given を持たない）が、desc/label への advisory
			// （stale-tense・prose-ref・desc-length 等）を同一ターンに返す。
			advisories, allowed, gateErr := runWriteGate(cmd, snap, lint.WriteOp{Vocab: &v, IsNew: false}, nil)
			if gateErr != nil {
				return gateErr
			}
			if err := s.SaveVocab(v); err != nil {
				return err
			}

			if asJSON {
				return emitWriteJSON(cmd, v, advisories, allowed, false)
			}
			fmt.Fprintf(cmd.OutOrStdout(), "vocab %s を更新しました\n", id)
			printWriteGateText(cmd, allowed, advisories)
			return nil
		},
	}
	cmd.Flags().StringVar(&label, "label", "", "表示ラベル（空文字は不可）")
	cmd.Flags().StringVar(&kind, "kind", "", "kind を更新（config.kinds.<category> の宣言集合に含まれる必要がある・condition の backfill 用・#45 D9）")
	cmd.Flags().StringVar(&owner, "owner", "", "効果を起こす主体を更新（effect のみ・ownerKind 宣言下では実在タグ id を検証・#45 D9）")
	cmd.Flags().StringVar(&description, "description", "", "説明（markdown・--desc-file/--edit と排他）")
	cmd.Flags().StringVar(&descFile, "desc-file", "", "説明をファイルから読み込む（--description/--edit と排他）")
	cmd.Flags().BoolVar(&editDesc, "edit", false, "$EDITOR で説明を入力する（--description/--desc-file と排他）")
	cmd.Flags().StringVar(&ref, "ref", "", "外部契約・仕様本文へのアンカー（空文字指定でクリア・#45 D5）")
	cmd.Flags().StringArrayVar(&altLabels, "alt-label", nil, "別表記・同義語（繰り返し可・指定で置換・#45 D5）")
	cmd.Flags().BoolVar(&clearAltLabels, "clear-alt-labels", false, "altLabels を空にする（#45 D5）")
	cmd.Flags().StringArrayVar(&establishes, "establishes", nil, "成立させる condition の id（effect のみ・繰り返し可・指定で置換・実在検証・#45 D5）")
	cmd.Flags().BoolVar(&clearEstablishes, "clear-establishes", false, "establishes を空にする（#45 D5）")
	cmd.Flags().BoolVar(&asJSON, "json", false, "更新後のレコードを応答封筒 { record, advisories } の JSON で出力する")
	return cmd
}
