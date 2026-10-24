// lib/finance-labels.ts
//
// 財政概況カードの歳入の款・歳出の目的の名前（決算統計の費目名。データ由来の語）を画面に出すときの名前（作業単位6の3段目）。
// 用語辞書 i18n/glossary.json の方針どおり、データは日本語のまま持ち（キーとして比べるのも日本語）、画面に出すときに辞書から訳を引く。
// - 日本語版はデータの値をそのまま返す（表示を変えない）。
// - 英語版は辞書の rev-*・exp-* の en を返す。辞書に無い費目名はビルドを止める（訳し漏れを画面に出さない）。
// - 特別地方消費税交付金は、データの費目の一覧にはあるが、どの団体の値にも入っていない（平成12年度に廃止）ため、載せていない。
import { t } from "@/lib/i18n";
import { LOCALE, type Locale } from "@/lib/locale";

/** 決算統計の費目名 → 辞書の id。キーはデータの表記 */
const FINANCE_ITEM_IDS: Readonly<Record<string, string>> = {
  // 歳入（款）
  地方税: "rev-local-taxes",
  地方譲与税: "rev-local-transfer-tax",
  市町村たばこ税都道府県交付金: "rev-muni-tobacco-to-pref",
  利子割交付金: "rev-interest-tax-transfer",
  配当割交付金: "rev-dividend-tax-transfer",
  株式等譲渡所得割交付金: "rev-capital-gains-tax-transfer",
  分離課税所得割交付金: "rev-separate-income-transfer",
  地方消費税交付金: "rev-local-consumption-tax-transfer",
  ゴルフ場利用税交付金: "rev-golf-tax-transfer",
  自動車取得税交付金: "rev-auto-acquisition-tax-transfer",
  軽油引取税交付金: "rev-gas-oil-tax-transfer",
  自動車税環境性能割交付金: "rev-env-performance-transfer",
  法人事業税交付金: "rev-corporate-enterprise-tax-transfer",
  地方特例交付金等: "rev-special-local-grants",
  地方交付税: "rev-local-allocation-tax",
  交通安全対策特別交付金: "rev-traffic-safety-grants",
  分担金及び負担金: "rev-shares-charges",
  使用料: "rev-rents-fees",
  手数料: "rev-charges",
  国庫支出金: "rev-national-treasury",
  国有提供施設等所在市町村助成交付金: "rev-national-facility-grants",
  都道府県支出金: "rev-prefectural-disb",
  財産収入: "rev-property-income",
  寄附金: "rev-contributions",
  繰入金: "rev-transfers",
  繰越金: "rev-brought-forward",
  諸収入: "rev-misc",
  地方債: "rev-local-bonds",
  特別区財政調整交付金: "rev-special-ward-equalising",
  // 歳出（目的）
  議会費: "exp-assembly",
  総務費: "exp-general-admin",
  民生費: "exp-public-welfare",
  衛生費: "exp-sanitation",
  労働費: "exp-labour",
  農林水産業費: "exp-agriculture",
  商工費: "exp-commerce",
  土木費: "exp-civil-eng",
  消防費: "exp-fire",
  警察費: "exp-police",
  教育費: "exp-education",
  災害復旧費: "exp-disaster-recovery",
  公債費: "exp-debt-service",
  諸支出金: "exp-misc",
  前年度繰上充用金: "exp-prior-year-appropriation",
};

/** 費目名を、その言語で画面に出す形にする。 */
export function financeItemLabel(name: string, locale: Locale = LOCALE): string {
  if (locale === "ja") return name;
  const id = FINANCE_ITEM_IDS[name];
  if (!id) throw new Error(`[i18n] 用語辞書に無い財政の費目名：${name}（lib/finance-labels.ts）`);
  return t(id, locale);
}
