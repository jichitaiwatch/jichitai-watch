// scripts/prune-out.mjs
//
// ビルド後（next build の直後。scripts/build-site.mjs＝npm run build と scripts/build-bilingual.mjs が呼ぶ。2026-10-24 までは package.json の postbuild）に out/ から、ブラウザが使わない・
// 使わせない補助ファイル（__next.*.txt）を消す。20260808_decisions.md D-26。
// 目的：配信先（Cloudflare Workers の静的配信）に置けるファイル数の上限（無料2万・有料10万）に収める。
//   - __next._full.txt        ：ページ本体（ページ名.txt）と中身が同じ複製。ブラウザは取りに行かない。
//   - __next._tree.txt        ：先読み用（移動先ページの骨組み）。
//   - __next.…__PAGE__.txt    ：先読み用（移動先ページ固有の中身）。
//   - __next.<区間名>.txt     ：先読み用（区間ごとの中身）。出るビルドと出ないビルドがある。
// 先読みは components/SiteLink.tsx（prefetch={false}）で止めてあるので、消しても 404 は出ない。
// 残すもの：ページ名.html（最初に開いたとき）と ページ名.txt（サイト内リンクの移動で取得するデータ）。
// Next.js の版を上げて出力の形が変わったら、このスクリプトが止める（想定外の名前・件数・欠けを検出）。
// 使い方（リポジトリのルートで）：node scripts/prune-out.mjs
//   --dry-run  消さずに検査だけする（件数を表示）
import { existsSync, readdirSync, rmdirSync, rmSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
const DRY = process.argv.includes("--dry-run");

// 消してよい名前（これ以外の __next.* は想定外として止める）
const KINDS = [
  ["tree", /^__next\._tree\.txt$/],
  ["full", /^__next\._full\.txt$/],
  ["page", /^__next\.(.+\.)?__PAGE__\.txt$/], // トップページは __next.__PAGE__.txt（途中の区切りなし）
  ["segment", /^__next\.[^/]+\.txt$/], // 先読み用（区間ごとの中身。例：__next.search.txt。試作の県を含むビルドで /search に出る）
];

function fail(msg) {
  console.error(`[prune-out] 失敗：${msg}`);
  process.exit(1);
}

if (!existsSync(OUT) || !statSync(OUT).isDirectory()) fail("out/ がありません（先に npm run build）");

const files = []; // out/ からの相対パス（/ 区切り）
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(relative(OUT, p).split(sep).join("/"));
  }
})(OUT);

const fileSet = new Set(files);
const targets = [];
const unexpected = [];
const counts = { tree: 0, full: 0, page: 0, segment: 0 };
for (const f of files) {
  if (f.startsWith("_next/")) continue; // 共通の JS・CSS・フォントには触れない
  const name = f.split("/").pop();
  if (!name.startsWith("__next.")) continue;
  const kind = KINDS.find(([, re]) => re.test(name));
  if (!kind) {
    unexpected.push(f);
    continue;
  }
  counts[kind[0]]++;
  targets.push(f);
}

if (unexpected.length > 0) {
  fail(`想定外の __next.* ファイルがあります（Next.js の版で出力の形が変わった可能性）。例：${unexpected.slice(0, 3).join(", ")}（計${unexpected.length}件）`);
}
if (counts.tree === 0 || counts.full === 0 || counts.page === 0) {
  fail(`消す対象が想定どおり見つかりません（tree=${counts.tree}, full=${counts.full}, page=${counts.page}, segment=${counts.segment}）。Next.js の出力の形が変わった可能性。消さずに止めます`);
}

// 残すものの検査：全ページ（.html）に、同名の .txt（移動で取得するデータ）が必要。
// 例外：404・_not-found・開発用の特殊ページは移動の対象ではない。
const NO_TXT_OK = new Set(["404.html", "_not-found.html"]);
const missing = [];
let htmlCount = 0;
for (const f of files) {
  if (!f.endsWith(".html") || f.startsWith("_next/")) continue;
  htmlCount++;
  if (NO_TXT_OK.has(f)) continue;
  const base = f === "index.html" ? "index.txt" : f.replace(/\.html$/, ".txt");
  if (!fileSet.has(base)) missing.push(f);
}
if (missing.length > 0) {
  fail(`ページ名.txt が無い .html があります（移動で必要）。例：${missing.slice(0, 3).join(", ")}（計${missing.length}件）`);
}

if (DRY) {
  console.log(`[prune-out] --dry-run：消す予定 ${targets.length} 件（tree=${counts.tree}, full=${counts.full}, page=${counts.page}, segment=${counts.segment}）／残る ${files.length - targets.length} 件／.html ${htmlCount} 件`);
  process.exit(0);
}

for (const f of targets) rmSync(join(OUT, ...f.split("/")));
// 空になったフォルダを消す（深いほうから）
(function prune(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) prune(join(dir, e.name));
  }
  if (dir !== OUT && readdirSync(dir).length === 0) rmdirSync(dir);
})(OUT);

console.log(`[prune-out] 消した ${targets.length} 件（tree=${counts.tree}, full=${counts.full}, page=${counts.page}, segment=${counts.segment}）／残り ${files.length - targets.length} 件／.html ${htmlCount} 件`);
