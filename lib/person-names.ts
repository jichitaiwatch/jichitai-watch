// lib/person-names.ts
//
// 首長・正副議長の氏名を、ビルドしている言語で画面に出す形にする（作業単位7。2026-10-23 運営者裁定）。
// - 日本語版はデータの氏名をそのまま返す（表示を変えない）。
// - 英語版は i18n/person-names-en.json（scripts/gen_person_names_en.py が、確かめた読みから作る）の
//   「姓 名」のローマ字に漢字を添える：Yamada Haruo (山田 晴夫)。文型は辞書の p-person-name。
//   読みを確かめられなかった人・載っていない人は、推測せず漢字のまま返す（D-25）。
// - 引くキーは「団体コードの先頭5桁|氏名（空白を除く）」。都道府県はデータの pref_code（2桁）に "000" を足す。
// - サーバー側でだけ使う（氏名の一覧をブラウザ用のファイルに入れないため）。
import personNames from "@/i18n/person-names-en.json";
import { tf } from "@/lib/i18n";
import { LOCALE, type Locale } from "@/lib/locale";

type Entry = { family_ja: string; given_ja: string; family_en: string; given_en: string };

const PEOPLE = personNames.people as Record<string, Entry>;

function keyOf(areaCode: string, nameJa: string): string {
  const code5 = areaCode.length === 2 ? `${areaCode}000` : areaCode.slice(0, 5);
  return `${code5}|${nameJa.replace(/[\s　]+/g, "")}`;
}

export type PersonNameParts = {
  /** ローマ字（"Yamada Haruo"）。読みが無い人は null */
  romaji: string | null;
  /** 漢字（英語版で添える形 "山田 晴夫"。読みが無い人はデータの表記のまま） */
  kanji: string;
};

/** 英語版で出す部品（ローマ字と漢字）。日本語版では使わない */
export function personNameParts(areaCode: string, nameJa: string): PersonNameParts {
  const e = PEOPLE[keyOf(areaCode, nameJa)];
  if (!e) return { romaji: null, kanji: nameJa };
  return { romaji: `${e.family_en} ${e.given_en}`, kanji: `${e.family_ja} ${e.given_ja}` };
}

/** 文字列で出す形（入口の要約など）。日本語版はデータの氏名のまま */
export function personNameLabel(areaCode: string, nameJa: string, locale: Locale = LOCALE): string {
  if (locale === "ja") return nameJa;
  const { romaji, kanji } = personNameParts(areaCode, nameJa);
  if (!romaji) return kanji;
  return tf("p-person-name", { romaji, kanji }, locale);
}
