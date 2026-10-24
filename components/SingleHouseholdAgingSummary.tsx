import { t } from "@/lib/i18n";
import ComparisonNote, { type ComparisonNoteProps } from "./ComparisonNote";

interface SingleHouseholdAgingSummaryProps {
  singleHouseholdRatio: number;
  agingRate: number;
  singleHouseholdComparison?: ComparisonNoteProps;
  agingComparison?: ComparisonNoteProps;
}

/** 比率ドーナツ（design/mock まちのすがた.html の .donut を再現）。塗り＝実値の割合、残りは中立の軌道色。 */
function Donut({ value, colorVar, textVar }: { value: number; colorVar: string; textVar: string }) {
  return (
    <div
      className="relative mx-auto grid h-[var(--donut)] w-[var(--donut)] place-items-center rounded-full"
      style={{ background: `conic-gradient(${colorVar} 0 ${value}%, var(--line) ${value}% 100%)` }}
    >
      <div className="absolute h-[calc(var(--donut)*0.78)] w-[calc(var(--donut)*0.78)] rounded-full bg-[var(--surface)]" />
      <span className="relative z-[1] fs-donut font-extrabold" style={{ color: textVar }}>
        {value}%
      </span>
    </div>
  );
}

/**
 * 「まちのすがた」単身世帯・高齢化カード。design/mock の表現（ドーナツ×2）を実データで再現する。
 * 単身世帯割合＝紫（--single）、高齢化率＝金（--aging）。色は指標の識別であって評価ではない（D-4/D-6/D-18）。
 * 全国順位・類似団体平均はF-5（2026-09-28）でdata/m1_1b_single_household.json・
 * data/m1_1c_aging_rate.jsonへcomparison付与済みのため表示する（旧コメント「比較データ未整備のため
 * 出さない」は解消済み）。
 */
export function SingleHouseholdAgingSummary({
  singleHouseholdRatio,
  agingRate,
  singleHouseholdComparison,
  agingComparison,
}: SingleHouseholdAgingSummaryProps) {
  return (
    <div className="pair-grid grid gap-3 [grid-template-columns:repeat(var(--pair-cols),minmax(0,1fr))]">
      <div className="flex flex-col gap-2">
        <p className="flex min-h-[2.7em] items-end justify-center text-center fs-label font-semibold text-[var(--muted)]">{t("pop-one-person-share")}</p>
        <Donut value={singleHouseholdRatio} colorVar="var(--single)" textVar="var(--single-text)" />
        {singleHouseholdComparison && <ComparisonNote {...singleHouseholdComparison} />}
      </div>
      <div className="flex flex-col gap-2">
        <p className="flex min-h-[2.7em] items-end justify-center text-center fs-label font-semibold text-[var(--muted)]">{t("sha-ageing-label")}</p>
        <Donut value={agingRate} colorVar="var(--aging)" textVar="var(--aging-text)" />
        {agingComparison && <ComparisonNote {...agingComparison} />}
      </div>
    </div>
  );
}
