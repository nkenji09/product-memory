package cli

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/nkenji09/product-memory/internal/lint"
	"github.com/nkenji09/product-memory/internal/model"
)

func newTagCreateCmd() *cobra.Command {
	var name, kind, desc, color, ref string
	var parents []string
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "create <id>",
		Short: "タグを 1 件作成する",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			if name == "" {
				return fmt.Errorf("--name は必須です")
			}

			s, err := openStore()
			if err != nil {
				return err
			}
			if s.TagExists(id) {
				return fmt.Errorf("tag %q は既に存在します", id)
			}

			snap, err := s.LoadAll()
			if err != nil {
				return err
			}

			if kind != "" && !containsStr(snap.Config.TagKinds, kind) {
				return fmt.Errorf("kind %q は config.tagKinds に未宣言です", kind)
			}

			for _, p := range parents {
				if !s.TagExists(p) {
					return fmt.Errorf("parent %q が実在しません", p)
				}
			}

			parentGraph := make(map[string][]string, len(snap.Tags)+1)
			for _, t := range snap.Tags {
				parentGraph[t.ID] = t.ParentIDs
			}
			parentGraph[id] = parents
			for _, cycled := range lint.CycleMembers(parentGraph) {
				if cycled == id {
					return fmt.Errorf("tag %q の parentIds が循環を作ります", id)
				}
			}

			t := model.Tag{
				ID:          id,
				Name:        name,
				Kind:        kind,
				ParentIDs:   parents,
				Description: desc,
				Color:       color,
				Ref:         ref,
			}
			if err := s.SaveTag(t); err != nil {
				return err
			}

			if asJSON {
				enc := json.NewEncoder(cmd.OutOrStdout())
				enc.SetIndent("", "  ")
				return enc.Encode(t)
			}
			fmt.Fprintf(cmd.OutOrStdout(), "tag %s を作成しました\n", id)
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "表示名（必須）")
	cmd.Flags().StringVar(&kind, "kind", "", "kind（config.tagKinds の宣言集合に含まれる必要がある）")
	cmd.Flags().StringArrayVar(&parents, "parent", nil, "親タグ id（複数指定可）")
	cmd.Flags().StringVar(&desc, "desc", "", "説明")
	cmd.Flags().StringVar(&color, "color", "", "表示色")
	cmd.Flags().StringVar(&ref, "ref", "", "参照 URL")
	cmd.Flags().BoolVar(&asJSON, "json", false, "作成したレコードを JSON で出力する")
	return cmd
}
