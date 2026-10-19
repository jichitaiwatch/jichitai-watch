import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { STAGING } from "@/lib/staging";

// app/robots.ts — out/robots.txt を静的に生成する（launch-backlog.md D-2）。
// 公開サイトは全ページを検索エンジンに開く。sitemap の場所を示す。
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  // 確認用の置き場所（lib/staging.ts）は検索エンジンに載せない
  if (STAGING) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
