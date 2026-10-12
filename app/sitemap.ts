import type { MetadataRoute } from "next";
import { SITE_URL, publicPaths } from "@/lib/site";

// app/sitemap.ts — out/sitemap.xml を静的に生成する（launch-backlog.md D-2）。
// パス一覧は lib/site.ts の publicPaths が単一の源。更新日（lastModified）は、
// ページごとの確かな日付を持たないため付けない（推測の日付を書かない）。
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths().map((p) => ({ url: p === "/" ? SITE_URL : `${SITE_URL}${p}` }));
}
