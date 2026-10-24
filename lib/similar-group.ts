// lib/similar-group.ts
//
// 類似団体の区分（総務省の類似団体区分。データの group_code）を、ビルドしている言語で画面に出す形にする（作業単位7。2026-10-24）。
// - 日本語版はデータのまま（「Ⅱ－２」「大都市」）。
// - 英語版：「大都市」は辞書の sg-large-cities。区分の記号は全角の文字を半角にそろえる（Ⅱ－２ → II-2）。
//   ほかに日本語を含む区分が出てきたら、ビルドを止める（訳し漏れを出さない）。
import { t } from "@/lib/i18n";
import { LOCALE, type Locale } from "@/lib/locale";

export function similarGroupLabel(code: string, locale: Locale = LOCALE): string {
  if (locale === "ja") return code;
  if (code === "大都市") return t("sg-large-cities", locale);
  const half = code.normalize("NFKC");
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(half)) {
    throw new Error(`[i18n] 類似団体の区分に英語が無い：${code}`);
  }
  return half;
}
