import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SearchExtraPagesProvider, type ExtraPages } from "@/components/SearchExtraPages";
import searchIndex from "@/data/search_index.json";
import { MUNICIPALITIES, WARDS } from "@/lib/municipalities";
import { PREFECTURES, SEARCH_EXAMPLE } from "@/lib/prefectures";
import { pageMeta } from "@/lib/site";

// app/search/layout.tsx — 検索（/search）共通のフッター。
// C-2 N-4：検索画面から /about・/data・/corrections（訂正窓口・Gate 4）へ到達できなかった
// 導線欠落の解消。page.tsx は "use client" のためフッターはサーバー側のレイアウトに置く。

// 検索ページ本体は "use client" のため metadata を持てない。title・description・canonical・共有メタはここで付ける（D-1/D-2）。
// 検索語つきURL（/search#q=…／旧形式 /search?q=…）も正規URLは /search に寄せる。
export const metadata: Metadata = pageMeta({
  title: "自治体を探す | 自治体Watch",
  description: "自治体名やよみがなで、市町村のページを探せます。",
  path: "/search",
});

/**
 * 索引では未公開（published=false）だが、このビルドにページがある団体（area_code → URL）。
 * 照合は団体コード：市区町村・区は area_code、県は pref_code（索引の県の行）。URL の形は索引と同じ（末尾 /）。
 * 公開用ビルドでは岐阜のページはすべて索引で公開済みなので空になる（試作ビルドだけ愛知・三重が入る。L-9）。
 */
function extraPages(): ExtraPages {
  const records = (searchIndex as {
    data: { area_code: string; pref_code: string; level: string; published: boolean }[];
  }).data;
  const units = new Map([...MUNICIPALITIES, ...WARDS].map((m) => [m.areaCode, m]));
  const prefs = new Map(PREFECTURES.map((p) => [p.prefCode, p]));
  const out: ExtraPages = {};
  for (const r of records) {
    if (r.published) continue;
    if (r.level === "prefecture") {
      const p = prefs.get(r.pref_code);
      if (p) out[r.area_code] = `/${p.prefSlug}/`;
    } else {
      const m = units.get(r.area_code);
      if (m) out[r.area_code] = `/${m.prefSlug}/${m.slug}/`;
    }
  }
  return out;
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  const pages = extraPages();
  return (
    <>
      {Object.keys(pages).length > 0 ? (
        <SearchExtraPagesProvider pages={pages} example={SEARCH_EXAMPLE}>{children}</SearchExtraPagesProvider>
      ) : (
        children
      )}
      <SiteFooter />
    </>
  );
}
