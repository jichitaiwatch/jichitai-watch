import type { FinanceOverviewRow, FinanceSection, FinanceLineItem } from "@/lib/metrics";
import { formatManOku, formatThousandYenExact } from "@/lib/format-yen";

interface FinanceOverviewCardProps {
  data: FinanceOverviewRow;
  /** 明細で個別表示する上位件数（残りは「その他」に集約）。既定4（付録Zブリーフ 2-2） */
  topN?: number;
}

/**
 * 識別用パレット（款/目的の降順位置に機械割当。多寡・優劣の評価色ではない・D-4/D-6/D-18）。
 * 「その他」は常に中立グレー。歳入・歳出で系統色を分け、系列の識別にのみ用いる。
 */
const PALETTE: Record<"revenue" | "expense", string[]> = {
  revenue: ["#6298d1", "#52b7df", "#a9d9ea", "#ff9e5b"],
  expense: ["#65bd83", "#ff9d59", "#ed91b1", "#4ebac7"],
};
const OTHER_COLOR = "#c6cdd1";

/** sr-only用：千円の生値を正確に桁区切り表示（データ非加工の正確値保持） */
function yen(v: number): string {
  return formatThousandYenExact(v);
}

/** 前年比（総額）の中立チップ。増減に評価色・矢印を付けない（D-6）。prior<=0 は率を出さない */
function yearOverYearChips(total: number, prior: number): string[] {
  const diff = total - prior;
  const sign = diff >= 0 ? "+" : "−";
  const abs = Math.abs(diff);
  const chips = [`前年比 ${sign}${formatManOku(abs)}`];
  if (prior > 0) chips.push(`${sign}${((abs / prior) * 100).toFixed(1)}%`);
  return chips;
}

function FinancePanel({
  kind,
  heading,
  section,
  topN,
}: {
  kind: "revenue" | "expense";
  heading: string;
  section: FinanceSection;
  topN: number;
}) {
  const top = section.items.slice(0, topN);
  const rest = section.items.slice(topN);
  const restTotal = rest.reduce((s, x) => s + x.value, 0);
  const total = section.total;

  const rows: (FinanceLineItem & { color: string; isOther?: boolean })[] = top.map(
    (it, i) => ({ ...it, color: PALETTE[kind][i] ?? OTHER_COLOR }),
  );
  if (restTotal > 0) rows.push({ name: "その他", value: restTotal, color: OTHER_COLOR, isOther: true });

  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <section className="min-w-0 rounded-[8px] bg-[var(--panel)] p-[9px]">
      <h3 className="m-0 mb-[7px] flex flex-col gap-0.5 fs-label font-extrabold text-[var(--identity)]">
        <span>{heading}</span>
        <span className="fs-key text-[#1c382f]">
          <NoBreakYen text={formatManOku(total)} />
        </span>
      </h3>

      {/* 構成比を1本に積む帯（stacked）。各セグメント幅＝総額に対する構成比 */}
      <div aria-hidden className="mb-2 flex h-4 overflow-hidden rounded-[3px] bg-[#dbe8e2]">
        {rows.map((r) => (
          <span key={r.name} style={{ width: `${pct(r.value)}%`, backgroundColor: r.color }} />
        ))}
      </div>

      {/* 明細：色ドット＋項目名＋金額（生値・千円）。構成比%は帯で表現し可視リストには出さない */}
      <ul aria-hidden className="grid gap-[5px]">
        {rows.map((r) => (
          <li
            key={r.name}
            className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1.5 fs-sub text-[#55665f]"
          >
            <span className="h-[7px] w-[7px] rounded-[2px]" style={{ backgroundColor: r.color }} />
            <span className={`break-words leading-tight ${r.isOther ? "text-[#566660]" : ""}`}>{r.name}</span>
            <strong className="whitespace-nowrap fs-sub font-bold text-[#26463b]">
              {formatManOku(r.value)}
            </strong>
          </li>
        ))}
      </ul>

      {/* 前年比（同一団体・総額ベース）。中立チップ */}
      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#dfe8e3] pt-[7px]">
        {yearOverYearChips(section.total, section.priorTotal).map((c) => (
          <span
            key={c}
            className="rounded-full bg-[#e8efeb] px-[7px] py-[3px] fs-source font-semibold text-[#52645d]"
          >
            {c}
          </span>
        ))}
      </div>

      {/* sr-only は table 要素自体には効かない（幅1px・overflow:hiddenが無視され内容幅まで広がり、ページ全体の横スクロール領域を作る＝C-4で検出）。div で包んで切り捨てる。 */}
      <div className="sr-only">
        <table>
          <caption>{heading}（普通会計・単位：千円。カッコ内は総額に対する構成比）</caption>
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col">金額</th>
              <th scope="col">構成比</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td>{yen(r.value)}</td>
                <td>{pct(r.value).toFixed(1)}%</td>
              </tr>
            ))}
            <tr>
              <th scope="row">合計</th>
              <td>{yen(total)}</td>
              <td>100.0%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * 財政概況カード（行政のすがた §0.9 案A・order20）の可視化層。design/mock「行政のすがた.html」準拠。
 *
 * - V1は普通会計1系統（統計比較のため国が統一集計した会計。一般会計を中核に含む）。特別会計・企業会計は
 *   データ不在かつ需要の観点で外す。モックの「収納中」プレースホルダも出さない（無い機能を匂わせない・
 *   absence as content・欠損規律）。
 * - 歳入・歳出を横2カラムで並べ、各カラムは「1本の構成比帯（stacked）＋上位N＋その他の明細」で示す。
 *   降順は事実の機械的順序であって優劣評価ではない（D-4）。色は系列の識別用で評価色ではない（D-4/D-6/D-18）。
 * - 前年比は同一団体の総額ベース（§7.12 2-2e）。増減に評価色・矢印を付けない（D-6）。
 * - 可視は億・万円表示（万円位まで・切り捨て）。正確な千円の生値はsr-only表に保持し非加工を担保（A-1・裁定(c)）。構成比%は帯とsr-only表で保持。
 * - 経年（財政規模の推移）への導線は trends 機構が提供するため、カード内には別リンクを置かない。
 * - PC＝歳入・歳出の2カラム／スマホ＝1列縦積み。
 */
export function FinanceOverviewCard({ data, topN = 4 }: FinanceOverviewCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line-soft)] pb-2">
        <span className="fs-label font-extrabold text-[#244a3c]">普通会計</span>
        <span className="fs-source font-semibold text-[#566660]">歳入・歳出</span>
      </div>
      <p className="-mt-1 fs-sub leading-snug text-[var(--muted)]">
        団体間で比較できるよう国が統一集計した<span className="whitespace-nowrap">会計（金額は兆・億・万円で表示）</span>
      </p>

      {/* 歳入・歳出は、カード幅（コンテナ）が十分あるときだけ2列。狭いとき（PCの半幅カード等）は1列にして、
          桁の大きい団体（東京都など）でも金額が枠からはみ出さないようにする。 */}
      <div className="[container-type:inline-size]">
        <div className="fin-grid">
          <FinancePanel kind="revenue" heading="歳入" section={data.revenue} topN={topN} />
          <FinancePanel kind="expense" heading="歳出" section={data.expenditure} topN={topN} />
        </div>
      </div>
    </div>
  );
}

/**
 * 「N兆M億K万円」を兆・億の後ろでだけ折り返せるようにする（東京都など桁の大きい団体でも枠からはみ出さない）。
 * 数字の途中・「万円」の途中では折り返さない。
 */
function NoBreakYen({ text }: { text: string }) {
  const segments = text.split(/(?<=[兆億])/);
  return (
    <>
      {segments.map((seg, i) => (
        <span key={i} className="inline-block whitespace-nowrap">
          {seg}
        </span>
      ))}
    </>
  );
}
