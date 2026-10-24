import Image from "next/image";
import Link from "@/components/SiteLink";
import { t } from "@/lib/i18n";
import { LOCALE } from "@/lib/locale";

// components/SiteFooter.tsx
// サイト共通フッター（ヘッダー3項目相当＋訂正・お問い合わせ）。文書ページの共通の器
// （components/SitePageShell.tsx）から抽出し、自治体ページ（app/[pref]/layout.tsx）・
// 検索（app/search/layout.tsx）でも同一のものを使う（C-2 N-4：市区町村ページから
// 訂正窓口・検索・トップへ到達できなかった導線欠落の解消。Gate 4「訂正導線はフッター」）。
// VI は app/page.tsx / SitePageShell と同じ（navy/teal 系・mock実測）。サーバーコンポーネント。

const NAVY = "#062657";
const TEAL_DARK = "#007b76";
const INK_MUTED = "#41577d";
const LINE = "#d8e2ed";

export const SITE_NAV = [
  { label: t("ui-nav-search"), href: "/search" },
  { label: t("ui-nav-about"), href: "/about" },
  { label: t("ui-nav-data"), href: "/data" },
];

// サイトのロゴ（ページ上部・下部）。正式ロゴ（原本 design/brand/logo-official.png・2026-10-04運営者提供）を
// scripts/gen_site_images.py で切り抜き・縮小した public/brand-logo.png を表示する（ui-vi-handoff.md §4.11）。
// トップページ（app/page.tsx）もこの部品を使う。隣に「自治体Watch」の文字があるため、画像の代替テキストは空にして
// 読み上げの重複を避ける（以前は「自」の文字を描いていたため「自 自治体Watch」と読まれていた）。
export function Brand() {
  return (
    <span className="inline-flex items-center gap-3 text-2xl font-extrabold sm:text-3xl" style={{ color: NAVY }}>
      <Image src="/brand-logo.png" alt="" width={44} height={44} className="h-10 w-10 sm:h-11 sm:w-11" />
      <span>{t("ui-site-name")}</span>
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-white" style={{ borderColor: LINE }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 py-8 sm:flex-row sm:justify-between sm:px-10">
        <Link href="/"><Brand /></Link>
        <nav aria-label={t("ui-aria-site-info")} className="flex flex-wrap items-center justify-center gap-5 text-base font-bold" style={{ color: NAVY }}>
          {SITE_NAV.map((n) => (
            <Link key={n.href} href={n.href} className="inline-block py-1.5 hover:opacity-70">{n.label}</Link>
          ))}
          <Link href="/corrections" className="inline-block py-1.5 hover:opacity-70" style={{ color: TEAL_DARK }}>
            {t("ui-nav-corrections")}
          </Link>
        </nav>
        {/* 英語版の「© Jichitai Watch」は狭い幅で途中で折れるので、英語版だけ1行に保つ（日本語版は従来どおり） */}
        <span className="text-base" style={{ color: INK_MUTED, ...(LOCALE === "en" ? { whiteSpace: "nowrap" } : {}) }}>{t("ui-copyright")}</span>
      </div>
    </footer>
  );
}
