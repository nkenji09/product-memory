import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';

// Comments (#18) — volatile, per-browser annotations on タグ/仕様 detail
// cards. Deliberately NOT part of the .pmem record model: everything here
// lives only in localStorage (never git, never the Go backend), exactly per
// claude-design-request-comments.md's "フロントエンド完結・localStorage の
// み" constraint. This file is the one place that reads/writes that
// storage — components never touch localStorage directly.
//
// Scope note: the constraint brief's "保存されるデータ" section lists only
// target/anchor/text (+ id/timestamps as an implementation detail) — no
// threaded replies. The Claude Design mock added a reply thread per
// comment; that's beyond the written requirement, so it's not implemented
// here (see .concierge/result.md).

export type RecordType = 'tag' | 'transition';

export interface CommentTarget {
  recordType: RecordType;
  recordId: string;
  recordTitle: string;
  anchor: string;
  anchorLabel: string;
}

export interface CommentRecord extends CommentTarget {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

interface CommentsValue {
  comments: CommentRecord[];
  hasComment: (recordId: string, anchor: string) => boolean;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  composer: CommentTarget | null;
  composerText: string;
  isEditingExisting: boolean;
  openComposer: (target: CommentTarget) => void;
  editComment: (c: CommentRecord) => void;
  setComposerText: (text: string) => void;
  saveComposer: () => void;
  cancelComposer: () => void;
  deleteComment: (id: string) => void;
  copyMsg: boolean;
  copyAll: () => void;
}

const STORAGE_KEY = 'pmem-comments-v1';
const CommentsContext = createContext<CommentsValue | null>(null);

function load(): CommentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist(arr: CommentRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Private-mode/quota — comments stay in-memory for this session only.
  }
}

function newId(): string {
  return 'c' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

function buildCopyText(comments: CommentRecord[]): string {
  const lines = [
    '# product-memory ビューア — レビューコメント',
    `以下の ${comments.length} 件のコメントに基づき、該当レコード（.pmem のタグ / 仕様=transition）の該当箇所を修正してください。`,
    '',
  ];
  comments.forEach((c, i) => {
    lines.push(`${i + 1}. [${c.recordType === 'tag' ? 'タグ' : '仕様'}] ${c.recordId} 「${c.recordTitle}」`);
    lines.push(`   箇所: ${c.anchorLabel}`);
    lines.push(`   コメント: ${c.text}`);
    lines.push('');
  });
  return lines.join('\n');
}

function fallbackCopy(text: string) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch {
    // best-effort only
  }
}

export function CommentsProvider({ children }: { children: ComponentChildren }) {
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [composer, setComposer] = useState<CommentTarget | null>(null);
  const [composerText, setComposerTextState] = useState('');
  const [copyMsg, setCopyMsg] = useState(false);

  useEffect(() => {
    setComments(load());
  }, []);

  const hasComment = (recordId: string, anchor: string) => comments.some((c) => c.recordId === recordId && c.anchor === anchor);

  const openComposer = (target: CommentTarget) => {
    const existing = comments.find((c) => c.recordId === target.recordId && c.anchor === target.anchor);
    setComposer(target);
    setComposerTextState(existing?.text || '');
    setPanelOpen(true);
    setCopyMsg(false);
  };

  const editComment = (c: CommentRecord) => {
    setComposer({ recordType: c.recordType, recordId: c.recordId, recordTitle: c.recordTitle, anchor: c.anchor, anchorLabel: c.anchorLabel });
    setComposerTextState(c.text);
    setPanelOpen(true);
    setCopyMsg(false);
  };

  const cancelComposer = () => {
    setComposer(null);
    setComposerTextState('');
  };

  const saveComposer = () => {
    if (!composer) return;
    const text = composerText.trim();
    setComments((prev) => {
      const idx = prev.findIndex((c) => c.recordId === composer.recordId && c.anchor === composer.anchor);
      let next: CommentRecord[];
      if (!text) {
        next = idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
      } else if (idx >= 0) {
        next = prev.map((c, i) => (i === idx ? { ...c, text, updatedAt: Date.now() } : c));
      } else {
        next = [...prev, { ...composer, id: newId(), text, createdAt: Date.now(), updatedAt: Date.now() }];
      }
      persist(next);
      return next;
    });
    setComposer(null);
    setComposerTextState('');
  };

  const deleteComment = (id: string) => {
    setComments((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persist(next);
      return next;
    });
  };

  const copyAll = () => {
    if (comments.length === 0) return;
    const text = buildCopyText(comments);
    const done = () => {
      setCopyMsg(true);
      setTimeout(() => setCopyMsg(false), 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  };

  const value: CommentsValue = {
    comments,
    hasComment,
    panelOpen,
    openPanel: () => {
      setPanelOpen(true);
      setComposer(null);
      setCopyMsg(false);
    },
    closePanel: () => {
      setPanelOpen(false);
      setComposer(null);
      setComposerTextState('');
    },
    composer,
    composerText,
    isEditingExisting: !!composer && comments.some((c) => c.recordId === composer.recordId && c.anchor === composer.anchor),
    openComposer,
    editComment,
    setComposerText: setComposerTextState,
    saveComposer,
    cancelComposer,
    deleteComment,
    copyMsg,
    copyAll,
  };

  return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>;
}

export function useComments(): CommentsValue {
  const ctx = useContext(CommentsContext);
  if (!ctx) throw new Error('useComments() must be called within a CommentsProvider');
  return ctx;
}
