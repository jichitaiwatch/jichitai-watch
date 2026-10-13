import ComparisonNote, { type ComparisonNoteProps } from "./ComparisonNote";
import { toFixedHalfUp } from "@/lib/format-decimal";

interface DaynightRatioStatProps {
  ratio: number;
  comparison?: ComparisonNoteProps;
}

// 目盛り軸のスケール（原本 まちのすがた.html の 90〜130）
const MIN = 90;
const MAX = 130;
const TICKS = [90, 100, 110, 120, 130];
const posLeft = (v: number) =>
  `calc(1.5rem + (100% - 3rem) * ${Math.min(1, Math.max(0, (v - MIN) / (MAX - MIN)))})`;

/**
 * 「まちのすがた」昼夜間人口比率カード。design/mock の day-grid 表現（ヒーロー数値＋目盛り軸に当該団体の
 * 位置マーカー）を実データ（ratio）で再現する。原本の「類似団体平均マーカー・前回比」は比較データ未整備の
 * ため出さない（欠損規律）。100超＝昼間流入は事実の定義文のみ添える。増減の評価語・評価色は付けない（D-4/D-6/D-18）。
 */
export function DaynightRatioStat({ ratio, comparison }: DaynightRatioStatProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[104px_1fr] items-center gap-3 sm:grid-cols-[132px_1fr]">
        <p className="whitespace-nowrap text-[36px] font-extrabold leading-none tracking-[-0.02em] text-[var(--identity)] sm:text-[38px]">
          {toFixedHalfUp(ratio, 1)}
        </p>

        <div className="relative h-[72px]" aria-hidden>
          {/* 昼夜テーマの装飾 */}
          <span className="absolute left-0 top-2 font-serif text-[28px] leading-none" style={{ color: "#f4a11b" }}>
            ☀
          </span>
          <span className="absolute right-0 top-2 font-serif text-[28px] leading-none" style={{ color: "#949872" }}>
            ☾
          </span>

          {/* 目盛り軸 */}
          <div className="absolute inset-x-6 bottom-5 h-0.5 bg-[var(--muted)]" />
          {TICKS.map((t) => (
            <div key={t} className="absolute bottom-3.5" style={{ left: posLeft(t) }}>
              <div className="h-2 w-px bg-[var(--muted)]" />
              <span className="absolute left-1/2 top-2 -translate-x-1/2 fs-note text-[var(--muted)]">
                {t}
              </span>
            </div>
          ))}

          {/* 当該団体マーカー（比較＝類似団体平均は未整備のため非表示）。色は☀と同系の琥珀（--daynight-marker・2026-10-03運営者裁定）。
              全国平均のオレンジ（--national）とは別色にし、比較値と読み違えないようにする */}
          <div className="absolute bottom-5 -translate-x-1/2 text-[var(--daynight-marker)]" style={{ left: posLeft(ratio) }}>
            <div className="h-7 w-0.5 bg-current" />
            <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-current" />
          </div>
        </div>
      </div>

      <p className="fs-sub text-[var(--muted)]">100超は昼間人口が夜間人口を上回ることを示します</p>
      {comparison && <ComparisonNote {...comparison} />}
    </div>
  );
}
