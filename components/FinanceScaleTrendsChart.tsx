"use client";

import { useEffect, useRef } from "react";
import { formatManOku } from "@/lib/format-yen";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { SrOnlyDataTable } from "./SrOnlyDataTable";
import { useScrollRegion, SCROLL_REGION_FOCUS } from "./useScrollRegion";

/** 1年度=1点。歳入・歳出は決算総額（千円）。欠損年は null（棒を描かない・ui-vi §5.8） */
export interface FinanceScalePoint {
  fyLabel: string;
  歳入: number | null;
  歳出: number | null;
}

/**
 * 歳入・歳出の識別用カラー（青／オレンジ）。系列識別のための配色であり、
 * 多寡の優劣・良悪の含意は持たせない（20260808_decisions.md D-4/D-6 / ui-vi §5.4・§5.8）。
 */
const SERIES = [
  { key: "歳入", color: "#2563eb" },
  { key: "歳出", color: "#ea580c" },
] as const;

/** 1データ点（年度）あたりの固定ピッチ（ui-vi §5.7）。棒2本ぶん確保。詰め込まず横スクロールで見せる */
const POINT_PITCH = 88;
const CHART_HEIGHT = 340;

/** Tooltip は億・万円を主表示・正確な千円を従で併記（A-1・裁定(c)）。null は「データなし」（§5.4：値ゼロと区別） */
function formatValue(value: unknown): string {
  return typeof value === "number"
    ? `${formatManOku(value)}（${value.toLocaleString("ja-JP")}千円）`
    : "データなし";
}

function formatLabel(label: unknown): string {
  return `${String(label)}年度`;
}

/** 縦軸は億円換算で表示（1億円＝100,000千円）。生値は千円のまま（Tooltip・出典注記で明示） */
function formatAxis(v: number): string {
  return `${(v / 100000).toLocaleString("ja-JP", { maximumFractionDigits: 0 })}`;
}

export function FinanceScaleTrendsChart({ data }: { data: FinanceScalePoint[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRegion = useScrollRegion(scrollRef, "財政概況の推移グラフ");

  // 初期表示は右端（最新年）に寄せる（§5.7）
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const width = Math.max(data.length * POINT_PITCH + 140, 480);

  return (
    <div className="flex flex-col gap-2">
      <div ref={scrollRef} className={`overflow-x-auto ${SCROLL_REGION_FOCUS}`} {...scrollRegion}>
        <BarChart
          accessibilityLayer={false} // C-7：Tab停止・名前なしrole="application"を出さない。同値はSrOnlyDataTableで読み上げ
          width={width}
          height={CHART_HEIGHT}
          data={data}
          margin={{ top: 16, right: 24, left: 12, bottom: 8 }}
          barGap={2}
          barCategoryGap="24%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey="fyLabel" tick={{ fontSize: 14, fill: "#57534e" }} />
          <YAxis
            width={56}
            tick={{ fontSize: 14, fill: "#57534e" }}
            tickFormatter={formatAxis}
          />
          <Tooltip formatter={formatValue} labelFormatter={formatLabel} />
          <Legend wrapperStyle={{ fontSize: 14 }} />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.key} fill={s.color} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </div>
      <p className="fs-note text-stone-600">縦軸＝億円（金額の生値は千円）</p>
      <SrOnlyDataTable
        caption="歳入・歳出の決算総額の年度別推移"
        columns={SERIES.map((s) => s.key)}
        rows={data.map((d) => ({
          label: d.fyLabel,
          cells: SERIES.map((s) => formatValue(d[s.key])),
        }))}
      />
    </div>
  );
}
