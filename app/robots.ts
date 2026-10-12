import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// app/robots.ts — out/robots.txt を静的に生成する（launch-backlog.md D-2）。
// 公開サイトは全ページを検索エンジンに開く。sitemap の場所を示す。
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
