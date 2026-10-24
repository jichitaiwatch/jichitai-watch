// lib/i18n-client.ts
//
// ブラウザ側で動く部品（"use client"）が画面の文言を使うための小さな道具。用語辞書そのものは読まない。
// 文言はサーバー側の部品が lib/i18n.ts の msgsFor() で辞書から引き、props（検索ページは文脈 MessagesProvider）で渡す。
// こうすると、辞書全体がブラウザ用のファイルに入らない（frontend-architecture.md §5.8 7）。
// - m(msgs, id)：その id の文言を返す。渡されていない id はエラー（渡し漏れを残さない）。
// - mf(msgs, id, vars)：文型（kind=pattern）に値を差し込む。差し込み位置と値の名前が合わないとエラー。

export type Msgs = Readonly<Record<string, string>>;

export function m(msgs: Msgs, id: string): string {
  const text = msgs[id];
  if (text === undefined) throw new Error(`[i18n] 部品に渡されていない文言の id：${id}（lib/i18n-ids.ts に足す）`);
  return text;
}

export function mf(msgs: Msgs, id: string, vars: Readonly<Record<string, string>>): string {
  const pattern = m(msgs, id);
  const slots = new Set([...pattern.matchAll(/\{([a-z]+)\}/g)].map((x) => x[1]));
  const missing = [...slots].filter((k) => !(k in vars));
  const extra = Object.keys(vars).filter((k) => !slots.has(k));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`[i18n] 文型 ${id} の差し込みが合わない（不足：${missing.join(",") || "なし"}／余分：${extra.join(",") || "なし"}）`);
  }
  return pattern.replace(/\{([a-z]+)\}/g, (_, k: string) => vars[k]);
}
