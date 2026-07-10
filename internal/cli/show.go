package cli

import "github.com/spf13/cobra"

func newShowCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "show",
		Short: "レコードを表示する",
	}
	cmd.AddCommand(newShowTxCmd())
	return cmd
}
