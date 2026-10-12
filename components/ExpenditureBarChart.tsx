import type { CSSProperties } from "react";

export interface ExpenditureBarChartDatum {
  label: string;
  valuePerCapita: number;
  /** 全国平均_円/人（データセット未整備の場合はnull） */
  nationalAverage: number | null;
  /** 岐阜県内平均_円/人（データセット未整備の場合はnull） */
  prefectureAverage: number | null;
}

interface ExpenditureBarChartProps {
  data: ExpenditureBarChartDatum[];
}

/**
 * 4費目を固定で塗り分ける識別色（A-5・2026-09-23運営者確定）。label固定・値に
 * 依らない機械的割当（D-4）。全国平均（--national オレンジ）・岐阜県内平均
 * （--prefecture 赤紫）のマーカーがバー上に重なって描かれるため、両者の色相
 * から離してある。
 */
const CATEGORY_COLOR: Record<string, string> = {
  民生費: "#8ac251",
  教育費: "#51c28a",
  土木費: "#519cc2",
  普通建設事業費: "#6451c2",
};
const DEFAULT_CATEGORY_COLOR = "var(--current)"; // パレット未定義の費目が来た場合のフォールバック

/**
 * マーカーのテキスト伸長方向を切り替える境界（%）。この値以下は三角を先頭にしてブロック左端を
 * pct%に置き右へ伸ばす。この値超は三角を末尾にしてブロック右端をpct%に置き左へ伸ばす
 * （transform: translateX(-100%)）。どちらの側でも三角の実位置は常にpct%そのもの（右端固定・
 * クランプはしない）。値が100%を超えて実際にクランプされたケース（pct=100）でも同じ式で
 * 自然にカード右端に来る（2026-09-27運営者裁定・A-25。初回実装ではpct>60を一律right:0で
 * 右端固定していたため、100%未満だが60%超の値（例：県内平均が自カード最大値の90.6%）まで
 * 実際の位置より右のカード端に寄って見える誤りがあった。実データで検出・是正）。
 * markerBlockStyle と描画側の語順分岐で同じ値を使う。
 */
export const MARKER_FLIP_PCT = 50;

/**
 * M3（住民一人あたり分野別支出）の可視化層。
 *
 * 4項目（民生費・教育費・土木費・普通建設事業費）は金額の桁が大きく
 * 異なるため、「カード内4項目のうち最大値=100%」でバーの長さを正規化
 * する（絶対値の円のままだと軸スケールが自動調整され、項目間の比較が
 * しづらいため）。ラベルに表示する実数値（円）は正規化前の実額のまま。
 *
 * デスクトップ・モバイルの両方でRechartsの固定ピクセルマージンや軸が
 * 狭幅カード（モバイル2カラムグリッド時は約170px）に収まらないため、
 * 両方の表示幅でCSS幅ベースの棒グラフに統一している（Recharts不使用）。
 * 全国平均（▼）・岐阜県内平均（▲）は、同じ「自カード最大値=100%」の
 * スケールに変換した位置にマーカーとして重ねて表示する（A-2/A-3・2026-09-23）。
 *
 * 三角と金額・ラベルは1つの要素にまとめ、常に「▼全国平均 ○○円」「▲県内平均 ○○円」の
 * 順（矢印が先頭）で表示する（2026-09-23運営者指摘：三角とラベルを別々に配置し左右で
 * 反転させる方式は、位置によって「ラベル 三角」の順になり矢印の意味が読み取れなかった
 * ため撤回。1要素化しフォントサイズも拡大）。位置は常にpct%そのものをアンカーにし、
 * pct<=MARKER_FLIP_PCTはブロック左端をpct%に置いて右へ伸ばす（三角先頭）、pct超はブロック
 * 右端をpct%に置いて左へ伸ばす（三角末尾）よう左右を振り分ける（markerBlockStyle参照）。
 * どちらの側でも三角そのものの実位置はpct%からずれない。100%超で実際にクランプされた値
 * （nationalPct/prefecturePctがclampPctで100に切り詰められたケース）は同じ式で自然にカード
 * 右端に来る（2026-09-27運営者裁定・A-25）。
 *
 * バー本体は4費目を固定の識別色で塗り分ける（CATEGORY_COLOR。A-5・2026-09-23運営者確定）。
 */
export function ExpenditureBarChart({ data }: ExpenditureBarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.valuePerCapita));
  const hasAnyAverage = data.some((d) => d.nationalAverage !== null || d.prefectureAverage !== null);

  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden="true">
        <ul className="flex flex-col gap-4 pt-2 sm:gap-5">
          {data.map((d) => {
            const barPct = clampPct((d.valuePerCapita / maxValue) * 100);
            const nationalPct =
              d.nationalAverage !== null ? clampPct((d.nationalAverage / maxValue) * 100) : null;
            const prefecturePct =
              d.prefectureAverage !== null ? clampPct((d.prefectureAverage / maxValue) * 100) : null;

            return (
              <li key={d.label}>
                <div className="flex items-baseline justify-between gap-2 fs-key">
                  <span className="font-medium text-[var(--body)]">{d.label}</span>
                  <span className="font-semibold text-[var(--identity)]">{d.valuePerCapita.toLocaleString()}円</span>
                </div>
                {/* マーカーがバー上下にはみ出すため、marker分の縦余白を確保する。
                    三角+金額が同一行になったため、以前（直上/直下の別行表示）より必要量は小さい。 */}
                <div className="relative mt-4 mb-4 h-2 w-full sm:mt-5 sm:mb-5 sm:h-2.5">
                  <div className="h-full w-full rounded-full bg-[var(--identity-soft)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: CATEGORY_COLOR[d.label] ?? DEFAULT_CATEGORY_COLOR,
                      }}
                    />
                  </div>
                  {nationalPct !== null && d.nationalAverage !== null && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-full mb-1 whitespace-nowrap fs-sub font-normal leading-none text-[var(--national-text)]"
                      style={markerBlockStyle(nationalPct)}
                    >
                      {nationalPct > MARKER_FLIP_PCT
                        ? `全国平均 ${d.nationalAverage.toLocaleString()}円 ▼`
                        : `▼ 全国平均 ${d.nationalAverage.toLocaleString()}円`}
                    </span>
                  )}
                  {prefecturePct !== null && d.prefectureAverage !== null && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-full mt-1 whitespace-nowrap fs-sub font-normal leading-none text-[var(--prefecture)]"
                      style={markerBlockStyle(prefecturePct)}
                    >
                      {prefecturePct > MARKER_FLIP_PCT
                        ? `県内平均 ${d.prefectureAverage.toLocaleString()}円 ▲`
                        : `▲ 県内平均 ${d.prefectureAverage.toLocaleString()}円`}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {hasAnyAverage && (
          <p className="fs-note text-[var(--muted-light)]">
            <span className="text-[var(--national-text)]">▼</span> 全国平均・
            <span className="text-[var(--prefecture)]">▲</span> 岐阜県内平均。いずれも人口加重平均（各費目の合計÷人口の合計）で、市町村ごとの円/人の単純平均ではありません（各項目のカード内最大値を100%とした位置に表示）
          </p>
        )}
      </div>

      {/* sr-only は table 要素自体には効かない（幅1px・overflow:hiddenが無視され内容幅まで広がり、ページ全体の横スクロール領域を作る＝C-4で検出）。div で包んで切り捨てる。 */}
      <div className="sr-only">
        <table>
          <caption>住民一人あたり分野別支出（単位：円／人）</caption>
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col">当該自治体</th>
              <th scope="col">全国平均</th>
              <th scope="col">岐阜県内平均</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th scope="row">{d.label}</th>
                <td>{d.valuePerCapita.toLocaleString()}円</td>
                <td>{d.nationalAverage !== null ? `${d.nationalAverage.toLocaleString()}円` : "データ未整備"}</td>
                <td>
                  {d.prefectureAverage !== null ? `${d.prefectureAverage.toLocaleString()}円` : "データ未整備"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function clampPct(pct: number): number {
  if (Number.isNaN(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

/**
 * マーカー（三角+ラベル）ブロックの配置（2026-09-23運営者指摘対応：
 * 「▼全国平均 ○○円」のように三角が必ず先頭に来る形へ変更。三角とラベルを
 * 別要素で左右反転配置すると、位置によって「ラベル ▼」の順になり矢印の
 * 意味が読み取れなくなっていたため、三角+ラベルを1要素に統合した。
 *
 * pct<=MARKER_FLIP_PCT：`left: pct%`のみ。ブロック左端がpct%に来て右へ伸びる（三角先頭。
 * 描画側で「▼ ラベル」の語順）。
 * pct>MARKER_FLIP_PCT：`left: pct%` に加え `transform: translateX(-100%)` でブロック自身の
 * 幅ぶん左へ押し戻す。結果としてブロック右端がpct%に来て左へ伸びる（三角末尾。描画側で
 * 「ラベル ▼」の語順）。いずれの分岐でも三角の実位置はpct%そのもので、途中で丸めたり
 * 固定値へスナップしたりしない（2026-09-27運営者裁定・A-25。初回実装のright:0固定＝
 * pct>60を一律カード右端へスナップする方式は、100%未満だが60%超の値の位置精度を失っていた
 * ため、pctをそのままアンカーに使う本方式へ置き換えた）。
 * 2026-09-23に一度採った「三角とラベルを別要素で左右反転」方式は語順が読めず撤回したが、本方式は
 * 三角+ラベルを1要素のまま語順だけをpct超で反転させるもので、当該撤回とは別物。
 *
 * 本関数とMARKER_FLIP_PCTは、他カードで「1本のバー/トラックに全国平均・県内(都道府県)平均等の
 * 比較マーカーを重ねる」表現を新設・追加する際の共通ルールとして再利用する（2026-09-27運営者指摘・
 * KaigoPremiumSummary.tsxへ適用）。バー系ごとに個別ルールを作らず本関数を import して使うこと。
 */
export function markerBlockStyle(pct: number): CSSProperties {
  if (pct > MARKER_FLIP_PCT) {
    return { left: `${pct}%`, transform: "translateX(-100%)" };
  }
  return { left: `${pct}%` };
}
