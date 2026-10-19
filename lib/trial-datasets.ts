// lib/trial-datasets.ts
//
// 試作（20260808_decisions.md D-24）の県別データセットを読む共通部品。
// 全国統計から県引数で切り出したファイル data/{basename}_{県コード}.json を、
// JICHITAI_TRIAL_PREFS にある県だけビルド時に読む。未設定の公開用ビルドでは何も読まない（岐阜の出力を変えない）。
// ファイルは publish/allowlist.txt で除外し、公開しない（Gate 7 の実測まで・D-24 A案）。
// サーバー側（ビルド時）専用。クライアントコンポーネントから読まない。

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TRIAL_PREF_CODES } from "@/lib/trial";
import { formatPeriodLabel } from "@/lib/staleness";
import {
  pickSourceUrl,
  POPULATION_CURRENT_YEAR_KEY,
  type DataMeta,
  type DataSourceEntry,
  type AgingRateRow,
  buildFinanceOverview,
  buildKodomoIryohiDistribution,
  buildGikaihi,
  buildKenzenkaSingleYear,
  type ChiefRow,
  type ExpenditureAverageBlock,
  type FinanceDataset,
  type GikaiTeiinRow,
  type GikaiCouncilRow,
  type KodomoIryohiDataset,
  type KodomoIryohiRow,
  type ExpenditureRow,
  type DaynightRow,
  type FurusatoRow,
  type IndustryRow,
  type KaigoAverageBlock,
  type KaigoPremiumRow,
  type ExpenditureTimeseriesRow,
  type FinanceScaleTimeseriesRow,
  type KenzenkaTimeseriesRow,
  type PopulationTimeseriesRow,
  type SingleHouseholdRow,
  type TaxableIncomeRow,
} from "@/lib/metrics";

interface TrialDataset<Row> {
  updated: string;
  period?: string;
  data: Row[];
  /** 政令指定都市の区の行（試作のみ。市の行 data とは分けて持つ。県分布・平均の計算には使わない） */
  wards?: Row[];
  sources?: DataSourceEntry[];
}

const cache = new Map<string, { row: unknown; ds: TrialDataset<unknown> }[]>();

function loadAll<Row extends { area_code: string }>(basename: string) {
  const hit = cache.get(basename);
  if (hit) return hit as { row: Row; ds: TrialDataset<Row> }[];
  const out = TRIAL_PREF_CODES.flatMap((code) => {
    const path = join(process.cwd(), "data", `${basename}_${code}.json`);
    if (!existsSync(path)) return [];
    const ds = JSON.parse(readFileSync(path, "utf-8")) as TrialDataset<Row>;
    return ds.data.map((row) => ({ row, ds }));
  });
  cache.set(basename, out as { row: unknown; ds: TrialDataset<unknown> }[]);
  return out;
}

/** 区の行（ds.wards）。loadAll と別に持ち、分布・県内平均の計算に混ざらないようにする */
function loadWards<Row extends { area_code: string }>(basename: string) {
  return TRIAL_PREF_CODES.flatMap((code) => {
    const path = join(process.cwd(), "data", `${basename}_${code}.json`);
    if (!existsSync(path)) return [];
    const ds = JSON.parse(readFileSync(path, "utf-8")) as TrialDataset<Row>;
    return (ds.wards ?? []).map((row) => ({ row, ds }));
  });
}

/**
 * 試作データセットを area_code で照合し、公開用 getter と同じ形 { row, meta } で返す。無ければ null（＝未整備）。
 * withSourceUrl は、対応する公開用 getter が meta.sourceUrl を入れているかに合わせる（表示を岐阜と同じにするため）。
 */
export function getTrialRow<Row extends { area_code: string }>(
  basename: string,
  areaCode: string,
  withSourceUrl = true,
): { row: Row; meta: DataMeta } | null {
  if (TRIAL_PREF_CODES.length === 0) return null;
  const hit =
    loadAll<Row>(basename).find((e) => e.row.area_code === areaCode) ??
    loadWards<Row>(basename).find((e) => e.row.area_code === areaCode);
  if (!hit) return null;
  const { row, ds } = hit;
  return {
    row,
    meta: {
      ...(withSourceUrl ? { sourceUrl: pickSourceUrl(ds.sources?.[0]) } : {}),
      updated: ds.updated,
      periodLabel: formatPeriodLabel(ds.period),
      fetchedAt: ds.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: ds.sources,
    },
  };
}

/**
 * 介護保険料（M2）の試作分（data/m2_kaigo_premium_{県コード}.json）。
 * 行は area_code を持たず保険者単位（広域連合を含む）。公開用 getKaigoPremium と同じく、県名と
 * 自治体マスタの介護保険者名（kaigoInsurerName）で照合する。政令市の区（kind="ward"）は市の単位の情報で
 * 区には無いため null（区のページに「くらし」を出さない＝launch-backlog.md L-9）。
 */
interface KaigoTrialDataset {
  updated: string;
  period?: string;
  data: KaigoPremiumRow[];
  sources?: DataSourceEntry[];
  national_average?: KaigoAverageBlock;
  prefecture_average?: KaigoAverageBlock & { prefecture: string };
}

function loadKaigoTrial(): KaigoTrialDataset[] {
  return TRIAL_PREF_CODES.flatMap((code) => {
    const path = join(process.cwd(), "data", `m2_kaigo_premium_${code}.json`);
    return existsSync(path) ? [JSON.parse(readFileSync(path, "utf-8")) as KaigoTrialDataset] : [];
  });
}

export function getKaigoPremiumTrial(m: {
  prefectureName: string;
  kaigoInsurerName: string;
  kind?: "ward";
}): { row: KaigoPremiumRow; meta: DataMeta } | null {
  if (TRIAL_PREF_CODES.length === 0 || m.kind === "ward" || !m.kaigoInsurerName) return null;
  for (const ds of loadKaigoTrial()) {
    const row = ds.data.find((r) => r.都道府県 === m.prefectureName && r.市区町村名 === m.kaigoInsurerName);
    if (!row) continue;
    return {
      row,
      meta: {
        sourceUrl: pickSourceUrl(ds.sources?.[0]),
        updated: ds.updated,
        periodLabel: formatPeriodLabel(ds.period),
        fetchedAt: ds.sources?.[0]?.fetched_at?.slice(0, 10),
        sources: ds.sources,
      },
    };
  }
  return null;
}

/** 介護保険料の全国平均・その県内平均（試作の県のデータセットのトップレベル）。無ければ両方 null */
export function getKaigoAveragesTrial(prefectureName: string): {
  national: KaigoAverageBlock | null;
  prefecture: (KaigoAverageBlock & { prefecture: string }) | null;
} {
  const ds = loadKaigoTrial().find((d) => d.prefecture_average?.prefecture === prefectureName);
  return { national: ds?.national_average ?? null, prefecture: ds?.prefecture_average ?? null };
}

/** ふるさと納税（F-6）の試作分（data/m4_5_furusato_{県コード}.json） */
export function getFurusatoTrial(areaCode: string) {
  return getTrialRow<FurusatoRow>("m4_5_furusato", areaCode);
}

/** 一人あたり課税対象所得（1-2c）の試作分（data/m1_2c_taxable_income_{県コード}.json） */
export function getTaxableIncomeTrial(areaCode: string) {
  return getTrialRow<TaxableIncomeRow>("m1_2c_taxable_income", areaCode, false);
}

/** 昼夜間人口比率（1-2b）の試作分（data/m1_2b_daynight_{県コード}.json） */
export function getDaynightTrial(areaCode: string) {
  return getTrialRow<DaynightRow>("m1_2b_daynight", areaCode, false);
}

/** 産業別就業者構成比・上位3業種（1-2a）の試作分（data/m1_2a_industry_{県コード}.json） */
export function getIndustryTrial(areaCode: string) {
  return getTrialRow<IndustryRow>("m1_2a_industry", areaCode, false);
}

/** 単身世帯割合（1-1b）の試作分（data/m1_1b_single_household_{県コード}.json） */
export function getSingleHouseholdTrial(areaCode: string) {
  return getTrialRow<SingleHouseholdRow>("m1_1b_single_household", areaCode, false);
}

/** 高齢化率（1-1c）の試作分（data/m1_1c_aging_rate_{県コード}.json） */
export function getAgingRateTrial(areaCode: string) {
  return getTrialRow<AgingRateRow>("m1_1c_aging_rate", areaCode, false);
}

/**
 * 人口・世帯数（1-1a）の試作分（data/m1_1a_population_timeseries_{県コード}.json）。
 * 公開用 getPopulationTimeseries と同じく、対象年度・取得日は「現在」の年（POPULATION_CURRENT_YEAR_KEY）の出典から取る。
 */
export function getPopulationTimeseriesTrial(areaCode: string) {
  const hit = getTrialRow<PopulationTimeseriesRow>("m1_1a_population_timeseries", areaCode, false);
  if (!hit) return null;
  const current = hit.meta.sources?.find(
    (src) => (src as { year_key?: string }).year_key === POPULATION_CURRENT_YEAR_KEY,
  ) as { year_label?: string; fetched_at?: string } | undefined;
  return {
    row: hit.row,
    meta: {
      ...hit.meta,
      periodLabel: formatPeriodLabel(current?.year_label),
      fetchedAt: current?.fetched_at?.slice(0, 10),
    },
  };
}

/**
 * 経年（推移）画面の試作分。公開用 getExpenditureTimeseries／getFinanceScaleTimeseries／getKenzenkaTimeseries と同じく
 * 出典リンクと更新日だけを返す（trends の描画が使うのはこの2つ）。ファイルは data/{基名}_multiyear_{県コード}.json。
 * 区は決算状況調に無いので該当なし（null）。
 */
export function getExpenditureTimeseriesTrial(areaCode: string) {
  return getTrialRow<ExpenditureTimeseriesRow>("m3_expenditure_multiyear", areaCode);
}

export function getFinanceScaleTimeseriesTrial(areaCode: string) {
  return getTrialRow<FinanceScaleTimeseriesRow>("m2_3_finance_scale_multiyear", areaCode);
}

export function getKenzenkaTimeseriesTrial(areaCode: string) {
  return getTrialRow<KenzenkaTimeseriesRow>("m2_4_kenzenka_shichoson_multiyear", areaCode);
}

interface ExpenditureTrialDataset extends TrialDataset<ExpenditureRow> {
  year_label?: string;
  national_average?: ExpenditureAverageBlock;
  prefecture_average?: ExpenditureAverageBlock & { prefecture: string };
}

/**
 * 分野別支出（M3）の試作分（data/m3_expenditure_{県コード}.json）。
 * 県内平均はその県のデータセットのもの（県ごとに違う）なので、行と一緒に返す。公開用 getExpenditure と同じく
 * 対象年度は year_label、取得日は sources[0].fetched_at をそのまま使う。
 */
export function getExpenditureTrial(areaCode: string) {
  if (TRIAL_PREF_CODES.length === 0) return null;
  const hit = (loadAll<ExpenditureRow>("m3_expenditure") as { row: ExpenditureRow; ds: ExpenditureTrialDataset }[]).find(
    (e) => e.row.area_code === areaCode,
  );
  if (!hit) return null;
  const { row, ds } = hit;
  return {
    row,
    meta: {
      updated: ds.updated,
      periodLabel: formatPeriodLabel(ds.year_label),
      fetchedAt: ds.sources?.[0]?.fetched_at,
      sources: ds.sources,
    } as DataMeta,
    national: ds.national_average ?? null,
    prefecture: ds.prefecture_average ?? null,
  };
}

/** 財政4種（m2_2_finance）の試作データセット。area_code を含む県のものを返す（無ければ null）。 */
function findFinanceTrial(areaCode: string): FinanceDataset | null {
  if (TRIAL_PREF_CODES.length === 0) return null;
  const hit = loadAll<{ area_code: string }>("m2_2_finance").find((e) => e.row.area_code === areaCode);
  return hit ? (hit.ds as unknown as FinanceDataset) : null;
}

/** 財政の健全性（単年）の試作分（data/m2_2_finance_{県コード}.json） */
export function getKenzenkaSingleYearTrial(areaCode: string) {
  const ds = findFinanceTrial(areaCode);
  return ds ? buildKenzenkaSingleYear(ds, areaCode) : null;
}

/** 議会費の試作分（同上） */
export function getGikaihiTrial(areaCode: string) {
  const ds = findFinanceTrial(areaCode);
  return ds ? buildGikaihi(ds, areaCode) : null;
}

/** 財政概況（歳入・歳出の内訳）の試作分（同上） */
export function getFinanceOverviewTrial(areaCode: string) {
  const ds = findFinanceTrial(areaCode);
  return ds ? buildFinanceOverview(ds, areaCode) : null;
}

interface ChiefTrialDataset {
  data: ChiefRow[];
  sources?: { provider?: string; dataset?: string; download_page?: string; fetched_at?: string };
}

/**
 * 首長（2-1）の試作分（data/m2_1_chief_{県コード}.json）。公開用 getChief と同じく、取得日は sources.fetched_at の日付部分、
 * 出典URLは sources（オブジェクト単体）の download_page。
 */
export function getChiefTrial(areaCode: string) {
  if (TRIAL_PREF_CODES.length === 0) return null;
  const hit = (loadAll<ChiefRow>("m2_1_chief") as unknown as { row: ChiefRow; ds: ChiefTrialDataset }[]).find(
    (e) => e.row.area_code === areaCode,
  );
  if (!hit) return null;
  const src = hit.ds.sources;
  return {
    row: hit.row,
    meta: {
      sourceUrl: pickSourceUrl(src),
      updated: src?.fetched_at ? src.fetched_at.slice(0, 10) : "-",
      fetchedAt: src?.fetched_at ? src.fetched_at.slice(0, 10) : undefined,
    } as DataMeta,
  };
}

/**
 * 子ども医療費助成（M1）の試作分（data/m1_kodomo_iryohi_{県コード}.json）。
 * 分布（県内の団体数）はその県のデータセットから数えるので、行と一緒に返す。
 */
export function getKodomoIryohiTrial(areaCode: string) {
  if (TRIAL_PREF_CODES.length === 0) return null;
  const hit = (loadAll<KodomoIryohiRow>("m1_kodomo_iryohi") as unknown as { row: KodomoIryohiRow; ds: KodomoIryohiDataset }[]).find(
    (e) => e.row.area_code === areaCode,
  );
  if (!hit) return null;
  const { row, ds } = hit;
  return {
    row,
    meta: {
      sourceUrl: pickSourceUrl(ds.sources?.[0]),
      updated: ds.updated,
      periodLabel: formatPeriodLabel(ds.period),
      fetchedAt: ds.sources?.[0]?.fetched_at?.slice(0, 10),
      sources: ds.sources,
    } as DataMeta,
    distribution: buildKodomoIryohiDistribution(ds),
  };
}

/**
 * 議員定数（3-2）の試作分（data/gikai_teiin_{県コード}.json）。条例定数・現員・比較値だけ。
 * 正副議長・会派・議事録公開は各議会サイトの個別調査が要るため、この系統には無い（該当カードは「データ未整備」）。
 */
export function getGikaiTeiinTrial(areaCode: string) {
  return getTrialRow<GikaiTeiinRow>("gikai_teiin", areaCode, true);
}

/**
 * 正副議長・会派・議事録Web公開（3-1・3-2・3-4）の試作分（data/gikai_council_{県コード}.json）。
 * 各議会サイトの個別調査（Grok→Composer→Claude裁定）の結果。出典は行ごとの複合のため、出典リンクは付けない。
 */
export function getGikaiCouncilTrial(areaCode: string) {
  const hit = getTrialRow<GikaiCouncilRow>("gikai_council", areaCode, false);
  if (!hit) return null;
  return { row: hit.row, meta: { updated: hit.meta.updated, fetchedAt: hit.meta.updated } as DataMeta };
}
