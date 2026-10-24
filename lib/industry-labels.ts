// lib/industry-labels.ts
//
// 産業の分類名（国勢調査の大分類。データ由来の語）を画面に出すときの名前。
// 用語辞書 i18n/glossary.json の方針どおり、データは日本語のまま持ち、画面に出すときに辞書から訳を引く。
// - 日本語版はデータの値をそのまま返す（表示を変えない）。
// - 英語版（未実装）は辞書の jsic-* の en を返す。辞書に無い分類名はビルドを止める（訳し漏れを残さない）。
import { t } from "@/lib/i18n";
import { LOCALE, type Locale } from "@/lib/locale";

/** 国勢調査の大分類名 → 辞書の id。キーはデータの表記（全角の読点「，」） */
const INDUSTRY_IDS: Readonly<Record<string, string>> = {
  "農業，林業": "jsic-a",
  漁業: "jsic-b",
  "鉱業，採石業，砂利採取業": "jsic-c",
  建設業: "jsic-d",
  製造業: "jsic-e",
  "電気・ガス・熱供給・水道業": "jsic-f",
  情報通信業: "jsic-g",
  "運輸業，郵便業": "jsic-h",
  "卸売業，小売業": "jsic-i",
  "金融業，保険業": "jsic-j",
  "不動産業，物品賃貸業": "jsic-k",
  "学術研究，専門・技術サービス業": "jsic-l",
  "宿泊業，飲食サービス業": "jsic-m",
  "生活関連サービス業，娯楽業": "jsic-n",
  "教育，学習支援業": "jsic-o",
  "医療，福祉": "jsic-p",
  複合サービス事業: "jsic-q",
  "サービス業（他に分類されないもの）": "jsic-r",
  "公務（他に分類されるものを除く）": "jsic-s",
  分類不能の産業: "jsic-t",
};

/** 産業の分類名を、その言語で画面に出す形にする。 */
export function industryLabel(name: string, locale: Locale = LOCALE): string {
  if (locale === "ja") return name;
  const id = INDUSTRY_IDS[name];
  if (!id) throw new Error(`[i18n] 用語辞書に無い産業の分類名：${name}（lib/industry-labels.ts）`);
  return t(id, locale);
}
