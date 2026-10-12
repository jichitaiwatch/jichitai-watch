import type { Metadata } from "next";
import Link from "next/link";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { PREFECTURES } from "@/lib/prefectures";
import { pageMeta, regionPath } from "@/lib/site";

// app/gifu-pref/page.tsx — 地域ページ（/gifu-pref/）。正本＝ui-vi §0.13/§2.1。
// 「岐阜県という地域」＝県内市町村の一覧・県のシルエット・県庁への導線を持つ。
// 県庁自身の統治データは政府ページ（/gifu-pref/gifu-ken/）に分離（§0.13）。
// 県＝青系（既存ルート規約）、市区町村＝teal 系（[gov] ページと同型）。

const prefecture = PREFECTURES[0];

// 県内市町村（active）。団体コード昇順の単純一覧（市→町→村はコード順で自然に整列）。
// 並び順は機械的順序＝評価順を作らない（ui-vi §2.3・D-6）。
const municipalities = [...MUNICIPALITIES].sort((a, b) =>
  a.areaCode.localeCompare(b.areaCode),
);

export const metadata: Metadata = pageMeta({
  title: `${prefecture.prefectureName} | 自治体Watch`,
  description: `${prefecture.prefectureName}内の市町村一覧。市町村ごとに財政や暮らしの制度を見られます。`,
  path: regionPath(prefecture.prefSlug),
});

const PREF_BLUE = "#073f91";

export default function GifuPrefPage() {
  return (
    <main id="main" tabIndex={-1} className="focus:outline-none min-h-screen bg-stone-100 px-3 py-6 sm:px-8 sm:py-10 type-large">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-1 py-1.5 fs-label font-medium text-stone-600">
          <span aria-hidden="true">←</span> トップ
        </Link>

        {/* 見出し：県名＋シルエット＋件数 */}
        <div className="mt-4 flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full sm:h-20 sm:w-20"
            style={{ background: "#e4eefb" }}>
            <svg viewBox="0 0 100 110" width="48" height="53" fill="none" stroke={PREF_BLUE} strokeWidth="3">
              <path d="M65.2 15.4L67 15.7L66.8 17.8L70.5 15.7L73.2 18.5L76.4 17.9L83.1 23.6L82.9 25.9L79.4 30L80.4 32.8L78.5 34.7L78.3 36.5L81.3 38.5L80.4 42.3L74.7 49.4L70.1 49.5L67.4 54L73.9 57.3L78 63.9L76.5 66.4L79.3 67.8L79.4 70.2L82.2 72.3L82.2 74.6L80.3 76L82.3 78.8L79.5 78.8L80.8 82.6L78.6 84.1L78.8 85.7L72.4 89.3L66.6 85.2L60.7 87.5L59.7 85.7L55.6 85.2L54 80.8L50.6 78.5L51.3 77.3L43.7 81.4L40.6 80.6L36.1 88.2L35.7 94.6L34.6 92.7L34.6 93.9L33.2 93.7L29.2 87.3L24.8 89.6L22.4 88.9L23.3 80.6L24.9 79.4L22.1 73.5L22.8 71L21.4 69.3L18.8 70L19 65.9L16.9 64.7L19.3 56.4L21.7 55.2L27.8 57.9L28.7 55.7L41.5 55L43.6 51.5L43.1 49.2L38.5 43.3L38.8 40.1L40.3 39L40.4 33.5L44.5 28.3L41.7 25.3L43.6 24.8L45.5 21.2L45.7 22.7L49.1 22.5L50.5 26.7L59.5 15.9L61.7 17.6Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="fs-label font-medium" style={{ color: PREF_BLUE }}>都道府県</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: PREF_BLUE }}>
                {prefecture.prefectureName}
              </h1>
              <span className="rounded-full border px-3 py-1 fs-label font-bold"
                style={{ background: "#e4eefb", borderColor: "#c3d6f2", color: PREF_BLUE }}>
                {municipalities.length}市町村
              </span>
            </div>
          </div>
        </div>

        {/* 県庁への導線 */}
        <Link
          href={`/${prefecture.prefSlug}/${prefecture.govSlug}/`}
          className="mt-6 flex items-center justify-between rounded-xl border bg-white px-5 py-4"
          style={{ borderColor: "#c3d6f2", boxShadow: "0 2px 8px rgba(21,49,86,.04)" }}
        >
          <span>
            <span className="block text-base font-bold" style={{ color: PREF_BLUE }}>
              {prefecture.prefectureName}庁のデータを見る
            </span>
            <span className="mt-1 block fs-label text-stone-600">
              県自身の財政・議会などの統治データ
            </span>
          </span>
          <span className="text-2xl" style={{ color: PREF_BLUE }} aria-hidden="true">→</span>
        </Link>

        {/* 県内市町村一覧 */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-teal-950">
            県内の市町村 <span className="fs-label font-normal text-stone-600">{municipalities.length}件</span>
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {municipalities.map((m) => (
              <li key={m.areaCode}>
                <Link
                  href={`/${m.prefSlug}/${m.slug}/`}
                  className="flex items-center justify-between rounded-xl border bg-white px-4 py-3.5 hover:border-teal-600"
                  style={{ borderColor: "#d5dfda", boxShadow: "0 2px 6px rgba(21,49,86,.03)" }}
                >
                  <span className="min-w-0 truncate font-bold text-teal-950">{m.cityName}</span>
                  <span className="shrink-0 text-lg text-teal-700" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
