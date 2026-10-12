import { SiteFooter } from "@/components/SiteFooter";

// app/gifu-pref/layout.tsx — 地域ページ・入口・4タブ・経年（/gifu-pref/**）共通のフッター。
// C-2 N-4：これらのページからトップ・検索・/about・/data・/corrections（訂正窓口・Gate 4）へ
// 到達できなかった導線欠落の解消。フッター本体は components/SiteFooter.tsx（文書ページ・検索と共通）。
// ルートセグメント直下のレイアウトであり、gifu-pref 固定リテラルへの結合を新たに深めない（D-17）。

export default function GifuPrefLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
