export type FiscalHealthIndicatorKind = "deficit" | "ratio";

/**
 * 1指標（比率）の描画データ。値・原表記トークン・法定基準（早期健全化／財政再生）を持つ。
 * value は m2_2_finance.json の格納値（％。null は「赤字なし／該当なし('-')」か「確認できず」）。
 * token は ratio_source_tokens の原表記（"-"＝赤字なし/該当なし＝事実／null＝確認できず）。
 * regenThreshold が null の指標（将来負担比率）は財政再生基準を描かない（ui-vi §3.1/§3.8）。
 */
export interface FiscalHealthIndicator {
  plainLabel: string;
  formalLabel: string;
  kind: FiscalHealthIndicatorKind;
  value: number | null;
  token: string | null;
  earlyThreshold: number;
  regenThreshold: number | null;
}

interface FiscalHealthCardProps {
  indicators: FiscalHealthIndicator[];
}

/** 法定超過マーカーの1色（ui-vi §3.4：赤信号ではなく法的事実のマーカー） */
const OVER_COLOR = "var(--threshold)";

/**
 * 4指標を固定で塗り分ける識別色（A-5・2026-09-23運営者確定。ui-vi §3.4の
 * 「信号色不採用・中立ティール1色」を上書き）。formalLabel固定・値に依らない
 * 機械的割当（D-4）。危険色に読める赤系は避ける。超過マーカーは引き続き
 * OVER_COLOR（--threshold）1色のみで、本パレットとは別の意味を持つ。
 */
const INDICATOR_COLOR: Record<string, string> = {
  実質赤字比率: "#5180c2",
  連結実質赤字比率: "#8a51c2",
  実質公債費比率: "#c2a651",
  将来負担比率: "#51c264",
};
const DEFAULT_INDICATOR_COLOR = "var(--current)"; // パレット未定義の指標が来た場合のフォールバック

/** 早期健全化基準を置く固定位置（％）。全指標でここに揃える（design/mock「行政のすがた.html」body-copy） */
const EARLY_POS = 60;

function clampPct(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.min(100, Math.max(0, x));
}

type ValueState =
  | { kind: "none"; label: string } // 赤字なし／負担なし（token "-"）＝事実
  | { kind: "unconfirmed" } // 確認できず（value null かつ token が "-" でない）
  | {
      kind: "value";
      text: string;
      fillPct: number;
      overEarly: boolean;
      overRegen: boolean;
    };

/**
 * 値の状態を評価する。バーは「早期健全化基準を 60% に固定」した正規化バレット。
 * fill＝value/early×60（％）。指標ごとに自らの早期基準を基準点とするため、バー長を
 * 指標間で相互比較させない（優劣比較にしない・§3.4）。実質公債費比率は負値がありうる（→0端）。
 */
function evaluate(ind: FiscalHealthIndicator): ValueState {
  if (ind.token === "-") {
    return { kind: "none", label: ind.kind === "deficit" ? "赤字なし" : "負担なし" };
  }
  if (ind.value === null) {
    return { kind: "unconfirmed" };
  }
  return {
    kind: "value",
    text: `${ind.value.toLocaleString("ja-JP")}`,
    fillPct: clampPct((ind.value / ind.earlyThreshold) * EARLY_POS),
    overEarly: ind.value >= ind.earlyThreshold,
    overRegen: ind.regenThreshold !== null && ind.value >= ind.regenThreshold,
  };
}

function IndicatorBlock({ ind }: { ind: FiscalHealthIndicator }) {
  const s = evaluate(ind);
  const over = s.kind === "value" && s.overEarly;

  // 基準線の位置（値の有無に依らず事実として描く）。早期は 60% 固定、再生は早期基準に対する比。
  const regenPos =
    ind.regenThreshold !== null
      ? clampPct((ind.regenThreshold / ind.earlyThreshold) * EARLY_POS)
      : null;

  const statusText =
    s.kind === "unconfirmed"
      ? "データなし（確認できず）"
      : s.kind === "value" && s.overRegen
        ? "財政再生基準に該当"
        : s.kind === "value" && s.overEarly
          ? "早期健全化基準に該当"
          : "国の基準内";

  return (
    <section className="min-w-0 rounded-[8px] border border-[#e1e8e4] bg-[#fbfcfb] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 fs-label font-extrabold leading-[1.35] text-[#24473a]">
            {ind.plainLabel}
          </h3>
          <small className="mt-0.5 block fs-source font-semibold text-[#566660]">
            {ind.formalLabel}
          </small>
        </div>
        <span
          className="shrink-0 whitespace-nowrap rounded-full bg-[#edf2ef] px-1.5 py-0.5 fs-source font-extrabold text-[#566660]"
          style={over ? { color: OVER_COLOR } : undefined}
        >
          {statusText}
        </span>
      </div>

      {/* 値：数値は大きく独立表示。赤字なし／負担なし・確認できずはチップで示す（0と混同しない） */}
      {s.kind === "value" ? (
        <p className="mb-1.5 mt-2.5 fs-key font-extrabold leading-none text-[#1e3b31]">
          {s.text}
          <span className="ml-0.5 fs-sub">%</span>
        </p>
      ) : s.kind === "none" ? (
        <span className="my-2.5 inline-flex rounded-full border border-[#b9cfc4] bg-[#f3f7f5] px-2.5 py-1 fs-sub font-extrabold text-[#315c4b]">
          {s.label}
        </span>
      ) : (
        <span className="my-2.5 inline-flex rounded-full border border-[var(--line)] bg-[var(--identity-soft)] px-2.5 py-1 fs-sub font-bold text-[var(--muted)]">
          確認できず
        </span>
      )}

      {/* バレット：早期＝実線(60%固定)／再生＝破線。値のある指標のみ fill を描く */}
      <div className="relative mt-0.5 h-[38px] pt-3.5">
        <div className="relative h-2.5 rounded-[2px] bg-[#e7ece9]">
          {s.kind === "value" && (
            <div
              className="h-full rounded-[2px]"
              style={{
                width: `${s.fillPct}%`,
                backgroundColor: INDICATOR_COLOR[ind.formalLabel] ?? DEFAULT_INDICATOR_COLOR,
              }}
            />
          )}
          {/* 超過マーカー（法的事実の1色）。値が早期基準以上のときのみ */}
          {over && s.kind === "value" && (
            <span
              aria-hidden
              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${s.fillPct}%`, backgroundColor: OVER_COLOR }}
            />
          )}
        </div>
        {/*
          基準線（早期＝実線／再生＝破線）は h-[38px] の外枠（この div）基準で top/bottom を7pxずつ
          取り、バー本体（h-2.5＝10px）の上下にはみ出すティックマークにする（design/mock
          「行政のすがた.html」の .bullet（38px）.early/.regen（top/bottom 7px）に準拠）。
          2026-09-29運営者指摘で発覚：内側のバー(h-2.5=10px)を基準に7px/7pxを取っていたため
          10-7-7<0となり線の高さが潰れて非表示になっていた不具合を修正（外枠基準に変更）。
        */}
        <span
          aria-hidden
          className="absolute bottom-[7px] top-[7px] w-0 border-l-2 border-[var(--baseline)]"
          style={{ left: `${EARLY_POS}%` }}
        >
          {/* ラベルは線の上端と重ならないよう、線の外側（上）に完全に浮かせる（2026-09-29運営者指摘：
              文字が線と重なっていたため、線の上端よりさらに上に配置するよう修正）。 */}
          <span className="absolute bottom-full left-0 mb-0.5 -translate-x-1/2 whitespace-nowrap fs-source font-bold text-[#566660]">
            早期
          </span>
        </span>
        {regenPos !== null && (
          <span
            aria-hidden
            className="absolute bottom-[7px] top-[7px] w-0 border-l-2 border-dashed border-[var(--baseline-soft)]"
            style={{ left: `${regenPos}%` }}
          >
            <span
              className={`absolute bottom-full mb-0.5 whitespace-nowrap fs-source font-bold text-[#566660] ${
                regenPos > 85 ? "right-0" : "left-0 -translate-x-1/2"
              }`}
            >
              再生
            </span>
          </span>
        )}
        {/* 目盛ラベル（基準の実数値）。3枠 space-between。再生なしの指標は3枠目を空に */}
        <div className="mt-1 flex justify-between fs-source text-[#566660]">
          <span>0%</span>
          <span>早期 {ind.earlyThreshold.toLocaleString("ja-JP")}%</span>
          <span>
            {ind.regenThreshold !== null
              ? `再生 ${ind.regenThreshold.toLocaleString("ja-JP")}%`
              : ""}
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * 財政の健全性カード（行政のすがた §0.9 案A・order30）の可視化層。design/mock「行政のすがた.html」準拠。
 *
 * ui-vi-handoff §3〜§3.4／§3.8 の見せ方をベースに、A-5（2026-09-23運営者確定）で§3.4の
 * 「信号色不採用・中立ティール1色」を上書きする：
 * - 早期健全化基準を 60% 位置に揃えた正規化バレット（モック body-copy）。バーは4指標を固定の
 *   識別色で塗り分ける（INDICATOR_COLOR。値の大小には依らない機械的割当・D-4）。指標ごとに
 *   自らの基準を基準点とし、バー長を指標間で相互比較させない（§3.4の当該部分は維持）。
 * - 平易ラベル（主・大）＋正式名（従・小）。平易ラベルに評価語（危険・悪化・深刻等）を入れない（§3.3）。
 * - 早期健全化基準＝実線(--baseline)／財政再生基準＝破線(--baseline-soft)。将来負担比率のみ再生線を描かない（§3.1）。
 * - 「赤字なし」（token "-"）と「確認できず」（value null）を表示上も区別する（§3.2・欠損規律）。
 * - 比較は団体間でなく法定基準との対置。順位・複合スコア・評価色は持たせない（D-4/D-6/D-18）。
 *   基準超過時のみ淡いテラコッタ1色(--threshold)を法的事実のマーカーとして当てる（§3.4）。
 * - PC＝2×2グリッド／スマホ＝1列縦積み（§3.8）。並びは法定列挙順であって評価順ではない。
 */
export function FiscalHealthCard({ indicators }: FiscalHealthCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="fs-note leading-snug text-[var(--muted)]">
        各指標の早期健全化基準を同じ位置にそろえ、現在値と国の基準の距離を示します。
      </p>

      <div aria-hidden className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {indicators.map((ind) => (
          <IndicatorBlock key={ind.formalLabel} ind={ind} />
        ))}
      </div>

      <p className="flex items-center gap-[7px] fs-source text-[#566660]">
        <span aria-hidden className="inline-block w-[18px] border-t-2 border-[var(--baseline)]" />
        <span>
          縦線＝国が定めた基準（<span className="text-[var(--baseline)]">実線</span>＝早期健全化基準／
          <span className="text-[var(--baseline)]">破線</span>＝財政再生基準）
        </span>
      </p>

      {/* sr-only は table 要素自体には効かない（幅1px・overflow:hiddenが無視され内容幅まで広がり、ページ全体の横スクロール領域を作る＝C-4で検出）。div で包んで切り捨てる。 */}
      <div className="sr-only">
        <table>
          <caption>財政健全化判断比率（単位：%。縦線は国が定めた法定基準）</caption>
          <thead>
            <tr>
              <th scope="col">指標</th>
              <th scope="col">値</th>
              <th scope="col">早期健全化基準</th>
              <th scope="col">財政再生基準</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind) => {
              const s = evaluate(ind);
              const valueText =
                s.kind === "value"
                  ? `${s.text}%`
                  : s.kind === "none"
                    ? s.label
                    : "確認できず";
              return (
                <tr key={ind.formalLabel}>
                  <th scope="row">
                    {ind.plainLabel}（{ind.formalLabel}）
                  </th>
                  <td>{valueText}</td>
                  <td>{ind.earlyThreshold.toLocaleString("ja-JP")}%</td>
                  <td>
                    {ind.regenThreshold !== null
                      ? `${ind.regenThreshold.toLocaleString("ja-JP")}%`
                      : "設定なし"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
