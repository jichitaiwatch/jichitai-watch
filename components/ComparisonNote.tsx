export interface ComparisonNoteProps {
  rankText: string;    // 例 "全国17位／47"
  averageText: string; // 例 "全国平均（加重平均）：31.4%"
}

/**
 * 比較注記。事実の2行のみ。評価色・アイコン・上下矢印は付けない
 * （中立性・20260808_decisions.md D-4/D-6/D-18）。
 */
export function ComparisonNote({ rankText, averageText }: ComparisonNoteProps) {
  return (
    <div className="mt-2 border-t border-stone-200 pt-2 fs-sub text-stone-600">
      <p>{rankText}</p>
      <p>{averageText}</p>
    </div>
  );
}

export default ComparisonNote;
