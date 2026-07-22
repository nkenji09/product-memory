import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api';
import { useT } from '../../i18n';
import { useLookups } from '../../lookups';
import type { GovernsEntry } from '../../types';
import { Markdown } from '../Markdown';
import { CollapsibleSection } from '../shared/CollapsibleSection';

// governs 並置（#45 D10b-1）— 「この記録を支配する規則」欄。TagCard/SpecCard/
// VocabCard の3種で共有。own の decision は各カードの従来位置のまま不変で、この
// 欄は own＋祖先/実効タグ経由の decision を出自バッジ付きで**並置**する（own 表示
// の置換ではない）。既定折りたたみ（件数バッジのみ常時表示）で単票の読みやすさを
// 守る。データ源とセレクタは CLI `scholia rules`／viewer GET /api/governs と同一の
// Go コア（index.GovernsFor*）で、フロントは再計算しない（面間整合原則 D10b-2）。

type RecordRef =
  | { kind: 'tag'; id: string }
  | { kind: 'transition'; id: string }
  | { kind: 'vocab'; id: string };

export function GovernsSection({ record }: { record: RecordRef }) {
  const t = useT();
  const { tagName, formatDecisionAt } = useLookups();
  const [entries, setEntries] = useState<GovernsEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = record.kind === 'tag' ? { tag: record.id } : record.kind === 'transition' ? { tx: record.id } : { vocab: record.id };
    api
      .getGoverns(params)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch(() => {
        // governs は付加情報。取得失敗しても単票の読みやすさは壊さない（欄を出さない）。
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [record.kind, record.id]);

  if (!entries || entries.length === 0) return null;

  const provenanceLabel = (e: GovernsEntry): string => {
    if (e.provenance === 'own') return t.browse.governsProvenanceOwn;
    if (e.provenance === 'effective-tag') return t.browse.governsProvenanceEffectiveTag(e.viaTag ? tagName(e.viaTag) : '');
    return t.browse.governsProvenanceParent(e.viaTag ? tagName(e.viaTag) : '');
  };

  return (
    <CollapsibleSection
      recordId={record.id}
      section="governs"
      count={entries.length}
      icon="gavel"
      label={t.browse.governsHeading}
      // 既定折りたたみ（§10-8・viewer-mock 画面a）: 件数バッジのみ常時表示、
      // 単票の読みやすさを守る。own 表示は各カードの従来位置にそのまま残る。
      defaultOpen={false}
    >
      <div class="governs-list">
        {entries.map((e) => (
          <div key={e.decision.id} class="tag-card-decision governs-entry">
            <span class={'governs-provenance-badge governs-provenance-' + e.provenance}>{provenanceLabel(e)}</span>
            <Markdown text={e.decision.why} />
            <span class="dim">
              {formatDecisionAt(e.decision.at)} {e.decision.ref && `· ${e.decision.ref}`}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
