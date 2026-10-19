// lib/site.ts
//
// 公開サイトの正規URL（canonical・sitemap.xml・robots.txt）の単一の源（launch-backlog.md D-2）。
//
// - ホスト：`https://jichitaiwatch.jp`（www 無し）。ドメインの正規表記（CLAUDE.md 冒頭・
//   docs/20260809_domain-registrar-decision.md）に合わせた。www の扱いはホスティング構築（D-6・D-8）で
//   この値へ寄せる。変える場合はここ1か所を直せば canonical・sitemap・robots がすべて追随する。
// - パス：末尾スラッシュ無し（例 `/gifu-pref/gifu-shi/machi`）。next.config に trailingSlash 指定が無く、
//   サイト内リンクは全ページでこの形に揃っている（2026-10-04 `out/` 全349ページで機械確認）。
//   frontend-architecture.md §5.0・§5.6 の `/{pref}/{gov}/` 表記はルート構造の書き方であって末尾スラッシュの指定ではない。
// - URL は凍結（frontend-architecture.md §5.1）。ここで作るパスは各ルートの generateStaticParams と同じ集合で、
//   ビルド後の `out/` と一致することを検査で確認する（一致しなければ D-2 の受入れ不可）。

import type { Metadata } from "next";
import { MUNICIPALITIES, WARDS } from "@/lib/municipalities";
import { PREFECTURES, REGION_DESCRIPTION } from "@/lib/prefectures";
import { STAGING } from "@/lib/staging";
import { ENTRANCE_TABS, entranceTabsFor, listTrendsCategories } from "@/lib/card-registry";

export const SITE_URL = "https://jichitaiwatch.jp";
export const SITE_NAME = "自治体Watch";

/** 各ページの metadata に渡す canonical（metadataBase＝SITE_URL からの相対パス）。 */
export function canonicalOf(path: string): Metadata["alternates"] {
  return { canonical: path };
}

/**
 * ページの title・description・canonical・共有用メタ（OGP／X）を1か所で組み立てる（D-1）。
 * Next.js の metadata は openGraph 等を「キー単位で丸ごと上書き」するため、ルートに置いても
 * 子ページの og:title は付かない。ページごとに本関数で必ず付ける。
 * 共有画像（og:image）：app/opengraph-image.png はファイル規約ではトップ（/）にしか付かない
 * （子ページが openGraph を設定すると上書きされる。2026-10-04 out/ で確認）。そのため全ページで明示的に付ける。
 * description は事実だけを書き、評価の言葉を使わない（20260808_decisions.md D-4/D-6）。
 */
/** 共有画像。実体は app/opengraph-image.png（scripts/gen_site_images.py が生成）で、/opengraph-image.png に書き出される。 */
const SHARE_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: `自治体Watch：${REGION_DESCRIPTION}`,
};

export function pageMeta({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: canonicalOf(path),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ja_JP",
      title,
      description,
      url: path,
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
    // 確認用の置き場所（lib/staging.ts）は検索エンジンに載せない（公開用ビルドでは項目ごと出さない）
    ...(STAGING ? { robots: { index: false, follow: false } } : {}),
  };
}

/** 4入口の各ページの説明文。載っているカード名をそのまま並べる（手書きしない＝カード増減に追随）。 */
export function tabDescription(name: string, tabLabel: string, cardTitles: string[]): string {
  // カードの無い区分（例：県庁の「くらし」）は画面も「この区分の情報は現在準備中です」と出す。それに合わせる。
  if (cardTitles.length === 0) return `${name}の「${tabLabel}」。この区分の情報は現在準備中です。`;
  return `${name}の「${tabLabel}」。${cardTitles.join("・")}を、出典つきで掲載しています。`;
}

/** 地域ページ（/{prefSlug}） */
export function regionPath(prefSlug: string): string {
  return `/${prefSlug}`;
}

/** 政府入口（/{prefSlug}/{govSlug}）。県庁・市区町村とも同じ形（§5.6.1） */
export function govPath(prefSlug: string, govSlug: string): string {
  return `/${prefSlug}/${govSlug}`;
}

/**
 * sitemap.xml に載せる全パス。404（not-found）は含めない。
 * 集合は各ルートの generateStaticParams と同じ：
 *   - 文書ページ：/ /about /data /corrections /search
 *   - 地域：PREFECTURES の prefSlug
 *   - 政府入口・4入口：市区町村 ∪ 県庁 × ENTRANCE_TABS
 *   - 経年：市区町村 × listTrendsCategories（県庁は経年なし）
 *   - 政令市の区（WARDS・試作ビルドだけに入る）：入口 ＋ entranceTabsFor の入口だけ（区の経年は作らない＝
 *     launch-backlog.md L-9）。公開用ビルドでは WARDS が空なので出力は変わらない。
 */
export function publicPaths(): string[] {
  const govs = [
    ...MUNICIPALITIES.map((m) => govPath(m.prefSlug, m.slug)),
    ...PREFECTURES.map((p) => govPath(p.prefSlug, p.govSlug)),
  ];
  const cats = listTrendsCategories();
  return [
    "/",
    "/about",
    "/data",
    "/corrections",
    "/search",
    ...PREFECTURES.map((p) => regionPath(p.prefSlug)),
    ...govs,
    ...govs.flatMap((g) => ENTRANCE_TABS.map(({ tab }) => `${g}/${tab}`)),
    ...MUNICIPALITIES.flatMap((m) =>
      cats.map((c) => `${govPath(m.prefSlug, m.slug)}/trends/${c.category}`),
    ),
    ...WARDS.flatMap((w) => [
      govPath(w.prefSlug, w.slug),
      ...entranceTabsFor(w).map(({ tab }) => `${govPath(w.prefSlug, w.slug)}/${tab}`),
    ]),
  ];
}
