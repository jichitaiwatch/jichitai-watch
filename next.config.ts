import type { NextConfig } from "next";

// 英語版のビルド（NEXT_PUBLIC_JICHITAI_LOCALE=en。lib/locale.ts）は /en の下に置く（frontend-architecture.md §5.8）。
const EN = process.env.NEXT_PUBLIC_JICHITAI_LOCALE === 'en';

const nextConfig: NextConfig = {
  output: 'export',
  ...(EN ? { basePath: '/en' } : {}),
  images: {
    unoptimized: true,
  },
  // 開発時のみ有効。スマホ実機をPCの開発サーバーにLAN経由（http://192.168.x.x:3000）で接続して確認するための許可。
  // 無いと開発用リソース（HMR）が遮断され、ハイドレーションされずグラフ等のクライアント描画が出ない（2026-10-03再現）。
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
};

export default nextConfig;
