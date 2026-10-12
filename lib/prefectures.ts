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
}

/**
 * 都道府県ごとの差分データ。V1公開スコープは岐阜県のみ（content-spec-v1.md §1）。
 * 他県を追加する際はこの配列に1件足すだけでよく、
 * app/gifu-pref/page.tsx（地域入口）と app/gifu-pref/gifu-ken/[tab]/page.tsx（県庁情報）は
 * 共通テンプレートに県configを渡す（市区町村版と同じデータ駆動の思想）。
 *
 * ※他県の完全動的ルート化・県スラッグの一斉適用は
 *   docs/frontend-architecture.md §5.4 の繰延事項（規約は凍結済み）。
 *   V1では本ファイルは岐阜のみを保持する。
 */
export const PREFECTURES: PrefectureConfig[] = [
  {
    prefSlug: "gifu-pref",
    govSlug: "gifu-ken",
    prefectureName: "岐阜県",
    prefCode: "21",
  },
];

export function getPrefectureBySlug(slug: string): PrefectureConfig | undefined {
  return PREFECTURES.find((p) => p.prefSlug === slug);
}

export function getPrefectureByGovSlug(govSlug: string): PrefectureConfig | undefined {
  return PREFECTURES.find((p) => p.govSlug === govSlug);
}
