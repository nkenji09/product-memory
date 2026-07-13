// drawer-resize (依頼C-3): 左 rail / 右コメントパネルの横幅設定。CSS 変数名・
// localStorage キー・clamp 範囲を Resizer と起動時復元の両方で共有する。

export interface ResizableWidthConfig {
  cssVar: string;
  storageKey: string;
  min: number;
  max: number;
  defaultWidth: number;
}

export const RAIL_WIDTH: ResizableWidthConfig = {
  cssVar: '--pmem-rail-width',
  storageKey: 'pmem-rail-width',
  min: 200,
  max: 600,
  defaultWidth: 300,
};

export const COMMENT_PANEL_WIDTH: ResizableWidthConfig = {
  cssVar: '--pmem-comment-width',
  storageKey: 'pmem-comment-width',
  min: 280,
  max: 640,
  defaultWidth: 400,
};

// マウント時に localStorage の保存幅を documentElement の CSS 変数へ復元する
// （PC 表示のみ意味を持つ — narrow は CSS 側で変数を無視する）。
export function restoreResizableWidths(): void {
  for (const cfg of [RAIL_WIDTH, COMMENT_PANEL_WIDTH]) {
    let raw: string | null;
    try {
      raw = localStorage.getItem(cfg.storageKey);
    } catch {
      continue;
    }
    if (!raw) continue;
    const px = parseFloat(raw);
    if (!Number.isFinite(px)) continue;
    const clamped = Math.min(cfg.max, Math.max(cfg.min, px));
    document.documentElement.style.setProperty(cfg.cssVar, `${clamped}px`);
  }
}
