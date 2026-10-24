// lib/party-labels.ts
//
// 会派名と首長の党派を、ビルドしている言語で画面に出す形にする（作業単位7。2026-10-24 運営者裁定。辞書の kaiha_names）。
// - 日本語版はデータの名前をそのまま返す（表示を変えない）。
// - 英語版：国政政党の名前と同じものは政党の英語名、会派に入っていない議員を表す区分は英語。
//   それ以外の会派名は意味を訳さず、日本語のまま返す（ja=true。画面側で lang="ja" を付ける）。
// - 名前はデータの照合キーにも使うので、照合には使わない。画面に出す直前にだけ通す。
// - サーバー側でだけ使う。
import { t } from "@/lib/i18n";
import { LOCALE, type Locale } from "@/lib/locale";

/** 政党の名前（会派名・党派で共通） */
const PARTY_IDS: Readonly<Record<string, string>> = {
  自由民主党: "party-ldp",
  立憲民主党: "party-cdp",
  国民民主党: "party-dpfp",
  公明党: "party-komeito",
  日本維新の会: "party-ishin",
  参政党: "party-sanseito",
  日本共産党: "party-jcp",
  社会民主党: "party-sdp",
};

/** 会派の一覧に出てくる、会派に入っていない議員を表す区分 */
const KAIHA_CATEGORY_IDS: Readonly<Record<string, string>> = {
  会派に属さない議員: "kh-cat-not-in-group",
  無会派: "kh-cat-no-group",
  無所属: "party-independent",
  無所属議員: "kh-cat-independent-members",
};

/** 首長1人の党派 */
const CHIEF_PARTY_IDS: Readonly<Record<string, string>> = {
  ...PARTY_IDS,
  無所属: "party-independent-one",
  諸派: "party-minor-one",
};

export type NameLabel = { text: string; ja: boolean };

function label(nameJa: string, ids: Readonly<Record<string, string>>, locale: Locale): NameLabel {
  if (locale === "ja") return { text: nameJa, ja: false };
  const id = ids[nameJa];
  return id ? { text: t(id, locale), ja: false } : { text: nameJa, ja: true };
}

/** 会派名（英語版で訳さない名前は ja=true） */
export function kaihaLabel(nameJa: string, locale: Locale = LOCALE): NameLabel {
  return label(nameJa, { ...PARTY_IDS, ...KAIHA_CATEGORY_IDS }, locale);
}

/** 首長の党派（英語版で訳さない名前は ja=true） */
export function chiefPartyLabel(nameJa: string, locale: Locale = LOCALE): NameLabel {
  return label(nameJa, CHIEF_PARTY_IDS, locale);
}
