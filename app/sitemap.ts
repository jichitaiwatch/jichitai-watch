import type { MetadataRoute } from "next";
import { SITE_URL, publicPaths } from "@/lib/site";
import { BILINGUAL, localePath } from "@/lib/locale";

// app/sitemap.ts — out/sitemap.xml を静的に生成する（launch-backlog.md D-2）。
// パス一覧は lib/site.ts の publicPaths が単一の源。更新日（lastModified）は、
// ページごとの確かな日付を持たないため付けない（推測の日付を書かない）。
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!BILINGUAL) return publicPaths().map((p) => ({ url: p === "/" ? SITE_URL : `${SITE_URL}${p}` }));
  // 日本語版と英語版をまとめて作ったとき（scripts/build-bilingual.mjs）：英語版のページも載せ、各ページに対の言語版を書く
  // （hreflang。ページの <link rel="alternate"> と同じ組。x-default は日本語版）。サイトの頭の sitemap.xml だけが使われる。
  const abs = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);
  return publicPaths().flatMap((p) => {
    const languages = { ja: abs(localePath(p, "ja")), en: abs(localePath(p, "en")), "x-default": abs(localePath(p, "ja")) };
    return [
      { url: abs(localePath(p, "ja")), alternates: { languages } },
      { url: abs(localePath(p, "en")), alternates: { languages } },
    ];
  });
}
