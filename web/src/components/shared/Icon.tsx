import type { JSX } from 'preact';

// Inline SVG icon registry (.concierge/decision.md §D): the design
// references iconify's `lucide:*` set via a CDN script, which the
// self-contained viewer (file:// export) cannot load. Each entry below is
// copied from lucide-static's source (MIT, 24x24, stroke-based) as plain
// path/shape data — no npm dependency, no network fetch at runtime. Grown
// incrementally: only the icons a given phase's components actually render
// are added here, not all ~57 the full design uses.
type Shape =
  | { tag: 'path'; d: string }
  | { tag: 'circle'; cx: number; cy: number; r: number }
  | { tag: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx?: number };

const ICONS = {
  sun: [
    { tag: 'circle', cx: 12, cy: 12, r: 4 },
    { tag: 'path', d: 'M12 2v2' },
    { tag: 'path', d: 'M12 20v2' },
    { tag: 'path', d: 'm4.93 4.93 1.41 1.41' },
    { tag: 'path', d: 'm17.66 17.66 1.41 1.41' },
    { tag: 'path', d: 'M2 12h2' },
    { tag: 'path', d: 'M20 12h2' },
    { tag: 'path', d: 'm6.34 17.66-1.41 1.41' },
    { tag: 'path', d: 'm19.07 4.93-1.41 1.41' },
  ],
  moon: [
    {
      tag: 'path',
      d: 'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401',
    },
  ],
  plus: [
    { tag: 'path', d: 'M5 12h14' },
    { tag: 'path', d: 'M12 5v14' },
  ],
  minus: [{ tag: 'path', d: 'M5 12h14' }],
  'message-plus': [
    { tag: 'path', d: 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z' },
    { tag: 'path', d: 'M12 8v6' },
    { tag: 'path', d: 'M9 11h6' },
  ],
  'message-filled': [
    { tag: 'path', d: 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z' },
    { tag: 'path', d: 'M7 11h10' },
    { tag: 'path', d: 'M7 15h6' },
    { tag: 'path', d: 'M7 7h8' },
  ],
  x: [
    { tag: 'path', d: 'M18 6 6 18' },
    { tag: 'path', d: 'm6 6 12 12' },
  ],
  'trash-2': [
    { tag: 'path', d: 'M10 11v6' },
    { tag: 'path', d: 'M14 11v6' },
    { tag: 'path', d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
    { tag: 'path', d: 'M3 6h18' },
    { tag: 'path', d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
  ],
  crosshair: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'line', x1: 22, y1: 12, x2: 18, y2: 12 },
    { tag: 'line', x1: 6, y1: 12, x2: 2, y2: 12 },
    { tag: 'line', x1: 12, y1: 6, x2: 12, y2: 2 },
    { tag: 'line', x1: 12, y1: 22, x2: 12, y2: 18 },
  ],
  pencil: [
    {
      tag: 'path',
      d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
    },
    { tag: 'path', d: 'm15 5 4 4' },
  ],
  'clipboard-copy': [
    { tag: 'rect', x: 8, y: 2, width: 8, height: 4, rx: 1 },
    { tag: 'path', d: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2' },
    { tag: 'path', d: 'M16 4h2a2 2 0 0 1 2 2v4' },
    { tag: 'path', d: 'M21 14H11' },
    { tag: 'path', d: 'm15 10-4 4 4 4' },
  ],
  check: [{ tag: 'path', d: 'M20 6 9 17l-5-5' }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  class?: string;
}

export function Icon({ name, size = 16, class: className }: Props) {
  const shapes = ICONS[name];
  return (
    <svg
      class={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {shapes.map((s, i): JSX.Element => {
        if (s.tag === 'circle') return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />;
        if (s.tag === 'line') return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />;
        if (s.tag === 'rect') return <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} />;
        return <path key={i} d={s.d} />;
      })}
    </svg>
  );
}
