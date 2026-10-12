// lib/staleness.ts
//
// Gate 4 陳腐化対策の算出ユーティリティ（docs/gate4-staleness-correction-spec.md A-0〜A-4）。
// 表示するのは「対象年度・取得日」のみ。次回更新予定・有効期限は画面に出さず、
// 期限超過の判定にだけ使う（2026-09-20運営者裁定）。判定は取得日（fetched_at）起点。

/** 更新周期の3類型（spec A-0）。判定できない頻度（選挙ごと等）は null。 */
export type UpdateCycle = "annual" | "triennial" | "quinquennial";

/** updateFrequency の表記文字列から周期類型を判定する。 */
export function classifyCycle(updateFrequency: string): UpdateCycle | null {
  if (updateFrequency.includes("3年")) return "triennial";
  if (updateFrequency.includes("5年")) return "quinquennial";
  // 「年1回」「年次」「年1回〜」等は年次扱い。
  if (updateFrequency.includes("年1回") || updateFrequency.includes("年次")) return "annual";
  // 「選挙ごと」「改選ごと」など周期不定は判定対象外。
  return null;
}

// 有効期限 ＝ 取得日 ＋ 周期 ＋ 猶予（月）。spec A-3：年次+3／3年+3／5年+6。
const MONTHS: Record<UpdateCycle, number> = {
  annual: 12 + 3,
  triennial: 36 + 3,
  quinquennial: 60 + 6,
};

/**
 * 取得日と更新頻度から「期限超過か」を返す。
 * fetched_at が無い／周期が判定できない場合は false（警告を出さない）。
 */
export function isStale(fetchedAt: string | undefined, updateFrequency: string, now: Date = new Date()): boolean {
  if (!fetchedAt) return false;
  const cycle = classifyCycle(updateFrequency);
  if (!cycle) return false;
  const base = new Date(fetchedAt);
  if (Number.isNaN(base.getTime())) return false;
  const deadline = new Date(base);
  deadline.setMonth(deadline.getMonth() + MONTHS[cycle]);
  return now.getTime() > deadline.getTime();
}

// 比較・集計表示の停止閾値（spec A-5、月数・取得日起点）。isStale()のMONTHS（A-3有効期限）とは別軸。
//   年次＝2周期（約2年）＝24ヶ月
//   3年周期＝次期改定（36ヶ月）を1期分（36ヶ月）超過＝72ヶ月
//   5年周期＝次回集計年（60ヶ月）を1年（12ヶ月）超過＝72ヶ月
const STOP_MONTHS: Record<UpdateCycle, number> = {
  annual: 24,
  triennial: 72,
  quinquennial: 72,
};

/**
 * 取得日と更新頻度から「比較・集計表示を停止すべきか」を返す（spec A-5）。
 * isStale()（A-4警告）より厳しい閾値。true の場合、呼び出し側は比較値（全国／県内／類似平均）
 * と経年集計の表示を停止し、実測値そのものは表示を続ける（停止するのは比較・集計のみ）。
 * fetched_at が無い／周期が判定できない場合は false（停止しない）。
 */
export function shouldSuppressComparison(
  fetchedAt: string | undefined,
  updateFrequency: string,
  now: Date = new Date(),
): boolean {
  if (!fetchedAt) return false;
  const cycle = classifyCycle(updateFrequency);
  if (!cycle) return false;
  const base = new Date(fetchedAt);
  if (Number.isNaN(base.getTime())) return false;
  const deadline = new Date(base);
  deadline.setMonth(deadline.getMonth() + STOP_MONTHS[cycle]);
  return now.getTime() > deadline.getTime();
}

/**
 * 対象年度の表示ラベルを「和暦（西暦）」に整形する（例「令和5年度（2023）」）。
 * 元データの year_label は表記順・付随情報がまちまちなので、和暦年度と西暦4桁を
 * 抽出して組み直す。抽出できない場合は元の文字列をそのまま返す（欠損を捏造しない）。
 */
export function formatPeriodLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const wareki = raw.match(/(令和|平成|昭和)\s*\d+\s*年度/);
  const seireki = raw.match(/(\d{4})\s*年度/) ?? raw.match(/(\d{4})/);
  if (wareki && seireki) return `${wareki[0].replace(/\s/g, "")}（${seireki[1]}）`;
  if (wareki) return wareki[0].replace(/\s/g, "");
  return raw;
}
