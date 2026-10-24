"use client";

import { usePathname } from "next/navigation";
import { LOCALE, localePath, type Locale } from "@/lib/locale";

// components/LanguageLink.tsx — 言語の切り替えリンク（作業単位6・2026-10-23 運営者裁定）。
// 日本語版のページには「English（英語）」、英語版のページには「日本語 (Japanese)」を、ページの右上に文字のリンクで出す（旗は使わない）。
// 切り替え先の言語で書いた名前を先に置く（リンクを探すのは今のページの言語を読めない人のため）。その部分には lang を付け、読み上げソフトが正しい言語で読むようにする。
// - 出すのは日本語版と英語版を1つのサイトにまとめて作ったときだけ（lib/locale.ts の BILINGUAL。呼び出し側で判定）。公開用ビルドの出力は変えない。
// - 行き先は、今のページと同じページの別の言語版（日本語 "/about" ⇔ 英語 "/en/about"）。英語版は basePath の外へ出るため next/link ではなく <a> を使う。
// - 見た目は style で付ける（Tailwind の新しいクラスを足すと、日本語版の CSS ファイルまで変わるため）。
// - 404 のページには出さない（対になるページが決まらないため）。404.html を作るときの path は "/_not-found" なので
//   HTML には出ない。ブラウザで開いたときは path が実際のURLになるため、ページの題名が404の題名と同じかで見分ける
//   （HTML と食い違わないように。題名はサーバー側で辞書から引いて渡す）。

const OTHER: Locale = LOCALE === "ja" ? "en" : "ja";

const BAR: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  pointerEvents: "none",
};
const INNER: React.CSSProperties = {
  maxWidth: "72rem",
  margin: "0 auto",
  padding: "2px 20px 0",
  display: "flex",
  justifyContent: "flex-end",
};
const LINK: React.CSSProperties = {
  pointerEvents: "auto",
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: 700,
  color: "#062657",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};

export function LanguageLink({
  native,
  paren,
  label,
  notFoundTitle,
}: {
  native: string;
  paren: string;
  label: string;
  notFoundTitle: string;
}) {
  const pathname = usePathname();
  if (!pathname || pathname.startsWith("/_not-found")) return null;
  if (typeof document !== "undefined" && document.title === notFoundTitle) return null;
  return (
    <nav aria-label={label} style={BAR}>
      <div style={INNER}>
        <a href={localePath(pathname, OTHER)} hrefLang={OTHER} style={LINK}>
          <span lang={OTHER}>{native}</span>
          {paren}
        </a>
      </div>
    </nav>
  );
}
