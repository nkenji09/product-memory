package cli

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
)

func newVocabEditCmd() *cobra.Command {
	var label, description, descFile string
	var editDesc bool
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "edit <id>",
		Short: "語彙の label/説明(description)を更新する",
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

			labelChanged := cmd.Flags().Changed("label")
			if labelChanged {
				if label == "" {
					return fmt.Errorf("--label を空にはできません")
				}
				v.Label = label
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
			if !labelChanged && !descChanged {
				return fmt.Errorf("--label/--description/--desc-file/--edit のいずれかを指定してください")
			}
			if descChanged {
				v.Description = descValue
			}

			if err := s.SaveVocab(v); err != nil {
				return err
			}

			if asJSON {
				enc := json.NewEncoder(cmd.OutOrStdout())
				enc.SetIndent("", "  ")
				return enc.Encode(v)
			}
			fmt.Fprintf(cmd.OutOrStdout(), "vocab %s を更新しました\n", id)
			return nil
		},
	}
	cmd.Flags().StringVar(&label, "label", "", "表示ラベル（空文字は不可）")
	cmd.Flags().StringVar(&description, "description", "", "説明（markdown・--desc-file/--edit と排他）")
	cmd.Flags().StringVar(&descFile, "desc-file", "", "説明をファイルから読み込む（--description/--edit と排他）")
	cmd.Flags().BoolVar(&editDesc, "edit", false, "$EDITOR で説明を入力する（--description/--desc-file と排他）")
	cmd.Flags().BoolVar(&asJSON, "json", false, "更新後のレコードを JSON で出力する")
	return cmd
}
