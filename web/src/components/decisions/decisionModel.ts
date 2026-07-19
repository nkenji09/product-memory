import type { Decision } from '../../types';

// Currency of a decision relative to the full decision set (D10a).
//   - 'superseded': some OTHER decision's supersedes[] links to this id with
//     mode === 'supersede'. That link outright replaces this decision.
//   - 'amended': some OTHER decision references this id via supersedes[] but
//     only with mode 'amend'/'exception' (or an omitted mode, which is treated
//     as 'amend') — it refines/excepts but does NOT replace it, so it stays
//     current-with-a-caveat rather than dead.
//   - 'current': nothing references it.
// 'superseded' wins over 'amended' when a decision is on the receiving end of
// both kinds of link — a hard replacement dominates a mere refinement.
export type Currency = 'current' | 'superseded' | 'amended';

/** mode omitted ⇒ 'amend' (types.ts SupersedeLink doc / Go model.SupersedeLink). */
export function linkMode(mode: string | undefined): 'supersede' | 'amend' | 'exception' {
  if (mode === 'supersede' || mode === 'exception') return mode;
  return 'amend';
}

// Scan every decision's supersedes[] once and classify which prior decisions
// are superseded vs merely amended. Computed client-side from the full array
// (the list/detail pages get all decisions via api.getRules({})), so it works
// identically in live and static-export mode.
export interface CurrencyIndex {
  supersededIds: Set<string>;
  amendedIds: Set<string>;
  /** targetId -> the decisions that link to it (any mode), for the detail
      page's derived "superseded/amended by" back-references. */
  supersededByMap: Map<string, Decision[]>;
}

export function buildCurrencyIndex(decisions: Decision[]): CurrencyIndex {
  const supersededIds = new Set<string>();
  const amendedIds = new Set<string>();
  const supersededByMap = new Map<string, Decision[]>();
  for (const d of decisions) {
    for (const link of d.supersedes || []) {
      const arr = supersededByMap.get(link.id) || [];
      arr.push(d);
      supersededByMap.set(link.id, arr);
      if (linkMode(link.mode) === 'supersede') supersededIds.add(link.id);
      else amendedIds.add(link.id);
    }
  }
  return { supersededIds, amendedIds, supersededByMap };
}

export function currencyOf(id: string, index: CurrencyIndex): Currency {
  if (index.supersededIds.has(id)) return 'superseded';
  if (index.amendedIds.has(id)) return 'amended';
  return 'current';
}
