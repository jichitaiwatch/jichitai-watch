// lib/publish-languages.ts
//
// 本番（公開用）のビルドで英語版も作るかのスイッチ（2026-10-24 運営者裁定 D-27・同日に改め）。
// - 英語版は岐阜だけの今から公開する（2026-10-24 に true にした）。以後の公開は日英同時（false に戻さない。
//   県を公開に加えたのに false なら publish/check.py が止める）。
// - false：npm run build（scripts/build-site.mjs）は日本語版だけを作る（いままでと同じ出力）。
// - true ：npm run build は日本語版と英語版をまとめて作る（scripts/build-bilingual.mjs。英語版を /en の下に置き、
//   言語の切り替えリンクと hreflang を出し、英語版の訳し漏れを機械で確かめる）。
// - このファイルは画面のコードからは読まない（scripts/build-site.mjs と publish/check.py が文字として読む）。
//   書き方（`export const ENGLISH_PUBLISHED = true;` または false の1行）を変えると、両方が止まる。
export const ENGLISH_PUBLISHED = true;
