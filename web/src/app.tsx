import { useState } from 'preact/hooks';
import { Sidebar } from './components/Sidebar';
import { TransitionList } from './components/TransitionList';
import { TransitionDetailPanel } from './components/TransitionDetail';
import { ConfigView } from './components/ConfigView';
import { TraceabilityView } from './components/TraceabilityView';
import { SearchBox } from './components/SearchBox';

export function App() {
  const [view, setView] = useState<'browse' | 'traceability' | 'config'>('browse');
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined);
  const [selectedTxId, setSelectedTxId] = useState<string | undefined>(undefined);

  const openTransition = (txId: string) => {
    setView('browse');
    setSelectedTxId(txId);
  };

  return (
    <>
      <header class="topbar">
        <h1>pmem view</h1>
        <SearchBox onSelectTx={openTransition} />
        <nav>
          <button type="button" class={view === 'browse' ? 'active' : ''} onClick={() => setView('browse')}>
            Browse
          </button>
          <button
            type="button"
            class={view === 'traceability' ? 'active' : ''}
            onClick={() => setView('traceability')}
          >
            Traceability
          </button>
          <button type="button" class={view === 'config' ? 'active' : ''} onClick={() => setView('config')}>
            Config
          </button>
        </nav>
      </header>
      {view === 'browse' && (
        <div class="layout">
          <Sidebar
            selectedTagId={selectedTagId}
            onSelectTag={(id) => {
              setSelectedTagId(id);
              setSelectedTxId(undefined);
            }}
          />
          <TransitionList tagId={selectedTagId} selectedTxId={selectedTxId} onSelectTx={setSelectedTxId} />
          <TransitionDetailPanel txId={selectedTxId} />
        </div>
      )}
      {view === 'traceability' && (
        <div class="layout layout-two">
          <TraceabilityView onSelectTx={openTransition} />
          <TransitionDetailPanel txId={selectedTxId} />
        </div>
      )}
      {view === 'config' && <ConfigView />}
    </>
  );
}
