// scripts/check_format_en.mjs
//
// 英語版の書き方（lib/format-en.ts）を確かめる（作業単位5）。
// 1. 運営者が決めた表の例（2026-10-22）どおりに出るか
// 2. data/ にある対象期間の文字列（period・year_label）が、すべて英語にできるか（形が決まっていない文字列があれば止まる）
// 使い方（作業リポジトリのルートで）：node scripts/check_format_en.mjs
// Node が TypeScript をそのまま読む機能を使う（Node 22.18 以降）。
import fs from "node:fs";
import path from "node:path";
import {
  enBillionAxis, enCount, enDate, enFiscalYear, enMoneyFromThousandYen, enPeriodLabel,
  enYen, enYenExactFromThousandYen, enYenFromManYen,
} from "../lib/format-en.ts";

const cases = [
  ["人数", enCount(397364), "397,364"],
  ["人数（負）", enCount(-3000), "−3,000"],
  ["金額 億", enMoneyFromThousandYen(66036013).text, "¥66.03 billion"],
  ["金額 億（県）", enMoneyFromThousandYen(316024610).text, "¥316.02 billion"],
  ["金額 million", enMoneyFromThousandYen(123456).text, "¥123.45 million"],
  ["金額 million 未満", enMoneyFromThousandYen(850).text, "¥850,000"],
  ["金額 trillion", enMoneyFromThousandYen(1234567890).text, "¥1.23 trillion"],
  ["金額 負", enMoneyFromThousandYen(-10447950).text, "−¥10.44 billion"],
  ["金額 数字と単位", JSON.stringify(enMoneyFromThousandYen(66036013)), JSON.stringify({ text: "¥66.03 billion", amount: "¥66.03", unit: "billion" })],
  ["千円の全桁", enYenExactFromThousandYen(66036013), "¥66,036,013,000"],
  ["円", enYen(6900), "¥6,900"],
  ["万円の小数", enYenFromManYen("426.9"), "¥4,269,000"],
  ["縦軸 billion", enBillionAxis(66036013), "66"],
  ["縦軸 billion 小数", enBillionAxis(16846219), "16.8"],
  ["年度", enFiscalYear("2023"), "FY2023"],
  ["年月日", enDate("2026-10-01"), "1 October 2026"],
  ["期間 年度", enPeriodLabel("令和7年度（2025）"), "FY2025"],
  ["期間 時点", enPeriodLabel("令和8年1月1日時点（住民基本台帳）"), "As of 1 January 2026 (Basic Resident Registration)"],
  ["期間 国勢調査", enPeriodLabel("令和7年(2025)国勢調査"), "2025 Population Census"],
  ["期間 第9期", enPeriodLabel("第9期（2024〜2026年度）"), "9th period (FY2024–FY2026)"],
];
let bad = 0;
for (const [name, got, want] of cases) {
  if (got !== want) { bad++; console.error(`× ${name}：${got}（期待：${want}）`); }
}

// data/ の対象期間の文字列をすべて英語にしてみる
const periods = new Set();
const walk = (x, k) => {
  if (Array.isArray(x)) x.forEach((v) => walk(v, k));
  else if (x && typeof x === "object") Object.entries(x).forEach(([kk, v]) => walk(v, kk));
  else if (typeof x === "string" && (k === "period" || k === "year_label")) periods.add(x);
};
for (const f of fs.readdirSync("data").filter((f) => f.endsWith(".json"))) {
  walk(JSON.parse(fs.readFileSync(path.join("data", f), "utf-8")));
}
for (const p of [...periods].sort()) {
  try { console.log(`  ${p} → ${enPeriodLabel(p)}`); } catch (e) { bad++; console.error(`× ${e.message}`); }
}
console.log(bad ? `[format-en] ${bad} 件の誤り` : `[format-en] 表の例 ${cases.length} 件・期間の文字列 ${periods.size} 種類、すべて期待どおり`);
process.exit(bad ? 1 : 0);
