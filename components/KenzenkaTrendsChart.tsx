"use client";

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { SrOnlyDataTable } from "./SrOnlyDataTable";
import { useScrollRegion, SCROLL_REGION_FOCUS } from "./useScrollRegion";
import { m, mf, type Msgs } from "@/lib/i18n-client";

/**
 * 1比率の経年系列。value は％（"-"＝該当なし は呼び出し側で 0 に、null＝確認できず はそのまま）。
 * early＝早期健全化基準（実線）、regen＝財政再生基準（破線・将来負担比率は null で描かない・§3.1/§5.9）。
 */
export interface KenzenkaTrendSeries {
  plainLabel: string;
  formalLabel: string;
  early: number;
  regen: number | null;
  points: { fyLabel: string; value: number | null }[];
}

/** 系列の識別色（中立ティール）。基準線は事実色、超過点のみテラコッタ（§3.4/§5.9） */
const LINE = "#0f766e";
const BASE = "#57534e";
const OVER = "#b5533f";

const POINT_PITCH = 64;
const CHART_HEIGHT = 220;

function formatValue(value: unknown, noData: string): string {
  return typeof value === "number" ? `${value.toLocaleString("ja-JP")}%` : noData;
}
/** 年度の表示（日本語「2023年度」・英語「FY2023」。辞書 p-fy） */
function formatLabel(label: unknown, msgs: Msgs): string {
  return mf(msgs, "p-fy", { y: String(label) });
}

interface DotProps {
  cx?: number;
  cy?: number;
  value?: number | null;
  index?: number;
  early: number;
}

/** 値点。基準超過年のみテラコッタ・拡大（§5.9 4）。null（cy無し）は不可視点で埋める（型上は要素を返す） */
function renderDot({ cx, cy, value, index, early }: DotProps): ReactElement {
  if (cx == null || cy == null || value == null) {
    return <circle key={index} r={0} opacity={0} />;
  }
  const over = value >= early;
  return (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={over ? 4 : 2.5}
      fill={over ? OVER : LINE}
    />
  );
}

function SeriesChart({ s, msgs }: { s: KenzenkaTrendSeries; msgs: Msgs }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRegion = useScrollRegion(
    scrollRef,
    mf(msgs, "p-scroll-region", { label: mf(msgs, "p-kz-graph", { label: s.plainLabel }) }),
  );
  const noData = m(msgs, "val-no-data");
  const fmt = (value: unknown) => formatValue(value, noData);
  const fy = (label: unknown) => formatLabel(label, msgs);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // y軸最大は「データ最大」と「法定基準」の大きい方を必ず上回るように取る（§5.9 3：基準線を必ず見せる）
  const nums = s.points
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const dataMax = nums.length ? Math.max(...nums) : 0;
  const top = Math.max(dataMax, s.early, s.regen ?? 0);
  const yMax = Math.max(5, Math.ceil((top * 1.1) / 5) * 5);
  const width = Math.max(s.points.length * POINT_PITCH + 100, 420);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="fs-label font-semibold text-teal-950">{s.plainLabel}</span>
        <span className="fs-note text-stone-600">{s.formalLabel}</span>
        <span className="fs-note text-stone-600">
          {mf(msgs, "p-kz-std", {
            early: `${s.early}`,
            regen: s.regen !== null ? mf(msgs, "p-kz-std-regen", { n: `${s.regen}` }) : m(msgs, "kz-std-no-regen"),
          })}
        </span>
      </div>
      <div ref={scrollRef} className={`overflow-x-auto ${SCROLL_REGION_FOCUS}`} {...scrollRegion}>
        <LineChart
          accessibilityLayer={false} // C-7：Tab停止・名前なしrole="application"を出さない。同値はSrOnlyDataTableで読み上げ
          width={width}
          height={CHART_HEIGHT}
          data={s.points}
          margin={{ top: 12, right: 24, left: 4, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="fyLabel" tick={{ fontSize: 14, fill: "#57534e" }} />
          <YAxis
            width={44}
            domain={[0, yMax]}
            tick={{ fontSize: 14, fill: "#57534e" }}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip formatter={fmt} labelFormatter={fy} />
          {/* 早期健全化基準＝実線・全幅の水平線（§5.9 1・2） */}
          <ReferenceLine y={s.early} stroke={BASE} strokeWidth={1} ifOverflow="extendDomain" />
          {/* 財政再生基準＝破線（将来負担比率は null で描かない） */}
          {s.regen !== null && (
            <ReferenceLine
              y={s.regen}
              stroke={BASE}
              strokeWidth={1}
              strokeDasharray="4 3"
              ifOverflow="extendDomain"
            />
          )}
          <Line
            type="linear" // 年度ごとの実測点を直線で結ぶ。曲線補間は点間に根拠のない値を描くため使わない（2026-10-03運営者指摘）
            dataKey="value"
            name={s.formalLabel}
            stroke={LINE}
            strokeWidth={2}
            connectNulls={false}
            dot={(props) => renderDot({ ...props, early: s.early })}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </div>
      <SrOnlyDataTable
        caption={mf(msgs, "p-kz-caption", {
          plain: s.plainLabel,
          formal: s.formalLabel,
          early: `${s.early}`,
          regen: s.regen !== null ? mf(msgs, "p-kz-caption-regen", { n: `${s.regen}` }) : m(msgs, "kz-caption-no-regen"),
        })}
        yearHeader={m(msgs, "col-fiscal-year")}
        columns={[s.formalLabel]}
        rows={s.points.map((p) => ({ label: fy(p.fyLabel), cells: [fmt(p.value)] }))}
      />
    </div>
  );
}

/**
 * 健全化判断比率の経年画面チャート（trends/fiscal-health・ui-vi §5.8/§5.9）。
 *
 * - 比率ごとに独立の折れ線グラフ（基準値の桁が違うため1グラフに重ねない）。並びは法定列挙順（§3.8）。
 * - 各グラフに水平の法定基準線：早期健全化＝実線／財政再生＝破線（将来負担比率は実線のみ・§3.1）。
 *   y軸は基準値を必ず含む範囲に取り、「基準までの距離」を常に見せる（§5.9）。
 * - 折れ線・点は中立ティール1色。ある年の値が早期健全化基準以上のときのみ、その点を淡いテラコッタで示す
 *   （§3.4/§5.9・法的事実のマーカー。信号色は使わない）。
 * - 「-」（該当なし＝赤字なし/負担なし）は 0 として、null（確認できず）は非接続ギャップとして描く（§5.4）。
 * - 固定ピッチ・右端初期スクロール（§5.7）。傾き・高さは事実で、良し悪しの評価ではない（§5.4）。
 */
/** msgs＝lib/i18n-ids.ts の KENZENKA_CHART_MSG_IDS をサーバー側で辞書から引いたもの */
export function KenzenkaTrendsChart({ series, msgs }: { series: KenzenkaTrendSeries[]; msgs: Msgs }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="fs-note leading-snug text-stone-600">
        {m(msgs, "kz-legend-1")}<span className="text-stone-600">{m(msgs, "fh-legend-solid")}</span>{m(msgs, "fh-legend-2")}
        <span className="text-stone-600">{m(msgs, "fh-legend-dashed")}</span>{m(msgs, "kz-legend-3")}
        <span style={{ color: OVER }}>{m(msgs, "kz-legend-terracotta")}</span>{m(msgs, "kz-legend-4")}
      </p>
      {series.map((s) => (
        <SeriesChart key={s.formalLabel} s={s} msgs={msgs} />
      ))}
    </div>
  );
}
