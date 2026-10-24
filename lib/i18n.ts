// lib/i18n.ts
//
// 画面の文言を用語辞書 i18n/glossary.json（正本）から引く（docs/frontend-architecture.md §5.8 7）。
// 画面のコードは文言を直接書かず、辞書の id で t("ui-nav-search") のように引く。
// 名前などを差し込む文型（kind=pattern。差し込み位置は {name} 形式）は tf("p-title", { page, site }) で組み立てる。
// - 言語を省いたときは、いまビルドしている言語（lib/locale.ts の LOCALE）の文言を返す。日本語版のビルドは ja、英語版のビルドは en。
// - 辞書に無い id を引くと、ビルドがエラーで止まる（画面と辞書の食い違いを残さない）。
// - サーバー側の部品からだけ使う。"use client" の部品から import すると、辞書全体がブラウザ用のファイルに入る。
//   クライアントの部品で文言が要るときは、サーバー側で引いた文字列を props で渡す。
import glossary from "@/i18n/glossary.json";
import { LOCALE, type Locale } from "@/lib/locale";

export type { Locale };

type Term = { id: string; ja: string; en: string; kind: string };

const TERMS: ReadonlyMap<string, Term> = new Map(
  (glossary.terms as Term[]).map((term) => [term.id, term]),
);

/** 辞書の id から、その言語の文言を返す。 */
export function t(id: string, locale: Locale = LOCALE): string {
  const term = TERMS.get(id);
  if (!term) throw new Error(`[i18n] 用語辞書に無い id：${id}（i18n/glossary.json）`);
  const text = term[locale];
  // kind=suffix（単位・区切りの小さな部品）だけは、片方の言語で空でよい（例：英語では数字の後ろに「人」を付けない）
  if (text === "" && term.kind === "suffix") return text;
  if (!text) throw new Error(`[i18n] 用語辞書の ${id} に ${locale} の文言が無い（i18n/glossary.json）`);
  return text;
}

/**
 * 文型（kind=pattern）に値を差し込んで返す。
 * 文型にある差し込み位置と渡した値の名前が1つでも合わないと、ビルドがエラーで止まる（差し込み漏れ・余分を残さない）。
 */
export function tf(id: string, vars: Readonly<Record<string, string>>, locale: Locale = LOCALE): string {
  const pattern = t(id, locale);
  const slots = new Set([...pattern.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]));
  const given = Object.keys(vars);
  const missing = [...slots].filter((k) => !(k in vars));
  const extra = given.filter((k) => !slots.has(k));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`[i18n] 文型 ${id} の差し込みが合わない（不足：${missing.join(",") || "なし"}／余分：${extra.join(",") || "なし"}）`);
  }
  return pattern.replace(/\{([a-z]+)\}/g, (_, k: string) => vars[k]);
}

/**
 * ブラウザ側で動く部品に渡す文言の組を作る（lib/i18n-client.ts）。ids は lib/i18n-ids.ts の一覧を渡す。
 * サーバー側でだけ呼ぶ（辞書全体をブラウザ用のファイルに入れないため）。
 */
export function msgsFor(ids: readonly string[], locale: Locale = LOCALE): Record<string, string> {
  return Object.fromEntries(ids.map((id) => [id, t(id, locale)]));
}
