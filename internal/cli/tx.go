package cli

import "github.com/spf13/cobra"

func newTxCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "tx",
		Short: "遷移（原子）を操作する",
	}
	cmd.AddCommand(newTxAddCmd())
	cmd.AddCommand(newTxRenameCmd())
	return cmd
}
