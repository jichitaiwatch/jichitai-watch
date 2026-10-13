// lib/pref-card-registry.tsx
//
// 都道府県レイヤーのカードレジストリ（市区町村版 lib/card-registry.tsx と対）。
// 位置づけ: 「どのカードを・どの入口に・どの順で・どのメタで出すか」の県ページ単一定義。
//   - gifu-pref 等の固定リテラルを持たない（20260808_decisions.md D-17）。
//   - 静的解決のみ。実行時 fetch なし（同 D-10 / output:'export'）。
//   - order は入口内の並び順であり優劣ではない。色・強調・複合スコアは型に持たせない（同 D-4/D-6/D-12）。
//   - 県V1に経年画面は無い。trendsCategory は設定しない。
//   - くらし入口はエントリ0枚（content-spec §7.16）。情報画面は空＝プレースホルダーが自動表示される。
//   - title / updateFrequency / sourceLabel / note は市区町村版の対応カードを流用する
//     （sourceLabel の都道府県固有補正は後段）。

import type { ReactNode } from "react";
import type { CardIconId } from "@/components/CardIcon";
import type { IaTab, EntranceSummaryItem, FrozenTrendCardKey } from "@/lib/card-registry";
import type { DataMeta, FinanceOverviewRow, ChiefRow, GikaiAssemblyRow, GikaihiRow, KaihaEntry } from "@/lib/metrics";
import type { FiscalHealthIndicator } from "@/components/FiscalHealthCard";
import { ExpenditureBarChart, type ExpenditureBarChartDatum } from "@/components/ExpenditureBarChart";
import type { PrefectureConfig } from "@/lib/prefectures";
import type { ComparisonNoteProps } from "@/components/ComparisonNote";
import {
  getPrefPopulation,
  getPrefPopulationTimeseries,
  getPrefSingleHousehold,
  getPrefAgingRate,
  getPrefTaxableIncome,
  getPrefIndustry,
  getPrefDaynight,
  getPrefChief,
  getPrefFinanceOverview,
  getPrefFiscalHealth,
  getPrefFiscalStatutory,
  getPrefExpenditurePerCapita,
  getPrefExpenditureNationalAverages,
  getPrefGikaiAssembly,
  getPrefGikaihi,
  getPrefTeisuComparison,
  getPrefGikaihiComparison,
  getPrefComparison,
  type PrefComparisonFile,
  type PrefPopulationRow,
  type PrefSingleHouseholdRow,
  type PrefAgingRateRow,
  type PrefTaxableIncomeRow,
  type PrefIndustryRow,
  type PrefDaynightRow,
  type PrefFiscalRow,
  type PrefExpenditurePerCapitaRow,
} from "@/lib/pref-metrics";
import { PopulationCard } from "@/components/PopulationCard";
import { HouseholdCountCard } from "@/components/HouseholdCountCard";
import { SingleHouseholdAgingSummary } from "@/components/SingleHouseholdAgingSummary";
import { IndustryCompositionSummary } from "@/components/IndustryCompositionSummary";
import { TopIndustriesList } from "@/components/TopIndustriesList";
import { DaynightRatioStat } from "@/components/DaynightRatioStat";
import { TaxableIncomeCard } from "@/components/TaxableIncomeCard";
import { ChiefCard } from "@/components/ChiefCard";
import { FinanceOverviewCard } from "@/components/FinanceOverviewCard";
import { FiscalHealthCard } from "@/components/FiscalHealthCard";
import { GikaiChoFukuchoCard } from "@/components/GikaiChoFukuchoCard";
import { CouncilSeatsCard } from "@/components/CouncilSeatsCard";
import { KaihaCard } from "@/components/KaihaCard";
import { GikaihiCard } from "@/components/GikaihiCard";
import { GijirokuCard } from "@/components/GijirokuCard";
import { toFixedHalfUp } from "@/lib/format-decimal";

/** getter が返す {row, meta} の共通形。Row はカードごとに異なる */
export interface PrefCardData<Row> {
  row: Row;
  meta: DataMeta;
}

/**
 * カード1枚の静的定義（都道府県）。
 * Row 型はエントリ内で resolve / renderVisualization を貫通させ、
 * definePrefCard() 経由でカタログ配列へ格納する際に unknown へ型消去する。
 */
export interface PrefCardDefinition<Row> {
  id: string;
  tab: IaTab;
  order: number;
  title: string;
  updateFrequency: string;
  sourceLabel: string;
  /** カード見出し左のアイコン識別子（識別であって評価ではない・append-only）。未設定＝アイコンなし（D-4/D-6/D-12） */
  iconId?: CardIconId;
  /** 情報画面グリッドの占有幅。compact＝PC3列(span2)／standard(既定)＝PC2列(span3)。表示密度の指定であり評価ではない */
  gridSize?: "compact" | "standard";
  note?: string;
  /** 県V1では常に未設定。型は市区町村版と共有の凍結 cardKey（§5.6.3） */
  trendsCategory?: FrozenTrendCardKey;
  resolve: (p: PrefectureConfig) => PrefCardData<Row> | null;
  resolveSourceLabel?: (p: PrefectureConfig) => string;
  renderVisualization: (data: PrefCardData<Row>, p: PrefectureConfig) => ReactNode;
}

/**
 * カタログ格納用の型消去ヘルパー。
 * エントリ定義時は Row 型で resolve / renderVisualization の整合を静的に強制し、
 * 戻り値で unknown へ消去して異種配列へ入れる。
 */
export function definePrefCard<Row>(def: PrefCardDefinition<Row>): PrefCardDefinition<unknown> {
  return def as PrefCardDefinition<unknown>;
}

/** "-" → null 正規化。FiscalHealthCard は value: number | null 契約 */
const numOrNull = (v: number | "-" | null): number | null => (typeof v === "number" ? v : null);

/**
 * 比較注記を組み立てる。実数系は単純平均、率・比率系は加重平均（公式全国値）を使う
 * （content-spec-v1.md §7.16.0の正直ラベル規律：national_officialは実数系では
 * 「合計」であって平均ではないため使わない。率系では公式値＝人口加重の実質的な
 * 加重平均のため「全国平均（加重平均）」と正確に呼べる）。
 */
function buildComparisonNote(
  file: PrefComparisonFile,
  prefectureName: string,
  field: string,
  kind: "count" | "rate",
  opts: { unit: string; decimals: number },
): ComparisonNoteProps | undefined {
  const m = getPrefComparison(file, prefectureName, field);
  if (!m) return undefined;
  const rankText = `全国${m.rank}位／${m.rank_out_of}都道府県`;
  if (kind === "count") {
    const avg = Math.round(m.national_average_unweighted ?? 0);
    return { rankText, averageText: `全国平均（単純平均）：${avg.toLocaleString()}${opts.unit}` };
  }
  const avg = toFixedHalfUp(m.national_official ?? 0, opts.decimals);
  return { rankText, averageText: `全国平均（加重平均）：${avg}${opts.unit}` };
}

/**
 * 都道府県カードカタログ。
 *
 * まち（machi）：§0.7確定7枚。
 * 行政（gyosei）：§0.9案A 4枚。trendsCategory は県V1では設定しない。
 * 議会（gikai）：§0.10案A 5枚。
 * くらし（kurashi）：V1見送り（content-spec §7.16）。エントリなし。
 */
export const PREF_CARD_REGISTRY: PrefCardDefinition<unknown>[] = [
  // ── まち（machi）§0.7 案A・7枚 ──
  definePrefCard<PrefPopulationRow>({
    id: "m1-population",
    iconId: "people",
    gridSize: "compact",
    tab: "machi",
    order: 10,
    title: "人口",
    updateFrequency: "年1回",
    sourceLabel: "住民基本台帳",
    note: "自治体Watchが最新年（令和8年）のみを抽出して表示。",
    resolve: (p) => getPrefPopulation(p.prefectureName),
    renderVisualization: (d, p) => (
      <PopulationCard
        male={d.row.人口_男}
        female={d.row.人口_女}
        total={d.row.人口_計}
        comparison={buildComparisonNote("1a_population", p.prefectureName, "人口_計", "count", { unit: "人", decimals: 0 })}
      />
    ),
  }),
  definePrefCard<PrefPopulationRow>({
    id: "m1-household",
    iconId: "house",
    gridSize: "compact",
    tab: "machi",
    order: 20,
    title: "世帯数",
    updateFrequency: "年1回",
    sourceLabel: "住民基本台帳",
    note: "自治体Watchが最新年（令和8年）のみを抽出して表示。人口カードと同一データ。",
    resolve: (p) => getPrefPopulation(p.prefectureName),
    renderVisualization: (d, p) => (
      <HouseholdCountCard
        households={d.row.世帯数}
        comparison={buildComparisonNote("1a_population", p.prefectureName, "世帯数", "count", { unit: "世帯", decimals: 0 })}
      />
    ),
  }),
  definePrefCard<{ single: PrefSingleHouseholdRow; aging: PrefAgingRateRow }>({
    id: "m1-single-household-aging",
    iconId: "demographic",
    gridSize: "compact",
    tab: "machi",
    order: 30,
    title: "単身世帯・高齢化率",
    updateFrequency: "年1回〜（国勢調査は5年ごと）",
    sourceLabel: "総務省 国勢調査／住民基本台帳",
    note: "自治体Watchが2つの統計を1枚に整理して表示。",
    resolve: (p) => {
      const s = getPrefSingleHousehold(p.prefectureName);
      const a = getPrefAgingRate(p.prefectureName);
      if (!s || !a) return null;
      return {
        row: { single: s.row, aging: a.row },
        meta: s.meta.updated >= a.meta.updated ? s.meta : a.meta,
      };
    },
    renderVisualization: (d, p) => (
      <SingleHouseholdAgingSummary
        singleHouseholdRatio={d.row.single.単身世帯割合}
        agingRate={d.row.aging.高齢化率}
        singleHouseholdComparison={buildComparisonNote("1b_single_household", p.prefectureName, "単身世帯割合", "rate", { unit: "%", decimals: 1 })}
        agingComparison={buildComparisonNote("1c_aging_rate", p.prefectureName, "高齢化率", "rate", { unit: "%", decimals: 1 })}
      />
    ),
  }),
  definePrefCard<PrefIndustryRow>({
    id: "m1-industry-composition",
    iconId: "pie",
    tab: "machi",
    order: 40,
    title: "産業別就業者構成比",
    updateFrequency: "5年ごと（国勢調査）",
    sourceLabel: "総務省 国勢調査",
    note: "自治体Watchが第1〜3次産業の構成比を算出して表示。",
    resolve: (p) => getPrefIndustry(p.prefectureName),
    renderVisualization: (d, p) => (
      <IndustryCompositionSummary
        primaryPct={d.row.第1次構成比}
        secondaryPct={d.row.第2次構成比}
        tertiaryPct={d.row.第3次構成比}
        primaryCount={d.row.第1次就業者数}
        secondaryCount={d.row.第2次就業者数}
        tertiaryCount={d.row.第3次就業者数}
        primaryComparison={buildComparisonNote("2a_industry", p.prefectureName, "第1次構成比", "rate", { unit: "%", decimals: 1 })}
        secondaryComparison={buildComparisonNote("2a_industry", p.prefectureName, "第2次構成比", "rate", { unit: "%", decimals: 1 })}
        tertiaryComparison={buildComparisonNote("2a_industry", p.prefectureName, "第3次構成比", "rate", { unit: "%", decimals: 1 })}
      />
    ),
  }),
  definePrefCard<PrefIndustryRow>({
    id: "m1-top-industries",
    iconId: "industry-bars",
    tab: "machi",
    order: 50,
    title: "構成比が高い上位3業種",
    updateFrequency: "5年ごと（国勢調査）",
    sourceLabel: "総務省 国勢調査",
    note: "自治体Watchが就業者数の降順で機械抽出。順位は事実提示であり優劣評価ではない。",
    resolve: (p) => getPrefIndustry(p.prefectureName),
    renderVisualization: (data) => <TopIndustriesList industries={data.row.上位3業種} />,
  }),
  definePrefCard<PrefDaynightRow>({
    id: "m1-daynight-ratio",
    iconId: "daynight",
    tab: "machi",
    order: 60,
    title: "昼夜間人口比率",
    updateFrequency: "5年ごと（国勢調査）",
    sourceLabel: "総務省 国勢調査",
    resolve: (p) => getPrefDaynight(p.prefectureName),
    renderVisualization: (d, p) => (
      <DaynightRatioStat
        ratio={d.row.昼夜間人口比率}
        comparison={buildComparisonNote("2b_daynight", p.prefectureName, "昼夜間人口比率", "rate", { unit: "", decimals: 1 })}
      />
    ),
  }),
  // 市区町村版 CARD_REGISTRY に未登録（production JSON未整備）。title は §0.7 のカード名。
  // updateFrequency / sourceLabel は同カードの既存出典表記（ui-vi-handoff.md §4.7）に合わせ、note は付けない（非加工）。
  definePrefCard<PrefTaxableIncomeRow>({
    id: "m1-taxable-income",
    tab: "machi",
    order: 70,
    title: "一人あたり課税対象所得",
    updateFrequency: "年1回",
    sourceLabel: "e-Stat 社会・人口統計体系",
    resolve: (p) => getPrefTaxableIncome(p.prefectureName),
    renderVisualization: (d, p) => (
      <TaxableIncomeCard
        perCapitaTaxableIncomeManYen={d.row.一人あたり課税対象所得_万円}
        comparison={buildComparisonNote("1d_taxable_income", p.prefectureName, "一人あたり課税対象所得_万円", "rate", { unit: "万円", decimals: 1 })}
      />
    ),
  }),

  // ── 行政（gyosei）§0.9 案A・4枚 ──
  definePrefCard<ChiefRow>({
    id: "m2-chief",
    iconId: "person",
    tab: "gyosei",
    order: 10,
    title: "首長",
    updateFrequency: "選挙ごと",
    // 自治総研 利用条件（using-data-note）: 実施機関名＋「自治体選挙結果調査」の明記が必須（content-spec §7.4）
    sourceLabel: "地方自治総合研究所（自治体選挙結果調査）",
    resolve: (p) => getPrefChief(p.prefCode),
    renderVisualization: (data) => <ChiefCard row={data.row} />,
  }),
  definePrefCard<FinanceOverviewRow>({
    id: "m2-finance-overview",
    iconId: "gauge",
    tab: "gyosei",
    order: 20,
    title: "財政概況",
    updateFrequency: "年次",
    sourceLabel: "総務省 都道府県決算状況調",
    resolve: (p) => getPrefFinanceOverview(p.prefCode),
    renderVisualization: (data) => <FinanceOverviewCard data={data.row} />,
  }),
  definePrefCard<PrefFiscalRow>({
    id: "m2-fiscal-health",
    tab: "gyosei",
    order: 30,
    title: "財政の健全性",
    updateFrequency: "年次",
    sourceLabel: "総務省 都道府県決算状況調／健全化判断比率の概要",
    resolve: (p) => getPrefFiscalHealth(p.prefCode),
    renderVisualization: (data) => {
      const row = data.row;
      const s = getPrefFiscalStatutory();
      const t = row.ratio_source_tokens;
      const indicators: FiscalHealthIndicator[] = [
        {
          plainLabel: "一般会計の赤字の程度",
          formalLabel: "実質赤字比率",
          kind: "deficit",
          value: numOrNull(row.実質赤字比率),
          token: t.実質赤字比率,
          earlyThreshold: row.実質赤字比率_早期健全化基準,
          regenThreshold: row.実質赤字比率_財政再生基準,
        },
        {
          plainLabel: "全会計の赤字の程度",
          formalLabel: "連結実質赤字比率",
          kind: "deficit",
          value: numOrNull(row.連結実質赤字比率),
          token: t.連結実質赤字比率,
          earlyThreshold: row.連結実質赤字比率_早期健全化基準,
          regenThreshold: row.連結実質赤字比率_財政再生基準,
        },
        {
          plainLabel: "借金返済の重さ",
          formalLabel: "実質公債費比率",
          kind: "ratio",
          value: row.実質公債費比率,
          token: t.実質公債費比率,
          earlyThreshold: s.実質公債費比率_早期健全化基準,
          regenThreshold: s.実質公債費比率_財政再生基準,
        },
        {
          plainLabel: "将来へ残す負担の大きさ",
          formalLabel: "将来負担比率",
          kind: "ratio",
          value: row.将来負担比率,
          token: t.将来負担比率,
          earlyThreshold: s.将来負担比率_早期健全化基準,
          regenThreshold: s.将来負担比率_財政再生基準,
        },
      ];
      return <FiscalHealthCard indicators={indicators} />;
    },
  }),
  definePrefCard<PrefExpenditurePerCapitaRow>({
    id: "m3-expenditure",
    iconId: "bars",
    tab: "gyosei",
    order: 40,
    title: "住民一人あたり分野別支出",
    updateFrequency: "年1回",
    sourceLabel: "総務省 都道府県決算状況調",
    note: "各費目の決算額（千円）を人口で除して自治体Watchが算出。",
    resolve: (p) => getPrefExpenditurePerCapita(p.prefCode),
    renderVisualization: (d) => {
      const nat = getPrefExpenditureNationalAverages();
      const r = d.row;
      const chartData: ExpenditureBarChartDatum[] = [
        { label: "民生費", valuePerCapita: r["民生費_円/人"], nationalAverage: nat.民生費, prefectureAverage: null },
        { label: "教育費", valuePerCapita: r["教育費_円/人"], nationalAverage: nat.教育費, prefectureAverage: null },
        { label: "土木費", valuePerCapita: r["土木費_円/人"], nationalAverage: nat.土木費, prefectureAverage: null },
        { label: "普通建設事業費", valuePerCapita: r["普通建設事業費_円/人"], nationalAverage: nat.普通建設事業費, prefectureAverage: null },
      ];
      return <ExpenditureBarChart data={chartData} />;
    },
  }),

  // ── 議会（gikai）§0.10 案A・5枚 ──
  definePrefCard<GikaiAssemblyRow>({
    id: "gikai-cho-fukucho",
    iconId: "gikai-chair",
    tab: "gikai",
    order: 10,
    title: "議長・副議長",
    updateFrequency: "改選ごと",
    sourceLabel: "各議会サイト個別調査",
    resolve: (p) => getPrefGikaiAssembly(p.prefCode),
    renderVisualization: (data) => (
      <GikaiChoFukuchoCard
        chairName={data.row.正副議長.議長氏名}
        viceChairName={data.row.正副議長.副議長氏名}
      />
    ),
  }),
  definePrefCard<GikaiAssemblyRow>({
    id: "gikai-teisu",
    iconId: "gikai-seats",
    tab: "gikai",
    order: 20,
    title: "議員定数",
    updateFrequency: "年次",
    sourceLabel: "総務省「地方自治月報」議員定数に関する調",
    resolve: (p) => getPrefGikaiAssembly(p.prefCode),
    renderVisualization: (d, p) => {
      const c = getPrefTeisuComparison(p.prefCode);
      return (
        <CouncilSeatsCard
          teisu={d.row.議員定数}
          genin={d.row.現員数}
          comparison={
            c
              ? { rankText: `全国${c.rank}位／${c.rankOutOf}都道府県`, averageText: `全国平均（単純平均）：${c.average.toLocaleString()}人` }
              : undefined
          }
        />
      );
    },
  }),
  definePrefCard<GikaiAssemblyRow>({
    id: "gikai-kaiha",
    iconId: "gikai-kaiha",
    tab: "gikai",
    order: 30,
    title: "会派",
    updateFrequency: "年次",
    sourceLabel: "各議会サイト個別調査",
    note: "自治体Watchが議会公式サイトを確認し3状態（有・\u2060無・\u2060確認できず）で整理。「確認できず」は非公開の意味ではない。",
    resolve: (p) => getPrefGikaiAssembly(p.prefCode),
    renderVisualization: (data) => (
      <KaihaCard
        status={data.row.会派.status}
        list={data.row.会派.会派一覧?.map((e) => ({ name: e.会派名, count: e.人数 })) ?? null}
        note={data.row.会派.参考メモ}
      />
    ),
  }),
  definePrefCard<GikaihiRow>({
    id: "gikai-hi",
    iconId: "gikai-cost",
    tab: "gikai",
    order: 40,
    title: "議会費",
    updateFrequency: "年次",
    sourceLabel: "総務省 都道府県決算状況調",
    note: "財政概況カードと同一データの再配置（自治体Watchが加工なしで抽出）。",
    resolve: (p) => getPrefGikaihi(p.prefCode),
    renderVisualization: (d, p) => {
      const c = getPrefGikaihiComparison(p.prefCode);
      return (
        <GikaihiCard
          current={d.row.議会費_千円}
          prior={d.row.議会費_前年_千円}
          absoluteComparison={
            c
              ? { rankText: `全国${c.absolute.rank}位／${c.absolute.rankOutOf}都道府県（総額）`, averageText: `全国平均（単純平均）：${c.absolute.average.toLocaleString()}千円` }
              : undefined
          }
          perCapitaComparison={
            c
              ? { rankText: `全国${c.perCapita.rank}位／${c.perCapita.rankOutOf}都道府県（一人あたり）`, averageText: `一人あたり ${c.perCapita.value.toLocaleString()}円・全国平均（加重平均）${c.perCapita.average.toLocaleString()}円` }
              : undefined
          }
        />
      );
    },
  }),
  definePrefCard<GikaiAssemblyRow>({
    id: "gikai-gijiroku",
    iconId: "gikai-minutes",
    tab: "gikai",
    order: 50,
    title: "議事録Web公開",
    updateFrequency: "年次",
    sourceLabel: "各議会サイト個別調査",
    resolve: (p) => getPrefGikaiAssembly(p.prefCode),
    renderVisualization: (data) => (
      <GijirokuCard
        status={data.row.議事録公開.status}
        format={data.row.議事録公開.公開形式}
        url={data.row.議事録公開.url}
      />
    ),
  }),

  // ── くらし（kurashi）：V1見送り・エントリなし（content-spec §7.16） ──
];

/** 指定入口のカードを order 昇順で返す（並びは非評価的・D-4/D-6/D-12） */
export function prefCardsForTab(tab: IaTab): PrefCardDefinition<unknown>[] {
  return PREF_CARD_REGISTRY.filter((c) => c.tab === tab).sort((a, b) => a.order - b.order);
}

/** 符号付き人数表記（5年増減用）。0は±0人（増減なしを明示。欠損の"—"とは区別する） */
function formatSignedCount(diff: number): string {
  if (diff === 0) return "±0人";
  const sign = diff > 0 ? "+" : "−";
  return `${sign}${Math.abs(diff).toLocaleString()}人`;
}

/**
 * 入口画面（4カード）の県版サマリー解決層。市区町村版 getEntranceSummary と同ロジック
 * （丸め・文言・条件分岐を変えない）。getter が null の項目は value="—"。
 */
export function getPrefEntranceSummary(tab: IaTab, p: PrefectureConfig): EntranceSummaryItem[] {
  if (tab === "machi") {
    const population = getPrefPopulationTimeseries(p.prefectureName);
    const aging = getPrefAgingRate(p.prefectureName);
    const populationValue = population
      ? `${population.row.r8_2026.人口_計.toLocaleString()}人`
      : "—";
    const diffValue = population
      ? formatSignedCount(population.row.r8_2026.人口_計 - population.row.r3_2021.人口_計)
      : "—";
    const agingValue = aging ? `${toFixedHalfUp(aging.row.高齢化率, 1)}%` : "—";
    return [
      { label: "人口", value: populationValue },
      { label: "5年増減", value: diffValue },
      { label: "高齢化率", value: agingValue },
    ];
  }

  if (tab === "gyosei") {
    const chief = getPrefChief(p.prefCode);
    return [
      { label: "首長", value: chief ? chief.row.氏名 : "—" },
      { label: "当選回数", value: chief ? `当選${chief.row.回}回` : "—" },
    ];
  }

  if (tab === "gikai") {
    const assembly = getPrefGikaiAssembly(p.prefCode);
    if (!assembly) {
      return [
        { label: "議員定数", value: "—" },
        { label: "最大会派", value: "—" },
        { label: "欠員", value: "—" },
      ];
    }
    const row = assembly.row;
    let maxKaihaValue: string;
    if (row.会派.status === "有") {
      const list = row.会派.会派一覧 ?? [];
      const max = list.reduce<KaihaEntry | null>((acc, e) => {
        if (!acc || e.人数 > acc.人数) return e;
        return acc;
      }, null);
      maxKaihaValue = max ? max.会派名 : "—";
    } else if (row.会派.status === "無") {
      maxKaihaValue = "会派なし";
    } else {
      maxKaihaValue = "確認できず";
    }
    return [
      { label: "議員定数", value: `${row.議員定数}` },
      { label: "最大会派", value: maxKaihaValue },
      { label: "欠員", value: `${row.議員定数 - row.現員数}人` },
    ];
  }

  // kurashi: 県V1は指標なし（content-spec §7.16.3）。入口カードは表示し、
  // 情報画面はプレースホルダー（ui-vi §0.12 差分6）。
  // EntranceCard は `summary && summary.length > 0` のときだけ行を描き
  // （components/EntranceCard.tsx L23）、各行は `{item.label}：{item.value}`
  // （同 L27）。カード見出しも「くらし」だが、label に別語（例:「情報」）を
  // 置くと「情報：準備中」になり指標名のように読める。推奨どおり
  // label="くらし" / value="準備中" なら画面は「くらし：準備中」となり、
  // ダミー指標値を出さず「準備中」の事実だけを伝えられる。
  return [{ label: "くらし", value: "準備中" }];
}

/** レンダラが出典ラベルを決めるときの共通ヘルパー（動的があれば優先） */
export function resolvePrefSourceLabel(
  def: PrefCardDefinition<unknown>,
  p: PrefectureConfig,
): string {
  return def.resolveSourceLabel ? def.resolveSourceLabel(p) : def.sourceLabel;
}
