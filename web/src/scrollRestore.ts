import { useEffect, useRef } from 'preact/hooks';

// Per-view scroll continuity (req.comfortable-viewer.view-state-continuity):
// each browse view (tags/specs/vocab) remembers where it was scrolled to so
// leaving and coming back — or reloading — lands you back at the same place.
//
// Storage split (spec decision): scroll position lives in sessionStorage, NOT
// the URL. It's a per-tab reading context, not something to share or bookmark:
// sessionStorage survives reload within the same tab and vanishes when the tab
// closes, which is exactly the lifetime we want (search conditions, which ARE
// shareable, go in the URL instead — see router.ts / BrowseView / VocabView).
//
// The scroll root is the *document* (window), not the `.browse-main` element:
// #app is only min-height:100vh, so browse-main grows to its full content
// height and the window is what actually scrolls (its overflow-y:auto never
// engages). Scroll-to-card deep links already rely on this via
// scrollIntoView — this hook saves/restores the same window scrollY.
const KEY_PREFIX = 'pmem-scroll-';

function readSaved(view: string): number | null {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + view);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    // sessionStorage can throw (private mode / disabled storage). Degrade to
    // "no saved position" rather than breaking the view.
    return null;
  }
}

function writeSaved(view: string, top: number): void {
  try {
    sessionStorage.setItem(KEY_PREFIX + view, String(Math.round(top)));
  } catch {
    // ignore — persistence is best-effort (see readSaved).
  }
}

/**
 * Remembers and restores the window scroll position for one view, keyed per
 * view in sessionStorage.
 *
 * - Save (T-viewer-scroll-save / act.user.leave-view): every scroll is
 *   persisted (debounced) so a reload keeps the position, and the last known
 *   position is flushed again on unmount (a view switch) — from a tracked ref,
 *   never re-read at teardown.
 * - Restore (T-viewer-scroll-restore / act.user.enter-view): once `ready`
 *   flips true (the view's content has loaded and laid out) the saved position
 *   is applied. With no saved position the view is reset to the top — since the
 *   window scroll is shared across views, this stops the previous view's scroll
 *   from bleeding into a freshly-entered one. `skipRestore` suppresses both
 *   when the view is instead going to scroll to a focused record (a comment
 *   "位置へ移動" jump, or a #/spec/<id> / #/vocab/<id> deep link) — that focus
 *   scroll wins over the remembered position.
 *
 * `ready` is what makes the restore reliable: the caller only flips it true
 * once the view's cards are in the committed DOM, so the document is already
 * tall enough for the target scrollY to take — no rAF/height-polling needed
 * (and rAF would stall anyway when the tab is backgrounded). A short
 * setTimeout re-apply covers card bodies (markdown/spec detail) that finish
 * laying out a beat later and could otherwise clamp the first attempt.
 */
export function useScrollRestore(view: string, ready: boolean, skipRestore = false): void {
  // Last observed scrollY. Seeded lazily from the saved value so an unmount
  // that happens before any scroll event doesn't clobber a real saved position
  // with a stale 0.
  const latest = useRef<number | null>(null);
  const restored = useRef(false);

  useEffect(() => {
    if (latest.current === null) latest.current = readSaved(view) ?? 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      latest.current = window.scrollY;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => writeSaved(view, latest.current ?? 0), 100);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
      writeSaved(view, latest.current ?? 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (!ready || restored.current || skipRestore) return;
    restored.current = true;
    const target = readSaved(view) ?? 0;
    latest.current = target;
    window.scrollTo(0, target);
    if (target === 0) return;
    // Re-apply once after layout settles: some card bodies grow a beat after
    // `ready`, which can clamp the first scroll to a shorter height. setTimeout
    // (not rAF) so it still fires when the tab is backgrounded.
    const reinforce = setTimeout(() => window.scrollTo(0, target), 120);
    return () => clearTimeout(reinforce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, ready, skipRestore]);
}
