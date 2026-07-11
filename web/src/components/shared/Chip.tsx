import type { ComponentChildren, JSX } from 'preact';

// Kind color mapping (design tokens --k-req/--k-sub/--k-con for tag kinds,
// --t-act/--t-giv/--t-then for vocab categories). Any kind/category not in
// this map falls back to --lm-text-dim rather than guessing a color, since
// tagKinds/facetKinds are project-configurable (§2 constitutive vs
// descriptive) — there is no fixed universal set to enumerate.
const KIND_COLOR: Record<string, string> = {
  requirement: 'var(--k-req)',
  subject: 'var(--k-sub)',
  concern: 'var(--k-con)',
  action: 'var(--t-act)',
  condition: 'var(--t-giv)',
  effect: 'var(--t-then)',
};

export function kindColor(kind: string | undefined): string {
  return (kind && KIND_COLOR[kind]) || 'var(--lm-text-dim)';
}

interface Props {
  color?: string;
  onClick?: () => void;
  onRemove?: () => void;
  title?: string;
  children: ComponentChildren;
}

export function Chip({ color = 'var(--lm-text-dim)', onClick, onRemove, title, children }: Props) {
  const style = { '--chip-color': color } as JSX.CSSProperties;
  if (onClick) {
    return (
      <button type="button" class="chip chip-clickable" style={style} onClick={onClick} title={title}>
        {children}
      </button>
    );
  }
  return (
    <span class="chip" style={style} title={title}>
      {children}
      {onRemove && (
        <button type="button" class="chip-remove" aria-label="除去" onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  );
}
