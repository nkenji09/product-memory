import type { FacetTreeNode, Tag, TransitionDetail, VocabEntry } from '../../types';

// Pure, presentation-only helpers for BrowseView's AND-filter chips (design
// §A-2 "検索レール＋タグ/仕様カード"). Every membership test here runs
// against fields the Go backend already resolved (FacetTreeNode's nesting,
// TransitionDetail.effectiveTags/rules) — nothing here re-derives gap,
// satisfied-by, effective-tag, or ancestor/descendant relationships from
// scratch (DESIGN §7/§9 single source of truth). The one exception is
// walking the already-nested FacetTreeNode forest to answer "is B a
// descendant of A", which is a tree traversal over data Go already built,
// not a new derivation — the same pattern the pre-refactor
// TagsView.tsx/TagHierarchyTree.tsx already used.

// 'owner' (vocab-owner-tag): VocabEntry.owner is a plain string field, not a
// tag record, so it carries its own condition shape rather than being
// shoehorned into 'tag'/'vocab' — `id` holds the raw owner string itself.
export type FilterCondition = { type: 'tag' | 'vocab'; id: string } | { type: 'owner'; id: string };

/** All tag ids in the subtree rooted at `rootId` (inclusive of rootId itself). */
export function descendantIds(trees: Record<string, FacetTreeNode[]>, rootId: string): Set<string> {
  const out = new Set<string>();
  const collect = (nodes: FacetTreeNode[]) => {
    for (const n of nodes) {
      out.add(n.tag.id);
      if (n.children) collect(n.children);
    }
  };
  const findAndCollect = (nodes: FacetTreeNode[]): boolean => {
    for (const n of nodes) {
      if (n.tag.id === rootId) {
        out.add(n.tag.id);
        if (n.children) collect(n.children);
        return true;
      }
      if (n.children && findAndCollect(n.children)) return true;
    }
    return false;
  };
  for (const tree of Object.values(trees)) {
    if (findAndCollect(tree)) return out;
  }
  // rootId isn't in any facet tree (its kind may not be a declared facet
  // kind) — it has no visible descendants, so it's just itself.
  out.add(rootId);
  return out;
}

/** A tag's parent tags, read directly off the already-nested facet trees. */
export function parentsOf(trees: Record<string, FacetTreeNode[]>, tagId: string, tagById: Map<string, Tag>): Tag[] {
  const parents: Tag[] = [];
  const walk = (nodes: FacetTreeNode[], parent: Tag | null) => {
    for (const n of nodes) {
      if (n.tag.id === tagId && parent) parents.push(parent);
      if (n.children) walk(n.children, n.tag);
    }
  };
  for (const tree of Object.values(trees)) walk(tree, null);
  if (parents.length === 0) {
    // Fallback for tags whose kind isn't a declared facet kind: parentIds is
    // already on the flat Tag record itself (no relationship computed here,
    // just read straight off the record).
    const self = tagById.get(tagId);
    for (const pid of self?.parentIds || []) {
      const p = tagById.get(pid);
      if (p) parents.push(p);
    }
  }
  return parents;
}

/** A tag's direct children, read directly off the already-nested facet trees. */
export function childrenOf(trees: Record<string, FacetTreeNode[]>, tagId: string, tagById: Map<string, Tag>): Tag[] {
  const findNode = (nodes: FacetTreeNode[]): FacetTreeNode | null => {
    for (const n of nodes) {
      if (n.tag.id === tagId) return n;
      const found = n.children ? findNode(n.children) : null;
      if (found) return found;
    }
    return null;
  };
  for (const tree of Object.values(trees)) {
    const node = findNode(tree);
    if (node) return (node.children || []).map((c) => c.tag);
  }
  // Fallback: same as parentsOf, read straight off the flat records.
  return Array.from(tagById.values()).filter((t) => (t.parentIds || []).includes(tagId));
}

// Wire format for BrowseView's URL sync (router.ts's Route.searchFilters):
// "<type>:<encodeURIComponent(id)>" joined by ",". Only the id is percent-
// encoded — `type` is always one of the three literals below, so it can
// never itself contain the ':'/',' delimiters; encoding the id is what
// keeps a raw ':' or ',' inside an id (e.g. a vocab id with a colon) from
// being mistaken for a delimiter when decoding. The outer hash query string
// (router.ts's URLSearchParams) percent-encodes this whole value again for
// the wire, transparently — this codec only has to defend its own
// delimiters, not URL-safety in general.
export function encodeFilters(filters: FilterCondition[]): string {
  return filters.map((f) => `${f.type}:${encodeURIComponent(f.id)}`).join(',');
}

export function decodeFilters(encoded: string): FilterCondition[] {
  if (!encoded) return [];
  const out: FilterCondition[] = [];
  for (const part of encoded.split(',')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const type = part.slice(0, i);
    const id = decodeURIComponent(part.slice(i + 1));
    if (type === 'tag' || type === 'vocab' || type === 'owner') out.push({ type, id } as FilterCondition);
  }
  return out;
}

export function tagMatchesFilters(tag: Tag, filters: FilterCondition[], trees: Record<string, FacetTreeNode[]>): boolean {
  return filters.every((f) => {
    if (f.type !== 'tag') return true;
    return descendantIds(trees, f.id).has(tag.id);
  });
}

export function specMatchesFilters(
  detail: TransitionDetail,
  filters: FilterCondition[],
  vocabById: Map<string, VocabEntry>,
): boolean {
  const vocabIds = [detail.action, ...(detail.given || []), ...(detail.then || [])];
  return filters.every((f) => {
    if (f.type === 'tag') return (detail.effectiveTags || []).some((et) => et.id === f.id);
    if (f.type === 'vocab') return vocabIds.includes(f.id);
    return vocabIds.some((vid) => vocabById.get(vid)?.owner === f.id);
  });
}
