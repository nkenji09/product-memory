import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '../api';
import { useT } from '../i18n';
import { useLookups } from '../lookups';
import { routeHash } from '../router';
import type { Transition } from '../types';
import { HashLink } from './shared/HashLink';
import { Icon } from './shared/Icon';

// #/flow index（tx.viewer.flow-nav-tab）: nav の「フロー」タブの着地点。実際に
// 使われている action を一覧し、選ぶと #/flow/<action> の既存フロービューへ。
// flow の表示内容（mermaid のみ・scope-honesty の CLI 開示）は不変で、これは
// 到達経路の追加（D10b-5）。action ごとの遷移数を副表示にする。

interface Props {
  onSelectAction: (actionId: string) => void;
}

export function FlowIndexView({ onSelectAction }: Props) {
  const t = useT();
  const { vocabLabel } = useLookups();
  const [transitions, setTransitions] = useState<Transition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .getTransitions({})
      .then((res) => setTransitions(res.transitions ?? []))
      .catch((err) => setError(String(err)));
  }, []);

  // Distinct action ids actually used by a transition, with a per-action count.
  const actions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of transitions ?? []) counts.set(tx.action, (counts.get(tx.action) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, label: vocabLabel(id), count }))
      .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
    // vocabLabel closes over lookups (id fallback is stable enough); excluded
    // from deps intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitions]);

  const q = query.trim().toLowerCase();
  const filtered = q ? actions.filter((a) => a.label.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)) : actions;

  if (error) return <main class="flow-index-view error">{error}</main>;
  if (!transitions) return <main class="flow-index-view dim">{t.flow.loading}</main>;

  return (
    <main class="flow-index-view">
      <header class="flow-index-hero">
        <h1>
          <Icon name="git-fork" size={20} /> {t.flow.indexTitle}
        </h1>
        <p class="dim">{t.flow.indexIntro}</p>
      </header>

      {actions.length > 0 && (
        <div class="flow-index-search">
          <Icon name="search" size={15} />
          <input type="search" value={query} placeholder={t.flow.indexSearchPlaceholder} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
        </div>
      )}

      {actions.length === 0 ? (
        <p class="dim flow-index-empty">{t.flow.indexEmpty}</p>
      ) : (
        <ul class="flow-index-list">
          {filtered.map((a) => (
            <li key={a.id}>
              <HashLink href={routeHash({ view: 'flow', actionId: a.id })} class="flow-index-row" onNavigate={() => onSelectAction(a.id)} title={a.id}>
                <span class="flow-index-row-label">{a.label}</span>
                <span class="flow-index-row-count dim">{t.flow.indexTxCount(a.count)}</span>
              </HashLink>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
