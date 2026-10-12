// lib/analytics.ts
//
// アクセス解析の設定の単一の源（launch-backlog.md D-3・pre-launch-gates.md Gate 8）。
//
// - ツール：Cloudflare Web Analytics（cookieを使わない・同意バナー不要。Gate 8 の推奨）。
//   Google Analytics は採用しない（Gate 8）。
// - 読み込み方：Cloudflare 公式の「手動で埋め込む」方式（サイトが Cloudflare を経由しない場合の方式）。
//   各ページに beacon.min.js を読む <script> を1つ置く（components/WebAnalytics.tsx）。
// - 配信元：スクリプト＝https://static.cloudflareinsights.com、送信先＝https://cloudflareinsights.com。
//   public/_headers の CSP（script-src・connect-src）にこの2つを足してある。ここを変えたら CSP も直す（D-22 で vercel.json から移行）。
// - トークン：Cloudflare の管理画面でサイト（jichitaiwatch.jp）を登録すると発行される。
//   ページの HTML にそのまま書かれる公開値であり、秘密情報ではない（security-model.md §5 の secret に当たらない）。
//   空文字のあいだは解析タグを一切出さない（未設定のまま公開しないことは H-2 で確認する）。

export const CF_BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

/** Cloudflare Web Analytics のサイトトークン（2026-10-04 発行・登録ホスト jichitaiwatch.jp）。空文字にするとタグを出さない。 */
export const CF_BEACON_TOKEN: string = "3e516f77db134e1394309a53bac616ae";

/**
 * 解析タグを出すか。本番用ビルド（npm run build）かつトークン設定済みのときだけ出す。
 * 開発サーバー（npm run dev）では出さない：手元の確認で計測が混ざるのを防ぐ。
 */
export function analyticsEnabled(): boolean {
  return process.env.NODE_ENV === "production" && CF_BEACON_TOKEN !== "";
}
