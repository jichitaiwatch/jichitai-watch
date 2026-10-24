// lib/format-en.ts
//
// 英語版の画面で使う、数字・金額・日付・期間の書き方（作業単位5。2026-10-22 運営者裁定の表に従う）。
// 日本語版の書き方（lib/format-yen.ts・lib/format-count.ts・lib/staleness.ts）は変えない。英語版のときだけこちらを使う。
// - 綴り・書き方は英国式（GOV.UK の表記ガイド：お金の million・billion は略さない。£0.xx million の形は使わない）。
// - 金額は「数字」と「単位の語」を分けて返す（amount・unit）。画面は2つを1つの塊にして折り返さず、単位の語を小さい字にする
//   （英語は語が長いので、カードからはみ出したり変な位置で改行したりしないようにするため。運営者指示 2026-10-22）。
// - 切り捨ての考え方は日本語版と同じ（表示の桁より下は切り捨て。正確な値は読み上げ用の表に全桁で出す）。
// - このファイルは他のファイルを import しない（scripts/check_format_en.mjs が Node で直接読み込んで確かめるため）。

const MINUS = "−"; // 日本語版と同じ U+2212

/** 金額の表示。text は1行で出すときの全体、amount と unit は分けて出すとき用（unit が空なら単位の語なし）。 */
export interface EnMoney {
  text: string;
  amount: string;
  unit: string;
}

function group(n: number): string {
  return n.toLocaleString("en-GB");
}

function sign(neg: boolean): string {
  return neg ? MINUS : "";
}

/** 小数2桁に切り捨てて、2桁で書く（例 66.0360 → "66.03"） */
function twoDecimalsDown(x: number): string {
  const v = Math.floor(Math.round(x * 1e6) / 1e4) / 100; // 浮動小数の誤差を丸めてから切り捨てる
  return v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * 千円単位の値を、英語の金額にする（日本語版 formatManOku の英語版）。
 * - ¥1 million 未満：円の全桁（例 ¥850,000）
 * - ¥1 million 以上 ¥1 billion 未満：million の小数2桁（例 ¥123.45 million。細かさは日本語版の万円と同じ）
 * - ¥1 billion 以上 ¥1 trillion 未満：billion の小数2桁（例 ¥66.03 billion）
 * - ¥1 trillion 以上：trillion の小数2桁（例 ¥1.23 trillion）
 */
export function enMoneyFromThousandYen(valueThousandYen: number): EnMoney {
  if (!Number.isFinite(valueThousandYen)) throw new Error(`[format-en] 金額が数ではない：${valueThousandYen}`);
  const neg = valueThousandYen < 0;
  const yen = Math.abs(valueThousandYen) * 1000;
  let amount: string;
  let unit: string;
  if (yen < 1e6) {
    amount = `¥${group(yen)}`;
    unit = "";
  } else if (yen < 1e9) {
    amount = `¥${twoDecimalsDown(yen / 1e6)}`;
    unit = "million";
  } else if (yen < 1e12) {
    amount = `¥${twoDecimalsDown(yen / 1e9)}`;
    unit = "billion";
  } else {
    amount = `¥${twoDecimalsDown(yen / 1e12)}`;
    unit = "trillion";
  }
  amount = `${sign(neg)}${amount}`;
  return { text: unit ? `${amount} ${unit}` : amount, amount, unit };
}

/** 千円単位の値を、円の全桁で書く（日本語版 formatThousandYenExact「66,036,013千円」の英語版 → ¥66,036,013,000） */
export function enYenExactFromThousandYen(valueThousandYen: number): string {
  if (!Number.isFinite(valueThousandYen)) throw new Error(`[format-en] 金額が数ではない：${valueThousandYen}`);
  return `${sign(valueThousandYen < 0)}¥${group(Math.abs(valueThousandYen) * 1000)}`;
}

/** 円の値（例 6,900円 → ¥6,900） */
export function enYen(valueYen: number): string {
  if (!Number.isFinite(valueYen)) throw new Error(`[format-en] 金額が数ではない：${valueYen}`);
  return `${sign(valueYen < 0)}¥${group(Math.abs(valueYen))}`;
}

/** 万円の小数（日本語版で四捨五入済みの文字列。例 "426.9" 万円 → ¥4,269,000） */
export function enYenFromManYen(roundedManYen: string): string {
  const v = Number(roundedManYen);
  if (!Number.isFinite(v)) throw new Error(`[format-en] 万円の値が数ではない：${roundedManYen}`);
  return enYen(Math.round(v * 10000));
}

/** 人数・件数（日本語版 formatManUnit「39万7,364」の英語版 → 397,364） */
export function enCount(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`[format-en] 数ではない：${value}`);
  return `${sign(value < 0)}${group(Math.abs(value))}`;
}

/** 財政規模グラフの縦軸（千円 → ¥ billion の数。日本語版は億円の整数） */
export function enBillionAxis(valueThousandYen: number): string {
  return (valueThousandYen / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 1 });
}

/** グラフ・表の年度（"2023" → "FY2023"） */
export function enFiscalYear(fyLabel: string): string {
  if (!/^\d{4}$/.test(fyLabel)) throw new Error(`[format-en] 年度の形ではない：${fyLabel}`);
  return `FY${fyLabel}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dmy(year: number, month: number, day: number): string {
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error(`[format-en] 日付の値が範囲外：${year}-${month}-${day}`);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** 年月日（"2026-10-01" → "1 October 2026"。英国式の日・月・年） */
export function enDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`[format-en] 日付の形ではない：${iso}`);
  return dmy(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** 令和の年 → 西暦（令和1年＝2019年） */
function reiwa(n: string): number {
  return 2018 + Number(n);
}

/** 令和と西暦の両方が書いてあるとき、食い違いがあれば止める（データの誤りを英語にして隠さない） */
function sameYear(r: string, y: string, raw: string): number {
  if (reiwa(r) !== Number(y)) throw new Error(`[format-en] 令和${r}年と${y}年が食い違う：${raw}`);
  return Number(y);
}

const SOURCE_NOTE_EN: Readonly<Record<string, string>> = {
  住民基本台帳: "Basic Resident Registration",
  各年度10月頃公表の決算統計: "final accounts statistics published around October each year",
  納税義務者1人当たり課税対象所得: "taxable income per taxpayer",
};

function note(raw: string, ja: string): string {
  const en = SOURCE_NOTE_EN[ja];
  if (!en) throw new Error(`[format-en] 期間の注記の英語が無い：（${ja}）${raw}`);
  return en;
}

/**
 * データに入っている対象期間の文字列を英語にする（例 "令和7年度（2025）" → "FY2025"）。
 * 決めた形に当てはまらない文字列は止める（訳し漏れを画面に出さない）。形を足すときはここと検査スクリプトの両方に足す。
 */
export function enPeriodLabel(raw: string): string {
  let m: RegExpExecArray | null;
  // 令和7年度（2025）
  if ((m = /^令和(\d+)年度（(\d{4})）$/.exec(raw))) return `FY${sameYear(m[1], m[2], raw)}`;
  // 令和6年度
  if ((m = /^令和(\d+)年度$/.exec(raw))) return `FY${reiwa(m[1])}`;
  // 令和7年(2025)国勢調査
  if ((m = /^令和(\d+)年\((\d{4})\)国勢調査$/.exec(raw))) return `${sameYear(m[1], m[2], raw)} Population Census`;
  // 令和6年(2024)
  if ((m = /^令和(\d+)年\((\d{4})\)$/.exec(raw))) return `${sameYear(m[1], m[2], raw)}`;
  // 令和8年1月1日／令和7年4月1日時点／令和7年4月1日現在／令和8年1月1日時点（住民基本台帳）
  if ((m = /^令和(\d+)年(\d+)月(\d+)日(時点|現在)?(?:（(.+)）)?$/.exec(raw))) {
    const date = dmy(reiwa(m[1]), Number(m[2]), Number(m[3]));
    const body = m[4] ? `As of ${date}` : date;
    return m[5] ? `${body} (${note(raw, m[5])})` : body;
  }
  // 令和2年1月1日〜令和8年1月1日、各年1月1日時点（住民基本台帳）
  if ((m = /^令和(\d+)年(\d+)月(\d+)日〜令和(\d+)年(\d+)月(\d+)日、各年(\d+)月(\d+)日時点（(.+)）$/.exec(raw))) {
    const from = dmy(reiwa(m[1]), Number(m[2]), Number(m[3]));
    const to = dmy(reiwa(m[4]), Number(m[5]), Number(m[6]));
    return `${from} to ${to}, as of ${Number(m[8])} ${MONTHS[Number(m[7]) - 1]} each year (${note(raw, m[9])})`;
  }
  // FY2015〜FY2024／FY2015〜FY2024（各年度10月頃公表の決算統計）
  if ((m = /^FY(\d{4})〜FY(\d{4})(?:（(.+)）)?$/.exec(raw))) {
    const span = `FY${m[1]}–FY${m[2]}`;
    return m[3] ? `${span} (${note(raw, m[3])})` : span;
  }
  // 第9期（2024〜2026年度）
  if ((m = /^第(\d+)期（(\d{4})〜(\d{4})年度）$/.exec(raw))) {
    const n = Number(m[1]);
    const ord = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
    return `${n}${ord} period (FY${m[2]}–FY${m[3]})`;
  }
  // 2024年度（令和6年度、FY April 2024 - March 2025）／…決算
  if ((m = /^(\d{4})年度（令和(\d+)年度、FY April (\d{4}) - March (\d{4})）(決算)?$/.exec(raw))) {
    const y = sameYear(m[2], m[1], raw);
    if (Number(m[3]) !== y || Number(m[4]) !== y + 1) throw new Error(`[format-en] 年度の範囲が食い違う：${raw}`);
    return `FY${y}${m[5] ? " final accounts" : ""} (April ${y} to March ${y + 1})`;
  }
  // 2024年度（納税義務者1人当たり課税対象所得）
  if ((m = /^(\d{4})年度（(.+)）$/.exec(raw))) return `FY${m[1]} (${note(raw, m[2])})`;
  throw new Error(`[format-en] 英語にする形が決まっていない期間の文字列：${raw}（lib/format-en.ts の enPeriodLabel に足す）`);
}
