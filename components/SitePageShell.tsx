import Link from "next/link";
import { noBreakAfterDot } from "@/lib/text";
import { Brand, SITE_NAV, SiteFooter } from "@/components/SiteFooter";

// components/SitePageShell.tsx
// 文書ページ（about/data/corrections）の共通の器。トップ（app/page.tsx）と同じ
// ヘッダー・フッターVI（navy/teal 系・mock実測）を使い回す。本文は各ページが children で渡す。
// フッターは components/SiteFooter.tsx（自治体ページ・検索と共通）。「訂正・お問い合わせ」導線を
// 置く（Gate 4・spec B-1）。

const NAVY = "#062657";

export function SitePageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff" }}>
      <header className="mx-auto flex w-full max-w-6xl flex-col items-start gap-2 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <Link href="/"><Brand /></Link>
        <nav aria-label="メイン" className="flex flex-wrap items-center gap-x-4 text-base font-bold sm:gap-x-10 sm:text-base" style={{ color: NAVY }}>
          {SITE_NAV.map((n) => (
            <Link key={n.href} href={n.href} className="inline-block py-1.5 hover:opacity-70">{n.label}</Link>
          ))}
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="focus:outline-none mx-auto w-full max-w-3xl px-5 pb-16 pt-2 sm:px-10">
        <h1 className="text-3xl font-extrabold tracking-wide sm:text-4xl" style={{ color: NAVY }}>{title}</h1>
        <div className="mt-8">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}

// 文書ページ本文の共通パーツ（見出し・段落・区切り）。
export function DocSection({ heading, id, children }: { heading?: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6 first:mt-0">
      {heading && (
        <h2 className="text-xl font-bold sm:text-2xl" style={{ color: NAVY }}>{heading}</h2>
      )}
      <div className="mt-4 space-y-4 text-base leading-relaxed" style={{ color: "#1f3350" }}>
        {noBreakAfterDot(children)}
      </div>
    </section>
  );
}
