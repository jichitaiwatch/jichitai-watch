"use client";

import { enBillionAxis } from "@/lib/format-en";
import { LOCALE } from "@/lib/locale";
import { thousandYenAmount } from "@/lib/format-units";
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
import { m, mf, type Msgs } from "@/lib/i18n-client";

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
  { key: "歳入", nameId: "revenue", color: "#2563eb" },
  { key: "歳出", nameId: "expenditure", color: "#ea580c" },
] as const;

/** 1データ点（年度）あたりの固定ピッチ（ui-vi §5.7）。棒2本ぶん確保。詰め込まず横スクロールで見せる */
const POINT_PITCH = 88;
const CHART_HEIGHT = 340;

/** Tooltip は億・万円を主表示・正確な千円を従で併記（A-1・裁定(c)）。null は「データなし」（§5.4：値ゼロと区別） */
function formatValue(value: unknown, noData: string, msgs: Msgs): string {
  return typeof value === "number"
    ? `${formatManOku(value)}${mf(msgs, "p-fs-tooltip-exact", { amount: thousandYenAmount(value) })}`
    : noData;
}

/** 年度の表示（日本語「2023年度」・英語「FY2023」。辞書 p-fy） */
function formatLabel(label: unknown, msgs: Msgs): string {
  return mf(msgs, "p-fy", { y: String(label) });
}

/** 縦軸は億円換算で表示（1億円＝100,000千円）。生値は千円のまま（Tooltip・出典注記で明示） */
function formatAxis(v: number): string {
  // 英語版は ¥ billion の数（縦軸の説明 ch-fs-axis と組む）
  if (LOCALE === "en") return enBillionAxis(v);
  return `${(v / 100000).toLocaleString("ja-JP", { maximumFractionDigits: 0 })}`;
}

/** msgs＝lib/i18n-ids.ts の FINANCE_SCALE_CHART_MSG_IDS をサーバー側で辞書から引いたもの */
export function FinanceScaleTrendsChart({ data, msgs }: { data: FinanceScalePoint[]; msgs: Msgs }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRegion = useScrollRegion(scrollRef, mf(msgs, "p-scroll-region", { label: m(msgs, "ch-fs-graph") }));
  const noData = m(msgs, "val-no-data");
  const fmt = (value: unknown) => formatValue(value, noData, msgs);
  const fy = (label: unknown) => formatLabel(label, msgs);

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
          <Tooltip formatter={fmt} labelFormatter={fy} />
          <Legend wrapperStyle={{ fontSize: 14 }} />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={m(msgs, s.nameId)} fill={s.color} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </div>
      <p className="fs-note text-stone-600">{m(msgs, "ch-fs-axis")}</p>
      <SrOnlyDataTable
        caption={m(msgs, "ch-fs-caption")}
        yearHeader={m(msgs, "col-fiscal-year")}
        columns={SERIES.map((s) => m(msgs, s.nameId))}
        rows={data.map((d) => ({
          label: fy(d.fyLabel),
          cells: SERIES.map((s) => fmt(d[s.key])),
        }))}
      />
    </div>
  );
}
