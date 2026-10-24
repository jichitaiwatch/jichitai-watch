// lib/data-text.ts
//
// データに入っている、自治体Watch が調べて書いた語・注記（会議録の公開形式・首長の注記・正副議長の退任の理由など）を、
// ビルドしている言語で画面に出す形にする（作業単位7。2026-10-24 運営者承認）。
// - 日本語版はデータの原文をそのまま返す（表示を変えない）。
// - 英語版は i18n/data-text-en.json の英訳を返す。表で null のものは訳さず日本語のまま（ja=true。画面側で lang="ja" を付ける）。
//   表に無い原文を出そうとするとビルドを止める（データに注記を足したら、英訳も足す）。
// - サーバー側でだけ使う。
import dataText from "@/i18n/data-text-en.json";
import { LOCALE, type Locale } from "@/lib/locale";
import type { NameLabel } from "@/lib/party-labels";

export type DataTextKind = "minutes_format" | "chief_note" | "leaving_reason" | "chair_note" | "kaiha_memo" | "forest_basis";

const TABLE = dataText as unknown as Record<DataTextKind, Record<string, string | null>>;

export function dataTextLabel(kind: DataTextKind, ja: string, locale: Locale = LOCALE): NameLabel {
  if (locale === "ja") return { text: ja, ja: false };
  const table = TABLE[kind];
  if (!(ja in table)) {
    throw new Error(`[data-text] 英訳が無い（i18n/data-text-en.json の ${kind}）：${ja}`);
  }
  const en = table[ja];
  return en === null ? { text: ja, ja: true } : { text: en, ja: false };
}

/** 文字列だけが要る欄（文型への差し込みなど）。日本語のまま出す名前も文字列で返す */
export function dataTextString(kind: DataTextKind, ja: string, locale: Locale = LOCALE): string {
  return dataTextLabel(kind, ja, locale).text;
}
