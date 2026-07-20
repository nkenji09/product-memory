package viewer

import (
	"net/http"
	"testing"

	"github.com/nkenji09/scholia/internal/index"
)

// governs route (#45 D10b-1). The seed (testutil_test.go) has T-login tagged
// req.auth-happy (parent subject.auth) with decision d1 on subject.auth.

func TestGetGoverns_TransitionViaParent(t *testing.T) {
	h, _ := newTestHandler(t)
	rec := doRequest(t, h, http.MethodGet, "/api/governs?tx=T-login", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeJSON[governsResponse](t, rec)
	if len(resp.Entries) != 1 {
		t.Fatalf("entries = %+v, want 1", resp.Entries)
	}
	e := resp.Entries[0]
	// d1 is on subject.auth, which is req.auth-happy's parent → via parent.
	if e.Decision.ID != "d1" || e.Provenance != index.GovernsViaParent || e.ViaTag != "subject.auth" {
		t.Fatalf("entry = %+v, want d1 via parent subject.auth", e)
	}
}

func TestGetGoverns_TagEffectiveTag(t *testing.T) {
	h, _ := newTestHandler(t)
	rec := doRequest(t, h, http.MethodGet, "/api/governs?tag=subject.auth", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeJSON[governsResponse](t, rec)
	if len(resp.Entries) != 1 || resp.Entries[0].Provenance != index.GovernsEffectiveTag {
		t.Fatalf("entries = %+v, want [d1 effective-tag]", resp.Entries)
	}
}

func TestGetGoverns_RejectsMultipleSelectors(t *testing.T) {
	h, _ := newTestHandler(t)
	rec := doRequest(t, h, http.MethodGet, "/api/governs?tag=subject.auth&tx=T-login", nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for multiple selectors", rec.Code)
	}
}

func TestGetGoverns_RejectsNoSelector(t *testing.T) {
	h, _ := newTestHandler(t)
	rec := doRequest(t, h, http.MethodGet, "/api/governs", nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for no selector", rec.Code)
	}
}
