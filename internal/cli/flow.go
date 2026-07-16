package cli

import (
	"encoding/json"

	"github.com/spf13/cobra"

	"github.com/nkenji09/product-memory/internal/flow"
	"github.com/nkenji09/product-memory/internal/index"
)

func newFlowCmd() *cobra.Command {
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "flow <action>",
		Short: "きっかけ(action)の given×transition マトリクスと honesty-first な gap 検出を表示する（派生・§3.4・#39）",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			s, err := openStore()
			if err != nil {
				return err
			}
			snap, err := s.LoadAll()
			if err != nil {
				return err
			}
			ix := index.Build(&snap)

			report := flow.Analyze(&snap, ix, args[0])

			if asJSON {
				enc := json.NewEncoder(cmd.OutOrStdout())
				enc.SetIndent("", "  ")
				return enc.Encode(report)
			}
			flow.WriteText(cmd.OutOrStdout(), report)
			return nil
		},
	}
	cmd.Flags().BoolVar(&asJSON, "json", false, "JSON で出力する")
	return cmd
}
