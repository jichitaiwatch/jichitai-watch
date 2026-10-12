import { CF_BEACON_SRC, CF_BEACON_TOKEN, analyticsEnabled } from "@/lib/analytics";

/**
 * アクセス解析タグ（Cloudflare Web Analytics・launch-backlog.md D-3）。設定は lib/analytics.ts。
 * Cloudflare 管理画面が示す埋め込み形（<script type="module" src=… data-cf-beacon=…>・2026-10-04 確認）をそのまま静的HTMLに書き出す。
 * next/script は使わない：後から差し込む方式になり、公式の埋め込み形から外れるため。
 */
export function WebAnalytics() {
  if (!analyticsEnabled()) return null;
  return (
    // type="module" のスクリプトは HTML の仕様上つねに遅延実行され、表示を止めない。
    // lint 規則は async/defer 属性の有無しか見ないため誤検出となる（2026-10-04 確認）。
    // eslint-disable-next-line @next/next/no-sync-scripts
    <script
      type="module"
      src={CF_BEACON_SRC}
      data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })}
    />
  );
}
