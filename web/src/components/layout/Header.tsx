import { strings } from '../../strings';
import type { ViewName } from '../../router';
import { useViewerSettings } from '../../settings';
import { Icon } from '../shared/Icon';
import type { IconName } from '../shared/Icon';
import { useComments } from '../comments/useComments';

interface Props {
  view: ViewName;
  onSelectView: (v: ViewName) => void;
}

// Nav mirrors the design's segmented-pill control (概要/タグ/仕様 + icons),
// extended with Vocab — a screen the design didn't mock but which still
// needs a reachable nav slot (.concierge/decision.md §A-4). Order is
// 概要/語彙/タグ/仕様 per user visual feedback (2026-07-11 tweaks2: 語彙 moved
// between 概要 and タグ). Traceability/Compare were also in that "not mocked"
// set but were dropped from the nav entirely per an earlier user request —
// not in the design, so removed for now rather than left half-styled; git
// history has the prior version if they come back. 'spec' (the legacy
// per-tag-report hash) is deliberately NOT a nav entry: it renders the same
// BrowseView as 'tags' with a different initial focus, so having both as
// separate buttons would just be two nav items doing the same thing. Config
// is not here either — the design treats settings as a standalone icon
// button, not a nav tab (see the header switches cluster below).
const NAV: Array<[ViewName, string, IconName]> = [
  ['home', strings.nav.home, 'layout-dashboard'],
  ['vocab', strings.nav.vocab, 'book-open'],
  ['tags', strings.nav.tags, 'tags'],
  ['browse', strings.nav.specs, 'scroll-text'],
];

export function Header({ view, onSelectView }: Props) {
  const { settings, toggleTheme, incFont, decFont } = useViewerSettings();
  const { comments, panelOpen, openPanel } = useComments();

  return (
    <header class="topbar">
      <div class="topbar-logo">
        <span class="topbar-logo-mark">
          <Icon name="box" size={19} />
        </span>
        <div class="topbar-logo-text">
          <span class="topbar-logo-title">pmem</span>
          <span class="topbar-logo-subtitle">product-memory</span>
        </div>
      </div>

      <nav class="topbar-nav">
        {NAV.map(([key, label, icon]) => {
          // 'spec' (legacy per-tag hash, kept for bookmark compat) renders
          // the same BrowseView 'tags' facet does — highlight タグ for it
          // too rather than leaving no tab active.
          const active = view === key || (key === 'tags' && view === 'spec');
          return (
            <button key={key} type="button" class={'topbar-nav-btn' + (active ? ' active' : '')} onClick={() => onSelectView(key)}>
              <Icon name={icon} size={16} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div class="header-switches">
        <div class="font-scale" role="group" aria-label="文字サイズ">
          <button type="button" aria-label={strings.header.fontDec} onClick={decFont}>
            <Icon name="minus" size={14} />
          </button>
          <span class="font-scale-pct">{Math.round(settings.fontScale * 100)}%</span>
          <button type="button" aria-label={strings.header.fontInc} onClick={incFont}>
            <Icon name="plus" size={14} />
          </button>
        </div>
        <button type="button" class="topbar-icon-btn" aria-label={strings.header.themeToggle} onClick={toggleTheme}>
          <Icon name={settings.theme === 'dark' ? 'moon' : 'sun'} size={17} />
        </button>
        {comments.length > 0 && (
          <button type="button" class={'topbar-icon-btn comment-header-btn' + (panelOpen ? ' active' : '')} aria-label="コメント一覧" onClick={openPanel}>
            <Icon name="message-filled" size={17} />
            <span class="comment-header-badge">{comments.length}</span>
          </button>
        )}
        <button
          type="button"
          class={'topbar-icon-btn' + (view === 'config' ? ' active' : '')}
          aria-label={strings.nav.config}
          title={strings.nav.config}
          onClick={() => onSelectView('config')}
        >
          <Icon name="settings" size={17} />
        </button>
      </div>
    </header>
  );
}
