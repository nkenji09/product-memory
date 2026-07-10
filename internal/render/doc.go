// Package render builds derived "spec" views (§3.8) — reports assembled at
// read time from a tag, the transitions in its effective-tag closure, and
// the decisions attached to those transitions or to the tag itself. Nothing
// here is persisted; it is all query + formatting over an index.Index.
package render
