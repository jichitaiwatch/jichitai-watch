// lib/format-units.ts
//
// 単位の前に置く数字の書き方を、ビルドしている言語で切り替える（作業単位6）。単位の語そのものは用語辞書の文型
// （p-yen「{amount}円」→ 英語「{amount}」など）に置き、ここでは数字の部分だけを作る。
// - 日本語版は従来どおり（数字だけ。円は辞書の文型が後ろに付ける）。英語版は円の記号を前に付ける（¥6,900）。
// - 辞書を読まないので、ブラウザ側で動く部品からも import してよい。
import { LOCALE } from "@/lib/locale";
import { enYen, enYenExactFromThousandYen, enYenFromManYen } from "@/lib/format-en";
import { formatManUnit } from "@/lib/format-count";

/** 円の値の数字の部分（日本語「6,900」・英語「¥6,900」）。辞書の p-yen「{amount}円」と組む */
export function yenAmount(valueYen: number): string {
  return LOCALE === "en" ? enYen(valueYen) : valueYen.toLocaleString("ja-JP");
}

/** 円の値の数字の部分を、日本語は万で区切って書く（日本語「1万2,345」・英語「¥12,345」）。辞書の p-yen と組む */
export function yenAmountMan(valueYen: number): string {
  return LOCALE === "en" ? enYen(valueYen) : formatManUnit(valueYen);
}

/** 千円単位の値の数字の部分（日本語「66,036,013」・英語「¥66,036,013,000」）。辞書の p-thousand-yen「{amount}千円」と組む */
export function thousandYenAmount(valueThousandYen: number): string {
  return LOCALE === "en" ? enYenExactFromThousandYen(valueThousandYen) : valueThousandYen.toLocaleString("ja-JP");
}

/** 万円の小数（四捨五入済みの文字列）の数字の部分（日本語「426.9」・英語「¥4,269,000」）。辞書の p-man-yen「{amount}万円」と組む */
export function manYenAmount(roundedManYen: string): string {
  return LOCALE === "en" ? enYenFromManYen(roundedManYen) : roundedManYen;
}
