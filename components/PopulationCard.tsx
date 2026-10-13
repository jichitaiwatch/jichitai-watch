import ComparisonNote, { type ComparisonNoteProps } from "./ComparisonNote";
import { formatManUnit } from "@/lib/format-count";
import { toFixedHalfUp } from "@/lib/format-decimal";

interface PopulationCardProps {
  male: number;
  female: number;
  total: number;
  /**
   * 前年（r7_2025）の総人口。自団体の時系列（住基）から前年比を出すために渡す。
   * 渡されない／null のときは前年比を表示しない（欠損規律）。全国平均は市区町村版が未整備のため出さない。
   */
  totalPrior?: number | null;
  comparison?: ComparisonNoteProps;
}

/**
 * 「まちのすがた」人口カード。design/mock まちのすがた.html の表現（総人口ヒーロー数値＋男女数値＋
 * 男女按分の split-bar）を実データで再現する。按分幅は male/female の実値から算出（仮値は使わない）。
 * 前年比は自団体の住基時系列（r8_2026 と r7_2025）から算出する。年次データのため「前回調査比」ではなく
 * 「前年比」と表記する。全国平均は市区町村版の比較データが未整備のため出さない（欠損規律）。
 * 色は男女の識別であって評価ではない。増減に評価色・矢印を付けない（D-4/D-6/D-18）。
 */
export function PopulationCard({ male, female, total, totalPrior, comparison }: PopulationCardProps) {
  const denom = male + female;
  const malePct = denom > 0 ? (male / denom) * 100 : 0;
  const femalePct = denom > 0 ? 100 - malePct : 0;

  const prior = totalPrior ?? null;
  let deltaLabel: string | null = null;
  if (prior !== null) {
    const diff = total - prior;
    const sign = diff >= 0 ? "+" : "−";
    const abs = Math.abs(diff);
    const rate = prior > 0 ? `（${sign}${toFixedHalfUp((abs / prior) * 100, 1)}%）` : "";
    deltaLabel = `${sign}${formatManUnit(abs)}人${rate}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="fs-label font-extrabold text-[var(--identity)]">総人口</p>
      <p className="text-[36px] font-extrabold leading-none tracking-[-0.02em] text-[var(--identity)] sm:text-[38px]">
        {formatManUnit(total)}
        <span className="ml-0.5 text-[0.55em] font-extrabold">人</span>
      </p>

      <div className="flex items-baseline gap-1.5 fs-label font-semibold">
        <span className="text-[var(--male-text)]">男 {formatManUnit(male)}</span>
        <span className="text-[var(--muted)]">／</span>
        <span className="text-[var(--female-text)]">女 {formatManUnit(female)}</span>
      </div>

      <div
        className="flex overflow-hidden rounded-full text-center fs-sub font-extrabold leading-[1.9] text-white"
        aria-label={`男${toFixedHalfUp(malePct, 1)}%、女${toFixedHalfUp(femalePct, 1)}%`}
      >
        <span className="bg-[var(--male-text)]" style={{ width: `${malePct}%` }}>
          {toFixedHalfUp(malePct, 1)}%
        </span>
        <span
          className="border-l border-white bg-[var(--female-text)]"
          style={{ width: `${femalePct}%` }}
        >
          {toFixedHalfUp(femalePct, 1)}%
        </span>
      </div>

      {deltaLabel && (
        <p className="fs-sub text-[var(--muted)]">
          前年比 <span className="font-semibold text-[var(--body)]">{deltaLabel}</span>
        </p>
      )}

      {comparison && <ComparisonNote {...comparison} />}
    </div>
  );
}
