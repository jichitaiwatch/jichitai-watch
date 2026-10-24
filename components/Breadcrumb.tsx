import Link from "@/components/SiteLink";
import { t } from "@/lib/i18n";

// components/Breadcrumb.tsx
// パンくず（ui-vi-handoff §2.5「各段はリンク・任意階層へジャンプ」／§0.8.4「入口名・カテゴリ名の段を増やす」）。
// 最後の段（現在地）はリンクにせず aria-current="page"。区切りは既存の経年画面の表記に合わせ「＞」。
// 色は --muted（A-4・WCAG AA対応済み）。識別の色であり評価色ではない（D-4/D-6）。
// サーバーコンポーネント（"use client" を持たない。output:'export' 整合）。

export interface BreadcrumbItem {
  label: string;
  /** 省略時は現在地（リンクにしない） */
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label={t("ui-aria-breadcrumb")} className="fs-crumb" style={{ color: "var(--muted)" }}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${i}-${item.label}`} className="flex items-center gap-x-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="inline-flex min-h-6 min-w-6 items-center justify-center px-0.5 underline decoration-dotted underline-offset-2 hover:opacity-70">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
              )}
              {!isLast && <span aria-hidden="true">{t("ui-crumb-sep")}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
