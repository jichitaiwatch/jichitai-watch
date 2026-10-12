// lib/contact.ts
//
// 問い合わせフォーム（Googleフォーム）の設定の単一の源（launch-backlog.md D-14・docs/gate4-brand-public-docs.md）。
// 空文字のあいだは「フォームなし（メール窓口のみ）」の文面を出す。フォームを作成したら、その公開URLをここに入れる。
// サイトに埋め込まず、リンクで飛ばす方式（CSPの変更は不要）。

export const CONTACT_FORM_URL: string = "https://docs.google.com/forms/d/e/1FAIpQLSc_yZP2FeS1x8ngZiBLe_aRhqVZtnnXaDZXEcvVdgDDXqNbjQ/viewform";

/** 窓口のメールアドレス（/about・/corrections 共通）。 */
export const CONTACT_EMAIL = "jichitaiwatch.official@gmail.com";

export function contactFormEnabled(): boolean {
  return CONTACT_FORM_URL !== "";
}
