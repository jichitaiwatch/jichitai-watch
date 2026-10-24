import { t, tf } from "@/lib/i18n";
import ComparisonNote, { type ComparisonNoteProps } from "./ComparisonNote";
import { formatManUnit } from "@/lib/format-count";
import { toFixedHalfUp } from "@/lib/format-decimal";

interface HouseholdCountCardProps {
  households: number;
  /**
   * 前年（r7_2025）の世帯数。自団体の住基時系列から前年比を出すために渡す。
   * 渡されない／null のときは前年比を表示しない（欠損規律）。全国平均は市区町村版が未整備のため出さない。
   */
  householdsPrior?: number | null;
  comparison?: ComparisonNoteProps;
}

/**
 * 「まちのすがた」2枚目カード（§0.7案A）。住基世帯数の最新年（r8_2026）を表示する。
 * 人口カード（PopulationCard）と同一データソース（m1_1a_population_timeseries.json）の異なる切り出し。
 * 前年比は自団体の住基時系列（r8_2026 と r7_2025）から算出する。年次データのため「前年比」と表記する。
 * 全国平均は市区町村版が未整備のため出さない（欠損規律）。増減に評価色・矢印を付けない（D-4/D-6/D-18）。
 */
export function HouseholdCountCard({
  households,
  householdsPrior,
  comparison,
}: HouseholdCountCardProps) {
  const prior = householdsPrior ?? null;
  let deltaLabel: string | null = null;
  if (prior !== null) {
    const diff = households - prior;
    const sign = diff >= 0 ? "+" : "−";
    const abs = Math.abs(diff);
    const rate = prior > 0 ? tf("p-delta-rate", { sign, pct: toFixedHalfUp((abs / prior) * 100, 1) }) : "";
    deltaLabel = `${tf("p-households", { n: `${sign}${formatManUnit(abs)}` })}${rate}`;
  }

  return (
    <div className="text-center">
      <p className="text-[36px] font-bold leading-none text-[var(--current)] sm:text-[38px]">
        {tf("p-households", { n: formatManUnit(households) })}
      </p>
      {deltaLabel && (
        <p className="mt-1 fs-sub text-[var(--muted)]">
          {t("fin-yoy")}<span className="font-semibold text-[var(--body)]">{deltaLabel}</span>
        </p>
      )}
      {comparison && <ComparisonNote {...comparison} />}
    </div>
  );
}
