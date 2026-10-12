// lib/pref-metrics.ts
//
// 都道府県レイヤーのデータアクセス層（市区町村版 lib/metrics.ts と対）。
// 都道府県自身の統治データ（data/pref_*.json）を読み、UI（Stage 2の pref-card-registry）が
// 消費する形へ整える。市区町村と共通の型・戻り値エンベロープ（{ row, meta } / DataMeta）は
// lib/metrics.ts から再利用し、二重定義を避ける（保守性）。
//
// 照合キーは系統で異なる（data/pref_*.json を実データで確認）：
//   - まち（pref_1a〜2b）／比較（pref_comparison_*）：都道府県名 で一致
//     （先頭に全国計行＝都道府県名 "合計"/"全国" が混在するが、県名不一致で自然に除外される）。
//   - 行政・議会（pref_governor / pref_kessan / pref_expenditure_percapita /
//     pref_assembly / pref_fiscal_indicators）：pref_code（2桁）で一致。

import type {
  DataMeta,
  DataSourceEntry,
  ChiefRow,
  ChiefUncontested,
  GikaiAssemblyRow,
  GikaiChoFukucho,
  GikaiKaiha,
  KaihaEntry,
  GikaiGijiroku,
  GikaihiRow,
  FinanceOverviewRow,
  FinanceLineItem,
  TopIndustryEntry,
  PopulationYearSnapshot,
} from "@/lib/metrics";
import { pickSourceUrl } from "@/lib/metrics";

import pref1aRaw from "@/data/pref_1a_population.json";
import prefPopTimeseriesRaw from "@/data/pref_1a_population_timeseries.json";
import pref1bRaw from "@/data/pref_1b_single_household.json";
import pref1cRaw from "@/data/pref_1c_aging_rate.json";
import pref1dRaw from "@/data/pref_1d_taxable_income.json";
import pref2aRaw from "@/data/pref_2a_industry.json";
import pref2bRaw from "@/data/pref_2b_daynight.json";
import prefGovernorRaw from "@/data/pref_governor.json";
import prefKessanRaw from "@/data/pref_kessan.json";
import prefFiscalRaw from "@/data/pref_fiscal_indicators.json";
import prefExpPercapRaw from "@/data/pref_expenditure_percapita.json";
import prefAssemblyRaw from "@/data/pref_assembly.json";
import prefCmp1aRaw from "@/data/pref_comparison_1a_population.json";
import prefCmp1bRaw from "@/data/pref_comparison_1b_single_household.json";
import prefCmp1cRaw from "@/data/pref_comparison_1c_aging_rate.json";
import prefCmp1dRaw from "@/data/pref_comparison_1d_taxable_income.json";
import prefCmp2aRaw from "@/data/pref_comparison_2a_industry.json";
import prefCmp2bRaw from "@/data/pref_comparison_2b_daynight.json";

// ---------------------------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------------------------

/** 都道府県系JSONの meta を組み立てる（sourceUrl は pickSourceUrl でURL値のみ採用・updated は top-level）。 */
function prefMeta(ds: {
  updated?: string;
  sources?: { source_url?: string; source_page?: string; fetched_at?: string }[];
}): DataMeta {
  const s = ds.sources?.[0];
  return {
    sourceUrl: pickSourceUrl(s),
    updated: ds.updated ?? (s?.fetched_at ? s.fetched_at.slice(0, 10) : "-"),
    sources: ds.sources as DataSourceEntry[] | undefined,
  };
}

// ===========================================================================
// まち（pref_1a〜2b）：都道府県名で照合。全国計行は県名不一致で自然に除外。
// 戻り値はまち系の県ネイティブ行（市区町村版と metric フィールド名は一致するが、
// キーが 都道府県名・人口は年ネストなしのフラット構造である点が異なる）。
// ===========================================================================

export interface PrefPopulationRow {
  都道府県コード: string;
  都道府県名: string;
  人口_男: number;
  人口_女: number;
  人口_計: number;
  世帯数: number;
}
export interface PrefPopulationTimeseriesRow {
  都道府県コード: string;
  都道府県名: string;
  r2_2020: PopulationYearSnapshot;
  r3_2021: PopulationYearSnapshot;
  r4_2022: PopulationYearSnapshot;
  r5_2023: PopulationYearSnapshot;
  r6_2024: PopulationYearSnapshot;
  r7_2025: PopulationYearSnapshot;
}
export interface PrefSingleHouseholdRow {
  都道府県コード: string;
  都道府県名: string;
  一般世帯数: number;
  単独世帯数: number;
  単身世帯割合: number;
}
export interface PrefAgingRateRow {
  都道府県コード: string;
  都道府県名: string;
  総数: number;
  "65歳以上人口": number;
  高齢化率: number;
}
export interface PrefTaxableIncomeRow {
  都道府県コード: string;
  都道府県名: string;
  課税対象所得_百万円: number;
  納税義務者数_人: number;
  一人あたり課税対象所得_万円: number;
}
export interface PrefIndustryRow {
  都道府県コード: string;
  都道府県名: string;
  産業計: number;
  第1次就業者数: number;
  第2次就業者数: number;
  第3次就業者数: number;
  分類不能就業者数: number;
  第1次構成比: number;
  第2次構成比: number;
  第3次構成比: number;
  上位3業種: TopIndustryEntry[];
}
export interface PrefDaynightRow {
  都道府県コード: string;
  都道府県名: string;
  昼夜間人口比率: number;
}

const pref1aDataset = pref1aRaw as unknown as {
  updated?: string;
  data: PrefPopulationRow[];
  sources?: DataSourceEntry[];
};
const prefPopTimeseriesDataset = prefPopTimeseriesRaw as unknown as {
  updated?: string;
  data: PrefPopulationTimeseriesRow[];
  sources?: DataSourceEntry[];
};
const pref1bDataset = pref1bRaw as unknown as {
  updated?: string;
  data: PrefSingleHouseholdRow[];
  sources?: DataSourceEntry[];
};
const pref1cDataset = pref1cRaw as unknown as {
  updated?: string;
  data: PrefAgingRateRow[];
  sources?: DataSourceEntry[];
};
const pref1dDataset = pref1dRaw as unknown as {
  updated?: string;
  data: PrefTaxableIncomeRow[];
  sources?: DataSourceEntry[];
};
const pref2aDataset = pref2aRaw as unknown as {
  updated?: string;
  data: PrefIndustryRow[];
  sources?: DataSourceEntry[];
};
const pref2bDataset = pref2bRaw as unknown as {
  updated?: string;
  data: PrefDaynightRow[];
  sources?: DataSourceEntry[];
};

function findByPrefName<T extends { 都道府県名: string }>(
  rows: T[],
  prefectureName: string,
): T | undefined {
  return rows.find((r) => r.都道府県名 === prefectureName);
}

export function getPrefPopulation(
  prefectureName: string,
): { row: PrefPopulationRow; meta: DataMeta } | null {
  const row = findByPrefName(pref1aDataset.data, prefectureName);
  return row ? { row, meta: prefMeta(pref1aDataset) } : null;
}
export function getPrefPopulationTimeseries(
  prefectureName: string,
): { row: PrefPopulationTimeseriesRow; meta: DataMeta } | null {
  const row = findByPrefName(prefPopTimeseriesDataset.data, prefectureName);
  return row ? { row, meta: prefMeta(prefPopTimeseriesDataset) } : null;
}
export function getPrefSingleHousehold(
  prefectureName: string,
): { row: PrefSingleHouseholdRow; meta: DataMeta } | null {
  const row = findByPrefName(pref1bDataset.data, prefectureName);
  return row ? { row, meta: prefMeta(pref1bDataset) } : null;
}
export function getPrefAgingRate(
  prefectureName: string,
): { row: PrefAgingRateRow; meta: DataMeta } | null {
  const row = findByPrefName(pref1cDataset.data, prefectureName);
  return row ? { row, meta: prefMeta(pref1cDataset) } : null;
}
export function getPrefTaxableIncome(
  prefectureName: string,
): { row: PrefTaxableIncomeRow; meta: DataMeta } | null {
  const row = findByPrefName(pref1dDataset.data, prefectureName);
  return row ? { row, meta: prefMeta(pref1dDataset) } : null;
}
export function getPrefIndustry(
  prefectureName: string,
): { row: PrefIndustryRow; meta: DataMeta } | null {
  const row = findByPrefName(pref2aDataset.data, prefectureName);
  return row ? { row, meta: prefMeta(pref2aDataset) } : null;
}
export function getPrefDaynight(
  prefectureName: string,
): { row: PrefDaynightRow; meta: DataMeta } | null {
  const row = findByPrefName(pref2bDataset.data, prefectureName);
  return row ? { row, meta: prefMeta(pref2bDataset) } : null;
}

// ===========================================================================
// 行政：首長（pref_governor）／財政概況（pref_kessan）／財政健全性（pref_fiscal_indicators）
// pref_code で照合。首長・財政概況は市区町村と同じ ChiefRow/FinanceOverviewRow へ写像し、
// 既存カード（ChiefCard/FinanceOverviewCard）を無改修で流用する。
// ===========================================================================

interface PrefGovernorRecord {
  pref_code: string;
  pref_name: string;
  氏名: string;
  当選回数: number;
  当選年月日: string;
  投票率: number | null;
  得票数: number | null;
  当日有権者数: number | null;
  絶対得票率: number | null;
  党派: string;
  無投票: ChiefUncontested;
  status?: string;
  _source_year_file?: string;
  _note?: string | null;
}
// 県版首長JSON（pref_governor）も市区町村版首長JSON（chiefRaw）と同じ独自形
// （provider/dataset/files[]/fetched_at）を持ち、sources は配列ではなくオブジェクト単体。
// prefMeta() の共通型（sources?:{...}[]）とは形が異なるため、prefMeta() は使わず
// getChief()（lib/metrics.ts・2026-09-20是正）と同一パターンで専用にmetaを組み立てる。
// A-6・2026-09-23是正：従来 `sources?: {...}[]` と誤って配列型にしていたため
// prefMeta()内の`sources?.[0]`が常にundefinedを返し、県版行政ページの得票率等の
// 更新日が「-」表示になっていた（実取得日は sources.fetched_at に実在＝2026-09-02）。
const prefGovernorDataset = prefGovernorRaw as unknown as {
  data: PrefGovernorRecord[];
  sources?: {
    provider?: string;
    dataset?: string;
    download_page?: string;
    fetched_at?: string;
  };
};

/** 首長（行政 2-1）。市区町村版 ChiefRow へ写像（当選回数→回・pref_name→市区町村名・pref_code→area_code）。 */
export function getPrefChief(prefCode: string): { row: ChiefRow; meta: DataMeta } | null {
  const r = prefGovernorDataset.data.find((x) => x.pref_code === prefCode);
  if (!r) return null;
  const row: ChiefRow = {
    area_code: r.pref_code,
    市区町村名: r.pref_name,
    氏名: r.氏名,
    当選年月日: r.当選年月日,
    回: r.当選回数,
    投票率: r.投票率,
    得票数: r.得票数,
    当日有権者数: r.当日有権者数,
    絶対得票率: r.絶対得票率,
    無投票: r.無投票,
    党派: r.党派,
    _source_year_file: r._source_year_file,
    _note: r._note ?? null,
  };
  const src = prefGovernorDataset.sources;
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(src),
      updated: src?.fetched_at ? src.fetched_at.slice(0, 10) : "-",
      fetchedAt: src?.fetched_at ? src.fetched_at.slice(0, 10) : undefined,
    },
  };
}

interface PrefKessanRecord {
  pref_code: string;
  pref_name: string;
  revenue_r6: Record<string, number | null>;
  expenditure_purpose_r6: Record<string, number | null>;
  revenue_r5: Record<string, number | null>;
  expenditure_purpose_r5: Record<string, number | null>;
}
const prefKessanDataset = prefKessanRaw as unknown as {
  updated?: string;
  // 歳出の目的キーは R6/R5 で款目が異なる（R5のみ「特別地方消費税交付金」を含む等）。
  revenue_kan_keys_r6: string[];
  revenue_kan_keys_r5: string[];
  expenditure_purpose_keys_r6: string[];
  expenditure_purpose_keys_r5: string[];
  data: PrefKessanRecord[];
  sources?: DataSourceEntry[];
};

const sumBy = (obj: Record<string, number | null>, keys: string[]): number =>
  keys.reduce((s, k) => s + (typeof obj[k] === "number" ? (obj[k] as number) : 0), 0);

const itemsBy = (obj: Record<string, number | null>, keys: string[]): FinanceLineItem[] =>
  keys
    .map((k) => ({ name: k, value: obj[k] }))
    .filter((x): x is FinanceLineItem => typeof x.value === "number" && x.value > 0)
    .sort((a, b) => b.value - a.value);

/** 財政概況（行政 2-2a/b/e）。市区町村版 getFinanceOverview と同型だが歳出キーを年別配列で集計。 */
export function getPrefFinanceOverview(
  prefCode: string,
): { row: FinanceOverviewRow; meta: DataMeta } | null {
  const r = prefKessanDataset.data.find((x) => x.pref_code === prefCode);
  if (!r) return null;
  const row: FinanceOverviewRow = {
    area_code: r.pref_code,
    市区町村名: r.pref_name,
    revenue: {
      total: sumBy(r.revenue_r6, prefKessanDataset.revenue_kan_keys_r6),
      priorTotal: sumBy(r.revenue_r5, prefKessanDataset.revenue_kan_keys_r5),
      items: itemsBy(r.revenue_r6, prefKessanDataset.revenue_kan_keys_r6),
    },
    expenditure: {
      total: sumBy(r.expenditure_purpose_r6, prefKessanDataset.expenditure_purpose_keys_r6),
      priorTotal: sumBy(r.expenditure_purpose_r5, prefKessanDataset.expenditure_purpose_keys_r5),
      items: itemsBy(r.expenditure_purpose_r6, prefKessanDataset.expenditure_purpose_keys_r6),
    },
  };
  return { row, meta: prefMeta(prefKessanDataset) };
}

/** 議会費（議会 3-3）。pref_kessan の歳出「議会費」から当年・前年を取り出す（市区町村版 getGikaihi と同型）。 */
export function getPrefGikaihi(prefCode: string): { row: GikaihiRow; meta: DataMeta } | null {
  const r = prefKessanDataset.data.find((x) => x.pref_code === prefCode);
  if (!r) return null;
  const k6 = prefKessanDataset.expenditure_purpose_keys_r6[0]; // 先頭＝議会費
  const k5 = prefKessanDataset.expenditure_purpose_keys_r5[0];
  const row: GikaihiRow = {
    area_code: r.pref_code,
    市区町村名: r.pref_name,
    議会費_千円: r.expenditure_purpose_r6[k6] ?? null,
    議会費_前年_千円: r.expenditure_purpose_r5[k5] ?? null,
  };
  return { row, meta: prefMeta(prefKessanDataset) };
}

/**
 * 財政健全性（行政）。pref_fiscal_indicators の periods（令和6/5/4）から対象年度の県行を返す。
 * 県版は都/道府県で法定基準が分岐し、赤字系の早期・再生基準はレコードに解決済みで格納される。
 * 実質公債費・将来負担の基準は都道府県一律で getPrefFiscalStatutory() 側にある。
 * FiscalHealthIndicator[] の組み立ては pref-card-registry（Stage 2）が担う。
 */
export interface PrefFiscalRow {
  pref_code: string;
  pref_name: string;
  status: string;
  財政力指数: number | null;
  経常収支比率: number | null;
  実質公債費比率: number | null;
  将来負担比率: number | null;
  ラスパイレス指数: number | null;
  実質赤字比率: number | "-" | null;
  連結実質赤字比率: number | "-" | null;
  ratio_source_tokens: {
    実質赤字比率: string | null;
    連結実質赤字比率: string | null;
    実質公債費比率: string | null;
    将来負担比率: string | null;
  };
  実質赤字比率_早期健全化基準: number;
  実質赤字比率_財政再生基準: number;
  連結実質赤字比率_早期健全化基準: number;
  連結実質赤字比率_財政再生基準: number;
  法定基準区分: string;
}
interface PrefFiscalPeriod {
  period: string;
  period_label: string;
  fiscal_year_end: number;
  sources?: DataSourceEntry[];
  national?: Record<string, unknown>;
  data: PrefFiscalRow[];
}
const prefFiscalDataset = prefFiscalRaw as unknown as {
  updated?: string;
  periods: PrefFiscalPeriod[];
  statutory_criteria: Record<string, unknown>;
};

/** 都道府県一律の法定基準（都道府県レベル。実質公債費＝早期25/再生35、将来負担＝早期400/再生なし）。 */
export interface PrefFiscalStatutory {
  実質公債費比率_早期健全化基準: number;
  実質公債費比率_財政再生基準: number;
  将来負担比率_早期健全化基準: number;
  将来負担比率_財政再生基準: number | null;
}
export function getPrefFiscalStatutory(): PrefFiscalStatutory {
  const sc = prefFiscalDataset.statutory_criteria as {
    実質公債費比率: { 早期健全化基準: number; 財政再生基準: number };
    将来負担比率: { 早期健全化基準: number; 財政再生基準: number | null };
  };
  return {
    実質公債費比率_早期健全化基準: sc.実質公債費比率.早期健全化基準,
    実質公債費比率_財政再生基準: sc.実質公債費比率.財政再生基準,
    将来負担比率_早期健全化基準: sc.将来負担比率.早期健全化基準,
    将来負担比率_財政再生基準: sc.将来負担比率.財政再生基準,
  };
}

/** 財政健全性の対象年度行を返す（既定＝最新＝令和6年度＝periods[0]）。 */
export function getPrefFiscalHealth(
  prefCode: string,
  period?: string,
): { row: PrefFiscalRow; meta: DataMeta } | null {
  const p =
    (period ? prefFiscalDataset.periods.find((x) => x.period === period) : undefined) ??
    prefFiscalDataset.periods[0];
  if (!p) return null;
  const row = p.data.find((x) => x.pref_code === prefCode);
  if (!row) return null;
  const s = p.sources?.[0];
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(s),
      updated: prefFiscalDataset.updated ?? "-",
      sources: p.sources,
    },
  };
}

export interface PrefExpenditurePerCapitaRow {
  pref_code: string;
  pref_name: string;
  人口_人: number;
  "民生費_千円": number;
  "民生費_円/人": number;
  "教育費_千円": number;
  "教育費_円/人": number;
  "土木費_千円": number;
  "土木費_円/人": number;
  "普通建設事業費_千円": number;
  "普通建設事業費_円/人": number;
  status: string;
}
const prefExpPercapDataset = prefExpPercapRaw as unknown as {
  updated?: string;
  data: PrefExpenditurePerCapitaRow[];
  sources?: DataSourceEntry[];
};

export function getPrefExpenditurePerCapita(
  prefCode: string,
): { row: PrefExpenditurePerCapitaRow; meta: DataMeta } | null {
  const row = prefExpPercapDataset.data.find((x) => x.pref_code === prefCode);
  return row ? { row, meta: prefMeta(prefExpPercapDataset) } : null;
}

// ===========================================================================
// 議会：pref_assembly（pref_code照合）。会派一覧_grok（; 区切り文字列）を KaihaEntry[] へパース。
// 正副議長・議員定数現員・議事録公開は市区町村版 GikaiAssemblyRow へ写像し、
// 既存カード（CouncilSeatsCard/GikaiChoFukuchoCard/KaihaCard/GijirokuCard）を流用する。
// ===========================================================================

interface PrefAssemblyRecord {
  pref_code: string;
  pref_name: string;
  議員定数: number;
  現員数: number;
  議会費_total_千円?: number;
  status?: string;
  正副議長: { 議長氏名: string | null; 副議長氏名: string | null; status?: string };
  会派: { 会派一覧_grok?: string | null; status?: string };
  議事録公開: { status?: string; 公開形式?: string | null; url?: string | string[] | null };
}
const prefAssemblyDataset = prefAssemblyRaw as unknown as {
  updated?: string;
  data: PrefAssemblyRecord[];
  sources?: { source_url?: string; source_page?: string; fetched_at?: string }[];
};

/**
 * 会派一覧_grok（例 "自民:51;立憲:26;…:1（令和8年8月10日現在・欠員4）"）を
 * KaihaEntry[] へ分解する。末尾の全角括弧注記（欠員等）は集計から除外し、参考メモとして返す。
 */
function parseKaihaGrok(raw: string | null | undefined): { list: KaihaEntry[]; memo?: string } {
  if (!raw) return { list: [] };
  const noteMatch = raw.match(/（([^）]*)）/);
  const memo = noteMatch ? noteMatch[1].trim() : undefined;
  const stripped = raw.replace(/（[^）]*）/g, "").replace(/：/g, ":").trim();
  const list: KaihaEntry[] = [];
  for (const seg of stripped.split(";")) {
    const s = seg.trim();
    if (!s) continue;
    const idx = s.lastIndexOf(":");
    if (idx < 0) continue;
    const name = s.slice(0, idx).trim();
    const n = Number(s.slice(idx + 1).trim());
    if (!name || !Number.isFinite(n)) continue;
    list.push({ 会派名: name, 人数: n });
  }
  return { list, memo };
}

function toKaihaStatus(s: string | undefined): GikaiKaiha["status"] {
  return s === "有" || s === "無" || s === "確認できず" ? s : "確認できず";
}

/** 議会のすがた（3-1正副議長／3-2定数現員・会派／3-4議事録）。市区町村版 GikaiAssemblyRow へ写像。 */
export function getPrefGikaiAssembly(
  prefCode: string,
): { row: GikaiAssemblyRow; meta: DataMeta } | null {
  const r = prefAssemblyDataset.data.find((x) => x.pref_code === prefCode);
  if (!r) return null;

  const chofuku: GikaiChoFukucho = {
    議長氏名: r.正副議長?.議長氏名 ?? null,
    副議長氏名: r.正副議長?.副議長氏名 ?? null,
    status: r.正副議長?.status === "有" ? "有" : "未発見",
  };

  const { list, memo } = parseKaihaGrok(r.会派?.会派一覧_grok);
  const kaiha: GikaiKaiha = {
    status: toKaihaStatus(r.会派?.status),
    会派一覧: list.length > 0 ? list : null,
    参考メモ: memo,
  };

  const g = r.議事録公開 ?? {};
  const gijiroku: GikaiGijiroku = {
    status: g.status === "有" ? "有" : "無",
    公開形式: g.公開形式 ?? null,
    url: g.url ?? null,
  };

  const row: GikaiAssemblyRow = {
    area_code: r.pref_code,
    市区町村名: r.pref_name,
    正副議長: chofuku,
    議員定数: r.議員定数,
    現員数: r.現員数,
    会派: kaiha,
    議事録公開: gijiroku,
  };
  return { row, meta: prefMeta(prefAssemblyDataset) };
}

// ===========================================================================
// 比較（ランキング）：pref_comparison_*。各指標フィールドが
// { value, rank, rank_out_of, percentile, national_official, … } を持つ（算出済み）。
// V1のカード描画への配線は Stage 2+（content-spec §7.16 残留(3)配下の §8-a）で扱う。
// データ層としてここで取得可能にしておく（将来の順位UIを安価に追加できるようにするため）。
// ===========================================================================

export interface PrefComparisonMetric {
  value: number;
  national_average_unweighted: number | null;
  national_official: number | null;
  group_code: string | null;
  group_average: number | null;
  rank: number;
  rank_out_of: number;
  percentile: number;
  average_method: string;
  source_note: string;
}

export type PrefComparisonFile =
  | "1a_population"
  | "1b_single_household"
  | "1c_aging_rate"
  | "1d_taxable_income"
  | "2a_industry"
  | "2b_daynight";

const comparisonDatasets: Record<
  PrefComparisonFile,
  { data: ({ 都道府県名: string } & Record<string, unknown>)[] }
> = {
  "1a_population": prefCmp1aRaw as never,
  "1b_single_household": prefCmp1bRaw as never,
  "1c_aging_rate": prefCmp1cRaw as never,
  "1d_taxable_income": prefCmp1dRaw as never,
  "2a_industry": prefCmp2aRaw as never,
  "2b_daynight": prefCmp2bRaw as never,
};

/**
 * 指定ファイル・指定フィールドの当該県比較メトリクスを返す。
 * 例：getPrefComparison("2b_daynight", "岐阜県", "昼夜間人口比率")
 */
export function getPrefComparison(
  file: PrefComparisonFile,
  prefectureName: string,
  field: string,
): PrefComparisonMetric | null {
  const ds = comparisonDatasets[file];
  const row = ds.data.find((r) => r.都道府県名 === prefectureName);
  const metric = row?.[field] as PrefComparisonMetric | undefined;
  return metric ?? null;
}

// ===========================================================================
// 行政・議会指標の全国順位・全国平均（実行時算出）。
// 母集団は自前の pref JSON 47件。まちの集計規律と同一
// （降順 rank・competition ranking・N=47・単純平均は呼び出し側指定）。
// ===========================================================================

export interface PrefRankStat {
  rank: number;        // 1 = 最大値（降順・competition ranking）
  rankOutOf: number;   // 47
  average: number;     // 全国平均（呼び出し側が単純/加重を指定した値）
}
/** 値配列に対する当該値の降順rank（同値は同順位・次を飛ばす）とN。平均は呼び出し側で用意して渡す。 */
function computeDescRank(values: number[], target: number): { rank: number; rankOutOf: number } {
  const rank = 1 + values.filter((v) => v > target).length;
  return { rank, rankOutOf: values.length };
}
const mean = (values: number[]): number => values.reduce((s, v) => s + v, 0) / values.length;

/** 分野別支出の全国per-capita（公式＝加重平均）。4費目それぞれ Σ費目千円×1000 ÷ Σ人口。 */
export interface PrefExpenditureNationalAverages {
  民生費: number; 教育費: number; 土木費: number; 普通建設事業費: number;
}
export function getPrefExpenditureNationalAverages(): PrefExpenditureNationalAverages {
  const rows = prefExpPercapDataset.data;
  const sumPop = rows.reduce((s, r) => s + r.人口_人, 0);
  const per = (senKey: string) =>
    Math.round((rows.reduce((s, r) => s + (r as unknown as Record<string, number>)[senKey], 0) * 1000) / sumPop);
  return {
    民生費: per("民生費_千円"),
    教育費: per("教育費_千円"),
    土木費: per("土木費_千円"),
    普通建設事業費: per("普通建設事業費_千円"),
  };
}

/** 議員定数：全国順位＋単純平均（47件の pref_assembly.議員定数）。 */
export function getPrefTeisuComparison(prefCode: string): PrefRankStat | null {
  const rows = prefAssemblyDataset.data;
  const me = rows.find((r) => r.pref_code === prefCode);
  if (!me) return null;
  const values = rows.map((r) => r.議員定数);
  const { rank, rankOutOf } = computeDescRank(values, me.議員定数);
  return { rank, rankOutOf, average: Math.round(mean(values)) };
}

/**
 * 議会費：絶対額（単純平均）と一人あたり額（加重平均）の2軸。
 * 議会費_千円 は pref_kessan.expenditure_purpose_r6["議会費"]
 * （getPrefGikaihi と同じ取り出し＝expenditure_purpose_keys_r6[0]）。
 * 人口は pref_expenditure_percapita の 人口_人 を pref_code で結合。
 * 一人あたり議会費_円 = 議会費_千円 × 1000 ÷ 人口_人。
 */
export interface PrefGikaihiComparison {
  absolute: PrefRankStat;   // 議会費total（千円）・単純平均
  perCapita: PrefRankStat & { value: number }; // 一人あたり（円）・加重平均。valueは当該県の一人あたり円
}
export function getPrefGikaihiComparison(prefCode: string): PrefGikaihiComparison | null {
  const kessanRows = prefKessanDataset.data;
  const popRows = prefExpPercapDataset.data;
  const k6 = prefKessanDataset.expenditure_purpose_keys_r6[0]; // 議会費
  const popByCode = new Map(popRows.map((r) => [r.pref_code, r.人口_人]));
  // 47件すべてで議会費と人口が揃う前提。欠けるものは母集団から外す（推測で0埋めしない）。
  const gikaihiList: { code: string; abs: number; per: number }[] = [];
  for (const r of kessanRows) {
    const abs = (r.expenditure_purpose_r6 as unknown as Record<string, unknown>)[k6];
    const pop = popByCode.get(r.pref_code);
    if (typeof abs !== "number" || typeof pop !== "number" || pop === 0) continue;
    gikaihiList.push({ code: r.pref_code, abs, per: (abs * 1000) / pop });
  }
  const me = gikaihiList.find((x) => x.code === prefCode);
  if (!me) return null;
  const absValues = gikaihiList.map((x) => x.abs);
  const absRank = computeDescRank(absValues, me.abs);
  // 一人あたりの加重平均＝Σ議会費千円×1000 ÷ Σ人口（母集団はgikaihiListに揃った県）
  const sumGikaihiSen = gikaihiList.reduce((s, x) => s + x.abs, 0);
  const sumPop = gikaihiList.reduce((s, x) => s + (x.abs * 1000) / x.per, 0); // = Σ人口
  const perValues = gikaihiList.map((x) => x.per);
  const perRank = computeDescRank(perValues, me.per);
  return {
    absolute: { rank: absRank.rank, rankOutOf: absRank.rankOutOf, average: Math.round(mean(absValues)) },
    perCapita: {
      rank: perRank.rank, rankOutOf: perRank.rankOutOf,
      average: Math.round((sumGikaihiSen * 1000) / sumPop),
      value: Math.round(me.per),
    },
  };
}
