import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SearchExtraPagesProvider, type ExtraPages } from "@/components/SearchExtraPages";
import searchIndex from "@/data/search_index.json";
import { MUNICIPALITIES, WARDS } from "@/lib/municipalities";
import { PREFECTURES, SEARCH_EXAMPLE } from "@/lib/prefectures";
import { pageMeta, pageTitle } from "@/lib/site";
import { msgsFor, t } from "@/lib/i18n";
import { SEARCH_MSG_IDS } from "@/lib/i18n-ids";
import { MessagesProvider } from "@/components/MessagesProvider";
import { SearchEnglishProvider, type SearchEnglish } from "@/components/SearchEnglish";
import placeNames from "@/i18n/place-names-en.json";
import { LOCALE } from "@/lib/locale";
import { prefLabel } from "@/lib/place-names";
import { normalizeSearchKey } from "@/lib/search-normalize";
import { searchExample } from "@/lib/search-example";

// app/search/layout.tsx — 検索（/search）共通のフッター。
// C-2 N-4：検索画面から /about・/data・/corrections（訂正窓口・Gate 4）へ到達できなかった
// 導線欠落の解消。page.tsx は "use client" のためフッターはサーバー側のレイアウトに置く。

// 検索ページ本体は "use client" のため metadata を持てない。title・description・canonical・共有メタはここで付ける（D-1/D-2）。
// 検索語つきURL（/search#q=…／旧形式 /search?q=…）も正規URLは /search に寄せる。
export const metadata: Metadata = pageMeta({
  title: pageTitle(t("ui-nav-search")),
  description: t("ui-desc-search"),
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

/**
 * 英語版の検索で使う英語の名前と英語の検索キー（作業単位8。英語版のビルドのときだけ作る）。
 * 県は47すべて、市区町村は英語の名前がある団体（データのある県）だけ。キーは英語の名前を検索と同じ正規化に通したもの
 * （"Kasamatsu Town" → kasamatsutown。前方一致なので "Kasamatsu" でも当たる。統計局の形 Kasamatsu-cho は索引の読みローマ字キーで当たる）。
 */
function searchEnglish(): SearchEnglish {
  const records = (searchIndex as {
    data: { area_code: string; pref_code: string; level: string; name: string; pref_name: string }[];
  }).data;
  const muni = placeNames.municipalities as Record<string, { ja: string; en: string; short_en?: string }>;
  const prefs: SearchEnglish["prefs"] = {};
  const units: SearchEnglish["units"] = {};
  for (const r of records) {
    if (r.level === "prefecture") {
      const name = prefLabel(r.name);
      prefs[r.pref_code] = { name, keys: [normalizeSearchKey(name)] };
      continue;
    }
    const e = muni[r.area_code];
    if (!e) continue;
    if (e.ja !== r.name) throw new Error(`[search] 英語の名前と索引の名前が合わない：${r.area_code} ${r.name}`);
    const keys = [normalizeSearchKey(e.en)];
    if (e.short_en) keys.push(normalizeSearchKey(e.short_en));
    units[r.area_code] = { name: e.en, keys };
  }
  return { example: searchExample("en"), prefs, units };
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  const pages = extraPages();
  return (
    <>
      <MessagesProvider msgs={msgsFor(SEARCH_MSG_IDS)}>
        {LOCALE === "en" ? (
          <SearchEnglishProvider value={searchEnglish()}>
            {Object.keys(pages).length > 0 ? (
              <SearchExtraPagesProvider pages={pages} example={SEARCH_EXAMPLE}>{children}</SearchExtraPagesProvider>
            ) : (
              children
            )}
          </SearchEnglishProvider>
        ) : Object.keys(pages).length > 0 ? (
          <SearchExtraPagesProvider pages={pages} example={SEARCH_EXAMPLE}>{children}</SearchExtraPagesProvider>
        ) : (
          children
        )}
      </MessagesProvider>
      <SiteFooter />
    </>
  );
}
