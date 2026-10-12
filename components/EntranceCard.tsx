import Link from "next/link";
import type { EntranceSummaryItem } from "@/lib/card-registry";

interface EntranceCardProps {
  href: string;
  label: string;
  summary?: EntranceSummaryItem[];
}

/**
 * 入口画面（4カード：まち／行政／議会／くらし）用のリンクカード。
 * 中身のサマリー表示（0-1〜0-4）は#19実装済み（content-spec-v1.md §7.15が正本）。
 * 並び順はENTRANCE_TABS配列順・summary配列順であって優劣ではない（D-4/D-6/D-12）。
 * サマリーは事実の文字列のみで、強調色・信号色・順位バッジ・矢印色分け等は付けない。
 */
export function EntranceCard({ href, label, summary }: EntranceCardProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-6 text-center shadow-sm transition hover:border-teal-300 hover:shadow-md sm:min-h-[120px]"
    >
      <span className="fs-title font-semibold text-teal-950">{label}</span>
      {summary && summary.length > 0 && (
        <div className="mt-1 flex flex-col gap-0.5">
          {summary.map((item) => (
            <span key={item.label} className="fs-sub text-stone-600">
              {item.label}：{item.value}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
