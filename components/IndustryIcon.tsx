import type { ReactNode } from "react";

/**
 * 意匠の出典: Lucide (https://lucide.dev, ISC License)。パスは手動転記。npm依存としては未導入（B案・依存最小方針）。
 * 許諾条件（著作権表示と許諾文）の原本は THIRD_PARTY_NOTICES.md。サイトでは /data「素材の出典について」に全文を表示する。
 *
 * 国勢調査・産業大分類20区分（A〜T）に対応するアイコン・色マップ。
 * 色は産業分類の識別色であって評価色ではない（D-4/D-6）。
 */

interface IndustryIconDef {
  color: string;
  bg: string;
  path: ReactNode;
}

const INDUSTRY_ICONS: Record<string, IndustryIconDef> = {
  "農業，林業": {
    color: "#6b8f45",
    bg: "#eaf0e0",
    path: (
      <>
        <path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20" />
        <path d="M16 18h-5" />
        <path d="M18 5a1 1 0 0 0-1 1v5.573" />
        <path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246" />
        <path d="M4 11V4" />
        <path d="M7 15h.01" />
        <path d="M8 10.1V4" />
        <circle cx="18" cy="18" r="2" />
        <circle cx="7" cy="15" r="5" />
      </>
    ),
  },
  漁業: {
    color: "#3f8f9e",
    bg: "#e2f1f3",
    path: (
      <>
        <path d="M6.5 12c.9-3.5 4.9-6 8.5-6 3.6 0 6.1 2.5 7 6-.9 3.5-3.4 6-7 6-3.6 0-7.6-2.5-8.5-6Z" />
        <path d="M18 12v.01" />
        <path d="M16 17.9a9.8 9.8 0 0 1 0-11.9" />
        <path d="M7 10.7C7 8 5.6 6 2.7 5.5c-1 1.5-1 5 .2 6.5-1.2 1.5-1.2 5-.2 6.5C5.6 18 7 16 7 13.3" />
      </>
    ),
  },
  "鉱業，採石業，砂利採取業": {
    color: "#a97a4a",
    bg: "#f2e8dc",
    path: (
      <>
        <path d="M14.5 12.5 6.6 20.4a1 1 0 1 1-3-3l7.9-7.9" />
        <path d="M17.6 6.6c-.2-1-.7-2-1.5-2.8a2.8 2.8 0 0 0-3-.6l-3.2 3.2a2.5 2.5 0 0 0 0 3.5l.8.8a2.5 2.5 0 0 0 3.5 0l3.2-3.2c.6-.6.8-1.3.6-2Z" />
        <path d="M22.5 21.5 7 6" />
      </>
    ),
  },
  建設業: {
    color: "#cf7a3f",
    bg: "#faeade",
    path: (
      <>
        <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" />
        <path d="m18 15 4-4" />
        <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
      </>
    ),
  },
  製造業: {
    color: "#4d76a3",
    bg: "#e3ebf3",
    path: (
      <>
        <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4l-4 3v13H2Z" />
        <path d="M17 18h1" />
        <path d="M12 18h1" />
        <path d="M7 18h1" />
      </>
    ),
  },
  "電気・ガス・熱供給・水道業": {
    color: "#c9a13a",
    bg: "#f7f0dc",
    path: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />,
  },
  情報通信業: {
    color: "#3f8f95",
    bg: "#e1f1f1",
    path: (
      <>
        <path d="M5 13a10 10 0 0 1 14 0" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0" />
        <path d="M2 8.8a15 15 0 0 1 20 0" />
        <path d="M12 20h.01" />
      </>
    ),
  },
  "運輸業，郵便業": {
    color: "#c0604f",
    bg: "#f6e3e0",
    path: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 6-10 7L2 6" />
      </>
    ),
  },
  "卸売業，小売業": {
    color: "#3f7d68",
    bg: "#e4f0ea",
    path: (
      <>
        <circle cx="8.5" cy="20.5" r="1.5" />
        <circle cx="19.5" cy="20.5" r="1.5" />
        <path d="M2.3 2.3h2l2.7 12.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21.8 6H5.1" />
      </>
    ),
  },
  "金融業，保険業": {
    color: "#ab8a35",
    bg: "#f4eed9",
    path: (
      <>
        <path d="M3 22h18" />
        <path d="M6 18v-9" />
        <path d="M10 18v-9" />
        <path d="M14 18v-9" />
        <path d="M18 18v-9" />
        <path d="M2 8 12 2l10 6" />
        <path d="M2 22V9" />
        <path d="M22 22V9" />
      </>
    ),
  },
  "不動産業，物品賃貸業": {
    color: "#bd6f4a",
    bg: "#f3e4da",
    path: (
      <>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        <path d="M9 22V12h6v10" />
      </>
    ),
  },
  "学術研究，専門・技術サービス業": {
    color: "#7d5fa8",
    bg: "#ece6f4",
    path: (
      <>
        <path d="M9 2v6l-5.5 9.5A2 2 0 0 0 5.2 21h13.5a2 2 0 0 0 1.8-3.5L15 8V2" />
        <path d="M8.5 2h7" />
        <path d="M8 16h8" />
      </>
    ),
  },
  "宿泊業，飲食サービス業": {
    color: "#d1745f",
    bg: "#f8e6e1",
    path: (
      <>
        <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
        <path d="M7 5V2" />
        <path d="M11 5V2" />
        <path d="M15 5V2" />
        <path d="M2 12h20" />
      </>
    ),
  },
  "生活関連サービス業，娯楽業": {
    color: "#a8508f",
    bg: "#f3e1ee",
    path: (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M20 4 8.1 15.9" />
        <path d="M14.5 14.5 20 20" />
        <path d="M8.1 8.1 12 12" />
      </>
    ),
  },
  "教育，学習支援業": {
    color: "#4a68ab",
    bg: "#e3e8f3",
    path: (
      <>
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
        <path d="M22 10v6" />
      </>
    ),
  },
  "医療，福祉": {
    color: "#d1607e",
    bg: "#f8e3e9",
    path: (
      <>
        <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
        <path d="M3.2 12h6.3l.5-1 2 4.5 2-7 1.5 3.5h5.3" />
      </>
    ),
  },
  複合サービス事業: {
    color: "#6f6f9e",
    bg: "#e7e7f2",
    path: (
      <>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </>
    ),
  },
  "サービス業（他に分類されないもの）": {
    color: "#4f8a80",
    bg: "#e2eeeb",
    path: (
      <>
        <path d="M11 17 13 19a1 1 0 1 0 3-3" />
        <path d="M9 19 11 21a1 1 0 1 0 3-3" />
        <path d="M2 14h1a4 4 0 0 0 4-4V9" />
        <path d="M2 14v6" />
        <path d="M22 14v6" />
        <path d="M22 14h-1a4 4 0 0 1-4-4V9" />
        <path d="m13 14-3-3-4 4-2-2 6-6 4 4 4-4 6 6-2 2-4-4-3 3Z" />
      </>
    ),
  },
  "公務（他に分類されるものを除く）": {
    color: "#445e80",
    bg: "#dfe5ec",
    path: (
      <>
        <path d="M4 22V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v18" />
        <path d="M4 22h16" />
        <path d="M19 22V9a1 1 0 0 1 1-1h1v14" />
        <path d="M8 6h1" />
        <path d="M8 10h1" />
        <path d="M8 14h1" />
        <path d="M12 6h1" />
        <path d="M12 10h1" />
        <path d="M12 14h1" />
        <path d="M8 18h5" />
      </>
    ),
  },
  分類不能の産業: {
    color: "#8c8c8c",
    bg: "#ececec",
    path: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </>
    ),
  },
};

// 未知業種フォールバック：見た目は「分類不能の産業」と同じ（help-circle・グレー）だが、
// データ上の未対応値を示すものであり「分類不能の産業」という国勢調査区分そのものと誤認させない。
const UNKNOWN_FALLBACK: IndustryIconDef = INDUSTRY_ICONS["分類不能の産業"];

function normalizeIndustryName(name: string): string {
  return name
    .replace(/[，,]/g, "，")
    .replace(/[・]/g, "・")
    .replace(/\s+/g, "")
    .trim();
}

const NORMALIZED_LOOKUP: Record<string, IndustryIconDef> = Object.fromEntries(
  Object.entries(INDUSTRY_ICONS).map(([key, value]) => [normalizeIndustryName(key), value]),
);

function resolveIndustryIcon(industryName: string): IndustryIconDef {
  return NORMALIZED_LOOKUP[normalizeIndustryName(industryName)] ?? UNKNOWN_FALLBACK;
}

export function IndustryIcon({
  industryName,
  size = 20,
  className,
}: {
  industryName: string;
  size?: number;
  className?: string;
}) {
  const { color, path } = resolveIndustryIcon(industryName);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {path}
    </svg>
  );
}

export function getIndustryIconColors(industryName: string): { color: string; bg: string } {
  const { color, bg } = resolveIndustryIcon(industryName);
  return { color, bg };
}
