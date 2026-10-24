// scripts/build-site.mjs — 本番のビルド（npm run build。Cloudflare も公開用リポジトリでこれを呼ぶ）。
//
// lib/publish-languages.ts の ENGLISH_PUBLISHED で、作るものを切り替える（2026-10-24 運営者裁定 D-27・同日に改め：英語版は岐阜だけの今から
// 公開し、以後の公開は日英同時）。
// - false：日本語版だけ。`next build` の後に scripts/prune-out.mjs（以前の package.json の build＋postbuild と同じ中身）。
// - true ：日本語版と英語版をまとめて作る（scripts/build-bilingual.mjs。英語版の訳し漏れの確認まで含む）。
// 使い方（リポジトリのルートで）：npm run build
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join("lib", "publish-languages.ts"), "utf-8");
const m = src.match(/^export const ENGLISH_PUBLISHED\s*=\s*(true|false)\s*;/m); // 行頭の宣言だけ（説明文の中の同じ形は読まない）
if (!m) {
  console.error("[build-site] 失敗：lib/publish-languages.ts に ENGLISH_PUBLISHED（true か false）が見つからない");
  process.exit(1);
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
if (m[1] === "true") {
  console.log("[build-site] 英語版を公開中（ENGLISH_PUBLISHED=true）：日本語版と英語版をまとめて作ります");
  run("node", [join("scripts", "build-bilingual.mjs")]);
} else {
  run("npx", ["next", "build"]);
  run("node", [join("scripts", "prune-out.mjs")]);
}
