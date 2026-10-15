import { noBreakAfterDot } from "@/lib/text";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import Link from "next/link";
import { HomeSearchBox } from "@/components/HomeSearchBox";
import { Brand } from "@/components/SiteFooter";

// app/page.tsx — トップページ（岐阜県版・V1）。正本＝ui-vi §2.1、design/mock 岐阜県版トップ。
// 全国版（日本地図・地域から探す）は §2.6 で V1 スコープ外。V1 は「現在公開中の地域＝
// 岐阜県カード1枚」で対応範囲を正直に示す。色は mock 実測（navy/teal 系）に準拠。

export const metadata: Metadata = pageMeta({
  title: "自治体Watch｜自治体を探す",
  description: "岐阜県内の市町村の財政や暮らしの制度を、市町村ごとに整理して見られます。",
  path: "/",
});

const NAVY = "#062657";
const NAVY2 = "#173765";
const TEAL = "#008f89";
const TEAL_DARK = "#007b76";
const TEAL_PALE = "#e9f7f5";
const INK_MUTED = "#41577d";
const LINE = "#d8e2ed";

const NAV = [
  { label: "自治体を探す", href: "/search" },
  { label: "自治体Watchとは", href: "/about" },
  { label: "データについて", href: "/data" },
];

const FEATURES = [
  {
    title: "財政の状況",
    body: "歳入・歳出や財政健全化指標を整理",
    icon: (
      <>
        <path d="M8 51V39h8v12M22 51V30h8v21M36 51V19h8v32" />
        <circle cx="49" cy="46" r="12" fill={TEAL} stroke="none" />
        <path d="M44 41l5 6 5-6M49 47v7M44 49h10" stroke="#fff" strokeWidth="2" />
      </>
    ),
  },
  {
    title: "暮らしに関わる制度",
    body: "子ども医療費助成・介護保険料・ふるさと納税を確認",
    icon: (
      <>
        <circle cx="20" cy="17" r="8" />
        <path d="M8 49V35c0-8 5-12 12-12s12 4 12 12v14M16 36v18M29 36v18" />
        <circle cx="45" cy="39" r="6" />
        <path d="M36 58V50c0-5 4-8 9-8s9 3 9 8v8M38 13c3-6 12-4 12 2 0 5-6 8-9 11-3-3-9-6-9-11 0-5 4-8 8-5" />
      </>
    ),
  },
  {
    title: "出典までたどれる",
    body: "出典資料とデータ更新日を明示",
    icon: (
      <>
        <rect x="10" y="8" width="34" height="45" rx="3" />
        <path d="M19 20h17M19 29h13M19 38h8" />
        <circle cx="43" cy="43" r="10" />
        <path d="M50 50l8 8" />
      </>
    ),
  },
];

export default function Home() {
  return (
    <div style={{ background: "#fff" }}>
      <header className="mx-auto flex w-full max-w-6xl flex-col items-start gap-2 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <Link href="/"><Brand /></Link>
        <nav aria-label="メイン" className="flex flex-wrap items-center gap-x-4 text-base font-bold sm:gap-x-10 sm:text-base" style={{ color: NAVY }}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="inline-block py-1.5 hover:opacity-70">{n.label}</Link>
          ))}
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="focus:outline-none mx-auto w-full max-w-6xl px-5 pb-16 sm:px-10">
        {/* hero */}
        <section className="pt-4">
          <p className="mb-3 text-base font-medium tracking-widest sm:text-lg" style={{ color: TEAL_DARK }}>
            地方自治を、もっと身近に。
          </p>
          <h1 className="text-3xl font-extrabold leading-snug tracking-wide sm:text-5xl" style={{ color: NAVY }}>
            {/* スマホ幅で「知」と「る。」の間で折れないよう、句ごとに折り返さない塊にする（2026-10-15 運営者指示） */}
            <span className="inline-block">自分のまちを、</span><span className="inline-block">数字から知る。</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed sm:text-lg" style={{ color: NAVY2 }}>
            財政や暮らしの制度を、市町村ごとに分かりやすく整理します。
          </p>
          <HomeSearchBox />
        </section>

        {/* 現在公開中の地域＝岐阜県カード */}
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold sm:text-2xl" style={{ color: NAVY }}>現在公開中の地域</h2>
          <Link
            href="/gifu-pref/"
            className="flex flex-col items-start gap-5 rounded-xl border bg-white p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6"
            style={{ borderColor: LINE, boxShadow: "0 2px 8px rgba(21,49,86,.04)" }}
          >
            <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full sm:h-28 sm:w-28"
              style={{ background: TEAL_PALE }}>
              <svg viewBox="0 0 100 110" width="72" height="80" fill="none" stroke={TEAL} strokeWidth="3">
                <path d="M65.2 15.4L67 15.7L66.8 17.8L70.5 15.7L73.2 18.5L76.4 17.9L83.1 23.6L82.9 25.9L79.4 30L80.4 32.8L78.5 34.7L78.3 36.5L81.3 38.5L80.4 42.3L74.7 49.4L70.1 49.5L67.4 54L73.9 57.3L78 63.9L76.5 66.4L79.3 67.8L79.4 70.2L82.2 72.3L82.2 74.6L80.3 76L82.3 78.8L79.5 78.8L80.8 82.6L78.6 84.1L78.8 85.7L72.4 89.3L66.6 85.2L60.7 87.5L59.7 85.7L55.6 85.2L54 80.8L50.6 78.5L51.3 77.3L43.7 81.4L40.6 80.6L36.1 88.2L35.7 94.6L34.6 92.7L34.6 93.9L33.2 93.7L29.2 87.3L24.8 89.6L22.4 88.9L23.3 80.6L24.9 79.4L22.1 73.5L22.8 71L21.4 69.3L18.8 70L19 65.9L16.9 64.7L19.3 56.4L21.7 55.2L27.8 57.9L28.7 55.7L41.5 55L43.6 51.5L43.1 49.2L38.5 43.3L38.8 40.1L40.3 39L40.4 33.5L44.5 28.3L41.7 25.3L43.6 24.8L45.5 21.2L45.7 22.7L49.1 22.5L50.5 26.7L59.5 15.9L61.7 17.6Z" />
              </svg>
            </span>
            <span className="w-full min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <strong className="text-3xl font-extrabold tracking-wider" style={{ color: NAVY }}>岐阜県</strong>
                <span className="rounded-full border px-3 py-1 text-base font-bold"
                  style={{ background: TEAL_PALE, borderColor: "#ccebe7", color: TEAL_DARK }}>42市町村</span>
              </span>
              <span className="mt-2 block text-base" style={{ color: INK_MUTED }}>
                岐阜県内の市町村データを公開しています
              </span>
            </span>
            <span className="text-base font-extrabold tracking-wide sm:ml-auto sm:self-center" style={{ color: TEAL_DARK }}>
              岐阜県の自治体を見る <span className="ml-2 text-2xl align-middle">→</span>
            </span>
          </Link>
        </section>

        {/* 自治体Watchで見られること */}
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold sm:text-2xl" style={{ color: NAVY }}>自治体Watchで見られること</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="flex items-center gap-5 rounded-xl border bg-white p-6"
                style={{ borderColor: LINE, boxShadow: "0 2px 6px rgba(21,49,86,.025)" }}>
                <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
                  style={{ background: TEAL_PALE }}>
                  <svg viewBox="0 0 64 64" width="60" height="60" fill="none" stroke={TEAL}
                    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-bold" style={{ color: NAVY }}>{f.title}</span>
                  <span className="mt-2 block text-base leading-relaxed" style={{ color: INK_MUTED }}>{noBreakAfterDot(f.body)}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-base" style={{ color: TEAL_DARK }}>
            <Link href="/about" className="hover:opacity-70">
              自治体Watchについて詳しく見る <span className="ml-2 align-middle text-xl">→</span>
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t" style={{ borderColor: LINE }}>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 py-8 sm:flex-row sm:justify-between sm:px-10">
          <Brand />
          <nav aria-label="サイト情報" className="flex flex-wrap items-center gap-5 text-base font-bold" style={{ color: NAVY }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="inline-block py-1.5 hover:opacity-70">{n.label}</Link>
            ))}
            <Link href="/corrections" className="inline-block py-1.5 hover:opacity-70" style={{ color: "#007b76" }}>
              訂正・お問い合わせ
            </Link>
          </nav>
          <span className="text-base" style={{ color: INK_MUTED }}>© 自治体Watch</span>
        </div>
      </footer>
    </div>
  );
}
