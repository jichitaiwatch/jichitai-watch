// lib/forest-tax.ts
//
// 森林環境譲与税（L-8・くらし）。data/forest_tax_use_r6_trial_{県コード}.json（市区町村）と
// data/forest_tax_use_r6_trial_pref_{県コード}.json（県自身）をビルド時に読む。読む県は、このビルドに含まれる県（PREFECTURES）だけ。
// ファイルが無ければ「未整備」（null）。
// 欠損は推定せず、機械が読み取れたかの事実で示す（20260808_decisions.md D-25）。
// サーバー側（ビルド時）専用。クライアントコンポーネントから読まない。

import { formatPeriodLabel } from "@/lib/staleness";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PREFECTURES } from "@/lib/prefectures";
import type { DataMeta } from "@/lib/metrics";

export interface ForestTaxUse {
  name: string;
  yen: number;
}

export interface ForestTaxRow {
  area_code: string;
  city_name: string;
  /** 総務省の譲与額（円） */
  jouyo_yen: number;
  /** 基金積立を除く、事業への充当額（円）。確定できないときは null */
  katsuyo_yen: number | null;
  /** 活用額の根拠区分。"譲与税充当額" 以外は事業費ベース（財源の内訳が資料に無い） */
  katsuyo_basis: string | null;
  /** 基金への積立額（円）。資料に無いとき null */
  kikin_tsumitate_yen: number | null;
  main_uses: ForestTaxUse[];
  source_url: string;
  /** 整合 / 不一致（資料の値のまま） / 確定できない / 未取得 */
  check: string;
  note: string;
}

interface ForestTaxDataset {
  updated: string;
  fiscal_year: string;
  data: ForestTaxRow[];
}

/** 行ごとのデータ更新日（ファイルの updated）。県単位のファイルで更新日が違うため、固定にしない */
const updatedByArea = new Map<string, string>();

function readDataset(path: string): ForestTaxRow[] {
  const ds = JSON.parse(readFileSync(path, "utf-8")) as ForestTaxDataset;
  for (const r of ds.data) updatedByArea.set(r.area_code, ds.updated);
  return ds.data;
}

function load(): ForestTaxRow[] {
  return PREFECTURES.flatMap(({ prefCode: code }) => {
    const path = join(process.cwd(), "data", `forest_tax_use_r6_trial_${code}.json`);
    if (!existsSync(path)) return [];
    return readDataset(path);
  });
}

let cache: ForestTaxRow[] | null = null;

/** 値が読み取れた団体だけを返す。「確定できない」「未取得」は null（画面は「未整備」の2値） */
export function getForestTax(areaCode: string): { row: ForestTaxRow; meta: DataMeta } | null {
  cache ??= load();
  const row = cache.find((r) => r.area_code === areaCode);
  if (!row) return null;
  if (row.check === "確定できない" || row.check === "未取得") return null;
  return {
    row,
    meta: {
      sourceUrl: row.source_url,
      updated: updatedByArea.get(row.area_code) ?? "2026-10-17",
      periodLabel: formatPeriodLabel("令和6年度"),
      fetchedAt: updatedByArea.get(row.area_code) ?? "2026-10-17",
    },
  };
}

let prefCache: ForestTaxRow[] | null = null;

/** 都道府県版（県自身が受け取った譲与税）。area_code は都道府県2桁 */
export function getForestTaxPref(prefCode: string): { row: ForestTaxRow; meta: DataMeta } | null {
  prefCache ??= PREFECTURES.flatMap(({ prefCode: code }) => {
    const path = join(process.cwd(), "data", `forest_tax_use_r6_trial_pref_${code}.json`);
    return existsSync(path) ? readDataset(path) : [];
  });
  const row = prefCache.find((r) => r.area_code === prefCode);
  if (!row) return null;
  if (row.check === "確定できない" || row.check === "未取得") return null;
  return {
    row,
    meta: {
      sourceUrl: row.source_url,
      updated: updatedByArea.get(row.area_code) ?? "2026-10-17",
      periodLabel: formatPeriodLabel("令和6年度"),
      fetchedAt: updatedByArea.get(row.area_code) ?? "2026-10-17",
    },
  };
}
