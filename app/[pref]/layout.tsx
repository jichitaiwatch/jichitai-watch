import { SiteFooter } from "@/components/SiteFooter";

// app/[pref]/layout.tsx — 地域ページ・入口・4タブ・経年（/{pref}/**）共通のフッター。
// C-2 N-4：これらのページからトップ・検索・/about・/data・/corrections（訂正窓口・Gate 4）へ
// 到達できなかった導線欠落の解消。フッター本体は components/SiteFooter.tsx（文書ページ・検索と共通）。
// 県は動的セグメント [pref]（pre-launch-blockers #2・2026-10-17 D-24 の共通化。県の一覧は lib/prefectures.ts）。

export default function PrefLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
