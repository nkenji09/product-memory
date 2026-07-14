import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from './Icon';

// A single item in the kebab (⋮) menu. Two shapes, discriminated by which
// field is set:
//  - action item (onSelect) → renders a <button role="menuitem">; running the
//    action closes the menu and returns focus to the trigger.
//  - link item (href) → renders a real <a role="menuitem" target="_blank"> so
//    the destination opens in a new tab by default, and Cmd/Ctrl/middle/right
//    click keep working natively (deep-linking restores focus in that tab).
export interface KebabMenuItem {
  key: string;
  label: string;
  icon?: IconName;
  /** Action item: run then close + refocus trigger. */
  onSelect?: () => void;
  /** Link item: real <a target="_blank" rel="noopener">. */
  href?: string;
}

interface Props {
  /** Accessible name for the ⋮ trigger (icon-only button). */
  triggerLabel: string;
  items: KebabMenuItem[];
}

// A small, self-contained, keyboard-accessible kebab (⋮) menu. There was no
// reusable popover/menu primitive in components/shared/ (only Chip/HashLink/
// Icon/CollapsibleSection), so this is the first — kept generic enough to reuse
// but currently only SpecCard's tag/vocab affordances use it. It replaces the
// two outer icons (⊕ filter / ↗ detail) that broke card layout when a chip row
// had many/long tags: the affordance now collapses into one ⋮ trigger sitting
// at the tail of each tag/vocab element (its footprint is a single icon).
//
// a11y (WAI-ARIA menu button pattern): trigger is <button aria-haspopup="menu"
// aria-expanded>; Enter/Space/↓ open and focus the first item, ↑ opens and
// focuses the last. Inside: role="menu" with role="menuitem" children (roving
// tabindex=-1), ↑/↓/Home/End move, Esc closes and returns focus to the trigger,
// outside click / Tab close. Enter/Space on an item fire its native activation
// (button click or anchor navigation) — we don't intercept them.
export function KebabMenu({ triggerLabel, items }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  // Which item to focus once the menu paints: 'first' for ↓/Enter/click, 'last'
  // for ↑ (per the menu-button pattern).
  const pendingFocus = useRef<'first' | 'last'>('first');

  // Close on outside pointerdown while open (matches VocabPicker's idiom).
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  // Move focus into the menu after it renders.
  useEffect(() => {
    if (!open) return;
    const idx = pendingFocus.current === 'last' ? items.length - 1 : 0;
    itemRefs.current[idx]?.focus();
  }, [open, items.length]);

  const closeAndRefocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const focusAt = (i: number) => {
    const n = items.length;
    if (n === 0) return;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      // Handle open ourselves so these keys don't also fire the click toggle.
      e.preventDefault();
      pendingFocus.current = 'first';
      setOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      pendingFocus.current = 'last';
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusAt(current + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusAt(current - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAt(items.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAndRefocus();
    } else if (e.key === 'Tab') {
      // Let Tab move focus naturally, but the menu should not linger open.
      setOpen(false);
    }
    // Enter/Space fall through to the focused item's native activation.
  };

  return (
    <span class="kebab-menu" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        class="kebab-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => {
          pendingFocus.current = 'first';
          setOpen((v) => !v);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <Icon name="ellipsis-vertical" size={16} />
      </button>
      {open && (
        <div class="kebab-menu-popover" role="menu" aria-label={triggerLabel} onKeyDown={onMenuKeyDown}>
          {items.map((item, i) =>
            item.href ? (
              <a
                key={item.key}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                role="menuitem"
                tabIndex={-1}
                class="kebab-menu-item"
                href={item.href}
                target="_blank"
                rel="noopener"
                onClick={() => setOpen(false)}
              >
                {item.icon && <Icon name={item.icon} size={14} />}
                <span>{item.label}</span>
              </a>
            ) : (
              <button
                key={item.key}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                role="menuitem"
                tabIndex={-1}
                type="button"
                class="kebab-menu-item"
                onClick={() => {
                  item.onSelect?.();
                  closeAndRefocus();
                }}
              >
                {item.icon && <Icon name={item.icon} size={14} />}
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </span>
  );
}
