"use client";

import { useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { SrOnlyDataTable } from "./SrOnlyDataTable";
import { useScrollRegion, SCROLL_REGION_FOCUS } from "./useScrollRegion";

/** 1年度=1点。値は住民一人あたり額（円/人）。欠損年は null（点線・非接続で表現） */
export interface ExpenditureTrendPoint {
  fyLabel: string;
  民生費: number | null;
  教育費: number | null;
  土木費: number | null;
  普通建設事業費: number | null;
}

/**
 * 費目の識別用カラー。優劣・良悪の含意は持たせない（20260808_decisions.md D-4 / ui-vi-handoff §5.4）。
 * 赤／緑の信号色は用いず、色はカテゴリ（費目）ラベルとしてのみ機能する。
 */
const SERIES = [
  { key: "民生費", color: "#0f766e" },
  { key: "教育費", color: "#b45309" },
  { key: "土木費", color: "#6d28d9" },
  { key: "普通建設事業費", color: "#475569" },
] as const;

/** 1データ点あたりの固定ピッチ（ui-vi-handoff §5.7）。点数が増えても詰め込まず横スクロールで見せる */
const POINT_PITCH = 68;
const CHART_HEIGHT = 340;

/** Recharts の formatter/labelFormatter は unknown 相当の値を渡すため、こちらで数値・文字列に正規化する */
function formatValue(value: unknown): string {
  return typeof value === "number"
    ? `${value.toLocaleString("ja-JP")} 円/人`
    : "データなし";
}

function formatLabel(label: unknown): string {
  return `${String(label)}年度`;
}

export function ExpenditureTrendsChart({ data }: { data: ExpenditureTrendPoint[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRegion = useScrollRegion(scrollRef, "住民一人あたり分野別支出の推移グラフ");

  // 初期表示は右端（最新年）に寄せる（§5.7）
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const width = Math.max(data.length * POINT_PITCH + 120, 480);

  return (
    <>
    <div ref={scrollRef} className={`overflow-x-auto ${SCROLL_REGION_FOCUS}`} {...scrollRegion}>
      <LineChart
        accessibilityLayer={false} // C-7：Tab停止・名前なしrole="application"を出さない。同値はSrOnlyDataTableで読み上げ
        width={width}
        height={CHART_HEIGHT}
        data={data}
        margin={{ top: 16, right: 32, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis dataKey="fyLabel" tick={{ fontSize: 14, fill: "#57534e" }} />
        <YAxis
          width={68}
          tick={{ fontSize: 14, fill: "#57534e" }}
          tickFormatter={(v: number) => v.toLocaleString("ja-JP")}
        />
        <Tooltip formatter={formatValue} labelFormatter={formatLabel} />
        <Legend wrapperStyle={{ fontSize: 14 }} />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="linear" // 年度ごとの実測点を直線で結ぶ。曲線補間は点間に根拠のない値を描くため使わない（2026-10-03運営者指摘）
            dataKey={s.key}
            name={s.key}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </div>
    <SrOnlyDataTable
      caption="費目別の住民一人あたり決算額の年度別推移（円/人）"
      columns={SERIES.map((s) => s.key)}
      rows={data.map((d) => ({
        label: d.fyLabel,
        cells: SERIES.map((s) => formatValue(d[s.key])),
      }))}
    />
    </>
  );
}
