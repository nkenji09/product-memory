package cli

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
)

func newVocabEditCmd() *cobra.Command {
	var description, descFile string
	var editDesc bool
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "edit <id>",
		Short: "語彙の説明(description)のみ更新する",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			s, err := openStore()
			if err != nil {
				return err
			}
			v, err := s.LoadVocab(id)
			if err != nil {
				return fmt.Errorf("vocab %q を読み込めません: %w", id, err)
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
			if !descChanged {
				return fmt.Errorf("--description/--desc-file/--edit のいずれかを指定してください")
			}
			v.Description = descValue

			if err := s.SaveVocab(v); err != nil {
				return err
			}

			if asJSON {
				enc := json.NewEncoder(cmd.OutOrStdout())
				enc.SetIndent("", "  ")
				return enc.Encode(v)
			}
			fmt.Fprintf(cmd.OutOrStdout(), "vocab %s の説明を更新しました\n", id)
			return nil
		},
	}
	cmd.Flags().StringVar(&description, "description", "", "説明（markdown・--desc-file/--edit と排他）")
	cmd.Flags().StringVar(&descFile, "desc-file", "", "説明をファイルから読み込む（--description/--edit と排他）")
	cmd.Flags().BoolVar(&editDesc, "edit", false, "$EDITOR で説明を入力する（--description/--desc-file と排他）")
	cmd.Flags().BoolVar(&asJSON, "json", false, "更新後のレコードを JSON で出力する")
	return cmd
}
