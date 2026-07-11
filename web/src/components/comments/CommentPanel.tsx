import { useComments } from './useComments';
import type { CommentRecord } from './useComments';
import { Icon } from '../shared/Icon';

interface Props {
  onGoto: (c: CommentRecord) => void;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Slide-over panel opened from the header's comment icon (or any per-section
// CommentButton): a composer for the currently-targeted section plus a
// summary list of every comment, each jumping back to its record via
// onGoto (App.tsx's existing openTagSpec/openTransition routes).
export function CommentPanel({ onGoto }: Props) {
  const {
    comments,
    panelOpen,
    closePanel,
    composer,
    composerText,
    isEditingExisting,
    setComposerText,
    saveComposer,
    cancelComposer,
    deleteComment,
    editComment,
    copyMsg,
    copyAll,
  } = useComments();

  if (!panelOpen) return null;

  const sorted = comments.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <div class="comment-backdrop" onClick={closePanel} />
      <aside class="comment-panel">
        <div class="comment-panel-head">
          <span class="comment-panel-title">
            <Icon name="message-filled" size={14} /> コメント <span class="comment-panel-count">{comments.length}</span>
          </span>
          <span class="comment-panel-spacer" />
          {copyMsg && (
            <span class="comment-copy-msg">
              <Icon name="check" size={12} /> コピーしました
            </span>
          )}
          <button type="button" class="comment-copy-btn" title="AI が修正するための情報をまとめてコピー" onClick={copyAll} disabled={comments.length === 0}>
            <Icon name="clipboard-copy" size={14} /> コピー
          </button>
          <button type="button" class="comment-close-btn" aria-label="閉じる" onClick={closePanel}>
            <Icon name="x" size={17} />
          </button>
        </div>

        <div class="comment-panel-body">
          {composer && (
            <div class="comment-composer">
              <div class="comment-composer-target">
                <span class="comment-composer-type">{composer.recordType === 'tag' ? 'タグ' : '仕様'}</span>
                <span class="comment-composer-title">{composer.recordTitle}</span>
                <span class="dim">›</span>
                <span class="dim">{composer.anchorLabel}</span>
              </div>
              <textarea
                class="comment-composer-input"
                rows={3}
                placeholder="コメントを入力…（このカードのこの箇所について）"
                value={composerText}
                onInput={(e) => setComposerText((e.target as HTMLTextAreaElement).value)}
              />
              <div class="comment-composer-actions">
                <button type="button" class="comment-btn-primary" onClick={saveComposer}>
                  <Icon name="check" size={14} /> 保存
                </button>
                <button type="button" class="comment-btn-secondary" onClick={cancelComposer}>
                  キャンセル
                </button>
                <span class="comment-panel-spacer" />
                {isEditingExisting && (
                  <button
                    type="button"
                    class="comment-btn-danger"
                    onClick={() => {
                      const existing = comments.find((c) => c.recordId === composer.recordId && c.anchor === composer.anchor);
                      if (existing) deleteComment(existing.id);
                      cancelComposer();
                    }}
                  >
                    <Icon name="trash-2" size={14} /> 削除
                  </button>
                )}
              </div>
            </div>
          )}

          {comments.length === 0 && !composer && (
            <div class="comment-empty">
              まだコメントはありません。
              <br />
              各カードの見出し横の <Icon name="message-plus" size={13} /> から追加できます。
            </div>
          )}

          {sorted.map((c) => (
            <div key={c.id} class="comment-item">
              <div class="comment-item-head">
                <span class="comment-item-type">{c.recordType === 'tag' ? 'タグ' : '仕様'}</span>
                <span class="comment-item-title">{c.recordTitle}</span>
                <span class="comment-item-location dim">
                  <Icon name="crosshair" size={10} /> {c.anchorLabel}
                </span>
              </div>
              <p class="comment-item-text">{c.text}</p>
              <div class="comment-item-actions">
                <button type="button" class="comment-btn-chip" onClick={() => onGoto(c)}>
                  <Icon name="crosshair" size={13} /> 位置へ移動
                </button>
                <button type="button" class="comment-btn-chip" onClick={() => editComment(c)}>
                  <Icon name="pencil" size={12} /> 編集
                </button>
                <span class="comment-panel-spacer" />
                <span class="comment-item-time dim">{formatTime(c.updatedAt)}</span>
                <button type="button" class="comment-btn-icon-danger" aria-label="削除" onClick={() => deleteComment(c.id)}>
                  <Icon name="trash-2" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
