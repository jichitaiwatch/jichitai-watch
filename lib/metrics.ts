import municipalityMasterRaw from "@/data/municipality_master.json";
import { formatPeriodLabel } from "@/lib/staleness";
import kodomoIryohiRaw from "@/data/m1_kodomo_iryohi.json";
import kaigoPremiumRaw from "@/data/m2_kaigo_premium.json";
import expenditureRaw from "@/data/m3_expenditure.json";
import expenditureTimeseriesRaw from "@/data/m3_expenditure_multiyear.json";
import populationTimeseriesRaw from "@/data/m1_1a_population_timeseries.json";
import singleHouseholdRaw from "@/data/m1_1b_single_household.json";
import agingRateRaw from "@/data/m1_1c_aging_rate.json";
import industryRaw from "@/data/m1_2a_industry.json";
import daynightRaw from "@/data/m1_2b_daynight.json";
import taxableIncomeRaw from "@/data/m1_2c_taxable_income.json";
import furusatoRaw from "@/data/m4_5_furusato.json";
import chiefRaw from "@/data/m2_1_chief.json";
import financeRaw from "@/data/m2_2_finance.json";
import financeScaleTimeseriesRaw from "@/data/m2_3_finance_scale_multiyear.json";
import kenzenkaTimeseriesRaw from "@/data/m2_4_kenzenka_shichoson_multiyear.json";
import gikaiAssemblyRaw from "@/data/gikai_assembly.json";

export interface KodomoIryohiRow {
  area_code: string;
  都道府県: string;
  番号: string;
  市区町村名: string;
  対象年齢_通院: string;
  対象年齢_入院: string;
  所得制限_通院: "有" | "無";
  所得制限_入院: "有" | "無";
  一部自己負担_通院: "有" | "無";
  一部自己負担_入院: "有" | "無";
}

/** 全国1,741市区町村の分布（件数。scripts/m1_kodomo_iryohi.py が収録。順位・評価は持たない） */
export interface KodomoIryohiNational {
  母集団: number;
  対象年齢_通院: Record<string, number>;
  対象年齢_入院: Record<string, number>;
  所得制限_通院: Record<string, number>;
  所得制限_入院: Record<string, number>;
  一部自己負担_通院: Record<string, number>;
  一部自己負担_入院: Record<string, number>;
}

export interface KodomoAgeCount {
  /** 「18歳年度末」等。県内にない年齢はまとめて「上記以外」 */
  label: string;
  /** 県内（収録団体）の団体数 */
  pref: number;
  /** 全国の団体数 */
  national: number;
}

export interface KodomoDistribution {
  prefTotal: number;
  nationalTotal: number;
  age: { 通院: KodomoAgeCount[]; 入院: KodomoAgeCount[] };
  /** 「有」の団体数（県内／全国） */
  incomeYes: { 通院: { pref: number; national: number }; 入院: { pref: number; national: number } };
  copayYes: { 通院: { pref: number; national: number }; 入院: { pref: number; national: number } };
}

export interface KaigoPremiumRow {
  都道府県: string;
  市区町村名: string;
  第8期月額基準保険料_円: number;
  第9期月額基準保険料_円: number;
  伸び率: number;
  要介護認定率: number;
}

/**
 * M2データセットのトップレベルに付与された全国平均・岐阜県内平均。
 * 「*_source」が "official" の場合は厚労省公表値、"unweighted_mean" の場合は
 * 抽出した全保険者データの単純算術平均であることを示す（人口・被保険者数に
 * よる加重は行っていない）。この区別はUI側でも曖昧にしないこと。
 */
export interface KaigoAverageBlock {
  insurer_count: number;
  premium_9th_yen: number;
  premium_average_source: "official" | "unweighted_mean";
  premium_average_source_url?: string;
  premium_note: string;
  certification_rate_pct: number;
  certification_rate_source: "official" | "unweighted_mean";
  certification_rate_note: string;
}

export interface ExpenditureRow {
  area_code: string;
  市区町村名: string;
  人口_人: number;
  民生費_千円: number;
  教育費_千円: number;
  土木費_千円: number;
  普通建設事業費_千円: number;
  "民生費_円/人": number;
  "教育費_円/人": number;
  "土木費_円/人": number;
  "普通建設事業費_円/人": number;
}

/** M3の全国/県内平均ブロック（費目別・円/人）。data/m3_expenditure.json の national_average / prefecture_average。
 *  人口加重平均（各費目_千円の合計 ÷ 人口_人の合計 × 1000）であり、各市町村の円/人の単純平均ではない。 */
export interface ExpenditureAverageBlock {
  municipality_count: number;
  note: string;
  "民生費_円/人": number;
  "教育費_円/人": number;
  "土木費_円/人": number;
  "普通建設事業費_円/人": number;
}

/**
 * M3多年度（経年）版。1レコード=1市区町村。各年度キー（fy2015〜fy2024）配下に
 * 当該年度の費目別決算額（千円）と一人あたり額（円/人）・人口を持つ。
 * データ欠損の年度は null（0や前年値で埋めない・data/m3_expenditure_multiyear.json notes）。
 * 経年画面（ui-vi-handoff §5.3 spending / §5.8 折れ線）専用。単年カード（ExpenditureRow）とは別系統。
 */
export const EXPENDITURE_FY_KEYS = [
  "fy2015",
  "fy2016",
  "fy2017",
  "fy2018",
  "fy2019",
  "fy2020",
  "fy2021",
  "fy2022",
  "fy2023",
  "fy2024",
] as const;
export type ExpenditureFyKey = (typeof EXPENDITURE_FY_KEYS)[number];

export interface ExpenditureYearValue {
  人口_人: number;
  民生費_千円: number;
  "民生費_円/人": number;
  教育費_千円: number;
  "教育費_円/人": number;
  土木費_千円: number;
  "土木費_円/人": number;
  普通建設事業費_千円: number;
  "普通建設事業費_円/人": number;
}

export type ExpenditureTimeseriesRow = {
  area_code: string;
  市区町村名: string;
} & { [K in ExpenditureFyKey]: ExpenditureYearValue | null };

/** 年次1時点分の人口・世帯データ（住基）。r2_2020〜r7_2025の6時点が全42件で確認済み */
export interface PopulationYearSnapshot {
  人口_男: number;
  人口_女: number;
  人口_計: number;
  世帯数: number;
  /**
   * 全国・類似団体比較（人口_計・世帯数の2キーのみ。人口_男/女はカード非表示のため対象外）。
   * r7_2025にのみ付与（全国母集団ファイルは令和7年時点のみ取得済みのため）。任意=過去年は未収集。
   */
  comparison?: {
    人口_計: TaxableIncomeComparison;
    世帯数: TaxableIncomeComparison;
  };
}

export interface PopulationTimeseriesRow {
  area_code: string;
  市区町村コード: string;
  都道府県: string;
  市区町村名: string;
  r2_2020: PopulationYearSnapshot;
  r3_2021: PopulationYearSnapshot;
  r4_2022: PopulationYearSnapshot;
  r5_2023: PopulationYearSnapshot;
  r6_2024: PopulationYearSnapshot;
  r7_2025: PopulationYearSnapshot;
}

export interface SingleHouseholdRow {
  area_code: string;
  市区町村コード: string;
  都道府県: string;
  市区町村名: string;
  一般世帯数: number;
  単独世帯数: number;
  単身世帯割合: number;
  /** 全国・類似団体比較（docs/similar-group-aggregation-design.md §4 スキーマ準拠。任意=未収集の指標もあるため） */
  comparison?: TaxableIncomeComparison;
}

export interface AgingRateRow {
  area_code: string;
  市区町村コード: string;
  都道府県: string;
  市区町村名: string;
  総数: number;
  "65歳以上人口": number;
  高齢化率: number;
  /** 全国・類似団体比較（docs/similar-group-aggregation-design.md §4 スキーマ準拠。任意=未収集の指標もあるため） */
  comparison?: TaxableIncomeComparison;
}

export interface TopIndustryEntry {
  産業コード: string;
  産業名: string;
  就業者数: number;
}

export interface IndustryRow {
  area_code: string;
  市区町村コード: string;
  都道府県: string;
  市区町村名: string;
  産業計: number;
  第1次就業者数: number;
  第2次就業者数: number;
  第3次就業者数: number;
  分類不能就業者数: number;
  第1次構成比: number;
  第2次構成比: number;
  第3次構成比: number;
  上位3業種: TopIndustryEntry[];
  /**
   * 全国・類似団体比較（第1次・第2次・第3次構成比の3キーのみ）。
   * docs/similar-group-aggregation-design.md §4 スキーマ準拠。任意=未収集の指標もあるため。
   */
  comparison?: {
    第1次構成比: TaxableIncomeComparison;
    第2次構成比: TaxableIncomeComparison;
    第3次構成比: TaxableIncomeComparison;
  };
}

export interface DaynightRow {
  area_code: string;
  市区町村コード: string;
  都道府県: string;
  市区町村名: string;
  昼夜間人口比率: number;
  /** 全国・類似団体比較（docs/similar-group-aggregation-design.md §4 スキーマ準拠。任意=未収集の指標もあるため） */
  comparison?: TaxableIncomeComparison;
}

/**
 * 全国・類似団体比較値（docs/similar-group-aggregation-design.md §4 スキーマ準拠）。
 * 1-2c 課税対象所得・1-2b 昼夜間人口比率など複数指標で共有する。
 * 評価語・評価色・複合スコアは持たない（中立性・D-4/D-6/D-18）。
 */
export interface TaxableIncomeComparison {
  value: number;
  national_average: number;
  group_code: string;
  group_average: number;
  rank: number;
  rank_out_of: number;
  percentile: number;
  average_method: "unweighted_mean" | "official";
  source_note: string;
}

export interface TaxableIncomeRow {
  area_code: string;
  市区町村名: string;
  課税対象所得_百万円: number;
  納税義務者数_人: number;
  一人あたり課税対象所得_万円: number;
  comparison: TaxableIncomeComparison;
}

/** ふるさと納税（F-6）の一人あたり値の比較。形は TaxableIncomeComparison と同じ（F-5と同一定義） */
export type FurusatoComparison = TaxableIncomeComparison;

export interface FurusatoRow {
  area_code: string;
  市区町村名: string;
  /** 令和7年度の受入件数・金額（決算見込） */
  受入_件数: number;
  受入_金額_円: number;
  /** 令和8年度課税の寄附金税額控除（市町村民税分。控除額は推計値を含む） */
  控除_市町村民税_人数: number;
  控除_市町村民税_寄附金額_円: number;
  控除_市町村民税_控除額_円: number;
  /** 一人あたりの換算に使った住基人口（令和7年1月1日） */
  人口_計: number;
  一人あたり受入額_円: number;
  一人あたり控除額_円: number;
  comparison: {
    一人あたり受入額_円: FurusatoComparison;
    一人あたり控除額_円: FurusatoComparison;
  };
}

/** 無投票の状態。is_mutou=true のとき投票率・得票数・絶対得票率は null（0埋めしない） */
export interface ChiefUncontested {
  is_mutou: boolean;
  token: string | null;
}

/**
 * 首長カード（行政 §0.9 2-1）。生値・事実提示。
 * 得票数 null には2系統ある（無投票／投票実施だが一次未確認）。前者は 無投票.is_mutou=true、
 * 後者は is_mutou=false かつ _note に理由。UIはこの2つと「確認できず」を区別する（欠損規律）。
 * area_code 照合（getExpenditure と同型）。
 */
/** 議会 正副議長（§0.10 3-1）。氏名のみV1採用（content-spec §7.13）。副議長不設置は「無」、未確認は null（等置しない） */
export interface GikaiChoFukucho {
  議長氏名: string | null;
  副議長氏名: string | null;
  status: "有" | "未発見";
}

export interface KaihaEntry {
  会派名: string;
  人数: number;
}

/** 会派（§0.10 3-2）。「確認できず」を「無」に丸めない（content-spec §7.10） */
export interface GikaiKaiha {
  status: "有" | "無" | "確認できず";
  会派一覧: KaihaEntry[] | null;
  /** 会派としては未確定だが判明している参考情報（例：党派別内訳）。集計には用いない注記 */
  参考メモ?: string;
}

/** 議事録本文のWeb公開有無（§0.10 3-4）。議決結果一覧・録画配信・議会だよりは会議録本文でない */
export interface GikaiGijiroku {
  status: "有" | "無";
  公開形式: string | null;
  url: string | string[] | null;
}

export interface GikaiAssemblyRow {
  area_code: string;
  市区町村名: string;
  正副議長: GikaiChoFukucho;
  議員定数: number;
  現員数: number;
  会派: GikaiKaiha;
  議事録公開: GikaiGijiroku;
  data_correction_log?: string[];
  /**
   * 議員定数（条例定数）の全国・類似団体比較（docs/similar-group-aggregation-design.md §4 スキーマ準拠）。
   * 比較対象は条例定数のみ（現員・会派・党派は対象外。components/CouncilSeatsCard.tsx の設計）。
   */
  comparison?: TaxableIncomeComparison;
}

export interface GikaihiRow {
  area_code: string;
  市区町村名: string;
  議会費_千円: number | null;
  議会費_前年_千円: number | null;
}

export interface ChiefRow {
  area_code: string;
  市区町村名: string;
  氏名: string;
  当選年月日: string;
  /** 自治総研定義の当選回数（＝期数ではない。content-spec §7.15）。UIは「当選○回」で表記 */
  回: number;
  投票率: number | null;
  得票数: number | null;
  当日有権者数: number | null;
  /** 絶対得票率＝得票数÷当日有権者数×100（％）。無投票・未確認は null */
  絶対得票率: number | null;
  無投票: ChiefUncontested;
  党派: string;
  _source_year_file?: string;
  _note?: string | string[] | null;
}

/**
 * 健全化判断比率の原表記トークン（m2_2_finance.json ratio_source_tokens）。
 * "-" ＝ 赤字なし／該当なし（原資料の「－」＝事実）。null ＝ 確認できず（空欄）。
 * 値（数値 or null）の null だけでは両者を区別できないため、UI は必ずこのトークンと併読する
 * （ui-vi-handoff §3.2「赤字なし」と「データなし」を混同しない）。
 */
export interface RatioSourceTokens {
  実質赤字比率: string | null;
  連結実質赤字比率: string | null;
  実質公債費比率: string | null;
  将来負担比率: string | null;
}

/**
 * 財政の健全性カード（行政 §0.9 2-2c/d/f/g）。単年（R6）＝m2_2_finance.json が正本
 * （content-spec §7.12 確定表）。多年度 m2_4 は経年画面 fiscal-health 専用で別系統。
 * 値の null は「赤字なし／該当なし('-')」と「確認できず」を兼ねるため ratio_source_tokens と併読する。
 * 実質赤字・連結実質赤字の早期健全化基準は標準財政規模依存で団体別（レコードに持つ）。
 * 実質公債費・将来負担の基準、および赤字系の財政再生基準は都道府県内一律のため
 * statutory_criteria_common（getKenzenkaStatutoryCommon）側にある。
 */
export interface FiscalHealthRow {
  area_code: string;
  市区町村名: string;
  実質公債費比率: number | null;
  将来負担比率: number | null;
  実質赤字比率: number | null;
  連結実質赤字比率: number | null;
  実質赤字比率_早期健全化基準: number;
  連結実質赤字比率_早期健全化基準: number;
  ratio_source_tokens: RatioSourceTokens;
}

/** ファイル共通の法定基準（団体別でない指標の早期健全化・財政再生。市区町村値・％） */
export interface KenzenkaStatutoryCommon {
  実質赤字比率_財政再生基準_市区町村: number;
  連結実質赤字比率_財政再生基準_市区町村: number;
  実質公債費比率_早期健全化基準: number;
  実質公債費比率_財政再生基準: number;
  将来負担比率_早期健全化基準_市区町村: number;
  /** 将来負担比率に財政再生基準は存在しない（原資料「－」＝設定なし）→ null（ui-vi §3.1/§3.8） */
  将来負担比率_財政再生基準: number | null;
}

/** 財政概況の1明細（款 or 目的）。value は当年（R6）の決算額（千円・生値）。0/欠損は含めない */
export interface FinanceLineItem {
  name: string;
  value: number;
}

/** 歳入 or 歳出の1セクション。items は当年（R6）降順・total/priorTotal は当年/前年（R5）の総額（千円） */
export interface FinanceSection {
  total: number;
  priorTotal: number;
  items: FinanceLineItem[];
}

/**
 * 財政概況カード（行政 §0.9 2-2a/2-2b/2-2e）。source＝m2_2_finance.json（普通会計ベース）。
 * V1は普通会計1系統のみ（特別会計・企業会計はデータ不在＋需要の観点で外す。ui-vi §4.6 の3区分展開は
 * V1では採らない）。値は生値（千円）。合計・降順・前年比はUI派生（データ非加工の原則）。
 * 経年（財政規模）は別ファイル m2_3_finance_scale_multiyear.json（後段Stage）。
 */
export interface FinanceOverviewRow {
  area_code: string;
  市区町村名: string;
  revenue: FinanceSection;
  expenditure: FinanceSection;
}

/** 財政規模（経年）1年度分。歳入・歳出は決算総額（千円・生値）。人口は同年度の住基人口 */
export interface FinanceScaleFyValue {
  人口_人: number;
  歳入総額_千円: number;
  歳出総額_千円: number;
}

/**
 * 財政規模の多年度（経年）版。source＝m2_3_finance_scale_multiyear.json（FY2015〜FY2024）。
 * 経年画面 trends/finance（棒グラフ・ui-vi §5.8）専用。年度キーは分野別支出と同一（EXPENDITURE_FY_KEYS）。
 * 欠損年は null（0や前年値で埋めない）。
 */
export type FinanceScaleTimeseriesRow = {
  area_code: string;
  市区町村名: string;
} & { [K in ExpenditureFyKey]: FinanceScaleFyValue | null };

/**
 * 健全化判断比率（経年）の1比率値。number＝実測％。"-"＝該当なし（赤字なし／負担なし＝原資料「－」・事実）。
 * null＝確認できず（概要ファイルに当該行が無い等）。"-" と null を混同しない（ui-vi §5.4）。
 */
export type KenzenkaRatioValue = number | "-" | null;

/** 健全化判断比率（経年）の1年度分。4比率。 */
export interface KenzenkaFyValue {
  実質赤字比率: KenzenkaRatioValue;
  連結実質赤字比率: KenzenkaRatioValue;
  実質公債費比率: KenzenkaRatioValue;
  将来負担比率: KenzenkaRatioValue;
}

/**
 * 健全化判断比率の多年度（経年）版。source＝m2_4_kenzenka_shichoson_multiyear.json（FY2015〜FY2024）。
 * 経年画面 trends/fiscal-health（比率ごと折れ線＋法定基準線・ui-vi §5.9）専用。
 * 法定基準（早期健全化・財政再生）は本ファイルに無く、単年（m2_2）側の
 * getKenzenkaSingleYear（赤字系の早期＝団体別）と getKenzenkaStatutoryCommon（共通）から取る。
 */
export type KenzenkaTimeseriesRow = {
  area_code: string;
  市区町村名: string;
} & { [K in ExpenditureFyKey]: KenzenkaFyValue | null };

/**
 * データ系譜メタの1エントリ。1つの取得元ファイルに対応する。
 * 仕様の正本: docs/data-schema.md 5.1節。
 */
export interface DataSourceEntry {
  role?: string;
  source_url: string;
  source_page?: string;
  fetched_at: string;
  source_file_hash: string;
}

/**
 * 出典フッターのリンク先URLを sources エントリから選ぶ共通ヘルパー。
 *
 * 規約: 市区町村版JSONは source_page に「出典掲載ページのURL」、source_url に
 * 「実ファイル(xlsx/pdf)のURL」を入れる。一方、県版(pref_*)JSONの一部は
 * source_page に出典名ラベル（URLでない文字列）を入れ、掲載ページURLは
 * source_page_url、実ファイルURLは source_url に持つ、という別体系になっている。
 * 旧実装 `source_page ?? source_url` はラベルをそのまま href に流し込み、
 * 県版 gikai/gyosei で行き止まりリンク(href=出典名)を生んでいた（C-1で検出）。
 *
 * 対策: source_page / source_page_url / source_url / download_page のうち
 * 「http(s) で始まる値」だけを、掲載ページ優先の順で採用する。URLが1つも
 * 無ければ undefined（MetricCard はリンクにせずラベルのみ表示）。値の推測や
 * 合成はしない（無ければ出さない・欠損規律）。
 */
export function pickSourceUrl(
  entry:
    | {
        source_page?: string;
        source_page_url?: string;
        source_url?: string;
        download_page?: string;
      }
    | undefined
    | null,
): string | undefined {
  if (!entry) return undefined;
  const isUrl = (v: unknown): v is string =>
    typeof v === "string" && /^https?:\/\//i.test(v);
  const candidates = [
    entry.source_page,
    entry.source_page_url,
    entry.source_url,
    entry.download_page,
  ];
  for (const c of candidates) {
    if (isUrl(c)) return c;
  }
  return undefined;
}

export interface DataMeta {
  /** 人間可読な出典表記に使う元データ側のURL（存在する場合のみ） */
  sourceUrl?: string;
  /** データ更新日（YYYY-MM-DD） */
  updated: string;
  /** 対象年度の表示ラベル（Gate 4・例「令和5年度（2023）」）。持たないデータセットではundefined */
  periodLabel?: string;
  /** データ取得日（YYYY-MM-DD・Gate 4 陳腐化判定の起点）。持たない場合はundefined */
  fetchedAt?: string;
  /** データ系譜メタ配列（docs/data-schema.md 5.1節）。未投入のデータセットではundefined */
  sources?: DataSourceEntry[];
}

/**
 * 人口時系列（m1_1a_population_timeseries.json）のsourcesは年ごとに1エントリ（year_key/year_label付き）。
 * 通常のDataSourceEntryにこの2項目を加えた形。Gate 4 periodLabel算出（getPopulationTimeseries）専用。
 */
interface PopulationSourceEntry extends DataSourceEntry {
  year_key: string;
  year_label: string;
}

/** 人口カードが「現在」として表示する年キー（PopulationCard.tsxの前年比算出はr7_2025/r6_2024前提）。
 *  新しい年次データが追加されたら、この値も合わせて更新する。 */
const POPULATION_CURRENT_YEAR_KEY = "r7_2025";

interface MunicipalityMasterRecord {
  area_code: string;
  pref_name: string;
  city_name: string;
  kaigo_insurer_name: string;
}

const municipalityMasterDataset = municipalityMasterRaw as {
  data: MunicipalityMasterRecord[];
};

function getMasterByAreaCode(areaCode: string): MunicipalityMasterRecord | undefined {
  return municipalityMasterDataset.data.find((r) => r.area_code === areaCode);
}

const kodomoIryohiDataset = kodomoIryohiRaw as {
  updated: string;
  period?: string;
  national: KodomoIryohiNational;
  data: KodomoIryohiRow[];
  sources?: DataSourceEntry[];
};

const kaigoPremiumDataset = kaigoPremiumRaw as {
  updated: string;
  period?: string;
  data: KaigoPremiumRow[];
  national_average?: KaigoAverageBlock;
  prefecture_average?: KaigoAverageBlock & { prefecture: string };
  sources?: DataSourceEntry[];
};

const expenditureDataset = expenditureRaw as {
  updated: string;
  year_label?: string;
  data: ExpenditureRow[];
  national_average?: ExpenditureAverageBlock;
  prefecture_average?: (ExpenditureAverageBlock & { prefecture: string }) | undefined;
  sources?: DataSourceEntry[];
};

const gikaiAssemblyDataset = gikaiAssemblyRaw as unknown as {
  updated: string;
  data: GikaiAssemblyRow[];
  sources?: DataSourceEntry[];
};

// 多年度JSONの sources は単年版（DataSourceEntry: source_file_hash）とキー体系が異なり
// （fy/role/source_file_hash_sha256/cache_file）、直キャストが型不一致になる。
// UI では出典URLしか使わないため、実キーに合わせた最小型で受け、meta では sourceUrl に正規化する。
const expenditureTimeseriesDataset = expenditureTimeseriesRaw as unknown as {
  updated: string;
  data: ExpenditureTimeseriesRow[];
  sources?: { source_url: string; source_page?: string }[];
};

// m2_3 の sources は fy 別（fy/role/source_url/source_page/sha256/cache_file）で DataSourceEntry 非互換。
// UI は出典URLと更新日だけ使うため最小型で受ける（getExpenditureTimeseries と同じ扱い）。
const financeScaleTimeseriesDataset = financeScaleTimeseriesRaw as unknown as {
  updated: string;
  data: FinanceScaleTimeseriesRow[];
  sources?: { source_url?: string; source_page?: string }[];
};

// m2_4 の sources は fy 別（fy/role/source_url/source_page/sha256/cache_file）で DataSourceEntry 非互換。
const kenzenkaTimeseriesDataset = kenzenkaTimeseriesRaw as unknown as {
  updated: string;
  data: KenzenkaTimeseriesRow[];
  sources?: { source_url?: string; source_page?: string }[];
};

const populationTimeseriesDataset = populationTimeseriesRaw as {
  updated: string;
  period?: string;
  data: PopulationTimeseriesRow[];
  sources?: PopulationSourceEntry[];
};

const singleHouseholdDataset = singleHouseholdRaw as {
  updated: string;
  period?: string;
  data: SingleHouseholdRow[];
  sources?: DataSourceEntry[];
};

const agingRateDataset = agingRateRaw as {
  updated: string;
  period?: string;
  data: AgingRateRow[];
  sources?: DataSourceEntry[];
};

const industryDataset = industryRaw as {
  updated: string;
  period?: string;
  data: IndustryRow[];
  sources?: DataSourceEntry[];
};

const daynightDataset = daynightRaw as {
  updated: string;
  period?: string;
  data: DaynightRow[];
  sources?: DataSourceEntry[];
};

const furusatoDataset = furusatoRaw as {
  updated: string;
  period?: string;
  data: FurusatoRow[];
  sources?: DataSourceEntry[];
};

const taxableIncomeDataset = taxableIncomeRaw as {
  updated: string;
  period?: string;
  data: TaxableIncomeRow[];
  sources?: DataSourceEntry[];
};

// 首長JSONは top-level に updated を持たず、sources も独自形（provider/dataset/files[]/fetched_at）
// のため DataSourceEntry と不一致。UI は出典URL（download_page）と取得日（fetched_at）だけ使うので
// 実キーに合わせた最小型で受ける（getExpenditureTimeseries と同じ扱い）。
// 2026-09-20判明・是正：sources は配列ではなくオブジェクト単体（実データ確認済み）。従来 `sources?: {...}[]`
// と誤って配列型にしていたため、`sources?.[0]` は常にundefinedを返し、sourceUrl/updatedが機能していなかった
// （period/year_label相当のフィールドはこのJSONに無いためperiodLabelは付与しない＝undefinedのまま）。
const chiefDataset = chiefRaw as unknown as {
  data: ChiefRow[];
  sources?: {
    provider?: string;
    dataset?: string;
    download_page?: string;
    fetched_at?: string;
  };
};

// m2_2_finance.json はレコードに revenue/expenditure（財政概況・後続Stage）と健全化比率を同居させる。
// 本Stageは健全化比率のフィールドのみ参照する（FiscalHealthRow へ絞り込み）。sources[0] は
// DataSourceEntry 互換（role/source_url/source_page/fetched_at/source_file_hash）。
const financeDataset = financeRaw as unknown as {
  updated: string;
  statutory_criteria_common: KenzenkaStatutoryCommon;
  /** 歳入款キーの並び（R6/R5で款が異なる：R5のみ「特別地方消費税交付金」が残る等） */
  revenue_kan_keys_r6: string[];
  revenue_kan_keys_r5: string[];
  /** 歳出目的キーの並び（R6/R5共通の14目的。議会費が先頭） */
  expenditure_purpose_keys: string[];
  data: { area_code: string }[];
  sources?: DataSourceEntry[];
};

/**
 * M1 子ども医療費助成を area_code で照合して返す（getExpenditure と同型）。
 */
export function getKodomoIryohi(
  areaCode: string,
): { row: KodomoIryohiRow; meta: DataMeta } | null {
  const row = kodomoIryohiDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(kodomoIryohiDataset.sources?.[0]),
      updated: kodomoIryohiDataset.updated,
      periodLabel: formatPeriodLabel(kodomoIryohiDataset.period),
      fetchedAt: kodomoIryohiDataset.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: kodomoIryohiDataset.sources,
    },
  };
}

function ageRank(label: string): number {
  if (label === "就学前") return 0;
  const m = label.match(/^(\d+)歳年度末$/);
  return m ? Number(m[1]) : 999;
}

/**
 * 子ども医療費助成の分布（県内の収録団体と全国1,741市区町村の団体数）。事実の件数のみで順位・評価は付けない。
 * 年齢は県内に現れる区分を年齢の小さい順に並べ、県内にない区分は全国分を「上記以外」にまとめる。
 */
export function getKodomoIryohiDistribution(): KodomoDistribution {
  const rows = kodomoIryohiDataset.data;
  const nat = kodomoIryohiDataset.national;
  const ageOf = (kind: "通院" | "入院"): KodomoAgeCount[] => {
    const key = `対象年齢_${kind}` as const;
    const prefCount: Record<string, number> = {};
    for (const r of rows) prefCount[r[key]] = (prefCount[r[key]] ?? 0) + 1;
    const labels = Object.keys(prefCount).sort((a, b) => ageRank(a) - ageRank(b));
    const out: KodomoAgeCount[] = labels.map((label) => ({
      label,
      pref: prefCount[label],
      national: nat[key][label] ?? 0,
    }));
    const otherNational = Object.entries(nat[key])
      .filter(([label]) => !(label in prefCount))
      .reduce((sum, [, n]) => sum + n, 0);
    if (otherNational > 0) out.push({ label: "上記以外", pref: 0, national: otherNational });
    return out;
  };
  const yes = (field: "所得制限" | "一部自己負担", kind: "通院" | "入院") => {
    const key = `${field}_${kind}` as const;
    return {
      pref: rows.filter((r) => r[key] === "有").length,
      national: nat[key]["有"] ?? 0,
    };
  };
  return {
    prefTotal: rows.length,
    nationalTotal: nat.母集団,
    age: { 通院: ageOf("通院"), 入院: ageOf("入院") },
    incomeYes: { 通院: yes("所得制限", "通院"), 入院: yes("所得制限", "入院") },
    copayYes: { 通院: yes("一部自己負担", "通院"), 入院: yes("一部自己負担", "入院") },
  };
}

/**
 * M2 介護保険料を area_code で照合して返す。
 * 1保険者→複数自治体のため、area_code で municipality_master の
 * kaigo_insurer_name を引き、その保険者名で m2（保険者単位のまま）を照合する。
 * 広域連合ハードコードは持たない（master が唯一の自治体→保険者名対応表）。
 */
export function getKaigoPremium(
  areaCode: string,
): { row: KaigoPremiumRow; meta: DataMeta } | null {
  const master = getMasterByAreaCode(areaCode);
  if (!master || !master.kaigo_insurer_name) return null;
  const row = kaigoPremiumDataset.data.find(
    (r) =>
      r.都道府県 === master.pref_name && r.市区町村名 === master.kaigo_insurer_name,
  );
  if (!row) return null;
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(kaigoPremiumDataset.sources?.[0]),
      updated: kaigoPremiumDataset.updated,
      periodLabel: formatPeriodLabel(kaigoPremiumDataset.period),
      fetchedAt: kaigoPremiumDataset.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: kaigoPremiumDataset.sources,
    },
  };
}

/**
 * M2データセットのトップレベルに付与された全国平均・都道府県内平均を返す。
 * 特定の自治体行とは独立したデータセット全体の統計であるため、市区町村
 * 単位の照合キーは不要。
 */
export function getKaigoAverages(): {
  national: KaigoAverageBlock | null;
  prefecture: (KaigoAverageBlock & { prefecture: string }) | null;
} {
  return {
    national: kaigoPremiumDataset.national_average ?? null,
    prefecture: kaigoPremiumDataset.prefecture_average ?? null,
  };
}

/**
 * M2の出典表記を保険者単位で組み立てる。保険者が単一市区町村ではなく
 * 広域連合の場合、この自治体単独で決めた基準額ではないことが分かるよう
 * 保険者名を明記する（例:「厚生労働省 第9期集計（保険者: もとす広域連合）」）。
 */
export function getKaigoPremiumSourceLabel(insurerName: string): string {
  return insurerName.includes("広域連合")
    ? `厚生労働省 第9期集計（保険者: ${insurerName}）`
    : "厚生労働省 第9期集計";
}

export function getExpenditure(
  areaCode: string,
): { row: ExpenditureRow; meta: DataMeta } | null {
  const row = expenditureDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row,
    meta: {
      updated: expenditureDataset.updated,
      periodLabel: formatPeriodLabel(expenditureDataset.year_label),
      fetchedAt: expenditureDataset.sources?.[0]?.fetched_at,
      sources: expenditureDataset.sources,
    },
  };
}

/**
 * M3分野別支出の全国／県内平均（費目別・円/人）。団体に依らずデータセット共通のため、
 * area_code を取らずデータセットから直接返す（getExpenditure とは別経路）。いずれも人口加重平均。
 */
export function getExpenditureAverages(): {
  national: ExpenditureAverageBlock | null;
  prefecture: ExpenditureAverageBlock | null;
} {
  return {
    national: expenditureDataset.national_average ?? null,
    prefecture: expenditureDataset.prefecture_average ?? null,
  };
}

/**
 * M3多年度（経年）版を area_code で照合して返す。経年画面（trends/spending）専用。
 * 単年カードの getExpenditure とは別データセット・別戻り型。
 */
export function getExpenditureTimeseries(
  areaCode: string,
): { row: ExpenditureTimeseriesRow; meta: DataMeta } | null {
  const row = expenditureTimeseriesDataset.data.find(
    (r) => r.area_code === areaCode,
  );
  if (!row) return null;
  const first = expenditureTimeseriesDataset.sources?.[0];
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(first),
      updated: expenditureTimeseriesDataset.updated,
    },
  };
}

/**
 * 財政規模（経年）を area_code で照合して返す。source＝m2_3_finance_scale_multiyear.json。
 * 経年画面 trends/finance（棒グラフ・ui-vi §5.8）専用。
 */
export function getFinanceScaleTimeseries(
  areaCode: string,
): { row: FinanceScaleTimeseriesRow; meta: DataMeta } | null {
  const row = financeScaleTimeseriesDataset.data.find(
    (r) => r.area_code === areaCode,
  );
  if (!row) return null;
  const first = financeScaleTimeseriesDataset.sources?.[0];
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(first),
      updated: financeScaleTimeseriesDataset.updated,
    },
  };
}

/**
 * 健全化判断比率（経年）を area_code で照合して返す。source＝m2_4_kenzenka_shichoson_multiyear.json。
 * 経年画面 trends/fiscal-health（比率ごと折れ線＋法定基準線・ui-vi §5.9）専用。
 */
export function getKenzenkaTimeseries(
  areaCode: string,
): { row: KenzenkaTimeseriesRow; meta: DataMeta } | null {
  const row = kenzenkaTimeseriesDataset.data.find(
    (r) => r.area_code === areaCode,
  );
  if (!row) return null;
  const first = kenzenkaTimeseriesDataset.sources?.[0];
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(first),
      updated: kenzenkaTimeseriesDataset.updated,
    },
  };
}

/**
 * まち系5データセット（人口時系列・単身世帯・高齢化率・産業・昼夜間人口比率）は
 * area_code（6桁）で照合する。元データの市区町村コードが5桁/6桁で不揃いでも、
 * 名寄せで付与した area_code に統一している。
 */
export function getPopulationTimeseries(
  areaCode: string,
): { row: PopulationTimeseriesRow; meta: DataMeta } | null {
  const row = populationTimeseriesDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  // PopulationCard.tsxが表示する「現在」はPOPULATION_CURRENT_YEAR_KEY年分のため、
  // periodLabel/fetchedAtもその年のsourcesエントリから取る（データセット全体のperiodではない）。
  const currentSource = populationTimeseriesDataset.sources?.find(
    (s) => s.year_key === POPULATION_CURRENT_YEAR_KEY,
  );
  return {
    row,
    meta: {
      updated: populationTimeseriesDataset.updated,
      periodLabel: formatPeriodLabel(currentSource?.year_label),
      fetchedAt: currentSource?.fetched_at?.slice(0, 10),
      sources: populationTimeseriesDataset.sources,
    },
  };
}

export function getSingleHousehold(
  areaCode: string,
): { row: SingleHouseholdRow; meta: DataMeta } | null {
  const row = singleHouseholdDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row,
    meta: {
      updated: singleHouseholdDataset.updated,
      periodLabel: formatPeriodLabel(singleHouseholdDataset.period),
      fetchedAt: singleHouseholdDataset.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: singleHouseholdDataset.sources,
    },
  };
}

export function getAgingRate(
  areaCode: string,
): { row: AgingRateRow; meta: DataMeta } | null {
  const row = agingRateDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row,
    meta: {
      updated: agingRateDataset.updated,
      periodLabel: formatPeriodLabel(agingRateDataset.period),
      fetchedAt: agingRateDataset.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: agingRateDataset.sources,
    },
  };
}

export function getIndustry(
  areaCode: string,
): { row: IndustryRow; meta: DataMeta } | null {
  const row = industryDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row,
    meta: {
      updated: industryDataset.updated,
      periodLabel: formatPeriodLabel(industryDataset.period),
      fetchedAt: industryDataset.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: industryDataset.sources,
    },
  };
}

export function getDaynight(
  areaCode: string,
): { row: DaynightRow; meta: DataMeta } | null {
  const row = daynightDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row,
    meta: {
      updated: daynightDataset.updated,
      periodLabel: formatPeriodLabel(daynightDataset.period),
      fetchedAt: daynightDataset.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: daynightDataset.sources,
    },
  };
}

export function getTaxableIncome(
  areaCode: string,
): { row: TaxableIncomeRow; meta: DataMeta } | null {
  const row = taxableIncomeDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row,
    meta: {
      updated: taxableIncomeDataset.updated,
      periodLabel: formatPeriodLabel(taxableIncomeDataset.period),
      fetchedAt: taxableIncomeDataset.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: taxableIncomeDataset.sources,
    },
  };
}

/** ふるさと納税（F-6・くらし）を area_code で照合して返す。 */
export function getFurusato(
  areaCode: string,
): { row: FurusatoRow; meta: DataMeta } | null {
  const row = furusatoDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(furusatoDataset.sources?.[0]),
      updated: furusatoDataset.updated,
      periodLabel: formatPeriodLabel(furusatoDataset.period),
      fetchedAt: furusatoDataset.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: furusatoDataset.sources,
    },
  };
}

/**
 * 首長（行政 2-1）を area_code で照合して返す（getExpenditure と同型）。
 * 首長JSONは updated を持たないため、取得日は sources[0].fetched_at の日付部分を用いる。
 * 出典URLは自治総研のダウンロードページ（利用条件: 実施機関名＋「自治体選挙結果調査」明記が必須）。
 */
export function getChief(
  areaCode: string,
): { row: ChiefRow; meta: DataMeta } | null {
  const row = chiefDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  // sources はこのJSONでは配列でなくオブジェクト単体（2026-09-20是正・従来の `?.[0]` は常にundefined）。
  const src = chiefDataset.sources;
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(src),
      updated: src?.fetched_at ? src.fetched_at.slice(0, 10) : "-",
      fetchedAt: src?.fetched_at ? src.fetched_at.slice(0, 10) : undefined,
      // period/year_label相当のフィールドがこのJSONに無いためperiodLabelは付与しない（推測しない）。
    },
  };
}

/**
 * 財政の健全性（単年・R6）を area_code で照合して返す。source＝m2_2_finance.json。
 * 返す row は健全化比率フィールドに絞る（FiscalHealthRow）。法定基準の団体別分（赤字系の
 * 早期健全化基準）は row 内、共通分は getKenzenkaStatutoryCommon で取る。
 */
export function getKenzenkaSingleYear(
  areaCode: string,
): { row: FiscalHealthRow; meta: DataMeta } | null {
  const row = financeDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row: row as unknown as FiscalHealthRow,
    meta: {
      sourceUrl: pickSourceUrl(financeDataset.sources?.[0]),
      updated: financeDataset.updated,
      sources: financeDataset.sources,
    },
  };
}

/**
 * 議会のすがた（§0.10 3-1/3-2/3-4）を area_code で照合して返す。source＝gikai_assembly.json。
 * 3-1正副議長・3-2議員定数現員・3-2会派・3-4議事録公開の4項目をまとめて持つ。
 */
export function getGikaiAssembly(
  areaCode: string,
): { row: GikaiAssemblyRow; meta: DataMeta } | null {
  const row = gikaiAssemblyDataset.data.find((r) => r.area_code === areaCode);
  if (!row) return null;
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(gikaiAssemblyDataset.sources?.[0]),
      updated: gikaiAssemblyDataset.updated,
      // sourcesは項目ごとに取得日が異なる複合台帳（content-spec-v1.md §7.13）のため、
      // 単一の取得日としてはデータセット全体の確定日（updated）を採用する（運営者裁定・2026-09-20）。
      fetchedAt: gikaiAssemblyDataset.updated,
      // period/year_label相当のフィールドがこのJSONに無いためperiodLabelは付与しない（推測しない）。
      sources: gikaiAssemblyDataset.sources,
    },
  };
}

/**
 * 議会費（§0.10 3-3）を area_code で照合して返す。source＝m2_2_finance.json
 * （expenditure_purpose_keys 先頭＝議会費・財政概況カードと共有・再配置のみ）。
 */
export function getGikaihi(
  areaCode: string,
): { row: GikaihiRow; meta: DataMeta } | null {
  const raw = financeDataset.data.find((r) => r.area_code === areaCode) as unknown as
    | {
        area_code: string;
        市区町村名: string;
        expenditure_purpose_r6: Record<string, number | null>;
        expenditure_purpose_r5: Record<string, number | null>;
      }
    | undefined;
  if (!raw) return null;
  const key = financeDataset.expenditure_purpose_keys[0];
  const row: GikaihiRow = {
    area_code: raw.area_code,
    市区町村名: raw.市区町村名,
    議会費_千円: raw.expenditure_purpose_r6[key] ?? null,
    議会費_前年_千円: raw.expenditure_purpose_r5[key] ?? null,
  };
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(financeDataset.sources?.[0]),
      updated: financeDataset.updated,
      sources: financeDataset.sources,
    },
  };
}

/** ファイル共通の法定基準（データセット全体の定数。getKaigoAverages と同型で団体照合キー不要） */
export function getKenzenkaStatutoryCommon(): KenzenkaStatutoryCommon {
  return financeDataset.statutory_criteria_common;
}

/**
 * 財政概況（普通会計・R6内訳＋R5前年比）を area_code で照合して返す。source＝m2_2_finance.json。
 * items は当年（R6）の各款/目的を降順に並べたもの（0・欠損 null は除外）。total/priorTotal は
 * 全款/全目的の合計（当年/前年）。トップNの切り出し・構成比・前年比の符号表示はコンポーネント側。
 */
export function getFinanceOverview(
  areaCode: string,
): { row: FinanceOverviewRow; meta: DataMeta } | null {
  const raw = financeDataset.data.find((r) => r.area_code === areaCode) as unknown as
    | {
        area_code: string;
        市区町村名: string;
        revenue_r6: Record<string, number | null>;
        expenditure_purpose_r6: Record<string, number | null>;
        revenue_r5: Record<string, number | null>;
        expenditure_purpose_r5: Record<string, number | null>;
      }
    | undefined;
  if (!raw) return null;

  const sumBy = (obj: Record<string, number | null>, keys: string[]): number =>
    keys.reduce((s, k) => s + (typeof obj[k] === "number" ? (obj[k] as number) : 0), 0);

  const itemsBy = (obj: Record<string, number | null>, keys: string[]): FinanceLineItem[] =>
    keys
      .map((k) => ({ name: k, value: obj[k] }))
      .filter((x): x is FinanceLineItem => typeof x.value === "number" && x.value > 0)
      .sort((a, b) => b.value - a.value);

  const row: FinanceOverviewRow = {
    area_code: raw.area_code,
    市区町村名: raw.市区町村名,
    revenue: {
      total: sumBy(raw.revenue_r6, financeDataset.revenue_kan_keys_r6),
      priorTotal: sumBy(raw.revenue_r5, financeDataset.revenue_kan_keys_r5),
      items: itemsBy(raw.revenue_r6, financeDataset.revenue_kan_keys_r6),
    },
    expenditure: {
      total: sumBy(raw.expenditure_purpose_r6, financeDataset.expenditure_purpose_keys),
      priorTotal: sumBy(raw.expenditure_purpose_r5, financeDataset.expenditure_purpose_keys),
      items: itemsBy(raw.expenditure_purpose_r6, financeDataset.expenditure_purpose_keys),
    },
  };

  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(financeDataset.sources?.[0]),
      updated: financeDataset.updated,
      sources: financeDataset.sources,
    },
  };
}


