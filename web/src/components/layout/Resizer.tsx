import { useEffect, useRef, useState } from 'preact/hooks';
import type { ResizableWidthConfig } from './resizableWidths';

interface Props {
  config: ResizableWidthConfig;
  // 'rail'（左）は右へドラッグすると広がる。'panel'（右・right:0固定）は
  // 左へドラッグすると広がる（symmetric な符号反転が必要なため方向を明示）。
  direction: 'rail' | 'panel';
  className?: string;
}

// 左 rail / 右コメントパネル共通のドラッグ式リサイズハンドル。ドラッグ処理を
// このコンポーネント内に隔離し、BrowseView.tsx/BrowseRail.tsx の索引描画
// ロジックには一切触れない（依頼C-3・並行 C-1/C-2 との衝突回避）。
export function Resizer({ config, direction, className }: Props) {
  const [active, setActive] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const current = getComputedStyle(document.documentElement).getPropertyValue(config.cssVar);
    const parsed = parseFloat(current);
    dragRef.current = {
      startX: e.clientX,
      startWidth: Number.isFinite(parsed) && parsed > 0 ? parsed : config.defaultWidth,
    };
    setActive(true);
  };

  useEffect(() => {
    if (!active) return;

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = e.clientX - drag.startX;
      const signed = direction === 'rail' ? delta : -delta;
      const next = Math.min(config.max, Math.max(config.min, drag.startWidth + signed));
      document.documentElement.style.setProperty(config.cssVar, `${next}px`);
    };

    const finish = () => {
      dragRef.current = null;
      setActive(false);
      const current = getComputedStyle(document.documentElement).getPropertyValue(config.cssVar);
      const parsed = parseFloat(current);
      if (!Number.isFinite(parsed)) return;
      try {
        localStorage.setItem(config.storageKey, String(parsed));
      } catch {
        // 保存できなくても致命的ではない（プライベートモード等）ので無視。
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [active, config, direction]);

  return (
    <div
      class={`pmem-resizer${active ? ' pmem-resizer-active' : ''}${className ? ` ${className}` : ''}`}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={config.min}
      aria-valuemax={config.max}
    />
  );
}
