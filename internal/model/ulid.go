package model

import (
	"crypto/rand"
	"fmt"
	"time"
)

// crockfordAlphabet is Crockford's Base32 alphabet (excludes I, L, O, U to
// avoid confusion with 1, 1, 0, V).
const crockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// NewULID generates a decision id (§3.5, §6): a 26-character Crockford
// Base32 ULID whose leading 48 bits are a millisecond timestamp (so ids sort
// chronologically as strings) and whose trailing 80 bits are
// crypto/rand-sourced entropy. No external dependency (handoff constraint —
// go.mod may not gain new requirements in this phase).
func NewULID() (string, error) {
	return newULIDAt(time.Now())
}

func newULIDAt(t time.Time) (string, error) {
	var data [16]byte

	ms := uint64(t.UnixMilli())
	data[0] = byte(ms >> 40)
	data[1] = byte(ms >> 32)
	data[2] = byte(ms >> 24)
	data[3] = byte(ms >> 16)
	data[4] = byte(ms >> 8)
	data[5] = byte(ms)

	if _, err := rand.Read(data[6:]); err != nil {
		return "", fmt.Errorf("ulid: entropy 生成に失敗: %w", err)
	}

	return encodeCrockford(data), nil
}

// encodeCrockford packs 128 bits (16 bytes) into 26 Base32 characters (5
// bits each = 130 bits; the 2 extra bits are always 0 since the timestamp
// never fills all 48 leading bits before year ~10889). This is the standard
// ULID bit layout.
func encodeCrockford(data [16]byte) string {
	var dst [26]byte
	dst[0] = crockfordAlphabet[(data[0]&224)>>5]
	dst[1] = crockfordAlphabet[data[0]&31]
	dst[2] = crockfordAlphabet[(data[1]&248)>>3]
	dst[3] = crockfordAlphabet[((data[1]&7)<<2)|((data[2]&192)>>6)]
	dst[4] = crockfordAlphabet[(data[2]&62)>>1]
	dst[5] = crockfordAlphabet[((data[2]&1)<<4)|((data[3]&240)>>4)]
	dst[6] = crockfordAlphabet[((data[3]&15)<<1)|((data[4]&128)>>7)]
	dst[7] = crockfordAlphabet[(data[4]&124)>>2]
	dst[8] = crockfordAlphabet[((data[4]&3)<<3)|((data[5]&224)>>5)]
	dst[9] = crockfordAlphabet[data[5]&31]
	dst[10] = crockfordAlphabet[(data[6]&248)>>3]
	dst[11] = crockfordAlphabet[((data[6]&7)<<2)|((data[7]&192)>>6)]
	dst[12] = crockfordAlphabet[(data[7]&62)>>1]
	dst[13] = crockfordAlphabet[((data[7]&1)<<4)|((data[8]&240)>>4)]
	dst[14] = crockfordAlphabet[((data[8]&15)<<1)|((data[9]&128)>>7)]
	dst[15] = crockfordAlphabet[(data[9]&124)>>2]
	dst[16] = crockfordAlphabet[((data[9]&3)<<3)|((data[10]&224)>>5)]
	dst[17] = crockfordAlphabet[data[10]&31]
	dst[18] = crockfordAlphabet[(data[11]&248)>>3]
	dst[19] = crockfordAlphabet[((data[11]&7)<<2)|((data[12]&192)>>6)]
	dst[20] = crockfordAlphabet[(data[12]&62)>>1]
	dst[21] = crockfordAlphabet[((data[12]&1)<<4)|((data[13]&240)>>4)]
	dst[22] = crockfordAlphabet[((data[13]&15)<<1)|((data[14]&128)>>7)]
	dst[23] = crockfordAlphabet[(data[14]&124)>>2]
	dst[24] = crockfordAlphabet[((data[14]&3)<<3)|((data[15]&224)>>5)]
	dst[25] = crockfordAlphabet[data[15]&31]
	return string(dst[:])
}
