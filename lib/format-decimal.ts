/**
 * 小数を指定桁で「四捨五入」して文字列にする（`Number.prototype.toFixed` の代わり）。
 *
 * なぜ必要か（2026-10-13・launch-backlog A-31）：`toFixed` は数値の内部表現（2進数）で丸めるため、
 * 10進で「ちょうど .x5」の値が切り捨て側に振れることがある（例：29.45 は内部では 29.4499… のため
 * `(29.45).toFixed(1)` は "29.4"）。データの値（JSON に 29.45 と書かれた値）を、読者が期待する
 * 10進の四捨五入（29.5）で表示するために使う。
 *
 * 方法：10進表記の文字列で桁をずらしてから丸める（`29.45e1` = 294.5 → 295 → 29.5）。
 * 負の値は絶対値で丸めて符号を戻す（-0.05 → "-0.1"。0 になる場合は符号を付けない）。
 * 計算途中の割合（例：増減数 ÷ 前年値 × 100）にも使えるが、その場合の「.x5」は偶然の一致であり、
 * 結果は toFixed とほぼ同じになる。
 */
export function toFixedHalfUp(value: number, digits: number): string {
  if (!Number.isFinite(value)) return String(value);
  const neg = value < 0;
  const abs = Math.abs(value);
  // 指数表記になる極端な値（1e-7 等）は文字列での桁ずらしができないため toFixed に任せる（境界値の問題は実質起きない）
  if (/e/i.test(String(abs))) {
    const body = abs.toFixed(digits);
    return neg && Number(body) !== 0 ? `-${body}` : body;
  }
  const shifted = Math.round(Number(`${abs}e${digits}`));
  const rounded = Number(`${shifted}e-${digits}`);
  const body = rounded.toFixed(digits);
  return neg && rounded !== 0 ? `-${body}` : body;
}
