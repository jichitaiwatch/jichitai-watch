// scripts/check-english-out.mjs — 英語版の出力に、訳し漏れの日本語が残っていないかを機械で確かめる（英語版・作業単位9。2026-10-24）。
//
// 使い方（作業リポジトリのルートで。英語版をビルドした後）:
//   node scripts/check-english-out.mjs out/en      // npm run build:bilingual（または英語版を公開にしたときの npm run build）の後
//   node scripts/check-english-out.mjs out         // NEXT_PUBLIC_JICHITAI_LOCALE=en だけでビルドしたとき
// Python を使わない（本番のビルド環境＝Cloudflare でも走らせるため）。
//
// 確かめること（静的な HTML だけ。ブラウザで描く検索結果などは対象外）:
//   1. すべてのページが <html lang="en">。
//   2. 画面の文字のうち、日本語の印（lang="ja"）の外にある日本語は、次のどれかでなければ「訳し漏れ」として止める。
//      - データにある名前（首長・正副議長の氏名、会派名、介護保険の保険者名、森林環境譲与税の事業名）
//        ＝訳さないと決めたもの（2026-10-23・24 運営者裁定）。県・市区町村の名前は英語にすると決めたので含めない
//      - 辞書（i18n/glossary.json）の英語や、データの語・注記の英訳（i18n/data-text-en.json）に、決めて残した日本語
//        （許諾文の「自治体Watch」・訂正フォームの項目名・注記の中の人名など）
//   3. 読み上げ用の属性（aria-label・alt・title・placeholder）と meta の content に日本語があれば、同じ基準で止める。
//   名前が lang="ja" の外に出ている箇所（出典名の中の保険者名など、文字列の欄）は、止めずに件数を出す。
// 訳し漏れがあれば終了コード1で終わる。
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DATA = "data";
const CJK = /[぀-ヿ㐀-鿿豈-﫿々〆〇ー]+/g;
const WS = /[\s　]+/g;

const load = (p) => JSON.parse(readFileSync(p, "utf-8"));
const list = (dir, re) => readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => join(dir, f));

/** JSON の中の文字列を集める（keys を渡したときは、その名前の欄の値だけ） */
function strings(o, keys, out = [], key = null) {
  if (Array.isArray(o)) for (const v of o) strings(v, keys, out, key);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) strings(v, keys, out, k);
  else if (typeof o === "string" && (!keys || keys.has(key))) out.push(o);
  return out;
}

/** 訳さない日本語の出どころ（種類 → 空白を除いて連結した文字列） */
function allowedSources() {
  const src = {};
  const add = (k, arr) => (src[k] ??= []).push(...arr);
  const nameKeys = new Set(["氏名", "議長氏名", "副議長氏名"]);
  for (const f of [...list(DATA, /^m2_1_chief.*\.json$/), join(DATA, "pref_governor.json")]) add("人名", strings(load(f), nameKeys));
  for (const f of [join(DATA, "gikai_assembly.json"), join(DATA, "pref_assembly.json"), ...list(DATA, /^gikai_council_.*\.json$/)]) {
    const d = load(f);
    add("人名", strings(d, nameKeys));
    add("会派名", strings(d, new Set(["会派名", "会派一覧_grok", "参考メモ"])));
  }
  for (const f of list(DATA, /^municipality_master.*\.json$/)) add("保険者名", strings(load(f), new Set(["kaigo_insurer_name"])));
  for (const f of list(DATA, /^m2_kaigo_premium.*\.json$/)) add("保険者名", strings(load(f), new Set(["保険者名", "insurer_name"])));
  for (const f of list(DATA, /^forest_tax.*\.json$/)) add("事業名", strings(load(f), new Set(["name"])));
  // 決めて残した日本語：辞書の英語と、データの語・注記の英訳に入っているもの
  add("辞書の英語", load(join("i18n", "glossary.json")).terms.map((t) => t.en));
  for (const table of Object.values(load(join("i18n", "data-text-en.json")))) {
    if (!table || typeof table !== "object") continue;
    for (const [ja, en] of Object.entries(table)) add("データの語の英訳", [en === null ? ja : en]);
  }
  return Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v.map((s) => s.replace(WS, "")).join("\n")]));
}

function kindOf(run, sources) {
  for (const [k, s] of Object.entries(sources)) if (s.includes(run)) return k;
  return null;
}

const unescape = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const TAG_SCRIPT = /<script\b[\s\S]*?<\/script>/g;
const TAG_STYLE = /<style\b[\s\S]*?<\/style>/g;
const LANG_JA = /<(\w+)[^>]*\blang="ja"[^>]*>[\s\S]*?<\/\1>/g;
const ATTR = /\b(aria-label|alt|title|placeholder|content)="([^"]*)"/g;
const TEXT = />([^<>]+)</g;

function htmlFiles(dir, root = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (relative(root, p).split(sep)[0] !== "_next") htmlFiles(p, root, out);
    } else if (e.name.endsWith(".html")) out.push(p);
  }
  return out.sort();
}

const outDir = process.argv[2];
if (!outDir) {
  console.error("使い方：node scripts/check-english-out.mjs <英語版の出力のフォルダ>");
  process.exit(2);
}
const pages = htmlFiles(outDir);
if (pages.length === 0) {
  console.error(`[check-en] HTML が無い：${outDir}`);
  process.exit(2);
}
const sources = allowedSources();
const errors = [];
const namesOutside = {};
const notEn = [];
for (const p of pages) {
  const rel = relative(outDir, p).split(sep).join("/");
  const raw = readFileSync(p, "utf-8");
  const m = raw.match(/<html[^>]*\blang="([^"]+)"/);
  if (!m || m[1] !== "en") notEn.push(rel);
  let body = raw.replace(TAG_SCRIPT, "").replace(TAG_STYLE, "");
  // 日本語の印の中は対象外（外側から順に消す）
  for (let prev = null; prev !== body; ) {
    prev = body;
    body = body.replace(LANG_JA, "");
  }
  const chunks = [
    ...[...body.matchAll(TEXT)].map((x) => ["文字", x[1]]),
    ...[...body.matchAll(ATTR)].map((x) => [`属性 ${x[1]}`, x[2]]),
  ];
  for (const [where, chunk] of chunks) {
    const text = unescape(chunk);
    for (const run of text.match(CJK) ?? []) {
      const k = kindOf(run.replace(WS, ""), sources);
      if (k === null) errors.push(`${rel}｜${where}｜${run}｜${text.trim().slice(0, 80)}`);
      else if (k !== "辞書の英語" && k !== "データの語の英訳") namesOutside[k] = (namesOutside[k] ?? 0) + 1;
    }
  }
}
console.log(`[check-en] ページ ${pages.length}`);
if (notEn.length) console.log(`[check-en] lang が en でないページ ${notEn.length}：${notEn.slice(0, 5).join(", ")}`);
const outside = Object.entries(namesOutside).sort((a, b) => b[1] - a[1]);
if (outside.length) console.log(`[check-en] 日本語の印の外に出ている名前（訳さないと決めたもの。止めない）：${outside.map(([k, v]) => `${k} ${v}`).join("・")}`);
if (errors.length) {
  console.log(`[check-en] 訳し漏れの日本語 ${errors.length} 件：`);
  for (const e of errors.slice(0, 50)) console.log(`  ${e}`);
  if (errors.length > 50) console.log(`  ……ほか ${errors.length - 50} 件`);
}
const ok = errors.length === 0 && notEn.length === 0;
console.log(`[check-en] 結果：${ok ? "問題なし" : "問題あり"}`);
process.exit(ok ? 0 : 1);
