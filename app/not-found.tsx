import type { Metadata } from "next";
import Link from "@/components/SiteLink";
import { DocSection, SitePageShell } from "@/components/SitePageShell";
import { t } from "@/lib/i18n";
import { SHARE_IMAGE, pageTitle } from "@/lib/site";
import { LOCALE } from "@/lib/locale";

// app/not-found.tsx — カスタム404（C-3・pre-launch-gates.md Gate 11「存在しないURL・旧URLで確認」）。
// 従来は Next.js 既定の英語404（リンク0件の行き止まり）だった。文書ページと同じ共通の器
// （ヘッダー・フッター）に載せ、トップと検索へ戻れるようにする。output:'export' では
// 本ファイルから out/404.html が生成され、ホスティング側が未知のURLに返す（ホスティング非依存）。
// 旧URLは公開前のため転送しない（G-1 で移設済み・リダイレクト不要と判断済み）。導線は検索とトップ。

// 共有画像の代替文：日本語版は app/opengraph-image.alt.txt（ファイルの決まりで、このページの共有画像に付く）。
// その文は日本語なので、英語版だけ共有画像と代替文をここで明示する（辞書の p-share-alt。日本語版の出力は変えない）。
export const metadata: Metadata = {
  title: pageTitle(t("ui-404-title")),
  ...(LOCALE === "en" ? { openGraph: { images: [SHARE_IMAGE] }, twitter: { images: [SHARE_IMAGE] } } : {}),
};

const NAVY = "#062657";
const TEAL_DARK = "#007b76";

export default function NotFound() {
  return (
    <SitePageShell title={t("ui-404-title")}>
      <DocSection>
        <p>
          {t("ui-404-body")}
        </p>
        <p>{t("ui-404-next")}</p>
        <ul className="mt-2 flex flex-col gap-3 sm:flex-row">
          <li>
            <Link
              href="/search"
              className="inline-block rounded-xl px-5 py-3 text-base font-bold text-white hover:opacity-90"
              style={{ background: NAVY }}
            >
              {t("ui-nav-search")}
            </Link>
          </li>
          <li>
            <Link
              href="/"
              className="inline-block rounded-xl border px-5 py-3 text-base font-bold hover:opacity-70"
              style={{ borderColor: TEAL_DARK, color: TEAL_DARK }}
            >
              {t("ui-back-to-home")}
            </Link>
          </li>
        </ul>
      </DocSection>
    </SitePageShell>
  );
}
