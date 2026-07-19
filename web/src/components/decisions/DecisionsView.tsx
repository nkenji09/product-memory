import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '../../api';
import { useT } from '../../i18n';
import { useLookups } from '../../lookups';
import type { Decision, Tag } from '../../types';
import { Icon } from '../shared/Icon';
import { buildCurrencyIndex, currencyOf, type Currency } from './decisionModel';

interface Props {
  /** Free-text query (routed via the shared searchQuery hash param so it
      round-trips a shared link). */
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenDecision: (id: string) => void;
}

type TargetKindFilter = 'all' | 'transition' | 'tag' | 'vocab';
type CurrencyFilter = 'all' | 'current' | 'superseded';
type PeriodFilter = 'all' | '30d' | '90d' | '1y';

const PERIOD_DAYS: Record<Exclude<PeriodFilter, 'all'>, number> = { '30d': 30, '90d': 90, '1y': 365 };

// Currency → badge class + label. 'amended' rides the same "still current but
// caveated" bucket as current for the 現行/失効 filter, but keeps its own badge.
function currencyBadge(c: Currency, t: ReturnType<typeof useT>): { cls: string; label: string } {
  if (c === 'superseded') return { cls: 'decision-badge-superseded', label: t.decisions.currencySuperseded };
  if (c === 'amended') return { cls: 'decision-badge-amended', label: t.decisions.currencyAmended };
  return { cls: 'decision-badge-current', label: t.decisions.currencyCurrent };
}

export function DecisionsView({ searchQuery, onSearchChange, onOpenDecision }: Props) {
  const t = useT();
  const { tagName, vocabLabel, transitionLabel } = useLookups();
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [targetKind, setTargetKind] = useState<TargetKindFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [currency, setCurrency] = useState<CurrencyFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');

  useEffect(() => {
    Promise.all([api.getRules({}), api.getTags()])
      .then(([rules, tgs]) => {
        setDecisions(rules.decisions);
        setTags(tgs);
      })
      .catch((err) => setError(String(err)));
  }, []);

  // The target's human label, covering all three target types (transitionLabel
  // only handles transitions; tag/vocab resolve through their own lookups).
  const targetLabel = (d: Decision): string => {
    if (d.target.type === 'tag') return tagName(d.target.id);
    if (d.target.type === 'vocab') return vocabLabel(d.target.id);
    return transitionLabel(d.target.id).primary;
  };
  const targetPrefix = (type: Decision['target']['type']): string =>
    type === 'tag' ? t.decisions.targetPrefixTag : type === 'vocab' ? t.decisions.targetPrefixVocab : t.decisions.targetPrefixTransition;

  const currencyIndex = useMemo(() => buildCurrencyIndex(decisions || []), [decisions]);

  // Tags that a decision actually targets — the tag-filter dropdown only
  // offers tags that a decision points at (a tag with no decisions would just
  // be a dead option). tagFilter matches a decision whose target IS the tag.
  const targetedTagIds = useMemo(() => {
    const s = new Set<string>();
    for (const d of decisions || []) if (d.target.type === 'tag') s.add(d.target.id);
    return s;
  }, [decisions]);

  const q = searchQuery.trim().toLowerCase();
  const now = Date.now();

  const filtered = useMemo(() => {
    if (!decisions) return [];
    return decisions
      .filter((d) => {
        if (targetKind !== 'all' && d.target.type !== targetKind) return false;
        if (tagFilter !== 'all' && !(d.target.type === 'tag' && d.target.id === tagFilter)) return false;
        const cur = currencyOf(d.id, currencyIndex);
        if (currency === 'superseded' && cur !== 'superseded') return false;
        if (currency === 'current' && cur === 'superseded') return false;
        if (period !== 'all') {
          const ageDays = (now - new Date(d.at).getTime()) / 86400000;
          if (!(ageDays <= PERIOD_DAYS[period])) return false;
        }
        if (q) {
          // Search corpus: why + changed + target id/label + acknowledges.
          const hay = [d.why, d.changed || '', d.target.id, targetLabel(d), (d.acknowledges || []).join(' ')].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice()
      .reverse(); // newest-first (getRules returns chronological ascending)
    // targetLabel closes over lookups; excluded from deps intentionally (label
    // fallback to id is stable enough, and lookups populate before decisions
    // in practice) — re-running on lookups churn isn't worth the extra deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisions, currencyIndex, targetKind, tagFilter, currency, period, q]);

  if (error) return <main class="decisions-view error">{error}</main>;
  if (!decisions) return <main class="decisions-view dim">{t.decisions.loading}</main>;

  const filterTags = tags.filter((tg) => targetedTagIds.has(tg.id));

  return (
    <main class="decisions-view">
      <header class="decisions-hero">
        <h1>
          <Icon name="gavel" size={20} /> {t.decisions.heading}
        </h1>
        <p class="dim">{t.decisions.intro}</p>
      </header>

      <section class="decisions-controls">
        <div class="decisions-search">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={searchQuery}
            placeholder={t.decisions.searchPlaceholder}
            onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
          />
        </div>
        <div class="decisions-filters">
          <label class="decisions-filter">
            <span class="decisions-filter-label dim">{t.decisions.filterTargetKind}</span>
            <select value={targetKind} onChange={(e) => setTargetKind((e.target as HTMLSelectElement).value as TargetKindFilter)}>
              <option value="all">{t.decisions.filterAll}</option>
              <option value="transition">{t.decisions.targetKindTransition}</option>
              <option value="tag">{t.decisions.targetKindTag}</option>
              <option value="vocab">{t.decisions.targetKindVocab}</option>
            </select>
          </label>
          {filterTags.length > 0 && (
            <label class="decisions-filter">
              <span class="decisions-filter-label dim">{t.decisions.filterTag}</span>
              <select value={tagFilter} onChange={(e) => setTagFilter((e.target as HTMLSelectElement).value)}>
                <option value="all">{t.decisions.filterAll}</option>
                {filterTags.map((tg) => (
                  <option key={tg.id} value={tg.id}>
                    {tg.name || tg.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label class="decisions-filter">
            <span class="decisions-filter-label dim">{t.decisions.filterCurrency}</span>
            <select value={currency} onChange={(e) => setCurrency((e.target as HTMLSelectElement).value as CurrencyFilter)}>
              <option value="all">{t.decisions.filterAll}</option>
              <option value="current">{t.decisions.currencyCurrent}</option>
              <option value="superseded">{t.decisions.currencySuperseded}</option>
            </select>
          </label>
          <label class="decisions-filter">
            <span class="decisions-filter-label dim">{t.decisions.filterPeriod}</span>
            <select value={period} onChange={(e) => setPeriod((e.target as HTMLSelectElement).value as PeriodFilter)}>
              <option value="all">{t.decisions.periodAll}</option>
              <option value="30d">{t.decisions.period30d}</option>
              <option value="90d">{t.decisions.period90d}</option>
              <option value="1y">{t.decisions.period1y}</option>
            </select>
          </label>
          <span class="decisions-count dim">{t.decisions.countLabel(filtered.length)}</span>
        </div>
      </section>

      {decisions.length === 0 ? (
        <p class="dim decisions-empty">{t.decisions.empty}</p>
      ) : filtered.length === 0 ? (
        <p class="dim decisions-empty">{t.decisions.noMatch}</p>
      ) : (
        <ul class="decisions-list">
          {filtered.map((d) => {
            const badge = currencyBadge(currencyOf(d.id, currencyIndex), t);
            return (
              <li key={d.id}>
                <button type="button" class="decision-row" onClick={() => onOpenDecision(d.id)}>
                  <div class="decision-row-top">
                    <span class="decision-row-target">
                      <span class="decision-row-target-kind dim">{targetPrefix(d.target.type)}</span>
                      {targetLabel(d)}
                    </span>
                    <span class={'decision-badge ' + badge.cls}>{badge.label}</span>
                  </div>
                  <p class="decision-row-why">{d.why}</p>
                  <span class="decision-row-at dim">{d.at.slice(0, 10)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
