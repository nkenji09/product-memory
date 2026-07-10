package model

import (
	"strings"
	"testing"
	"time"
)

func TestNewULID_LengthAndCharset(t *testing.T) {
	id, err := NewULID()
	if err != nil {
		t.Fatalf("NewULID: %v", err)
	}
	if len(id) != 26 {
		t.Fatalf("expected 26-char ULID, got %d: %q", len(id), id)
	}
	for _, c := range id {
		if !strings.ContainsRune(crockfordAlphabet, c) {
			t.Fatalf("ULID %q contains char %q outside Crockford Base32 alphabet", id, c)
		}
	}
}

func TestNewULID_Unique(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 1000; i++ {
		id, err := NewULID()
		if err != nil {
			t.Fatalf("NewULID: %v", err)
		}
		if seen[id] {
			t.Fatalf("duplicate ULID generated: %s", id)
		}
		seen[id] = true
	}
}

func TestULID_SortsChronologically(t *testing.T) {
	base := time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC)
	earlier, err := newULIDAt(base)
	if err != nil {
		t.Fatalf("newULIDAt: %v", err)
	}
	later, err := newULIDAt(base.Add(5 * time.Second))
	if err != nil {
		t.Fatalf("newULIDAt: %v", err)
	}
	if !(earlier < later) {
		t.Fatalf("expected earlier ULID %q to sort before later ULID %q", earlier, later)
	}
}

func TestULID_SameMillisecondStillDistinctViaEntropy(t *testing.T) {
	at := time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC)
	a, err := newULIDAt(at)
	if err != nil {
		t.Fatalf("newULIDAt: %v", err)
	}
	b, err := newULIDAt(at)
	if err != nil {
		t.Fatalf("newULIDAt: %v", err)
	}
	if a == b {
		t.Fatalf("expected two ULIDs at the same millisecond to differ via random entropy, got equal: %s", a)
	}
	if a[:10] != b[:10] {
		t.Fatalf("expected identical timestamp prefix (first 10 chars) for same-millisecond ULIDs, got %q vs %q", a[:10], b[:10])
	}
}
