// lib/search-example.ts
//
// 検索の入力例（「例：岐阜市、大垣市」）を、ビルドしている言語の名前で作る（作業単位8。2026-10-24）。
// 選び方は lib/prefectures.ts の SEARCH_EXAMPLE と同じ（県が1つなら2市、複数なら各県の1市目）。
// - 日本語版は SEARCH_EXAMPLE をそのまま返す（表示を変えない）。
// - 英語版は英語の名前（MunicipalityConfig.label）を「, 」でつなぐ（Gifu City, Ogaki City）。
// トップの検索欄（app/page.tsx）と検索ページ（app/search/layout.tsx）で使う。サーバー側でだけ使う。
import { LOCALE, type Locale } from "@/lib/locale";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { PREFECTURES, SEARCH_EXAMPLE } from "@/lib/prefectures";

export function searchExample(locale: Locale = LOCALE): string {
  if (locale === "ja") return SEARCH_EXAMPLE;
  const label = (prefName: string, cityName: string) => {
    const m = MUNICIPALITIES.find((x) => x.prefectureName === prefName && x.cityName === cityName);
    if (!m) throw new Error(`[search] 入力例の団体が無い：${prefName}${cityName}`);
    return m.label;
  };
  return (
    PREFECTURES.length === 1
      ? PREFECTURES[0].exampleCities.slice(0, 2).map((c) => label(PREFECTURES[0].prefectureName, c))
      : PREFECTURES.map((p) => label(p.prefectureName, p.exampleCities[0]))
  ).join(", ");
}
