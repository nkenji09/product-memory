import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { loadCardSectionOpen, saveCardSectionOpen, defaultCardSectionOpen } from '../../collapseState';

interface Props {
  recordId: string;
  section: string;
  count: number;
  icon: IconName;
  label: string;
  extra?: ComponentChildren;
  // SpecCard の既存 isOpen（フォーカス時に true になる外部シグナル）を渡す
  // 口。マウント時の初期状態（localStorage 優先・無ければ件数しきい値）に
  // 織り込むほか、マウント後に false→true へ変化した場合（同一 SpecCard
  // インスタンスが後から focus される・#27 差し戻しレビュー1-3）も展開に
  // 同期する。true→false 方向へは同期しない（ユーザーの明示的な開閉・
  // localStorage 済みの状態を上書きしないため、一方向のみ）。
  focusOpen?: boolean;
  onToggle?: () => void;
  children: ComponentChildren;
}

// F2: カード内セクション（意思決定/関連仕様/使用箇所）の開閉可能ヘッダ。
// ヘッダに保有件数を表示し、5件以上は既定で折りたたむ（TagCard/SpecCard/
// VocabCard の3箇所で共通利用）。開閉状態はレコード×セクション単位で
// localStorage に永続化（rail の折りたたみと同じパターン、キーは別名前空間）。
export function CollapsibleSection({ recordId, section, count, icon, label, extra, focusOpen, onToggle, children }: Props) {
  const [open, setOpen] = useState<boolean>(() => loadCardSectionOpen(recordId, section) ?? (focusOpen || defaultCardSectionOpen(count)));

  // focusOpen は「一方向の開シグナル」— true になった瞬間（マウント時含む）
  // だけ open へ反映し、false 方向へは何もしない。isOpen prop がマウント後
  // に false→true へ変わる経路（同一ビュー内で別の spec へフォーカス移動）
  // でも意思決定セクションが自動展開されるようにするための同期。
  useEffect(() => {
    if (focusOpen) setOpen(true);
  }, [focusOpen]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      saveCardSectionOpen(recordId, section, next);
      return next;
    });
    onToggle?.();
  }

  return (
    <div class="card-section">
      <div class="card-section-heading-row">
        <button type="button" class="card-section-toggle" onClick={toggle} aria-expanded={open}>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
          <span class="card-section-heading">
            <Icon name={icon} size={14} /> {label} <span class="card-section-count dim">({count})</span>
          </span>
        </button>
        {extra}
      </div>
      {open && children}
    </div>
  );
}
