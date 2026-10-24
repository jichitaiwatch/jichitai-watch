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

import { manYenAmount, thousandYenAmount } from "@/lib/format-units";
import { t, tf } from "@/lib/i18n";
import { nameLabelNode, personName } from "@/components/PersonName";
import { kaihaLabel } from "@/lib/party-labels";
import { dataTextString } from "@/lib/data-text";
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
import { ForestTaxCard } from "@/components/ForestTaxCard";
import { getForestTaxPref, type ForestTaxRow } from "@/lib/forest-tax";

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
  opts: { unit: "人" | "世帯" | "万円" | "%" | ""; decimals: number },
): ComparisonNoteProps | undefined {
  const m = getPrefComparison(file, prefectureName, field);
  if (!m) return undefined;
  const rankText = tf("p-rank-national-pref", { rank: `${m.rank}`, total: `${m.rank_out_of}` });
  if (kind === "count") {
    const avg = Math.round(m.national_average_unweighted ?? 0);
    return { rankText, averageText: tf("p-national-avg-simple", { amount: withUnit(avg.toLocaleString(), opts.unit) }) };
  }
  const avg = toFixedHalfUp(m.national_official ?? 0, opts.decimals);
  return { rankText, averageText: tf("p-national-avg-weighted", { amount: withUnit(avg, opts.unit) }) };
}

/**
 * 比較の注記の「数字＋単位」。単位の語は用語辞書の文型から引く（英語版は「人」「世帯」を付けず、万円は ¥ の全桁にする）。
 * 日本語版の出力は従来の `${数字}${単位}` と同じ。
 */
function withUnit(num: string, unit: "人" | "世帯" | "万円" | "%" | ""): string {
  if (unit === "人") return tf("p-people", { n: num });
  if (unit === "世帯") return tf("p-households", { n: num });
  if (unit === "万円") return tf("p-man-yen", { amount: manYenAmount(num) });
  return `${num}${unit}`;
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
    title: t("card-population"),
    updateFrequency: t("freq-once-a-year"),
    sourceLabel: t("src-juki"),
    note: t("note-latest-year"),
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
    title: t("card-households"),
    updateFrequency: t("freq-once-a-year"),
    sourceLabel: t("src-juki"),
    note: t("note-latest-year-same"),
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
    title: t("card-one-person-ageing"),
    updateFrequency: t("freq-annual-census"),
    sourceLabel: t("src-census-juki"),
    note: t("note-two-stats"),
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
    title: t("card-employment-by-industry"),
    updateFrequency: t("freq-5yr-census"),
    sourceLabel: t("src-census"),
    note: t("note-sectors"),
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
    title: t("card-top3-industries"),
    updateFrequency: t("freq-5yr-census"),
    sourceLabel: t("src-census"),
    note: t("note-top3"),
    resolve: (p) => getPrefIndustry(p.prefectureName),
    renderVisualization: (data) => <TopIndustriesList industries={data.row.上位3業種} />,
  }),
  definePrefCard<PrefDaynightRow>({
    id: "m1-daynight-ratio",
    iconId: "daynight",
    tab: "machi",
    order: 60,
    title: t("card-day-night-ratio"),
    updateFrequency: t("freq-5yr-census"),
    sourceLabel: t("src-census"),
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
    title: t("card-taxable-income"),
    updateFrequency: t("freq-once-a-year"),
    sourceLabel: t("src-estat-ssds"),
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
    title: t("card-local-head"),
    updateFrequency: t("freq-each-election"),
    // 自治総研 利用条件（using-data-note）: 実施機関名＋「自治体選挙結果調査」の明記が必須（content-spec §7.4）
    sourceLabel: t("src-jichisoken-elections"),
    // 英語版だけの注記（辞書の ja は空＝日本語版には出さない。2026-10-23 運営者裁定）
    note: t("note-family-name-first") || undefined,
    resolve: (p) => getPrefChief(p.prefCode),
    renderVisualization: (data) => <ChiefCard row={data.row} />,
  }),
  definePrefCard<FinanceOverviewRow>({
    id: "m2-finance-overview",
    iconId: "gauge",
    tab: "gyosei",
    order: 20,
    title: t("card-finance-overview"),
    updateFrequency: t("freq-annual"),
    sourceLabel: t("src-mic-pref-accounts"),
    resolve: (p) => getPrefFinanceOverview(p.prefCode),
    renderVisualization: (data) => <FinanceOverviewCard data={data.row} />,
  }),
  definePrefCard<PrefFiscalRow>({
    id: "m2-fiscal-health",
    tab: "gyosei",
    order: 30,
    title: t("card-fiscal-soundness"),
    updateFrequency: t("freq-annual"),
    sourceLabel: t("src-mic-pref-accounts-soundness"),
    resolve: (p) => getPrefFiscalHealth(p.prefCode),
    renderVisualization: (data) => {
      const row = data.row;
      const s = getPrefFiscalStatutory();
      const tokens = row.ratio_source_tokens;
      const indicators: FiscalHealthIndicator[] = [
        {
          plainLabel: t("fh-plain-real-deficit"),
          formalLabel: t("ind-real-deficit"),
          id: "実質赤字比率",
          kind: "deficit",
          value: numOrNull(row.実質赤字比率),
          token: tokens.実質赤字比率,
          earlyThreshold: row.実質赤字比率_早期健全化基準,
          regenThreshold: row.実質赤字比率_財政再生基準,
        },
        {
          plainLabel: t("fh-plain-consolidated-deficit"),
          formalLabel: t("ind-consolidated-real-deficit"),
          id: "連結実質赤字比率",
          kind: "deficit",
          value: numOrNull(row.連結実質赤字比率),
          token: tokens.連結実質赤字比率,
          earlyThreshold: row.連結実質赤字比率_早期健全化基準,
          regenThreshold: row.連結実質赤字比率_財政再生基準,
        },
        {
          plainLabel: t("fh-plain-debt-service"),
          formalLabel: t("ind-real-debt-service"),
          id: "実質公債費比率",
          kind: "ratio",
          value: row.実質公債費比率,
          token: tokens.実質公債費比率,
          earlyThreshold: s.実質公債費比率_早期健全化基準,
          regenThreshold: s.実質公債費比率_財政再生基準,
        },
        {
          plainLabel: t("fh-plain-future-burden"),
          formalLabel: t("ind-future-burden"),
          id: "将来負担比率",
          kind: "ratio",
          value: row.将来負担比率,
          token: tokens.将来負担比率,
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
    title: t("card-expenditure-per-resident"),
    updateFrequency: t("freq-once-a-year"),
    sourceLabel: t("src-mic-pref-accounts"),
    note: t("note-per-resident"),
    resolve: (p) => getPrefExpenditurePerCapita(p.prefCode),
    renderVisualization: (d) => {
      const nat = getPrefExpenditureNationalAverages();
      const r = d.row;
      const chartData: ExpenditureBarChartDatum[] = [
        { label: t("exp-public-welfare"), id: "民生費", valuePerCapita: r["民生費_円/人"], nationalAverage: nat.民生費, prefectureAverage: null },
        { label: t("exp-education"), id: "教育費", valuePerCapita: r["教育費_円/人"], nationalAverage: nat.教育費, prefectureAverage: null },
        { label: t("exp-civil-eng"), id: "土木費", valuePerCapita: r["土木費_円/人"], nationalAverage: nat.土木費, prefectureAverage: null },
        { label: t("exp-ordinary-construction"), id: "普通建設事業費", valuePerCapita: r["普通建設事業費_円/人"], nationalAverage: nat.普通建設事業費, prefectureAverage: null },
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
    title: t("card-chair-vice"),
    updateFrequency: t("freq-each-assembly-election"),
    sourceLabel: t("src-assembly-websites"),
    // 英語版だけの注記（辞書の ja は空＝日本語版には出さない。2026-10-23 運営者裁定）
    note: t("note-family-name-first") || undefined,
    resolve: (p) => getPrefGikaiAssembly(p.prefCode),
    renderVisualization: (data, p) => (
      <GikaiChoFukuchoCard
        areaCode={p.prefCode}
        chairName={data.row.正副議長.議長氏名}
        viceChairName={data.row.正副議長.副議長氏名}
        chairSince={data.row.正副議長.議長就任日}
        viceChairSince={data.row.正副議長.副議長就任日}
        sinceAsOf={data.row.正副議長.就任日_基準日}
        previous={data.row.正副議長.直前}
      />
    ),
  }),
  definePrefCard<GikaiAssemblyRow>({
    id: "gikai-teisu",
    iconId: "gikai-seats",
    tab: "gikai",
    order: 20,
    title: t("card-assembly-seats"),
    updateFrequency: t("freq-annual"),
    sourceLabel: t("src-mic-assembly-seats-monthly"),
    resolve: (p) => getPrefGikaiAssembly(p.prefCode),
    renderVisualization: (d, p) => {
      const c = getPrefTeisuComparison(p.prefCode);
      return (
        <CouncilSeatsCard
          teisu={d.row.議員定数}
          genin={d.row.現員数}
          comparison={
            c
              ? { rankText: tf("p-rank-national-pref", { rank: `${c.rank}`, total: `${c.rankOutOf}` }), averageText: tf("p-national-avg-simple", { amount: tf("p-people", { n: c.average.toLocaleString() }) }) }
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
    title: t("card-political-groups"),
    updateFrequency: t("freq-annual"),
    sourceLabel: t("src-assembly-websites"),
    // 英語版だけ、会派名を日本語のまま出す旨を足す（辞書の ja は空＝日本語版の注記は変わらない）
    note: [t("note-three-states"), t("note-kaiha-names-ja")].filter(Boolean).join(" "),
    resolve: (p) => getPrefGikaiAssembly(p.prefCode),
    renderVisualization: (data) => (
      <KaihaCard
        status={data.row.会派.status}
        list={data.row.会派.会派一覧?.map((e) => ({ name: e.会派名, count: e.人数 })) ?? null}
        note={data.row.会派.参考メモ ? dataTextString("kaiha_memo", data.row.会派.参考メモ) : data.row.会派.参考メモ}
      />
    ),
  }),
  definePrefCard<GikaihiRow>({
    id: "gikai-hi",
    iconId: "gikai-cost",
    tab: "gikai",
    order: 40,
    title: t("card-assembly-expenditure"),
    updateFrequency: t("freq-annual"),
    sourceLabel: t("src-mic-pref-accounts"),
    note: t("note-same-as-overview"),
    resolve: (p) => getPrefGikaihi(p.prefCode),
    renderVisualization: (d, p) => {
      const c = getPrefGikaihiComparison(p.prefCode);
      return (
        <GikaihiCard
          current={d.row.議会費_千円}
          prior={d.row.議会費_前年_千円}
          absoluteComparison={
            c
              ? { rankText: tf("p-rank-national-pref-total", { rank: `${c.absolute.rank}`, total: `${c.absolute.rankOutOf}` }), averageText: tf("p-national-avg-simple", { amount: tf("p-thousand-yen", { amount: thousandYenAmount(c.absolute.average) }) }) }
              : undefined
          }
          perCapitaComparison={
            c
              ? { rankText: tf("p-rank-national-pref-per-resident", { rank: `${c.perCapita.rank}`, total: `${c.perCapita.rankOutOf}` }), averageText: tf("p-gh-per-resident-avg", { v: c.perCapita.value.toLocaleString(), a: c.perCapita.average.toLocaleString() }) }
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
    title: t("card-minutes-online"),
    updateFrequency: t("freq-annual"),
    sourceLabel: t("src-assembly-websites"),
    resolve: (p) => getPrefGikaiAssembly(p.prefCode),
    renderVisualization: (data) => (
      <GijirokuCard
        status={data.row.議事録公開.status}
        format={data.row.議事録公開.公開形式}
        url={data.row.議事録公開.url}
      />
    ),
  }),

  // ── くらし（kurashi）：森林環境譲与税のみ。ほかの指標は V1 見送り（content-spec §7.16） ──
  // 森林環境譲与税：県自身が受け取った額（L-8）。
  definePrefCard<ForestTaxRow>({
    id: "l8-forest-tax",
    tab: "kurashi",
    order: 40,
    title: t("card-forest-tax"),
    updateFrequency: t("freq-once-a-year"),
    sourceLabel: t("src-forest-pref"),
    note: t("note-forest-pref"),
    resolve: (p) => getForestTaxPref(p.prefCode),
    renderVisualization: (data) => {
      const r = data.row;
      return (
        <ForestTaxCard
          jouyoYen={r.jouyo_yen}
          katsuyoYen={r.katsuyo_yen}
          katsuyoNote={r.katsuyo_basis !== null && r.katsuyo_basis !== "譲与税充当額" ? dataTextString("forest_basis", r.katsuyo_basis) : undefined}
          tsumitateYen={r.kikin_tsumitate_yen}
          uses={r.main_uses}
        />
      );
    },
  }),
];

/** 指定入口のカードを order 昇順で返す（並びは非評価的・D-4/D-6/D-12） */
export function prefCardsForTab(tab: IaTab): PrefCardDefinition<unknown>[] {
  return PREF_CARD_REGISTRY.filter((c) => c.tab === tab).sort((a, b) => a.order - b.order);
}

/** 符号付き人数表記（5年増減用）。0は±0人（増減なしを明示。欠損の"—"とは区別する） */
function formatSignedCount(diff: number): string {
  if (diff === 0) return tf("p-people", { n: "±0" });
  const sign = diff > 0 ? "+" : "−";
  return tf("p-people", { n: `${sign}${Math.abs(diff).toLocaleString()}` });
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
      ? tf("p-people", { n: population.row.r8_2026.人口_計.toLocaleString() })
      : "—";
    const diffValue = population
      ? formatSignedCount(population.row.r8_2026.人口_計 - population.row.r3_2021.人口_計)
      : "—";
    const agingValue = aging ? `${toFixedHalfUp(aging.row.高齢化率, 1)}%` : "—";
    return [
      { label: t("pop-population"), value: populationValue },
      { label: t("sum-5yr-change"), value: diffValue },
      { label: t("pop-ageing-rate"), value: agingValue },
    ];
  }

  if (tab === "gyosei") {
    const chief = getPrefChief(p.prefCode);
    return [
      { label: t("gov-local-head"), value: chief ? personName(chief.row.area_code, chief.row.氏名) : "—" },
      { label: t("sum-times-elected"), value: chief ? tf("p-times-elected", { n: `${chief.row.回}` }) : "—" },
    ];
  }

  if (tab === "gikai") {
    const assembly = getPrefGikaiAssembly(p.prefCode);
    if (!assembly) {
      return [
        { label: t("card-assembly-seats"), value: "—" },
        { label: t("sum-largest-group"), value: "—" },
        { label: t("gov-vacancy"), value: "—" },
      ];
    }
    const row = assembly.row;
    let maxKaihaValue: ReactNode;
    if (row.会派.status === "有") {
      const list = row.会派.会派一覧 ?? [];
      const max = list.reduce<KaihaEntry | null>((acc, e) => {
        if (!acc || e.人数 > acc.人数) return e;
        return acc;
      }, null);
      maxKaihaValue = max ? nameLabelNode(kaihaLabel(max.会派名)) : "—";
    } else if (row.会派.status === "無") {
      maxKaihaValue = t("val-no-groups");
    } else {
      maxKaihaValue = t("val-not-confirmed");
    }
    return [
      { label: t("card-assembly-seats"), value: `${row.議員定数}` },
      { label: t("sum-largest-group"), value: maxKaihaValue },
      { label: t("gov-vacancy"), value: tf("p-people", { n: `${row.議員定数 - row.現員数}` }) },
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
  return [{ label: t("tab-kurashi"), value: t("val-in-preparation") }];
}

/** レンダラが出典ラベルを決めるときの共通ヘルパー（動的があれば優先） */
export function resolvePrefSourceLabel(
  def: PrefCardDefinition<unknown>,
  p: PrefectureConfig,
): string {
  return def.resolveSourceLabel ? def.resolveSourceLabel(p) : def.sourceLabel;
}
