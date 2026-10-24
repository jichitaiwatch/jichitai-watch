import { LOCALE } from "@/lib/locale";
import { enCount } from "@/lib/format-en";
/**
 * 人口・世帯数（単位「人」「世帯」）の生値を「万区切り」の可読文字列へ整形する。
 *
 * 対象は総人口・男女内訳・世帯数、およびそれらの前年比の絶対値（`components/PopulationCard.tsx`・
 * `components/HouseholdCountCard.tsx`）。金額系（歳入歳出等）は `lib/format-yen.ts` の
 * `formatManOku`（千円単位・億万区切り）が担うため本モジュールの対象外。一人あたり支出（円）・
 * 介護保険料（円）は桁が小さくそのまま読めるため対象外（各カードの既存表示を維持）。
 *
 * 設計（launch-backlog A-23・2026-09-27 運営者裁定）：
 * - 万位のみ区切り、万未満はカンマ区切りの生数字のまま保持する（例：406,632 → 40万6,632）。
 * - 丸めない・切り捨てない＝完全な値を保持する（`format-yen.ts` が総額系で万円位まで切り捨てる
 *   のとは異なり、人口・世帯数は正確値そのものを画面に出す）。1万未満の値は万を付けず生数字のみ
 *   （例：8,320 → 8,320）。
 * - 単位（人／世帯）は付与せず数値部分のみ返す。単位は呼び出し側で付ける。
 *
 * 中立性（D-6）：万区切りは数値の絶対規模に対して機械的な整形であり、特定団体・特定値を強調しない。
 * 増減や大小に評価色・評価語を与えない用途で使う。値を丸めず完全に保持するため情報の欠落も生じない。
 */

/** 人口・世帯数の生値 → 「N万M」表記（数値部分のみ・丸めず完全な値を保持） */
export function formatManUnit(value: number): string {
  // 英語版は万で区切らず全桁で書く（lib/format-en.ts）
  if (LOCALE === "en") return enCount(value);
  if (!Number.isFinite(value)) return "確認できず";
  const neg = value < 0;
  const abs = Math.abs(value);
  const man = Math.floor(abs / 10000);
  const rest = abs % 10000;
  let body: string;
  if (man > 0 && rest > 0) {
    body = `${man.toLocaleString("ja-JP")}万${rest.toLocaleString("ja-JP")}`;
  } else if (man > 0) {
    body = `${man.toLocaleString("ja-JP")}万`;
  } else {
    body = `${rest.toLocaleString("ja-JP")}`;
  }
  return neg ? `−${body}` : body;
}
