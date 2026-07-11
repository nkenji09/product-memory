import { strings } from '../../strings';
import { Chip } from '../shared/Chip';
import { Icon } from '../shared/Icon';

export interface KindOption {
  key: string;
  label: string;
  count: number;
}

export interface ConditionChip {
  label: string;
  color: string;
  onRemove: () => void;
}

export interface IndexItem {
  id: string;
  label: string;
  color: string;
  indent: number;
  isGap?: boolean;
  onClick: () => void;
}

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  kindFacet: string;
  kindOptions: KindOption[];
  onKindFacetChange: (k: string) => void;
  conditions: ConditionChip[];
  onClearConditions: () => void;
  indexItems: IndexItem[];
}

export function BrowseRail({ query, onQueryChange, kindFacet, kindOptions, onKindFacetChange, conditions, onClearConditions, indexItems }: Props) {
  return (
    <aside class="browse-rail">
      <div class="browse-rail-head">
        <Icon name="sliders-horizontal" size={14} class="dim" />
        <span class="browse-rail-label dim">検索条件</span>
      </div>

      <div class="browse-rail-search-wrap">
        <Icon name="search" size={15} class="browse-rail-search-icon dim" />
        <input
          class="browse-rail-search"
          type="text"
          placeholder={strings.browse.searchPlaceholder}
          value={query}
          onInput={(e) => onQueryChange((e.target as HTMLInputElement).value)}
        />
      </div>

      {kindOptions.length > 0 && (
        <div class="browse-rail-section">
          <span class="browse-rail-label dim">種別</span>
          <div class="browse-rail-kinds">
            <button type="button" class={'browse-rail-kind' + (kindFacet === 'all' ? ' active' : '')} onClick={() => onKindFacetChange('all')}>
              <span>{strings.browse.kindAll}</span>
              <span class="dim">{kindOptions.reduce((sum, k) => sum + k.count, 0)}</span>
            </button>
            {kindOptions.map((k) => (
              <button
                key={k.key}
                type="button"
                class={'browse-rail-kind' + (kindFacet === k.key ? ' active' : '')}
                onClick={() => onKindFacetChange(k.key)}
              >
                <span>{k.label}</span>
                <span class="dim">{k.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {conditions.length > 0 && (
        <div class="browse-rail-conditions">
          <div class="browse-rail-conditions-head">
            <span class="browse-rail-label dim">
              <Icon name="filter" size={13} /> {strings.browse.conditionsHeading} <span class="browse-rail-and">{strings.browse.and}</span>
            </span>
            <button type="button" class="browse-rail-clear" onClick={onClearConditions}>
              {strings.browse.clear}
            </button>
          </div>
          <div class="browse-rail-condition-chips">
            {conditions.map((c, i) => (
              <Chip key={i} color={c.color} onRemove={c.onRemove}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div class="browse-rail-section browse-rail-index">
        <span class="browse-rail-label dim">
          <Icon name="list" size={13} /> {strings.browse.indexHeading} <span class="browse-rail-index-count">{indexItems.length}</span>
        </span>
        <div class="browse-rail-index-list">
          {indexItems.map((item) => (
            <button
              key={item.id}
              type="button"
              class="browse-rail-index-item"
              style={{ paddingLeft: `${8 + item.indent * 14}px` }}
              onClick={item.onClick}
            >
              <span class="browse-rail-index-dot" style={{ background: item.color }} />
              <span class="browse-rail-index-label">{item.label}</span>
              {item.isGap && (
                <span class="browse-rail-index-gap">
                  <Icon name="triangle-alert" size={12} />
                </span>
              )}
            </button>
          ))}
          {indexItems.length === 0 && <span class="dim browse-rail-index-empty">{strings.browse.indexEmpty}</span>}
        </div>
      </div>
    </aside>
  );
}
