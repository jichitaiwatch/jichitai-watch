// lib/prefectures.ts
//
// 都道府県レイヤーの自治体マスタ（市区町村版 lib/municipalities.ts と対の構造）。
// 都道府県ページは市区町村の集計ではなく都道府県自身の統治データ層
// （CLAUDE.md 2026-08-04・docs/frontend-architecture.md §0）。本ファイルは
// 「県ページのURL生成」と「県データJSONの照合キー」だけを持つ（識別色などの
// UI関心はレジストリ/ルート層で扱い、本マスタには持たせない）。
//
// 照合キーがJSON系統で不統一である点に注意（data/pref_*.json を実データで確認）：
//   - まち（pref_1a〜2b）／比較（pref_comparison_*）：都道府県名 で照合する。
//     都道府県コードは桁・書式がファイル間で不揃い（"-"/"00000"/"00"/6桁）なため使わない。
//     まち系は先頭行に全国計（都道府県名＝"合計" または "全国"）が混在するので、
//     getter 側で都道府県名一致により当該県のみを引く（計行は自然に除外される）。
//   - 行政・議会（pref_governor / pref_kessan / pref_expenditure_percapita /
//     pref_assembly / pref_fiscal_indicators）：pref_code（2桁ゼロ埋め）で照合する。
// このため PrefectureConfig は prefectureName と prefCode の両方を保持する。

import { TRIAL_PREF_CODES } from "@/lib/trial";

export interface PrefectureConfig {
  /**
   * 地域（area）レイヤーのURLセグメント（/{prefSlug}/）。
   * docs/frontend-architecture.md §5.4 で凍結済み（gifu-pref）。
   */
  prefSlug: string;
  /**
   * 政府（government）レイヤーのURLセグメント（/{prefSlug}/{govSlug}/）。
   * 県庁＝県名核＋県接尾辞（gifu-ken / tokyo-to / hokkaido-do / osaka-fu / kyoto-fu。§5.6.1）。
   * 地域レイヤーの prefSlug（-pref）とは別リソースの綴り。同一県から2綴りが出るのは設計どおり。
   * 市区町村（MunicipalityConfig.slug）と同一の {gov} スロットで解決される。
   */
  govSlug: string;
  /**
   * 都道府県の表示名 兼 まち系・比較系JSONの照合キー（例「岐阜県」）。
   * pref_1a〜2b / pref_comparison_* は 都道府県名 で結合する（コード桁が不揃いのため）。
   */
  prefectureName: string;
  /**
   * 全国地方公共団体コードの都道府県2桁（ゼロ埋め。例：岐阜県＝"21"）。
   * pref_governor / pref_kessan / pref_expenditure_percapita / pref_assembly /
   * pref_fiscal_indicators は pref_code で結合する。
   */
  prefCode: string;
  /** 検索の入力例に出す市（先頭から2つまで。例「岐阜市」「大垣市」）。 */
  exampleCities: string[];
}

/**
 * 都道府県ごとの差分データ。V1公開スコープは岐阜県のみ（content-spec-v1.md §1）。
 * 他県を追加する際はこの配列に1件足すだけでよく、
 * app/[pref]/page.tsx（地域入口）と app/[pref]/[gov]/[tab]/page.tsx（県庁情報）は
 * 共通テンプレートに県configを渡す（市区町村版と同じデータ駆動の思想）。
 *
 * ※他県の完全動的ルート化・県スラッグの一斉適用は
 *   docs/frontend-architecture.md §5.4 の繰延事項（規約は凍結済み）。
 *   V1では本ファイルは岐阜のみを保持する。
 */
const ALL_PREFECTURES: PrefectureConfig[] = [
  {
    prefSlug: "gifu-pref",
    govSlug: "gifu-ken",
    prefectureName: "岐阜県",
    prefCode: "21",
    exampleCities: ["岐阜市", "大垣市"],
  },
  // 試作県（D-24）。JICHITAI_TRIAL_PREFS に県コードがあるときだけ有効（lib/trial.ts）。
  { prefSlug: "aichi-pref", govSlug: "aichi-ken", prefectureName: "愛知県", prefCode: "23", exampleCities: ["名古屋市", "豊橋市"] },
  { prefSlug: "mie-pref", govSlug: "mie-ken", prefectureName: "三重県", prefCode: "24", exampleCities: ["津市", "四日市市"] },
  { prefSlug: "okayama-pref", govSlug: "okayama-ken", prefectureName: "岡山県", prefCode: "33", exampleCities: ["岡山市", "倉敷市"] },
  { prefSlug: "hiroshima-pref", govSlug: "hiroshima-ken", prefectureName: "広島県", prefCode: "34", exampleCities: ["広島市", "福山市"] },
  { prefSlug: "yamaguchi-pref", govSlug: "yamaguchi-ken", prefectureName: "山口県", prefCode: "35", exampleCities: ["山口市", "下関市"] },
];

export const PREFECTURES: PrefectureConfig[] = ALL_PREFECTURES.filter(
  (p) => p.prefCode === "21" || TRIAL_PREF_CODES.includes(p.prefCode),
);

/**
 * 公開中の地域を指す文言（トップの説明・共有画像の代替文・「自治体Watchとは」・検索の入力例）の元。
 * 岐阜県だけのとき（公開用ビルド）は従来どおりの文言になり、県が増えると PREFECTURES から作り直される
 * （県を足したときに文言の直し漏れが出ないように、文言は県の一覧から作る。launch-backlog.md L-9）。
 */
export const REGION_LABEL = PREFECTURES.map((p) => p.prefectureName).join("・");
export const REGION_DESCRIPTION = `${REGION_LABEL}内の市町村の財政や暮らしの制度を、市町村ごとに整理して見られます。`;
/** 岐阜県だけのときの入力例。クライアント側の既定値にも使う（この値と同じなら画面へ渡さない）。 */
export const DEFAULT_SEARCH_EXAMPLE = "岐阜市、大垣市";
export const SEARCH_EXAMPLE = (
  PREFECTURES.length === 1
    ? PREFECTURES[0].exampleCities.slice(0, 2)
    : PREFECTURES.map((p) => p.exampleCities[0])
).join("、");

export function getPrefectureBySlug(slug: string): PrefectureConfig | undefined {
  return PREFECTURES.find((p) => p.prefSlug === slug);
}

export function getPrefectureByGovSlug(govSlug: string): PrefectureConfig | undefined {
  return PREFECTURES.find((p) => p.govSlug === govSlug);
}
