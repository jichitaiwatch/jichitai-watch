/**
 * 総額系金額（千円単位の生値）を「兆・億・万区切り」の可読文字列へ整形する（1兆円以上のみ兆を使う）。
 *
 * 対象は歳入・歳出総額、費目内訳、議会費、財政規模グラフ等の「総額系」のみ。
 * 一人あたり支出（円）・介護保険料（円）・課税対象所得（万円）は桁が小さく
 * そのまま読めるため、本フォーマッタの対象外（各カードの既存表示を維持）。
 *
 * 設計（launch-backlog A-1・2026-09-23 運営者裁定 (c)）：
 * - 画面表示は万円位まで（例 660億3,601万円）。千円位は画面では出さない。
 * - 正確な千円値は sr-only 等に別途保持する（データ非加工の担保）。本モジュールは
 *   画面用文字列のみを返し、正確値の保持は呼び出し側が生値 toLocaleString で行う。
 * - 丸めではなく「切り出し」：入力は千円単位の整数生値。万円位＝千円÷10 の整数部を
 *   採り、千円位（端数）は画面から落とす（切り捨て。四捨五入しない＝上振れ表示を作らない）。
 *
 * 中立性（D-6）：単位の割り当ては金額の絶対規模に対して機械的で、特定団体・特定費目を
 * 強調しない。増減や大小に評価色・評価語を与えない用途で使う。
 */

/** 千円単位の生値 → 「N兆M億K万円」表記（画面用・万円位まで・切り捨て。1兆円未満は従来どおり「N億M万円」） */
export function formatManOku(valueThousandYen: number): string {
  if (!Number.isFinite(valueThousandYen)) return "確認できず";

  const neg = valueThousandYen < 0;
  const absThousand = Math.abs(valueThousandYen);

  // 万円位までに丸める（切り捨て）。1万円 = 10千円。
  const totalMan = Math.floor(absThousand / 10); // 万円単位の整数
  const totalOku = Math.floor(totalMan / 10000); // 1億 = 10000万
  const man = totalMan % 10000;
  const cho = Math.floor(totalOku / 10000); // 1兆 = 10000億（2026-10-02運営者裁定で追加）
  const oku = totalOku % 10000;

  let body: string;
  if (totalOku > 0) {
    // 兆・億・万の各位を大きい順に並べ、0の位は省く。末尾は必ず「円」。
    // 例: 9兆123億4,567万円／9兆123億円／9兆4,567万円／660億3,601万円／660億円
    const parts: string[] = [];
    if (cho > 0) parts.push(`${cho.toLocaleString("ja-JP")}兆`);
    if (oku > 0) parts.push(`${oku.toLocaleString("ja-JP")}億`);
    if (man > 0) parts.push(`${man.toLocaleString("ja-JP")}万`);
    body = `${parts.join("")}円`;
  } else if (man > 0) {
    body = `${man.toLocaleString("ja-JP")}万円`;
  } else {
    // 万円位に満たない（1万円未満）。総額系では稀だが、千円位まで落ちる値は
    // 画面でも 0円 とせず千円位まで出して情報消失を防ぐ。
    body = `${absThousand.toLocaleString("ja-JP")}千円`;
  }
  return neg ? `−${body}` : body;
}

/** 千円単位の生値 → 正確な「N千円」表記（sr-only・非加工の正確値保持用） */
export function formatThousandYenExact(valueThousandYen: number): string {
  if (!Number.isFinite(valueThousandYen)) return "確認できず";
  return `${valueThousandYen.toLocaleString("ja-JP")}千円`;
}
