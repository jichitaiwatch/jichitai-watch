import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // 開発時のみ有効。スマホ実機をPCの開発サーバーにLAN経由（http://192.168.x.x:3000）で接続して確認するための許可。
  // 無いと開発用リソース（HMR）が遮断され、ハイドレーションされずグラフ等のクライアント描画が出ない（2026-10-03再現）。
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
};

export default nextConfig;
