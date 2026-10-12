import ComparisonNote, { type ComparisonNoteProps } from "./ComparisonNote";

interface IndustryCompositionSummaryProps {
  primaryPct: number;
  secondaryPct: number;
  tertiaryPct: number;
  /** 第1〜3次産業の就業者数（人）。未収集/未接続時はnullで「人数」行を出さない（欠損規律）。 */
  primaryCount?: number | null;
  secondaryCount?: number | null;
  tertiaryCount?: number | null;
  primaryComparison?: ComparisonNoteProps;
  secondaryComparison?: ComparisonNoteProps;
  tertiaryComparison?: ComparisonNoteProps;
}

/** セクターのイラスト（design/mock まちのすがた.html の <symbol> viewBox 0 0 48 40 を転記） */
const FIGURES = {
  plant: (
    <path d="M23 36V17m0 9c-7-1-11-5-12-11 7 0 11 4 12 11Zm1-5c1-7 5-11 13-12-1 8-5 12-13 12ZM8 37c5-6 27-6 32 0H8Z" />
  ),
  factory: (
    <path d="M6 37V18l11 6v-7l11 7v-9h12v22H6Zm26-26h5V4h-5v7ZM11 29h5v4h-5v-4Zm9 0h5v4h-5v-4Zm9 0h5v4h-5v-4Z" />
  ),
  city: (
    <path d="M5 37V18h13v19H5Zm15 0V8h13v29H20Zm15 0V15h9v22h-9ZM9 22h3v3H9v-3Zm0 7h3v3H9v-3Zm15-16h4v4h-4v-4Zm0 7h4v4h-4v-4Zm0 7h4v4h-4v-4Zm14-8h3v3h-3v-3Zm0 6h3v3h-3v-3Z" />
  ),
} as const;

function Sector({
  label,
  pct,
  count,
  colorVar,
  textVar,
  bgVar,
  figure,
  comparison,
}: {
  label: string;
  pct: number;
  count?: number | null;
  colorVar: string;
  textVar: string;
  bgVar: string;
  figure: keyof typeof FIGURES;
  comparison?: ComparisonNoteProps;
}) {
  return (
    <div
      className="sector-box flex flex-col items-center rounded-md border p-2.5 sm:p-3"
      style={{ color: textVar, background: bgVar, borderColor: colorVar }}
    >
      <div className="sector-label mb-2 flex items-center justify-center gap-1.5 fs-label font-extrabold">
        <span className="h-[9px] w-[9px] rounded-full" style={{ background: colorVar }} />
        {label}
      </div>
      <svg viewBox="0 0 48 40" className="sector-icon mb-1 block h-[38px] w-[44px]" fill={colorVar} aria-hidden>
        {FIGURES[figure]}
      </svg>
      <div className="sector-pct flex flex-col items-center gap-0 sm:flex-row sm:items-baseline sm:gap-1">
        <span className="fs-sub text-[var(--muted)]">構成比</span>
        <b className="fs-key font-extrabold text-[var(--ink)]">{pct}%</b>
      </div>
      {count != null && (
        <p className="sector-count mt-0.5 fs-sub text-[var(--muted)]">{count.toLocaleString()}人</p>
      )}
      {comparison && (
        <div className="sector-cmp w-full [&_p]:text-center">
          <ComparisonNote {...comparison} />
        </div>
      )}
    </div>
  );
}

/**
 * 「まちのすがた」産業別就業者構成比カード。design/mock の表現（第1〜3次のセクター箱＝イラスト＋構成比）を
 * 実データ（3区分の%・人数）で再現する。色は産業分類の識別であって評価色ではない（D-4/D-6/D-18）。
 * 就業者数（区分別）はIndustryRow/PrefIndustryRowに実在するため表示する（2026-09-27・A-24）。
 * 全国順位・類似団体平均はF-5（2026-09-28）でdata/m1_2a_industry.jsonへcomparison付与済みのため表示する
 * （旧コメント「実データ未整備のため出さない」は事実誤認だった。primary/secondary/tertiaryComparisonは
 * propsに存在していたが本体側で未使用のままレンダリングされていなかった不具合も本対応で解消）。
 */
export function IndustryCompositionSummary({
  primaryPct,
  secondaryPct,
  tertiaryPct,
  primaryCount,
  secondaryCount,
  tertiaryCount,
  primaryComparison,
  secondaryComparison,
  tertiaryComparison,
}: IndustryCompositionSummaryProps) {
  return (
    <div className="sector-grid grid gap-2 [grid-template-columns:repeat(var(--ind-cols),minmax(0,1fr))]">
      <Sector label="第1次産業" pct={primaryPct} count={primaryCount} colorVar="var(--sector1)" textVar="var(--sector1-text)" bgVar="var(--sector1-bg)" figure="plant" comparison={primaryComparison} />
      <Sector label="第2次産業" pct={secondaryPct} count={secondaryCount} colorVar="var(--sector2)" textVar="var(--sector2-text)" bgVar="var(--sector2-bg)" figure="factory" comparison={secondaryComparison} />
      <Sector label="第3次産業" pct={tertiaryPct} count={tertiaryCount} colorVar="var(--sector3)" textVar="var(--sector3-text)" bgVar="var(--sector3-bg)" figure="city" comparison={tertiaryComparison} />
    </div>
  );
}
