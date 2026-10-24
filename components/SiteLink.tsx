// components/SiteLink.tsx
//
// サイト内リンクの共通部品。next/link をそのまま使い、先読み（prefetch）だけを止める。
// 理由：配信先（Cloudflare Workers の静的配信）に置けるファイル数の上限のため、ビルド後に
// 先読み用の補助ファイル（__next.*.txt）を out/ から消している（scripts/prune-out.mjs・
// 20260808_decisions.md D-26）。先読みを止めないと、消したファイルをブラウザが取りに行って 404 になる。
// ページ間の移動は、クリック時に移動先のデータ（ページ名.txt）を取得する従来どおりのクライアント遷移で動く。
// next/link を直接 import しない（eslint の no-restricted-imports で検出する）。この部品を使う。
import Link from "next/link";
import type { ComponentProps } from "react";

type SiteLinkProps = Omit<ComponentProps<typeof Link>, "prefetch">;

export default function SiteLink(props: SiteLinkProps) {
  return <Link {...props} prefetch={false} />;
}
