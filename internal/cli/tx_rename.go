package cli

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
)

func newTxRenameCmd() *cobra.Command {
	var to string
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "rename <id>",
		Short: "遷移を改名する（decisions の target も一括更新・§6）",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			id := args[0]
			if to == "" {
				return fmt.Errorf("--to は必須です")
			}
			s, err := openStore()
			if err != nil {
				return err
			}
			result, err := s.RenameTransition(id, to)
			if err != nil {
				return err
			}
			if asJSON {
				enc := json.NewEncoder(cmd.OutOrStdout())
				enc.SetIndent("", "  ")
				return enc.Encode(result)
			}
			fmt.Fprintf(cmd.OutOrStdout(), "transition %s を %s に改名しました（更新した decision: %d 件）\n",
				result.OldID, result.NewID, len(result.UpdatedDecisions))
			return nil
		},
	}
	cmd.Flags().StringVar(&to, "to", "", "新しい id（必須）")
	cmd.Flags().BoolVar(&asJSON, "json", false, "更新サマリを JSON で出力する")
	return cmd
}
