import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL, pageTitle } from "@/lib/site";
import { t, tf } from "@/lib/i18n";
import { BILINGUAL, LOCALE } from "@/lib/locale";
import { LanguageLink } from "@/components/LanguageLink";
import { WebAnalytics } from "@/components/WebAnalytics";

// metadataBase＝正規ホスト（lib/site.ts）。各ページの canonical はこの基準からの相対パスで書く（D-2）。
// canonical はここ（ルート）には置かない：置くと子ページへ継承され、全ページが "/" を正規URLと名乗ってしまう。
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: t("ui-site-description"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={LOCALE}>
      <body className="antialiased">
        {/* スキップリンクと言語の切り替えリンクは1つの塊（<>…</>）に入れる。塊を分けて並べると、後ろの {children} の
            位置がずれ、ページ内の部品の自動の id（useId）が変わってしまう（日本語版の出力を変えないため）。 */}
        <>
          {/* スキップリンク（WCAG 2.4.1・C-7。2026-10-03運営者裁定）。通常は非表示、Tabでフォーカスしたときだけ表示。
              飛び先は各ページに1つだけある <main id="main">。 */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--identity)] focus:px-4 focus:py-2 focus:text-base focus:font-bold focus:text-white"
          >
            {t("ui-skip-to-main")}
          </a>
          {/* 言語の切り替えリンク（日本語版と英語版をまとめて作ったときだけ。公開用ビルドでは何も出さない） */}
          {BILINGUAL && (
            <LanguageLink
              native={t("ui-lang-switch-native")}
              paren={tf("p-lang-switch-paren", { x: t("ui-lang-switch-local") })}
              label={t("ui-aria-lang-switch")}
              notFoundTitle={pageTitle(t("ui-404-title"))}
            />
          )}
        </>
        {children}
        {/* アクセス解析（D-3）。トークン未設定・開発サーバーでは何も出さない（lib/analytics.ts）。 */}
        <WebAnalytics />
      </body>
    </html>
  );
}
