// lib/locale.ts
//
// いまビルドしている言語（作業単位6）。英語版は、言語を指定した別のビルドで作り、/en の下に置く。
// - 指定は環境変数 NEXT_PUBLIC_JICHITAI_LOCALE（"en" のときだけ英語版。未設定＝日本語版＝公開用ビルドと同じ）。
//   NEXT_PUBLIC_ で始まる名前にしているのは、ブラウザ側で動く部品（グラフの数字の書き方など）にもビルド時に値が埋め込まれるため。
// - 英語版のビルドは next.config.ts の basePath を "/en" にする。サイト内リンク（next/link）とJS・画像の場所に /en が自動で付く。
// - このファイルは辞書を読まない（ブラウザ側の部品からも import してよい）。
export type Locale = "ja" | "en";

export const LOCALE: Locale = process.env.NEXT_PUBLIC_JICHITAI_LOCALE === "en" ? "en" : "ja";

/** その言語のページのURLの頭（日本語＝""、英語＝"/en"）。§5.8：日本語は今のURLのまま、他の言語は頭に言語の印を付ける。 */
export const LOCALE_PREFIX: Record<Locale, string> = { ja: "", en: "/en" };

/**
 * 日本語版と英語版を1つのサイトにまとめて作っているか（scripts/build-bilingual.mjs が両方のビルドに付ける）。
 * true のときだけ、言語の切り替えリンクと、検索エンジン向けの対の印（hreflang）を出す。
 * 未設定＝日本語だけのビルド。本番で英語版も作るかは lib/publish-languages.ts の ENGLISH_PUBLISHED（2026-10-24 D-27）。
 */
export const BILINGUAL: boolean = process.env.NEXT_PUBLIC_JICHITAI_BILINGUAL === "1";

/** その言語でのページのURL（path はサイト内の形。例 "/about"）。英語のトップは "/en"。 */
export function localePath(path: string, locale: Locale): string {
  const prefix = LOCALE_PREFIX[locale];
  if (!prefix) return path;
  return path === "/" ? prefix : `${prefix}${path}`;
}
