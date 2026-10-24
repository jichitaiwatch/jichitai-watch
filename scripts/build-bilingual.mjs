// scripts/build-bilingual.mjs
//
// 日本語版と英語版を続けてビルドし、英語版を /en の下に入れた1つのサイトを out/ に作る（作業単位6・frontend-architecture.md §5.8）。
// - 両方のビルドに NEXT_PUBLIC_JICHITAI_BILINGUAL=1 を付ける。このときだけ、言語の切り替えリンクと hreflang（対の印）が出る。
// - 2026-10-24 運営者裁定（D-27・同日に改め）：英語版は岐阜だけの今から公開し、以後の公開は日英同時（ENGLISH_PUBLISHED=true）。
// - 英語版のビルドの out/ の中身を out/en/ に入れる。英語版は basePath が /en なので、ページ・JS・画像の場所はすべて /en から始まる。
//   英語版の robots.txt・sitemap.xml・_headers は /en の下では意味が無い（サイトの頭のものだけが読まれる）ので入れない。
//   英語のトップ（/en）は、日本語のページ（/about → about.html）と同じ形で開けるよう、en.html も置く。
// - 試作の県を含めるとき（JICHITAI_TRIAL_PREFS など）は、その環境変数がそのまま両方のビルドに渡る。
// - 最後に scripts/check-english-out.mjs で英語版に訳し漏れの日本語が残っていないかを確かめ、残っていれば失敗で終わる（作業単位9）。
// - 各言語のビルドは `next build` を直接呼び、すぐ scripts/prune-out.mjs で補助ファイルを消す（npm run build は呼ばない：
//   英語版を公開にしたとき npm run build がこのスクリプトを呼ぶため。prune-out は2回目・まとめた後の out/ では止まる作り）。
// - 本番のビルド（npm run build＝scripts/build-site.mjs）は、lib/publish-languages.ts の ENGLISH_PUBLISHED が true のときこのスクリプトを呼ぶ。
// 使い方（リポジトリのルートで）：node scripts/build-bilingual.mjs
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const OUT = "out";
const TMP = ".bilingual-tmp";

function build(locale) {
  const env = { ...process.env, NEXT_PUBLIC_JICHITAI_BILINGUAL: "1" };
  if (locale === "en") env.NEXT_PUBLIC_JICHITAI_LOCALE = "en";
  else delete env.NEXT_PUBLIC_JICHITAI_LOCALE;
  console.log(`[build-bilingual] ${locale === "en" ? "英語版" : "日本語版"}をビルドします`);
  // .next の中身は言語ごとに違うので、毎回消してから作る
  rmSync(".next", { recursive: true, force: true });
  // 前回の出力の残りを消してから作る（out/ に古いページが残ると、配信するファイルが不必要に増える）
  rmSync(OUT, { recursive: true, force: true });
  const r = spawnSync("npx", ["next", "build"], { stdio: "inherit", env, shell: true });
  if (r.status !== 0) {
    console.error(`[build-bilingual] 失敗：${locale} のビルドが止まった`);
    process.exit(1);
  }
  const pr = spawnSync("node", [join("scripts", "prune-out.mjs")], { stdio: "inherit" });
  if (pr.status !== 0) {
    console.error(`[build-bilingual] 失敗：${locale} のビルド後の補助ファイルの削除が止まった`);
    process.exit(1);
  }
}

rmSync(TMP, { recursive: true, force: true });

build("en");
renameSync(OUT, TMP);

build("ja");

const EN = join(OUT, "en");
if (existsSync(EN)) {
  console.error(`[build-bilingual] 失敗：日本語版の出力に en という名前がすでにある（${EN}）`);
  process.exit(1);
}
renameSync(TMP, EN);
for (const f of ["robots.txt", "sitemap.xml", "_headers"]) rmSync(join(EN, f), { force: true });
cpSync(join(EN, "index.html"), join(OUT, "en.html"));
// 英語版の訳し漏れを機械で確かめる
const check = spawnSync("node", [join("scripts", "check-english-out.mjs"), EN], { stdio: "inherit" });
if (check.status !== 0) {
  console.error("[build-bilingual] 失敗：英語版に訳し漏れの日本語が残っている（上の一覧）");
  process.exit(1);
}
console.log(`[build-bilingual] できました：${OUT}/（日本語）と ${EN}/（英語）`);
