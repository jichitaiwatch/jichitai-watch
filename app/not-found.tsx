import type { Metadata } from "next";
import Link from "next/link";
import { DocSection, SitePageShell } from "@/components/SitePageShell";

// app/not-found.tsx — カスタム404（C-3・pre-launch-gates.md Gate 11「存在しないURL・旧URLで確認」）。
// 従来は Next.js 既定の英語404（リンク0件の行き止まり）だった。文書ページと同じ共通の器
// （ヘッダー・フッター）に載せ、トップと検索へ戻れるようにする。output:'export' では
// 本ファイルから out/404.html が生成され、ホスティング側が未知のURLに返す（ホスティング非依存）。
// 旧URLは公開前のため転送しない（G-1 で移設済み・リダイレクト不要と判断済み）。導線は検索とトップ。

export const metadata: Metadata = {
  title: "ページが見つかりません | 自治体Watch",
};

const NAVY = "#062657";
const TEAL_DARK = "#007b76";

export default function NotFound() {
  return (
    <SitePageShell title="ページが見つかりません">
      <DocSection>
        <p>
          お探しのページは見つかりませんでした。URLに誤りがあるか、ページが移動・削除された可能性があります。
        </p>
        <p>次のリンクから、目的のページをお探しください。</p>
        <ul className="mt-2 flex flex-col gap-3 sm:flex-row">
          <li>
            <Link
              href="/search"
              className="inline-block rounded-xl px-5 py-3 text-base font-bold text-white hover:opacity-90"
              style={{ background: NAVY }}
            >
              自治体を探す
            </Link>
          </li>
          <li>
            <Link
              href="/"
              className="inline-block rounded-xl border px-5 py-3 text-base font-bold hover:opacity-70"
              style={{ borderColor: TEAL_DARK, color: TEAL_DARK }}
            >
              トップページへ戻る
            </Link>
          </li>
        </ul>
      </DocSection>
    </SitePageShell>
  );
}
