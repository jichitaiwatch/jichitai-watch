// lib/place-names.ts
//
// 県・市区町村の名前を、ビルドしている言語で画面に出す形にする（作業単位7。2026-10-23 運営者裁定）。
// - 日本語版は日本語の名前をそのまま返す（表示を変えない）。
// - 英語版は i18n/place-names-en.json（scripts/gen_place_names_en.py が作る）の英語を返す
//   （岐阜県 = Gifu Prefecture、岐阜市 = Gifu City、笠松町 = Kasamatsu Town、名古屋市熱田区 = Atsuta Ward, Nagoya City）。
//   載っていない名前はビルドを止める（訳し漏れを画面に出さない）。
// - 名前はデータの照合キーにも使うので、照合には使わない。画面に出す直前にだけ通す。
// - サーバー側でだけ使う（名前の一覧をブラウザ用のファイルに入れないため）。ブラウザ側の部品には、引いた名前を props で渡す。
import placeNames from "@/i18n/place-names-en.json";
import { LOCALE, type Locale } from "@/lib/locale";

type Entry = { ja: string; en: string; short_en?: string };

const PREF_BY_NAME: ReadonlyMap<string, Entry> = new Map(
  Object.values(placeNames.prefectures as Record<string, Entry>).map((e) => [e.ja, e]),
);
const MUNI_BY_CODE = placeNames.municipalities as Record<string, Entry>;

/** 都道府県の名前（日本語の名前で引く。都道府県名は全国で重ならない） */
export function prefLabel(nameJa: string, locale: Locale = LOCALE): string {
  if (locale === "ja") return nameJa;
  const e = PREF_BY_NAME.get(nameJa);
  if (!e) throw new Error(`[place-names] 英語の名前が無い都道府県：${nameJa}（scripts/gen_place_names_en.py）`);
  return e.en;
}

/** 市区町村の名前（団体コードで引く。府中市など、同じ名前が別の県にあるため） */
export function muniLabel(areaCode: string, nameJa: string, locale: Locale = LOCALE): string {
  if (locale === "ja") return nameJa;
  const e = MUNI_BY_CODE[areaCode];
  if (!e || e.ja !== nameJa) {
    throw new Error(`[place-names] 英語の名前が無い・合わない市区町村：${areaCode} ${nameJa}（scripts/gen_place_names_en.py）`);
  }
  return e.en;
}

/** 政令指定都市の区の短い名前（親の市の名前を除く。日本語「熱田区」・英語「Atsuta Ward」） */
export function wardShortLabel(areaCode: string, nameJa: string, parentNameJa: string, locale: Locale = LOCALE): string {
  if (locale === "ja") return nameJa.replace(parentNameJa, "");
  const e = MUNI_BY_CODE[areaCode];
  if (!e?.short_en || e.ja !== nameJa) throw new Error(`[place-names] 英語の短い名前が無い区：${areaCode} ${nameJa}`);
  return e.short_en;
}
