package cli

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/nkenji09/product-memory/internal/lint"
)

func newLintCmd() *cobra.Command {
	var asJSON bool
	cmd := &cobra.Command{
		Use:   "lint",
		Short: "記録の自己矛盾を検査する（§5）",
		RunE: func(cmd *cobra.Command, args []string) error {
			s, err := openStore()
			if err != nil {
				return err
			}
			snap, err := s.LoadAll()
			if err != nil {
				return err
			}
			findings := lint.Run(snap)
			if findings == nil {
				findings = []lint.Finding{}
			}

			if asJSON {
				enc := json.NewEncoder(cmd.OutOrStdout())
				enc.SetIndent("", "  ")
				out := struct {
					Findings   []lint.Finding `json:"findings"`
					ErrorCount int            `json:"errorCount"`
				}{Findings: findings, ErrorCount: countErrors(findings)}
				if err := enc.Encode(out); err != nil {
					return err
				}
			} else {
				if len(findings) == 0 {
					fmt.Fprintln(cmd.OutOrStdout(), "lint: 問題は見つかりませんでした")
				}
				for _, f := range findings {
					fmt.Fprintf(cmd.OutOrStdout(), "[%s] %s: %s\n", f.Severity, f.Rule, f.Message)
				}
			}

			if lint.HasError(findings) {
				return fmt.Errorf("lint failed: %d error(s)", countErrors(findings))
			}
			return nil
		},
	}
	cmd.Flags().BoolVar(&asJSON, "json", false, "JSON で出力する")
	return cmd
}

func countErrors(findings []lint.Finding) int {
	n := 0
	for _, f := range findings {
		if f.Severity == lint.SeverityError {
			n++
		}
	}
	return n
}
