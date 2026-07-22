import { useEffect, useRef, useState } from 'preact/hooks';
import { api, isStaticMode } from '../../api';
import { useT } from '../../i18n';
import type { Config, KindDecl } from '../../types';
import { kindDeclId } from '../../types';
import { TokenSetField } from './TokenSetField';
import { TagKindLabelsField } from './TagKindLabelsField';
import { Icon } from '../shared/Icon';

interface EditableConfig {
  // #45 D9: tagKinds は KindDecl[] を丸ごと保持し、object 宣言（behaviors/
  // description）を round-trip で保全する（port だけ変えて保存しても behaviors が
  // 消えない）。UI は id で操作し、既存 object 宣言は id 一致で温存する。
  tagKinds: KindDecl[];
  facetKinds: string[];
  traceabilityKinds: string[];
  roots: string[];
  port: string;
  tagKindLabels: Record<string, string>;
  productName: string;
  tagline: string;
  intro: string;
  timezone: string;
}

function toEditable(cfg: Config): EditableConfig {
  return {
    tagKinds: cfg.tagKinds.map((k) => (typeof k === 'string' ? k : { ...k })),
    facetKinds: [...cfg.facetKinds],
    traceabilityKinds: [...cfg.traceabilityKinds],
    roots: [...cfg.roots],
    port: String(cfg.viewer.port),
    tagKindLabels: { ...(cfg.tagKindLabels || {}) },
    productName: cfg.display?.productName || '',
    tagline: cfg.display?.tagline || '',
    intro: cfg.display?.intro || '',
    timezone: cfg.timezone || '',
  };
}

function addUnique(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr : [...arr, value];
}

// Client-side mirror of the server's model.ValidateTimezone (Go's
// time.LoadLocation) — Intl.DateTimeFormat throws RangeError for a
// timeZone it can't resolve, so this catches the same class of typo before
// the round-trip to PUT /api/config. Empty is valid here (means "clear").
function isValidTimezone(tz: string): boolean {
  if (tz === '') return true;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// addTagKindID は id を tagKinds に string 宣言で追加する（既存は温存・重複は無視）。
function addTagKindID(kinds: KindDecl[], value: string): KindDecl[] {
  return kinds.some((k) => kindDeclId(k) === value) ? kinds : [...kinds, value];
}

// removeTagKindID は id 一致で tagKinds から除去する（object 宣言も id で判定）。
function removeTagKindID(kinds: KindDecl[], value: string): KindDecl[] {
  return kinds.filter((k) => kindDeclId(k) !== value);
}

export function ConfigView() {
  const t = useT();
  const [remote, setRemote] = useState<Config | null>(null);
  const [draft, setDraft] = useState<EditableConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        setRemote(cfg);
        const ed = toEditable(cfg);
        baseline.current = JSON.stringify(ed);
        setDraft(ed);
      })
      .catch((err) => setError(String(err)));
  }, []);

  if (error) return <main class="config-view error">{error}</main>;
  if (!remote || !draft) return <main class="config-view dim">{t.config.loading}</main>;

  const editable = !isStaticMode;
  const dirty = editable && baseline.current !== null && JSON.stringify(draft) !== baseline.current;
  // TokenSetField/TagKindLabelsField/subset チェックは id で扱う。object 宣言は
  // id に射影して表示し、値の実体（behaviors 等）は draft.tagKinds に温存する。
  const tagKindIDs = draft.tagKinds.map(kindDeclId);
  const tagKindSet = new Set(tagKindIDs);

  const update = (patch: Partial<EditableConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setMessage(null);
  };

  const onSave = () => {
    const portStr = draft.port.trim();
    if (!/^\d+$/.test(portStr) || Number(portStr) < 1 || Number(portStr) > 65535) {
      setMessage({ kind: 'error', text: t.config.portInvalid(portStr || t.config.portEmptyWord) });
      return;
    }
    const timezone = draft.timezone.trim();
    if (!isValidTimezone(timezone)) {
      setMessage({ kind: 'error', text: t.config.timezoneInvalid(timezone) });
      return;
    }
    api
      .putConfig({
        tagKinds: draft.tagKinds,
        facetKinds: draft.facetKinds,
        traceabilityKinds: draft.traceabilityKinds,
        roots: draft.roots,
        viewer: { port: Number(portStr) },
        tagKindLabels: draft.tagKindLabels,
        display: { productName: draft.productName, tagline: draft.tagline, intro: draft.intro },
        timezone,
      })
      .then((cfg) => {
        setRemote(cfg);
        const ed = toEditable(cfg);
        baseline.current = JSON.stringify(ed);
        setDraft(ed);
        setMessage({ kind: 'ok', text: t.config.savedMessage });
      })
      .catch((err) => setMessage({ kind: 'error', text: String(err) }));
  };

  const onReset = () => {
    if (!baseline.current) return;
    setDraft(JSON.parse(baseline.current));
    setMessage(null);
  };

  return (
    <main class="config-view">
      <div class="config-head">
        <div class="config-head-text">
          <h1>{t.config.heading}</h1>
          <p class="dim">
            {t.config.introBefore}
            <code>.scholia/config.json</code>
            {t.config.introAfter}
          </p>
        </div>
      </div>

      {editable ? (
        <div class="config-status-bar">
          <span class="config-status-ok">
            <Icon name="server" size={14} />
            {t.config.serverModeBefore}
            <code>config.json</code>
            {t.config.serverModeAfter}
          </span>
          {dirty && <span class="config-dirty-badge">{t.config.dirtyBadge}</span>}
          <span class="config-status-spacer" />
          {dirty && (
            <button type="button" class="config-btn-secondary" onClick={onReset}>
              {t.config.discard}
            </button>
          )}
          <button type="button" class="config-btn-primary" onClick={onSave}>
            <Icon name="save" size={14} />
            {t.common.save}
          </button>
        </div>
      ) : (
        <div class="config-readonly-banner">
          <div class="config-readonly-banner-head">
            <Icon name="eye" size={15} class="dim" />
            <span class="config-readonly-title">{t.config.readonlyTitle}</span>
          </div>
          <span class="dim">
            <code>scholia export --html</code>
            {t.config.readonlyBannerMid}
            <code>scholia view</code>
            {t.config.readonlyBannerSuffix}
          </span>
        </div>
      )}

      {message && (
        <div class={message.kind === 'ok' ? 'config-message-ok' : 'config-message-error'}>
          <Icon name={message.kind === 'ok' ? 'check' : 'triangle-alert'} size={15} />
          {message.text}
        </div>
      )}

      <section class="config-section">
        <div class="config-section-head">
          <span class="config-section-icon">
            <Icon name="git-fork" size={16} />
          </span>
          <span class="config-section-title">{t.config.sections.classification.title}</span>
          <span class="dim">{t.config.sections.classification.desc}</span>
        </div>
        <TokenSetField
          label={t.config.fields.tagKinds.label}
          mono="tagKinds"
          icon="tags"
          description={t.config.fields.tagKinds.description}
          values={tagKindIDs}
          editable={editable}
          onAdd={(v) => update({ tagKinds: addTagKindID(draft.tagKinds, v) })}
          onRemove={(v) => update({ tagKinds: removeTagKindID(draft.tagKinds, v) })}
        />
        <TagKindLabelsField
          tagKinds={tagKindIDs}
          labels={draft.tagKindLabels}
          editable={editable}
          onChange={(kind, label) => update({ tagKindLabels: { ...draft.tagKindLabels, [kind]: label } })}
        />
        <TokenSetField
          label={t.config.fields.facetKinds.label}
          mono="facetKinds"
          icon="panel-left"
          description={t.config.fields.facetKinds.description}
          values={draft.facetKinds}
          editable={editable}
          subsetOf="tagKinds"
          isSubsetMember={(v) => tagKindSet.has(v)}
          onAdd={(v) => update({ facetKinds: addUnique(draft.facetKinds, v) })}
          onRemove={(v) => update({ facetKinds: draft.facetKinds.filter((x) => x !== v) })}
        />
        <TokenSetField
          label={t.config.fields.roots.label}
          mono="roots"
          icon="list-tree"
          description={t.config.fields.roots.description}
          values={draft.roots}
          editable={editable}
          onAdd={(v) => update({ roots: addUnique(draft.roots, v) })}
          onRemove={(v) => update({ roots: draft.roots.filter((x) => x !== v) })}
        />
      </section>

      <section class="config-section">
        <div class="config-section-head">
          <span class="config-section-icon">
            <Icon name="radar" size={16} />
          </span>
          <span class="config-section-title">{t.config.sections.traceability.title}</span>
          <span class="dim">{t.config.sections.traceability.desc}</span>
        </div>
        <TokenSetField
          label={t.config.fields.traceabilityKinds.label}
          mono="traceabilityKinds"
          icon="radar"
          description={t.config.fields.traceabilityKinds.description}
          values={draft.traceabilityKinds}
          editable={editable}
          subsetOf="tagKinds"
          isSubsetMember={(v) => tagKindSet.has(v)}
          onAdd={(v) => update({ traceabilityKinds: addUnique(draft.traceabilityKinds, v) })}
          onRemove={(v) => update({ traceabilityKinds: draft.traceabilityKinds.filter((x) => x !== v) })}
        />
      </section>

      <section class="config-section">
        <div class="config-section-head">
          <span class="config-section-icon">
            <Icon name="monitor" size={16} />
          </span>
          <span class="config-section-title">{t.config.sections.viewer.title}</span>
          <span class="dim">{t.config.sections.viewer.desc}</span>
        </div>
        <div class="config-field">
          <div class="config-field-head">
            <span class="config-field-icon">
              <Icon name="plug" size={14} />
            </span>
            <span class="config-field-label">{t.config.fields.port.label}</span>
            <span class="config-field-mono">viewer.port</span>
          </div>
          <p class="config-field-desc dim">
            {t.config.fields.port.descriptionBefore}
            <code>scholia view</code>
            {t.config.fields.port.descriptionAfter}
          </p>
          {editable ? (
            <input
              class="config-port-input"
              value={draft.port}
              inputMode="numeric"
              onInput={(e) => update({ port: (e.target as HTMLInputElement).value })}
            />
          ) : (
            <span class="config-port-readonly">{draft.port}</span>
          )}
        </div>
      </section>

      <section class="config-section">
        <div class="config-section-head">
          <span class="config-section-icon">
            <Icon name="pencil" size={16} />
          </span>
          <span class="config-section-title">{t.config.sections.display.title}</span>
          <span class="dim">{t.config.sections.display.desc}</span>
        </div>
        <div class="config-field">
          <div class="config-field-head">
            <span class="config-field-icon">
              <Icon name="box" size={14} />
            </span>
            <span class="config-field-label">{t.config.fields.productName.label}</span>
            <span class="config-field-mono">display.productName</span>
          </div>
          <p class="config-field-desc dim">{t.config.fields.productName.description}</p>
          {editable ? (
            <input
              class="config-port-input config-wide-input"
              value={draft.productName}
              placeholder="scholia"
              onInput={(e) => update({ productName: (e.target as HTMLInputElement).value })}
            />
          ) : (
            <span class="config-port-readonly">{draft.productName || 'scholia'}</span>
          )}
        </div>
        <div class="config-field">
          <div class="config-field-head">
            <span class="config-field-icon">
              <Icon name="scroll-text" size={14} />
            </span>
            <span class="config-field-label">{t.config.fields.tagline.label}</span>
            <span class="config-field-mono">display.tagline</span>
          </div>
          <p class="config-field-desc dim">{t.config.fields.tagline.description}</p>
          {editable ? (
            <input
              class="config-port-input config-wide-input"
              value={draft.tagline}
              placeholder={t.home.tagline}
              onInput={(e) => update({ tagline: (e.target as HTMLInputElement).value })}
            />
          ) : (
            <span class="config-port-readonly">{draft.tagline || t.home.tagline}</span>
          )}
        </div>
        <div class="config-field">
          <div class="config-field-head">
            <span class="config-field-icon">
              <Icon name="file-code-2" size={14} />
            </span>
            <span class="config-field-label">{t.config.fields.intro.label}</span>
            <span class="config-field-mono">display.intro</span>
          </div>
          <p class="config-field-desc dim">{t.config.fields.intro.description}</p>
          {editable ? (
            <textarea
              class="config-intro-textarea"
              value={draft.intro}
              rows={3}
              placeholder={t.home.intro}
              onInput={(e) => update({ intro: (e.target as HTMLTextAreaElement).value })}
            />
          ) : (
            <span class="config-port-readonly">{draft.intro}</span>
          )}
        </div>
        <div class="config-field">
          <div class="config-field-head">
            <span class="config-field-icon">
              <Icon name="clock" size={14} />
            </span>
            <span class="config-field-label">{t.config.fields.timezone.label}</span>
            <span class="config-field-mono">timezone</span>
          </div>
          <p class="config-field-desc dim">{t.config.fields.timezone.description}</p>
          {editable ? (
            <input
              class="config-port-input config-wide-input"
              value={draft.timezone}
              placeholder="UTC"
              onInput={(e) => update({ timezone: (e.target as HTMLInputElement).value })}
            />
          ) : (
            <span class="config-port-readonly">{draft.timezone || 'UTC'}</span>
          )}
        </div>
      </section>

      <section class="config-section config-section-readonly">
        <div class="config-section-head">
          <span class="config-field-icon">
            <Icon name="lock" size={14} />
          </span>
          <span class="config-section-title">{t.config.sections.readonlyMeta.title}</span>
          <span class="config-readonly-tag">read-only</span>
        </div>
        <p class="dim config-readonly-desc">
          {t.config.sections.readonlyMeta.descBefore}
          <code>scholia config</code>
          {t.config.sections.readonlyMeta.descMid}
          <code>scholia kind</code>
          {t.config.sections.readonlyMeta.descAfter}
        </p>
        <div class="config-ro-row">
          <span class="config-ro-label">{t.config.schemaVersionLabel}</span>
          <span class="config-field-mono">schemaVersion</span>
          <span class="config-ro-value">{remote.schemaVersion}</span>
        </div>
        <div class="config-ro-vocab">
          <span class="config-ro-vocab-title">
            {t.config.vocabKindsHeading} <span class="dim">· idPrefix</span>
          </span>
          {(['condition', 'action', 'effect'] as const).map((cat) => (
            <div key={cat} class="config-ro-vocab-row">
              <span class="config-ro-vocab-cat">
                {cat} <span class="config-ro-vocab-prefix">{remote.idPrefix[cat] || '—'}</span>
              </span>
              <div class="config-field-chips">
                {remote.kinds[cat].length === 0 ? (
                  <span class="dim">{t.config.undefinedMarker}</span>
                ) : (
                  remote.kinds[cat].map((v) => {
                    // #45 D9: condition は KindDecl[]（object 宣言あり）。id を表示し、
                    // description があれば tooltip に出す（kind バッジ tooltip・レイヤ6）。
                    const id = kindDeclId(v);
                    const desc = typeof v === 'string' ? undefined : v.description;
                    return (
                      <span key={id} class="config-ro-chip" title={desc || undefined}>
                        {id}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
