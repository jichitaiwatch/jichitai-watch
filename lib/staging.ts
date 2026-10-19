// lib/staging.ts
//
// 確認用の置き場所（試験環境）向けのビルドかどうか（launch-backlog.md L-11）。環境変数 JICHITAI_STAGING=1 のときだけ真。
// 真のときは、検索エンジンに載せない（robots.txt で全拒否・各ページに noindex）、アクセス解析のタグを出さない
// （本番の計測に確認作業の閲覧が混ざらないようにする）。未設定（公開用ビルド）では何も変わらない。
// ビルドは `node scripts/staging.mjs`（試作の県も含める）。

export const STAGING = process.env.JICHITAI_STAGING === "1";
