// lib/i18n-ids.ts
//
// ブラウザ側で動く部品（"use client"）ごとに、使う文言の辞書 id の一覧。
// サーバー側で lib/i18n.ts の msgsFor(この一覧) を呼び、結果を部品に渡す（辞書全体をブラウザへ送らない）。
// 部品が使う id を足したら、ここにも足す（足し忘れると部品の m() がエラーで止まる）。
// "use client" のファイルに置かないこと（サーバー側からは値として読めなくなるため）。

export const SEARCH_MSG_IDS = [
  "sr-municipality-page",
  "val-in-preparation",
  "sr-back",
  "p-sr-results",
  "ui-nav-search",
  "sr-placeholder",
  "sr-input-label",
  "sr-clear",
  "p-sr-hint",
  "sr-none",
  "sr-none-tip",
  "sr-dup",
  "sr-prefs",
  "sr-munis",
  "p-fu-count",
  "sr-narrow-1",
  "sr-narrow-2",
  "sr-loading",
] as const;

export const HOME_SEARCH_MSG_IDS = ["sr-placeholder", "sr-input-label", "ui-nav-search", "p-example"] as const;

const CHART_COMMON = ["val-no-data", "p-scroll-region", "col-fiscal-year", "p-fy"] as const;

export const FINANCE_SCALE_CHART_MSG_IDS = [
  ...CHART_COMMON,
  "revenue",
  "expenditure",
  "ch-fs-graph",
  "ch-fs-axis",
  "ch-fs-caption",
  "p-fs-tooltip-exact",
] as const;

export const EXPENDITURE_CHART_MSG_IDS = [
  ...CHART_COMMON,
  "exp-public-welfare",
  "exp-education",
  "exp-civil-eng",
  "exp-ordinary-construction",
  "ch-ex-graph",
  "ch-ex-caption",
  "p-yen-per-person-chart",
] as const;

export const KENZENKA_CHART_MSG_IDS = [
  ...CHART_COMMON,
  "p-kz-graph",
  "p-kz-std",
  "p-kz-std-regen",
  "kz-std-no-regen",
  "p-kz-caption",
  "p-kz-caption-regen",
  "kz-caption-no-regen",
  "kz-legend-1",
  "fh-legend-solid",
  "fh-legend-2",
  "fh-legend-dashed",
  "kz-legend-3",
  "kz-legend-terracotta",
  "kz-legend-4",
] as const;

export const REGION_PICKER_MSG_IDS = [
  "rp-tablist",
  "rp-has-published",
  "p-municipality-count",
  "val-in-preparation",
  "rp-note",
  ...(["hokkaido", "tohoku", "kanto", "chubu", "kinki", "chugoku", "shikoku", "kyushu"] as const).flatMap(
    (id) => [`region-${id}`, `region-${id}-heading`] as const,
  ),
] as const;

export const SWITCHER_MSG_IDS = ["sw-switch", "sw-list-label", "sw-current"] as const;
