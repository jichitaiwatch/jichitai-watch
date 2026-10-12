import type { Metadata } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/site";
import { WebAnalytics } from "@/components/WebAnalytics";

// metadataBase＝正規ホスト（lib/site.ts）。各ページの canonical はこの基準からの相対パスで書く（D-2）。
// canonical はここ（ルート）には置かない：置くと子ページへ継承され、全ページが "/" を正規URLと名乗ってしまう。
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "自治体Watch",
  description:
    "公的データをAIでわかりやすく提示し、地方自治への市民の関与を高めるためのプロジェクト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {/* スキップリンク（WCAG 2.4.1・C-7。2026-10-03運営者裁定）。通常は非表示、Tabでフォーカスしたときだけ表示。
            飛び先は各ページに1つだけある <main id="main">。 */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--identity)] focus:px-4 focus:py-2 focus:text-base focus:font-bold focus:text-white"
        >
          本文へスキップ
        </a>
        {children}
        {/* アクセス解析（D-3）。トークン未設定・開発サーバーでは何も出さない（lib/analytics.ts）。 */}
        <WebAnalytics />
      </body>
    </html>
  );
}
