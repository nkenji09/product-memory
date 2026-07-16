package flow

import (
	"bytes"
	"strings"
	"testing"
)

func TestWriteText_NeverOmitsScopeSectionEvenWithZeroFindings(t *testing.T) {
	r := Report{
		Action:      "act.a",
		ActionLabel: "a",
		Scope: ScopeDisclosure{
			OutOfGuarantee: disclosureBoilerplate,
		},
	}
	var buf bytes.Buffer
	WriteText(&buf, r)
	out := buf.String()

	for _, want := range []string{"subset-shadow", "宣言軸", "抜け", "重なり", "acknowledged-remainder", "scope-disclosure"} {
		if !strings.Contains(out, want) {
			t.Fatalf("WriteText output missing section %q:\n%s", want, out)
		}
	}
	// The mandated out-of-guarantee captions must always print, so a
	// zero-finding run cannot be misread as a bare "no gaps".
	for _, caption := range disclosureBoilerplate {
		if !strings.Contains(out, caption) {
			t.Fatalf("WriteText output missing scope caption %q:\n%s", caption, out)
		}
	}
}
