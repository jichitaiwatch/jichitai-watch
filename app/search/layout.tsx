import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
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

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
