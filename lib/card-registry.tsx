// lib/card-registry.tsx
//
// カードレジストリ（新IA4入口のデータ駆動化・frontend-architecture.md §3.1 / ui-vi-handoff.md §0.8・§4.2）
// 位置づけ: 「どのカードを・どの入口に・どの順で・どのメタで出すか」の単一定義。
//   - pref 非依存のカード型カタログ。gifu-pref 等の固定リテラルを持たない（20260808_decisions.md D-17）。
//   - 静的解決のみ。実行時 fetch なし（同 D-10 / output:'export'）。
//   - order は入口内の並び順であり優劣ではない。色・強調・複合スコアは型に持たせない（同 D-4/D-6/D-12）。
//   - getter の戻り row を各可視化コンポーネントの props 形へ変換する責務は、本レジストリの
//     renderVisualization が担う（従来 MunicipalityDashboard.tsx が直書きしていた変換をここへ集約）。

import type { ReactNode } from "react";
import type { MunicipalityConfig } from "@/lib/municipalities";
import type {
  DataMeta,
  ChiefRow,
  FiscalHealthRow,
  FinanceOverviewRow,
  KodomoIryohiRow,
  KaigoPremiumRow,
  ExpenditureRow,
  PopulationTimeseriesRow,
  SingleHouseholdRow,
  AgingRateRow,
  IndustryRow,
  DaynightRow,
  TaxableIncomeRow,
  FurusatoRow,
  GikaiCouncilRow,
  GikaiTeiinRow,
  GikaihiRow,
  KaihaEntry,
  KenzenkaFyValue,
  KenzenkaRatioValue,
} from "@/lib/metrics";
import {
  getKodomoIryohi,
  getKodomoIryohiDistribution,
  getKaigoPremium,
  getKaigoAverages,
  getKaigoPremiumSourceLabel,
  getExpenditure,
  getExpenditureAverages,
  getChief,
  getFinanceOverview,
  getKenzenkaSingleYear,
  getKenzenkaStatutoryCommon,
  getPopulationTimeseries,
  getSingleHousehold,
  getAgingRate,
  getIndustry,
  getDaynight,
  getTaxableIncome,
  getFurusato,
  getGikaiAssembly,
  getGikaihi,
  getExpenditureTimeseries,
  getFinanceScaleTimeseries,
  getKenzenkaTimeseries,
  EXPENDITURE_FY_KEYS,
} from "@/lib/metrics";
import { ChildMedicalSubsidyTable } from "@/components/ChildMedicalSubsidyTable";
import { formatManUnit } from "@/lib/format-count";
import { KaigoPremiumSummary } from "@/components/KaigoPremiumSummary";
import { ExpenditureBarChart, type ExpenditureBarChartDatum } from "@/components/ExpenditureBarChart";
import { ExpenditureTrendsChart, type ExpenditureTrendPoint } from "@/components/ExpenditureTrendsChart";
import { FinanceScaleTrendsChart, type FinanceScalePoint } from "@/components/FinanceScaleTrendsChart";
import { KenzenkaTrendsChart, type KenzenkaTrendSeries } from "@/components/KenzenkaTrendsChart";
import { PopulationCard } from "@/components/PopulationCard";
import { HouseholdCountCard } from "@/components/HouseholdCountCard";
import { SingleHouseholdAgingSummary } from "@/components/SingleHouseholdAgingSummary";
import { IndustryCompositionSummary } from "@/components/IndustryCompositionSummary";
import { TopIndustriesList } from "@/components/TopIndustriesList";
import { DaynightRatioStat } from "@/components/DaynightRatioStat";
import { TaxableIncomeCard } from "@/components/TaxableIncomeCard";
import { FurusatoCard } from "@/components/FurusatoCard";
import { ForestTaxCard } from "@/components/ForestTaxCard";
import { getForestTax, type ForestTaxRow } from "@/lib/forest-tax";
import {
  getDaynightTrial,
  getChiefTrial,
  getExpenditureTrial,
  getFinanceOverviewTrial,
  getGikaihiTrial,
  getKenzenkaSingleYearTrial,
  getExpenditureTimeseriesTrial,
  getFinanceScaleTimeseriesTrial,
  getKenzenkaTimeseriesTrial,
  getFurusatoTrial,
  getKaigoPremiumTrial,
  getKaigoAveragesTrial,
  getGikaiTeiinTrial,
  getGikaiCouncilTrial,
  getKodomoIryohiTrial,
  getAgingRateTrial,
  getIndustryTrial,
  getPopulationTimeseriesTrial,
  getSingleHouseholdTrial,
  getTaxableIncomeTrial,
} from "@/lib/trial-datasets";
import type { CardIconId } from "@/components/CardIcon";
import { ChiefCard } from "@/components/ChiefCard";
import { FiscalHealthCard, type FiscalHealthIndicator } from "@/components/FiscalHealthCard";
import { FinanceOverviewCard } from "@/components/FinanceOverviewCard";
import { GikaiChoFukuchoCard } from "@/components/GikaiChoFukuchoCard";
import { CouncilSeatsCard } from "@/components/CouncilSeatsCard";
import { KaihaCard } from "@/components/KaihaCard";
import { GikaihiCard } from "@/components/GikaihiCard";
import { GijirokuCard } from "@/components/GijirokuCard";
import { toFixedHalfUp } from "@/lib/format-decimal";

/** 新IA4入口（ui-vi-handoff.md §0.8 で確定。旧 fiscal/budget/mayor は gyosei へ集約・消滅） */
export type IaTab = "machi" | "gyosei" | "gikai" | "kurashi";

/**
 * 経年URL（/{pref}/{gov}/trends/{cardKey}）の cardKey 予約名前空間（append-only 凍結）。
 * frontend-architecture.md §5.6.3（§5.1 のスラッグ凍結を経年URLへ拡張）＝推移URL不変性の前提。
 * append-only＝新カテゴリは末尾に足すだけ。既存の綴りは変更も削除もしない。
 * CardDefinition.trendsCategory の値＝この cardKey。型に用い、未登録・誤綴りをビルド時（型）で弾く。
 * 現行 active＝spending / finance / fiscal-health（trendsCategory 設定済みカード）。
 * child-medical / care-premium は §5.6.3 が挙げる予約名（将来の経年カードで使用）。
 */
export const FROZEN_TREND_CARD_KEYS = [
  "spending",
  "finance",
  "fiscal-health",
  "child-medical",
  "care-premium",
] as const;

export type FrozenTrendCardKey = (typeof FROZEN_TREND_CARD_KEYS)[number];

/**
 * 入口画面（4カード）のラベル定義。ui-vi-handoff.md §0.2「入口カード4枚：
 * まちのすがた／行政のすがた／議会のすがた／くらし」をそのまま用いる。
 * 入口ラベルは各情報カードのtitleとは別概念（入口＝区分そのものの名称）。
 * app/[pref]/[gov]/page.tsx（入口画面）と
 * app/[pref]/[gov]/[tab]/page.tsx（情報画面・generateStaticParams）が
 * この配列を共通で参照する単一定義。
 */
export const ENTRANCE_TABS: { tab: IaTab; label: string }[] = [
  { tab: "machi", label: "まちのすがた" },
  { tab: "gyosei", label: "行政のすがた" },
  { tab: "gikai", label: "議会のすがた" },
  { tab: "kurashi", label: "くらし" },
];

/** 入口サマリー1項目（#19・content-spec §7.15 0-1〜0-4）。value は事実の文字列のみ（D-4/D-6/D-12） */
export interface EntranceSummaryItem {
  label: string;
  value: string;
}

/** 符号付き人数表記（5年増減用）。0は±0人（増減なしを明示。欠損の"—"とは区別する） */
function formatSignedCount(diff: number): string {
  if (diff === 0) return "±0人";
  const sign = diff > 0 ? "+" : "−";
  return `${sign}${Math.abs(diff).toLocaleString()}人`;
}

/**
 * 入口画面（4カード）のサマリー解決層（#19・案A）。既存 getter の派生に閉じ、
 * 新規データ取得・JSON変更を伴わない。getter が null を返した項目は value="—"
 * （欠損規律・中立表示。項目自体は残す）。
 */

/** 入口サマリーの「最大会派」表示（有＝最大人数の会派名／無＝会派なし／確認できず） */
function maxKaihaLabel(kaiha: GikaiCouncilRow["会派"]): string {
  if (kaiha.status === "有") {
    const max = (kaiha.会派一覧 ?? []).reduce<KaihaEntry | null>((acc, e) => (!acc || e.人数 > acc.人数 ? e : acc), null);
    return max ? max.会派名 : "—";
  }
  return kaiha.status === "無" ? "会派なし" : "確認できず";
}

export function getEntranceSummary(tab: IaTab, m: MunicipalityConfig): EntranceSummaryItem[] {
  if (tab === "machi") {
    const population = getPopulationTimeseries(m.areaCode) ?? getPopulationTimeseriesTrial(m.areaCode);
    // 試作（D-24）：公開分に無い area_code は試作データ（公開用ビルドでは常に null）
    const aging = getAgingRate(m.areaCode) ?? getAgingRateTrial(m.areaCode);
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
    const chief = getChief(m.areaCode) ?? getChiefTrial(m.areaCode);
    return [
      { label: "首長", value: chief ? chief.row.氏名 : "—" },
      { label: "当選回数", value: chief ? `当選${chief.row.回}回` : "—" },
    ];
  }

  if (tab === "gikai") {
    const assembly = getGikaiAssembly(m.areaCode);
    if (!assembly) {
      // 試作県（D-24）：条例定数・現員（gikai_teiin）と、会派（gikai_council）は別系統。無い項目は「—」
      const teiin = getGikaiTeiinTrial(m.areaCode);
      const council = getGikaiCouncilTrial(m.areaCode);
      return [
        { label: "議員定数", value: teiin ? `${teiin.row.議員定数}` : "—" },
        { label: "最大会派", value: council ? maxKaihaLabel(council.row.会派) : "—" },
        { label: "欠員", value: teiin && teiin.row.現員数 !== null ? `${teiin.row.議員定数 - teiin.row.現員数}人` : "—" },
      ];
    }
    const row = assembly.row;
    const maxKaihaValue = maxKaihaLabel(row.会派);
    return [
      { label: "議員定数", value: `${row.議員定数}` },
      { label: "最大会派", value: maxKaihaValue },
      { label: "欠員", value: `${row.議員定数 - row.現員数}人` },
    ];
  }

  // kurashi
  const kodomoIryohi = getKodomoIryohi(m.areaCode) ?? getKodomoIryohiTrial(m.areaCode);
  const kaigoPremium = getKaigoPremium(m.areaCode) ?? getKaigoPremiumTrial(m);
  const kodomoValue = kodomoIryohi && kodomoIryohi.row.対象年齢_通院 ? "あり" : "—";
  const kaigoValue = kaigoPremium
    ? `${kaigoPremium.row.第9期月額基準保険料_円.toLocaleString()}円/月`
    : "—";
  return [
    { label: "子ども医療費助成", value: kodomoValue },
    { label: "介護保険料", value: kaigoValue },
  ];
}

/** getter が返す {row, meta} の共通形。Row はカードごとに異なる */
export interface CardData<Row> {
  row: Row;
  meta: DataMeta;
}

/**
 * カード1枚の静的定義（pref 非依存）。
 * Row 型はエントリ内で resolve / renderVisualization を貫通させ、
 * defineCard() 経由でカタログ配列へ格納する際に unknown へ型消去する。
 */
export interface CardDefinition<Row, E = MunicipalityConfig> {
  /** 安定ID（順位ではなく識別子）。React key・将来のURL断片に使う */
  id: string;
  /** カード見出し左のアイコン識別子（識別であって評価ではない・append-only）。未設定＝アイコンなし（D-4/D-6/D-12） */
  iconId?: CardIconId;
  /** 情報画面グリッドの占有幅。compact＝PC3列(span2)／standard(既定)＝PC2列(span3)。表示密度の指定であり評価ではない */
  gridSize?: "compact" | "standard";
  /** 所属入口 */
  tab: IaTab;
  /** 同一 tab 内の表示順。昇順の並びであって評価順ではない（D-4/D-6/D-12）。挿入余地のため10刻み */
  order: number;
  /** 入口配下の情報画面での見出し（従来 Dashboard 直書き → ここへ外出し） */
  title: string;
  /** 更新頻度の表記（例 "年1回"） */
  updateFrequency: string;
  /**
   * 出典表記の静的フォールバック。実出典URL・更新日は resolve() の meta を優先。
   * 保険者名などで動的生成が要る場合は resolveSourceLabel を使う。
   */
  sourceLabel: string;
  /** 補足注記（任意。M1〜M3 は「自治体Watchが加工して作成」等の加工明示に使う） */
  note?: string;
  /**
   * 経年画面が存在するカードのみ設定する経年カテゴリ（ui-vi-handoff §5.3 のURL断片：
   * spending / finance / fiscal-health / child-medical / care-premium）。
   * 情報画面の「推移を見る」導線（§0.8.4）と /trends/{category} の generateStaticParams は
   * この値だけから生成する。未設定＝経年導線なし（gikai 等）。値の有無は「経年時系列データが
   * 実在するか」に一致させる（D-10・単年のみの指標には設定しない）。
   */
  trendsCategory?: FrozenTrendCardKey;
  /**
   * 経年画面（/trends/{cardKey}）の描画メタ＋描画関数。trendsCategory を持つカードのみ設定。
   * 単年の resolve/renderVisualization とは独立に、自分の経年時系列 getter を呼んで描画する
   * （§5.6.3・#11.1 直書き負債の解消＝経年ページ側の category 分岐を廃す）。
   * lead/sourceLabel/note は経年画面固有の静的メタ（単年カードの sourceLabel/note とは別物）。
   * render は per-自治体で時系列を取得し、無ければ null（→ notFound）。sourceUrl/updated は時系列 meta 由来。
   */
  trends?: {
    lead: string;
    sourceLabel: string;
    note: string;
    render: (m: E) => { chart: ReactNode; sourceUrl?: string; updated: string } | null;
  };
  /**
   * 自治体設定からデータを解決する。照合キーは MunicipalityConfig.areaCode。
   * pref 固定リテラルに依存しない（D-17）。
   * データ未整備は null（現行 lib/metrics.ts の2値挙動に一致。fetch_error/parse_error の
   * 5値化は pre-launch-blockers 側のパイプライン課題で、ここでは先取りしない）。
   */
  resolve: (m: E) => CardData<Row> | null;
  /** 出典ラベルを動的生成する場合のみ（M2＝広域連合名を含める）。あれば sourceLabel より優先 */
  resolveSourceLabel?: (m: E) => string;
  /**
   * 可視化層。データ有時のみ呼ばれる。row を各コンポーネントの props 形へ変換して描画する。
   * suppressComparison: true の場合、比較値（全国／県内／類似平均）の表示を停止する
   * （spec A-5・lib/staleness.ts の shouldSuppressComparison()）。実測値そのものは停止しない。
   * 比較値を持つカードのみ第3引数を使う（持たないカードは既存の2引数シグネチャのままでよい）。
   * 経年集計（trends）側の停止は本引数の対象外（trends.render は別経路・未対応）。
   */
  renderVisualization: (data: CardData<Row>, m: E, suppressComparison?: boolean) => ReactNode;
}

/**
 * カタログ格納用の型消去ヘルパー。
 * エントリ定義時は Row 型で resolve / renderVisualization の整合を静的に強制し、
 * 戻り値で unknown へ消去して異種配列へ入れる。
 */
export function defineCard<Row, E = MunicipalityConfig>(def: CardDefinition<Row, E>): CardDefinition<unknown, E> {
  return def as CardDefinition<unknown, E>;
}

/**
 * カードカタログ。
 *
 * まち（machi）：§0.7確定7枚を全て登録（人口・世帯・単身世帯高齢化・産業構成・
 * 上位3業種・昼夜間人口比率・一人あたり課税対象所得）。
 * 人口・世帯は同一データソース（m1_1a_population_timeseries.json）
 * の異なる切り出しで、いずれも最新年（r8_2026）のみを使用する。
 *
 * まち以外（行政・議会・くらし）は getter が実在する M1/M2/M3 のみ登録。
 * 行政の 首長・財政概況・財政の健全性（§0.9）／議会（§0.10・指標別5枚）は
 * getter 未実装のため、データ搭載セッションでそれぞれ resolve/renderVisualization
 * を伴うエントリとして追加する（粒度は確定済み・案A）。
 */
export const CARD_REGISTRY: CardDefinition<unknown>[] = [
  // ── まち（machi）§0.7 案A・7/7枚 ──
  defineCard<PopulationTimeseriesRow>({
    id: "m1-population",
    iconId: "people",
    gridSize: "compact",
    tab: "machi",
    order: 10,
    title: "人口",
    updateFrequency: "年1回",
    sourceLabel: "住民基本台帳",
    note: "自治体Watchが最新年（令和8年）のみを抽出して表示。",
    // 試作（D-24）：公開分に無い area_code は試作データ（公開用ビルドでは常に null）
    resolve: (m) => getPopulationTimeseries(m.areaCode) ?? getPopulationTimeseriesTrial(m.areaCode),
    renderVisualization: (data, _m, suppressComparison) => {
      const latest = data.row.r8_2026;
      const prior = data.row.r7_2025;
      const c = latest.comparison?.人口_計;
      return (
        <PopulationCard
          male={latest.人口_男}
          female={latest.人口_女}
          total={latest.人口_計}
          totalPrior={prior ? prior.人口_計 : null}
          comparison={
            !c || suppressComparison
              ? undefined
              : {
                  rankText: `全国${c.rank}位／${c.rank_out_of}市区町村`,
                  averageText: `類似団体平均（${c.group_code}）：${formatManUnit(Math.round(c.group_average))}人`,
                }
          }
        />
      );
    },
  }),
  defineCard<PopulationTimeseriesRow>({
    id: "m1-household",
    iconId: "house",
    gridSize: "compact",
    tab: "machi",
    order: 20,
    title: "世帯数",
    updateFrequency: "年1回",
    sourceLabel: "住民基本台帳",
    note: "自治体Watchが最新年（令和8年）のみを抽出して表示。人口カードと同一データ。",
    // 試作（D-24）：公開分に無い area_code は試作データ（公開用ビルドでは常に null）
    resolve: (m) => getPopulationTimeseries(m.areaCode) ?? getPopulationTimeseriesTrial(m.areaCode),
    renderVisualization: (data, _m, suppressComparison) => {
      const c = data.row.r8_2026.comparison?.世帯数;
      return (
        <HouseholdCountCard
          households={data.row.r8_2026.世帯数}
          householdsPrior={data.row.r7_2025 ? data.row.r7_2025.世帯数 : null}
          comparison={
            !c || suppressComparison
              ? undefined
              : {
                  rankText: `全国${c.rank}位／${c.rank_out_of}市区町村`,
                  averageText: `類似団体平均（${c.group_code}）：${formatManUnit(Math.round(c.group_average))}世帯`,
                }
          }
        />
      );
    },
  }),
  defineCard<{ single: SingleHouseholdRow; aging: AgingRateRow } & { meta?: never }>({
    id: "m1-single-household-aging",
    iconId: "demographic",
    gridSize: "compact",
    tab: "machi",
    order: 30,
    title: "単身世帯・高齢化率",
    // 2026-09-21修正：旧「年1回〜（国勢調査は5年ごと）」は lib/staleness.ts の classifyCycle()
    // が"3年"→"5年"→"年1回/年次"の順で部分一致判定するため、"5年"にマッチして無条件に
    // 5年周期扱いになっていた（単身世帯割合側の年次相当の陳腐化を検知できないバグ）。
    // 実際の更新周期は内訳が異なる（content-spec-v1.md §7.2 1-1b・2026-08-28裁定）：
    //   単身世帯割合＝国勢調査（5年周期・令和7年国勢調査の結果〔令8.9.29公表〕へ2026-10-12に更新済み。次回は令和12年国勢調査）
    //   高齢化率　　＝住民基本台帳 年齢階級別人口（年次更新・国勢調査より鮮度良のため意図的に住基採用）
    // 複合カード1枚に対しclassifyCycle()は単一の周期しか判定できないため、
    // 2指標のうち厳しい方（年次）をカード全体のupdateFrequencyとして採用する
    // （緩い方に倒すと年次側の陳腐化を見逃す。厳しい方に倒す誤りは無駄な確認を促すだけで実害がない）。
    updateFrequency: "年次",
    sourceLabel: "総務省 国勢調査／住民基本台帳",
    note: "自治体Watchが2つの統計を1枚に整理して表示。単身世帯割合は国勢調査（5年周期）、高齢化率は住民基本台帳（年次）が出典で、指標ごとに更新周期が異なる。陳腐化判定はカード全体として厳しい方（年次）を採用。",
    resolve: (m) => {
      // 試作（D-24）：公開分に無い area_code は試作データ（公開用ビルドでは常に null）
      const single = getSingleHousehold(m.areaCode) ?? getSingleHouseholdTrial(m.areaCode);
      const aging = getAgingRate(m.areaCode) ?? getAgingRateTrial(m.areaCode);
      if (!single || !aging) return null;
      // 2指標で出典の時点が異なる（単身世帯＝国勢調査、高齢化率＝住民基本台帳）ため、対象年度は両方を並べて表示する
      // （2026-10-12 修正：旧実装は新しい方の meta だけを使い、片方の時点を両方の時点のように表示していた）。
      // 更新日は新しい方、取得日は古い方（陳腐化判定を厳しい側に倒す）、系譜は両方を連結する。
      const periodLabel =
        single.meta.periodLabel && aging.meta.periodLabel
          ? `単身世帯 ${single.meta.periodLabel}／高齢化率 ${aging.meta.periodLabel}`
          : undefined;
      const fetchedCandidates = [single.meta.fetchedAt, aging.meta.fetchedAt].filter(
        (d): d is string => Boolean(d),
      );
      return {
        row: { single: single.row, aging: aging.row },
        meta: {
          updated: single.meta.updated >= aging.meta.updated ? single.meta.updated : aging.meta.updated,
          periodLabel,
          fetchedAt: fetchedCandidates.length ? fetchedCandidates.sort()[0] : undefined,
          sources: [...(single.meta.sources ?? []), ...(aging.meta.sources ?? [])],
        },
      };
    },
    renderVisualization: (data, _m, suppressComparison) => {
      const cs = data.row.single.comparison;
      const ca = data.row.aging.comparison;
      const note = (c: typeof cs, unit: string) =>
        !c || suppressComparison
          ? undefined
          : {
              rankText: `全国${c.rank}位／${c.rank_out_of}市区町村`,
              averageText: `類似団体平均（${c.group_code}）：${c.group_average}${unit}`,
            };
      return (
        <SingleHouseholdAgingSummary
          singleHouseholdRatio={data.row.single.単身世帯割合}
          agingRate={data.row.aging.高齢化率}
          singleHouseholdComparison={note(cs, "%")}
          agingComparison={note(ca, "%")}
        />
      );
    },
  }),
  defineCard<IndustryRow>({
    id: "m1-industry-composition",
    iconId: "pie",
    tab: "machi",
    order: 40,
    title: "産業別就業者構成比",
    updateFrequency: "5年ごと（国勢調査）",
    sourceLabel: "総務省 国勢調査",
    note: "自治体Watchが第1〜3次産業の構成比を算出して表示。",
    // 試作（D-24）：公開分に無い area_code は試作データ（公開用ビルドでは常に null）
    resolve: (m) => getIndustry(m.areaCode) ?? getIndustryTrial(m.areaCode),
    renderVisualization: (data, _m, suppressComparison) => {
      const c = data.row.comparison;
      const note = (v: { rank: number; rank_out_of: number; group_code: string; group_average: number } | undefined) =>
        !v || suppressComparison
          ? undefined
          : {
              rankText: `全国${v.rank}位／${v.rank_out_of}市区町村`,
              averageText: `類似団体平均（${v.group_code}）：${v.group_average}%`,
            };
      return (
        <IndustryCompositionSummary
          primaryPct={data.row.第1次構成比}
          secondaryPct={data.row.第2次構成比}
          tertiaryPct={data.row.第3次構成比}
          primaryCount={data.row.第1次就業者数}
          secondaryCount={data.row.第2次就業者数}
          tertiaryCount={data.row.第3次就業者数}
          primaryComparison={note(c?.第1次構成比)}
          secondaryComparison={note(c?.第2次構成比)}
          tertiaryComparison={note(c?.第3次構成比)}
        />
      );
    },
  }),
  defineCard<IndustryRow>({
    id: "m1-top-industries",
    iconId: "industry-bars",
    tab: "machi",
    order: 50,
    title: "構成比が高い上位3業種",
    updateFrequency: "5年ごと（国勢調査）",
    sourceLabel: "総務省 国勢調査",
    note: "自治体Watchが就業者数の降順で機械抽出。順位は事実提示であり優劣評価ではない。",
    // 試作（D-24）：公開分に無い area_code は試作データ（公開用ビルドでは常に null）
    resolve: (m) => getIndustry(m.areaCode) ?? getIndustryTrial(m.areaCode),
    renderVisualization: (data) => <TopIndustriesList industries={data.row.上位3業種} />,
  }),
  defineCard<DaynightRow>({
    id: "m1-daynight-ratio",
    iconId: "daynight",
    tab: "machi",
    order: 60,
    title: "昼夜間人口比率",
    updateFrequency: "5年ごと（国勢調査）",
    sourceLabel: "総務省 国勢調査",
    // 試作（D-24）：公開分に無い area_code は試作データ（公開用ビルドでは常に null）
    resolve: (m) => getDaynight(m.areaCode) ?? getDaynightTrial(m.areaCode),
    renderVisualization: (data, _m, suppressComparison) => {
      const c = data.row.comparison;
      return (
        <DaynightRatioStat
          ratio={data.row.昼夜間人口比率}
          comparison={
            !c || suppressComparison
              ? undefined
              : {
                  rankText: `全国${c.rank}位／${c.rank_out_of}市区町村`,
                  averageText: `類似団体平均（${c.group_code}）：${toFixedHalfUp(c.group_average, 1)}`,
                }
          }
        />
      );
    },
  }),
  defineCard<TaxableIncomeRow>({
    id: "m1-taxable-income",
    tab: "machi",
    order: 70,
    title: "一人あたり課税対象所得",
    updateFrequency: "年1回",
    sourceLabel: "e-Stat 統計でみる市区町村のすがた",
    // 試作（D-24）：公開分に無い area_code は試作データ（公開用ビルドでは常に null）
    resolve: (m) => getTaxableIncome(m.areaCode) ?? getTaxableIncomeTrial(m.areaCode),
    renderVisualization: (data, _m, suppressComparison) => {
      const c = data.row.comparison;
      return (
        <TaxableIncomeCard
          perCapitaTaxableIncomeManYen={data.row.一人あたり課税対象所得_万円}
          comparison={
            suppressComparison
              ? undefined
              : {
                  rankText: `全国${c.rank}位／${c.rank_out_of}市区町村`,
                  averageText: `類似団体平均（${c.group_code}）：${toFixedHalfUp(c.group_average, 1)}万円`,
                }
          }
        />
      );
    },
  }),

  // ── 行政（gyosei）§0.9 案A ──
  // 首長=order10 / 財政概況=20（後続Stage）/ 財政の健全性=30（後続Stage）/ M3=40。
  defineCard<ChiefRow>({
    id: "m2-chief",
    iconId: "person",
    tab: "gyosei",
    order: 10,
    title: "首長",
    updateFrequency: "選挙ごと",
    // 自治総研 利用条件（using-data-note）: 実施機関名＋「自治体選挙結果調査」の明記が必須（content-spec §7.4）
    sourceLabel: "地方自治総合研究所（自治体選挙結果調査）",
    // 経年導線なし（ui-vi §0.9）。生値・事実提示ゆえ加工主体明示（フッター③）は付与しない（§4.5 I3）
    resolve: (m) => getChief(m.areaCode) ?? getChiefTrial(m.areaCode),
    renderVisualization: (data) => <ChiefCard row={data.row} />,
  }),
  defineCard<FinanceOverviewRow>({
    id: "m2-finance-overview",
    iconId: "gauge",
    tab: "gyosei",
    order: 20,
    title: "財政概況",
    updateFrequency: "年次",
    sourceLabel: "総務省 市町村別決算状況調",
    // V1は普通会計1系統（統計比較のため国が統一集計した会計。一般会計を中核に含む）。特別会計・
    //   企業会計はデータ不在かつ需要の観点から外す（ui-vi §4.6 の3区分展開はV1では採らない・
    //   absence as content・§0.9追補2026-09-09）。
    // 経年（trends/finance＝財政規模の棒グラフ）: m2_3_finance_scale_multiyear.json（FY2015〜FY2024）。
    //   経年画面の描画は ui-vi §5.8。trends ページ汎用化と同時に付与済み。
    trendsCategory: "finance",
    trends: {
      lead: "歳入・歳出決算総額（財政規模）の推移。",
      sourceLabel: "総務省 市町村別決算状況調",
      note: "普通会計の歳入・歳出決算総額（生値・千円）。縦軸は億円表示。",
      render: (m) => {
        const ts = getFinanceScaleTimeseries(m.areaCode) ?? getFinanceScaleTimeseriesTrial(m.areaCode);
        if (!ts) return null;
        const points: FinanceScalePoint[] = EXPENDITURE_FY_KEYS.map((k) => {
          const v = ts.row[k];
          return { fyLabel: k.replace("fy", ""), 歳入: v ? v["歳入総額_千円"] : null, 歳出: v ? v["歳出総額_千円"] : null };
        });
        return { chart: <FinanceScaleTrendsChart data={points} />, sourceUrl: ts.meta.sourceUrl, updated: ts.meta.updated };
      },
    },
    // 前年比は同一団体（§7.12 2-2e）。生値ゆえ加工主体明示（フッター③）は付与しない。
    resolve: (m) => getFinanceOverview(m.areaCode) ?? getFinanceOverviewTrial(m.areaCode),
    renderVisualization: (data) => <FinanceOverviewCard data={data.row} />,
  }),
  defineCard<FiscalHealthRow>({
    id: "m2-fiscal-health",
    tab: "gyosei",
    order: 30,
    title: "財政の健全性",
    updateFrequency: "年次",
    sourceLabel: "総務省 市町村別決算状況調／健全化判断比率の概要",
    // 経年（trends/fiscal-health＝比率ごと折れ線＋水平法定基準線）: m2_4_kenzenka_shichoson_multiyear.json
    //   （FY2015〜FY2024）。経年画面の描画は ui-vi §5.9。基準線は単年（m2_2）側の getter から取る
    //   （赤字系の早期＝団体別／その他＝共通）。trends ページ汎用化と同時に付与済み。
    trendsCategory: "fiscal-health",
    trends: {
      lead: "健全化判断比率の推移。横の実線＝早期健全化基準、破線＝財政再生基準（将来負担比率は再生基準なし）。線の高さは基準までの距離を示す事実で、良し悪しの評価ではありません。",
      sourceLabel: "総務省 健全化判断比率及び資金不足比率の概要（各年度）",
      note: "早期健全化基準・財政再生基準は法定の一定値（実質赤字・連結実質赤字の早期基準は標準財政規模に応じ団体別）。「-」（赤字なし・負担なし）は0として表示。",
      render: (m) => {
        const ts = getKenzenkaTimeseries(m.areaCode) ?? getKenzenkaTimeseriesTrial(m.areaCode);
        const single = getKenzenkaSingleYear(m.areaCode) ?? getKenzenkaSingleYearTrial(m.areaCode);
        if (!ts || !single) return null;
        const c = getKenzenkaStatutoryCommon();
        const toVal = (v: KenzenkaRatioValue): number | null =>
          v === null ? null : v === "-" ? 0 : v;
        const pointsOf = (sel: (f: KenzenkaFyValue) => KenzenkaRatioValue) =>
          EXPENDITURE_FY_KEYS.map((k) => {
            const fy = ts.row[k];
            return { fyLabel: k.replace("fy", ""), value: fy ? toVal(sel(fy)) : null };
          });
        const series: KenzenkaTrendSeries[] = [
          {
            plainLabel: "一般会計の赤字の程度",
            formalLabel: "実質赤字比率",
            early: single.row.実質赤字比率_早期健全化基準,
            regen: c.実質赤字比率_財政再生基準_市区町村,
            points: pointsOf((f) => f.実質赤字比率),
          },
          {
            plainLabel: "全会計の赤字の程度",
            formalLabel: "連結実質赤字比率",
            early: single.row.連結実質赤字比率_早期健全化基準,
            regen: c.連結実質赤字比率_財政再生基準_市区町村,
            points: pointsOf((f) => f.連結実質赤字比率),
          },
          {
            plainLabel: "借金返済の重さ",
            formalLabel: "実質公債費比率",
            early: c.実質公債費比率_早期健全化基準,
            regen: c.実質公債費比率_財政再生基準,
            points: pointsOf((f) => f.実質公債費比率),
          },
          {
            plainLabel: "将来へ残す負担の大きさ",
            formalLabel: "将来負担比率",
            early: c.将来負担比率_早期健全化基準_市区町村,
            regen: c.将来負担比率_財政再生基準,
            points: pointsOf((f) => f.将来負担比率),
          },
        ];
        return { chart: <KenzenkaTrendsChart series={series} />, sourceUrl: ts.meta.sourceUrl, updated: ts.meta.updated };
      },
    },
    // 法定事実の提示ゆえ加工主体明示（フッター③）は付与しない（ui-vi §0.9・§4.5 I3）
    resolve: (m) => getKenzenkaSingleYear(m.areaCode) ?? getKenzenkaSingleYearTrial(m.areaCode),
    renderVisualization: (data) => {
      const row = data.row;
      const c = getKenzenkaStatutoryCommon();
      const t = row.ratio_source_tokens;
      // 順序は健全化判断比率の法定列挙順（実質赤字→連結実質赤字→実質公債費→将来負担。ui-vi §3.8）。
      // 評価順ではない（D-4）。早期基準は 赤字系＝レコード別／比率系＝共通。将来負担の再生基準は null（§3.1）。
      const indicators: FiscalHealthIndicator[] = [
        {
          plainLabel: "一般会計の赤字の程度",
          formalLabel: "実質赤字比率",
          kind: "deficit",
          value: row.実質赤字比率,
          token: t.実質赤字比率,
          earlyThreshold: row.実質赤字比率_早期健全化基準,
          regenThreshold: c.実質赤字比率_財政再生基準_市区町村,
        },
        {
          plainLabel: "全会計の赤字の程度",
          formalLabel: "連結実質赤字比率",
          kind: "deficit",
          value: row.連結実質赤字比率,
          token: t.連結実質赤字比率,
          earlyThreshold: row.連結実質赤字比率_早期健全化基準,
          regenThreshold: c.連結実質赤字比率_財政再生基準_市区町村,
        },
        {
          plainLabel: "借金返済の重さ",
          formalLabel: "実質公債費比率",
          kind: "ratio",
          value: row.実質公債費比率,
          token: t.実質公債費比率,
          earlyThreshold: c.実質公債費比率_早期健全化基準,
          regenThreshold: c.実質公債費比率_財政再生基準,
        },
        {
          plainLabel: "将来へ残す負担の大きさ",
          formalLabel: "将来負担比率",
          kind: "ratio",
          value: row.将来負担比率,
          token: t.将来負担比率,
          earlyThreshold: c.将来負担比率_早期健全化基準_市区町村,
          regenThreshold: c.将来負担比率_財政再生基準,
        },
      ];
      return <FiscalHealthCard indicators={indicators} />;
    },
  }),
  defineCard<ExpenditureRow>({
    id: "m3-expenditure",
    iconId: "bars",
    tab: "gyosei",
    order: 40,
    title: "住民一人あたり分野別支出",
    updateFrequency: "年1回",
    sourceLabel: "総務省 地方財政状況調査（決算統計）",
    note: "各費目の決算額（千円）を人口で除して自治体Watchが算出。",
    // 経年（trends/spending）: m3_expenditure_multiyear.json（FY2015〜FY2024）が実在（§5.3・§5.8 折れ線）
    trendsCategory: "spending",
    trends: {
      lead: "住民一人あたり額（円/人）の推移。色は費目の識別のためのもので、金額の優劣を表すものではありません。",
      sourceLabel: "総務省 地方財政状況調査（決算統計）",
      note: "各費目の決算額（千円）を各年度の人口で除して自治体Watchが算出。",
      render: (m) => {
        const ts = getExpenditureTimeseries(m.areaCode) ?? getExpenditureTimeseriesTrial(m.areaCode);
        if (!ts) return null;
        const points: ExpenditureTrendPoint[] = EXPENDITURE_FY_KEYS.map((k) => {
          const v = ts.row[k];
          return {
            fyLabel: k.replace("fy", ""),
            民生費: v ? v["民生費_円/人"] : null,
            教育費: v ? v["教育費_円/人"] : null,
            土木費: v ? v["土木費_円/人"] : null,
            普通建設事業費: v ? v["普通建設事業費_円/人"] : null,
          };
        });
        return { chart: <ExpenditureTrendsChart data={points} />, sourceUrl: ts.meta.sourceUrl, updated: ts.meta.updated };
      },
    },
    resolve: (m) => getExpenditure(m.areaCode) ?? getExpenditureTrial(m.areaCode), // area_code 照合（試作県はあとから）
    renderVisualization: (data, _m, suppressComparison) => {
      const r = data.row;
      // 試作県（D-24）は、その県のデータセットの県内平均を使う。岐阜は従来どおり。
      const trial = getExpenditureTrial(r.area_code);
      const { national: na, prefecture: pa } = trial
        ? { national: trial.national, prefecture: trial.prefecture }
        : getExpenditureAverages();
      // A-5：停止時は比較値のみnullへ（実測値=valuePerCapitaは常に表示）。
      const nat = (v: number | null) => (suppressComparison ? null : v);
      const chartData: ExpenditureBarChartDatum[] = [
        {
          label: "民生費",
          valuePerCapita: r["民生費_円/人"],
          nationalAverage: nat(na ? na["民生費_円/人"] : null),
          prefectureAverage: nat(pa ? pa["民生費_円/人"] : null),
        },
        {
          label: "教育費",
          valuePerCapita: r["教育費_円/人"],
          nationalAverage: nat(na ? na["教育費_円/人"] : null),
          prefectureAverage: nat(pa ? pa["教育費_円/人"] : null),
        },
        {
          label: "土木費",
          valuePerCapita: r["土木費_円/人"],
          nationalAverage: nat(na ? na["土木費_円/人"] : null),
          prefectureAverage: nat(pa ? pa["土木費_円/人"] : null),
        },
        {
          label: "普通建設事業費",
          valuePerCapita: r["普通建設事業費_円/人"],
          nationalAverage: nat(na ? na["普通建設事業費_円/人"] : null),
          prefectureAverage: nat(pa ? pa["普通建設事業費_円/人"] : null),
        },
      ];
      return <ExpenditureBarChart data={chartData} prefectureName={trial?.prefecture?.prefecture} />;
    },
  }),

  // ── 議会（gikai）§0.10 案A・5枚 ──
  defineCard<GikaiCouncilRow>({
    id: "gikai-cho-fukucho",
    iconId: "gikai-chair",
    tab: "gikai",
    order: 10,
    title: "議長・副議長",
    updateFrequency: "改選ごと",
    sourceLabel: "各議会サイト個別調査",
    resolve: (m) => getGikaiAssembly(m.areaCode) ?? getGikaiCouncilTrial(m.areaCode),
    renderVisualization: (data) => (
      <GikaiChoFukuchoCard
        chairName={data.row.正副議長.議長氏名}
        viceChairName={data.row.正副議長.副議長氏名}
      />
    ),
  }),
  defineCard<GikaiTeiinRow>({
    id: "gikai-teisu",
    iconId: "gikai-seats",
    tab: "gikai",
    order: 20,
    title: "議員定数",
    updateFrequency: "年次",
    sourceLabel: "総務省『議員定数に関する調』",
    resolve: (m) => getGikaiAssembly(m.areaCode) ?? getGikaiTeiinTrial(m.areaCode),
    renderVisualization: (data, _m, suppressComparison) => {
      const c = data.row.comparison;
      return (
        <CouncilSeatsCard
          cityName={data.row.市区町村名}
          teisu={data.row.議員定数}
          genin={data.row.現員数}
          nationalAverage={!c || suppressComparison ? null : c.national_average}
          similarAverage={!c || suppressComparison ? null : c.group_average}
        />
      );
    },
  }),
  defineCard<GikaiCouncilRow>({
    id: "gikai-kaiha",
    iconId: "gikai-kaiha",
    tab: "gikai",
    order: 30,
    title: "会派",
    updateFrequency: "年次",
    sourceLabel: "各議会サイト個別調査",
    note: "自治体Watchが議会公式サイトを確認し3状態（有・\u2060無・\u2060確認できず）で整理。「確認できず」は非公開の意味ではない。",
    resolve: (m) => getGikaiAssembly(m.areaCode) ?? getGikaiCouncilTrial(m.areaCode),
    renderVisualization: (data) => (
      <KaihaCard
        status={data.row.会派.status}
        list={data.row.会派.会派一覧?.map((e) => ({ name: e.会派名, count: e.人数 })) ?? null}
        note={data.row.会派.参考メモ}
      />
    ),
  }),
  defineCard<GikaihiRow>({
    id: "gikai-hi",
    iconId: "gikai-cost",
    tab: "gikai",
    order: 40,
    title: "議会費",
    updateFrequency: "年次",
    sourceLabel: "総務省 市町村別決算状況調",
    note: "財政概況カードと同一データの再配置（自治体Watchが加工なしで抽出）。",
    resolve: (m) => getGikaihi(m.areaCode) ?? getGikaihiTrial(m.areaCode),
    renderVisualization: (data) => (
      <GikaihiCard current={data.row.議会費_千円} prior={data.row.議会費_前年_千円} />
    ),
  }),
  defineCard<GikaiCouncilRow>({
    id: "gikai-gijiroku",
    iconId: "gikai-minutes",
    tab: "gikai",
    order: 50,
    title: "議事録Web公開",
    updateFrequency: "年次",
    sourceLabel: "各議会サイト個別調査",
    resolve: (m) => {
      const hit = getGikaiAssembly(m.areaCode) ?? getGikaiCouncilTrial(m.areaCode);
      // 試作県で会議録本文の公開を確認できなかった団体（議事録公開 null）は「データ未整備」
      return hit && hit.row.議事録公開 ? hit : null;
    },
    renderVisualization: (data) => (
      <GijirokuCard
        status={data.row.議事録公開!.status}
        format={data.row.議事録公開!.公開形式}
        url={data.row.議事録公開!.url}
      />
    ),
  }),

  // ── くらし（kurashi）§0.11 案A・2枚＋F-6 ふるさと納税（2026-10-07 運営者裁定で追加・計3枚）──
  defineCard<KodomoIryohiRow>({
    id: "m1-kodomo-iryohi",
    tab: "kurashi",
    order: 10,
    title: "子ども医療費助成",
    updateFrequency: "年1回",
    sourceLabel: "こども家庭庁 実施状況調査",
    note: "公表資料を自治体Watchが表形式に整理。",
    resolve: (m) => getKodomoIryohi(m.areaCode) ?? getKodomoIryohiTrial(m.areaCode),
    renderVisualization: (data) => {
      const r = data.row;
      // 試作県（D-24）は、その県のデータセットから数えた分布を使う。岐阜は従来どおり。
      const trial = getKodomoIryohiTrial(r.area_code);
      return (
        <ChildMedicalSubsidyTable
          ageOutpatient={r.対象年齢_通院}
          ageInpatient={r.対象年齢_入院}
          incomeLimitOutpatient={r.所得制限_通院}
          incomeLimitInpatient={r.所得制限_入院}
          copayOutpatient={r.一部自己負担_通院}
          copayInpatient={r.一部自己負担_入院}
          distribution={trial ? trial.distribution : getKodomoIryohiDistribution()}
          studentMedical={r.学生医療}
        />
      );
    },
  }),
  defineCard<KaigoPremiumRow>({
    id: "m2-kaigo-premium",
    tab: "kurashi",
    order: 20,
    title: "介護保険料 基準額",
    updateFrequency: "3年ごと",
    sourceLabel: "厚生労働省",
    note: "公表された基準額（第1号・月額）を自治体Watchが整理。",
    // 試作（D-24）：公開分に無い団体は試作データ（公開用ビルドでは常に null）
    resolve: (m) => getKaigoPremium(m.areaCode) ?? getKaigoPremiumTrial(m),
    resolveSourceLabel: (m) => getKaigoPremiumSourceLabel(m.kaigoInsurerName),
    renderVisualization: (data, m, suppressComparison) => {
      const r = data.row;
      // 公開分（岐阜）なら従来の平均。それ以外（試作の県）は、その県のデータセットの平均
      const averages = getKaigoPremium(m.areaCode) ? getKaigoAverages() : getKaigoAveragesTrial(m.prefectureName);
      return (
        <KaigoPremiumSummary
          cityName={m.cityName}
          insurerName={r.市区町村名}
          premiumCurrent={r.第9期月額基準保険料_円}
          premiumPrevious={r.第8期月額基準保険料_円}
          growthRate={r.伸び率}
          certificationRate={r.要介護認定率}
          nationalAverage={suppressComparison ? null : averages.national}
          prefectureAverage={suppressComparison ? null : averages.prefecture}
        />
      );
    },
  }),
  defineCard<FurusatoRow>({
    id: "m4-5-furusato",
    tab: "kurashi",
    order: 30,
    title: "ふるさと納税",
    updateFrequency: "年1回",
    sourceLabel: "総務省 ふるさと納税に関する現況調査",
    note: "公表資料を自治体Watchが整理し、人口一人あたりに換算。",
    // 試作（D-24）：公開分に無い area_code は試作データ（公開用ビルドでは常に null）
    resolve: (m) => getFurusato(m.areaCode) ?? getFurusatoTrial(m.areaCode),
    renderVisualization: (data, _m, suppressComparison) => {
      const r = data.row;
      const cIn = r.comparison.一人あたり受入額_円;
      const cOut = r.comparison.一人あたり控除額_円;
      const cmp = (c: typeof cIn) =>
        suppressComparison
          ? undefined
          : {
              rankSuffix: `全国${c.rank}位／${c.rank_out_of}市区町村`,
              averageText: `類似団体平均（${c.group_code}）：${formatManUnit(c.group_average)}円`,
            };
      return (
        <FurusatoCard
          intake={{
            amountYen: r.受入_金額_円,
            perCapitaYen: r.一人あたり受入額_円,
            detailLabel: "寄附件数",
            detailValue: `${formatManUnit(r.受入_件数)}件`,
            comparison: cmp(cIn),
          }}
          deduction={{
            amountYen: r.控除_市町村民税_控除額_円,
            perCapitaYen: r.一人あたり控除額_円,
            detailLabel: "控除人数",
            detailValue: `${formatManUnit(r.控除_市町村民税_人数)}人`,
            comparison: cmp(cOut),
          }}
        />
      );
    },
  }),
  // 森林環境譲与税（L-8）。読む県は forest-tax.ts がこのビルドに含まれる県だけに絞る。
  defineCard<ForestTaxRow>({
    id: "l8-forest-tax",
    tab: "kurashi",
    order: 40,
    title: "森林環境譲与税",
    updateFrequency: "年1回",
    sourceLabel: "各自治体の森林環境譲与税の使途公表／総務省 森林環境譲与税の譲与額",
    note: "各自治体の公表資料を自治体Watchが整理。基金の残高は載せていません。",
    resolve: (m) => getForestTax(m.areaCode),
    renderVisualization: (data) => {
      const r = data.row;
      return (
        <ForestTaxCard
          jouyoYen={r.jouyo_yen}
          katsuyoYen={r.katsuyo_yen}
          katsuyoNote={r.katsuyo_basis !== null && r.katsuyo_basis !== "譲与税充当額" ? r.katsuyo_basis : undefined}
          tsumitateYen={r.kikin_tsumitate_yen}
          uses={r.main_uses}
        />
      );
    },
  }),
];

/** 指定入口のカードを order 昇順で返す（並びは非評価的・D-4/D-6/D-12） */
/** 入口のタブ。政令市の区は、「まちのすがた」と、区の値があるカードを持つタブだけ（無いタブは出さない）。区以外は ENTRANCE_TABS のまま */
export function entranceTabsFor(m: MunicipalityConfig): { tab: IaTab; label: string }[] {
  if (m.kind !== "ward") return ENTRANCE_TABS;
  return ENTRANCE_TABS.filter((t) => t.tab === "machi" || cardsForTab(t.tab).some((d) => d.resolve(m) !== null));
}

export function cardsForTab(tab: IaTab): CardDefinition<unknown>[] {
  return CARD_REGISTRY.filter((c) => c.tab === tab).sort((a, b) => a.order - b.order);
}

/** レンダラが出典ラベルを決めるときの共通ヘルパー（動的があれば優先） */
export function resolveSourceLabel(
  def: CardDefinition<unknown>,
  m: MunicipalityConfig,
): string {
  return def.resolveSourceLabel ? def.resolveSourceLabel(m) : def.sourceLabel;
}

/**
 * 経年カテゴリの帰属メタ（ui-vi-handoff §0.8.3 の帰属・§0.8.4 の戻り先/パンくず生成に使う）。
 * trendsCategory を持つカードから機械的に導出する（カテゴリ→入口/カード見出しの単一の出どころ）。
 */
export interface TrendsCategoryMeta {
  category: string;
  tab: IaTab;
  tabLabel: string;
  cardTitle: string;
  cardId: string;
}

/** trendsCategory を設定済みのカードから経年カテゴリ一覧を返す（/trends generateStaticParams の唯一の源） */
export function listTrendsCategories(): TrendsCategoryMeta[] {
  return CARD_REGISTRY.filter((c) => c.trendsCategory).map((c) => ({
    category: c.trendsCategory!,
    tab: c.tab,
    tabLabel: ENTRANCE_TABS.find((t) => t.tab === c.tab)?.label ?? c.tab,
    cardTitle: c.title,
    cardId: c.id,
  }));
}

/** 経年カテゴリ1件のメタを引く。無ければ undefined（経年画面側で notFound に落とす） */
export function getTrendsCategory(category: string): TrendsCategoryMeta | undefined {
  return listTrendsCategories().find((c) => c.category === category);
}

/** category（cardKey）に対応する、trends 描画を持つカード定義を返す（経年ページの委譲先） */
export function getTrendsCard(category: string): CardDefinition<unknown> | undefined {
  return CARD_REGISTRY.find((c) => c.trendsCategory === category && c.trends);
}


