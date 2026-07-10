import { useEffect, useState } from 'preact/hooks';
import { api } from '../api';
import type { SearchResult } from '../types';

interface Props {
  onSelectTx: (id: string) => void;
}

export function SearchBox({ onSelectTx }: Props) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    api
      .search(q)
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const select = (id: string) => {
    setQuery('');
    setResult(null);
    onSelectTx(id);
  };

  return (
    <div class="search-box">
      <input
        type="search"
        class="search-input"
        placeholder="検索（実効タグ・語彙・遷移 id・kind）"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />
      {query.trim() && (
        <div class="search-results">
          {error && <p class="error">{error}</p>}
          {result && result.transitions.length === 0 && !error && <p class="dim">該当なし</p>}
          {result && result.transitions.length > 0 && (
            <ul>
              {result.transitions.map((t) => (
                <li key={t.id}>
                  <button type="button" class="search-result-row" onClick={() => select(t.id)}>
                    <span class="tx-id">{t.id}</span>
                    {result.matchedOn[t.id] && (
                      <span class="dim search-matched-on">{result.matchedOn[t.id].join(', ')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
