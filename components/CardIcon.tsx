import type { ReactNode } from "react";

/**
 * カード見出し左のアイコン識別子。geometry は design/mock（各すがた.html の <symbol> または title-icon の
 * インラインSVG）実測をそのまま転記。append-only：新規は末尾に足すだけ。既存の綴り・形は変更しない。
 * アイコンは識別であって評価ではない（D-4/D-6/D-12）。gikai系は viewBox 40×40・ストローク＋塗り混在。
 * くらしは原本受領後に追加する。
 */
export type CardIconId =
  | "person"
  | "building"
  | "gauge"
  | "bars"
  | "people"
  | "house"
  | "demographic"
  | "pie"
  | "industry-bars"
  | "daynight"
  | "gikai-chair"
  | "gikai-seats"
  | "gikai-kaiha"
  | "gikai-cost"
  | "gikai-minutes";

/** 既定 viewBox は 0 0 24 24。gikai系のみ 0 0 40 40（原本 title-icon の実測に合わせる） */
const VIEWBOX: Partial<Record<CardIconId, string>> = {
  "gikai-chair": "0 0 40 40",
  "gikai-seats": "0 0 40 40",
  "gikai-kaiha": "0 0 40 40",
  "gikai-cost": "0 0 40 40",
  "gikai-minutes": "0 0 40 40",
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const PATHS: Record<CardIconId, ReactNode> = {
  // 行政のすがた.html
  person: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4.5 21c.4-5.2 3.1-8 7.5-8s7.1 2.8 7.5 8h-15Z" />
    </>
  ),
  building: <path d="M3 21V8l9-5 9 5v13h-5v-5h-8v5H3Zm4-9h3V9H7v3Zm7 0h3V9h-3v3Z" />,
  gauge: <path d="M4.2 19a9 9 0 1 1 15.6 0h-3a6.3 6.3 0 1 0-9.6 0h-3Zm6.5-4.2 5.7-5.3-3.7 6.9-2-1.6Z" />,
  bars: <path d="M3 19h18v2H3v-2Zm2-2V9h4v8H5Zm6 0V4h4v13h-4Zm6 0v-6h4v6h-4Z" />,

  // まちのすがた.html
  people: (
    <>
      <circle cx="12" cy="6" r="3" />
      <circle cx="5.5" cy="8" r="2.2" />
      <circle cx="18.5" cy="8" r="2.2" />
      <path d="M7.8 19v-4.1c0-2.8 1.8-4.7 4.2-4.7s4.2 1.9 4.2 4.7V19H7.8ZM1.8 19v-3.5c0-2.3 1.5-3.8 3.7-3.8 1 0 1.8.3 2.5.8-.9 1.1-1.4 2.5-1.4 4.2V19H1.8Zm15.6 0v-2.3c0-1.7-.5-3.1-1.4-4.2.7-.5 1.5-.8 2.5-.8 2.2 0 3.7 1.5 3.7 3.8V19h-4.8Z" />
    </>
  ),
  house: <path d="M3 11 12 3l9 8v10H3V11Zm3 0v7h4v-5h4v5h4v-7l-6-5.3L6 11Z" />,
  demographic: (
    <>
      <circle cx="7" cy="6" r="2.5" />
      <path d="M3.5 19v-7c0-2 1.4-3.4 3.5-3.4s3.5 1.4 3.5 3.4v7h-7Z" />
      <circle cx="16.2" cy="6.3" r="2.4" />
      <path d="M12.8 19v-6.3c0-2.2 1.4-3.7 3.4-3.7 2.2 0 3.6 1.5 3.6 3.7v3.2H22V18h-2.2v1h-7Z" />
    </>
  ),
  pie: (
    <>
      <path d="M11 2a10 10 0 1 0 10 11H11V2Z" />
      <path d="M13 2.2V11h8.8A10 10 0 0 0 13 2.2Z" opacity=".7" />
    </>
  ),
  "industry-bars": (
    <>
      <rect x="3" y="13" width="4" height="8" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </>
  ),
  daynight: (
    <>
      <circle cx="6.5" cy="12" r="3.2" />
      <path
        d="M6.5 2.7v4.6M6.5 16.7v4.6M.3 12h1.5M11.2 12h1M1.8 7.3 3 8.5M10 15.5l1.2 1.2M1.8 16.7 3 15.5M10 8.5l1.2-1.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="19" cy="12" r="5.4" />
      <circle cx="21.5" cy="9.5" r="5.4" fill="var(--identity)" />
    </>
  ),

  // 議会のすがた.html（viewBox 40×40・頭部は塗り・線はストローク）
  "gikai-chair": (
    <>
      <circle cx="11" cy="11" r="3" fill="currentColor" />
      <circle cx="29" cy="11" r="3" fill="currentColor" />
      <circle cx="20" cy="15" r="4" fill="currentColor" />
      <path d="M11 15v7m18-7v7M14 27l3-8h6l3 8M8 27h24v7M11 34v3m18-3v3" {...STROKE} />
    </>
  ),
  "gikai-seats": (
    <>
      <circle cx="10" cy="12" r="4" fill="currentColor" />
      <circle cx="20" cy="9" r="4.5" fill="currentColor" />
      <circle cx="30" cy="12" r="4" fill="currentColor" />
      <path d="M4 30l3-11 5 3 3 8M13 30l3-13 4 3 4-3 3 13M27 30l3-8 5-3 3 11M19 18l2 6" {...STROKE} />
    </>
  ),
  "gikai-kaiha": (
    <>
      <circle cx="20" cy="8" r="3.5" fill="currentColor" />
      <circle cx="8" cy="17" r="3.5" fill="currentColor" />
      <circle cx="32" cy="17" r="3.5" fill="currentColor" />
      <path d="M20 12v9M11 20l5 4m13-4-5 4" {...STROKE} />
    </>
  ),
  "gikai-cost": (
    <>
      <path d="M4 16 15 6l11 10M6 17h18v11H6zM10 18v10m5-10v10m5-10v10M4 28h22" {...STROKE} />
      <rect x="24" y="17" width="12" height="16" rx="2" {...STROKE} />
      <path d="M27 20h6m-6 4h2m3 0h1m-6 4h2m3 0h1" {...STROKE} />
    </>
  ),
  "gikai-minutes": (
    <>
      <rect x="6" y="4" width="20" height="31" rx="3" {...STROKE} />
      <path d="M10 12h12m-12 6h12m-12 6h8M6 9H3m3 7H3m3 7H3M26 30 36 10m0 0-1 7m1-7-7 1" {...STROKE} />
    </>
  ),
};

export function CardIcon({ id, className }: { id: CardIconId; className?: string }) {
  return (
    <svg viewBox={VIEWBOX[id] ?? "0 0 24 24"} fill="currentColor" aria-hidden className={className}>
      {PATHS[id]}
    </svg>
  );
}
