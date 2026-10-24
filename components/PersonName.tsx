import type { ReactNode } from "react";
import { tf } from "@/lib/i18n";
import { LOCALE } from "@/lib/locale";
import { personNameParts } from "@/lib/person-names";

/**
 * 首長・正副議長の氏名（作業単位7。2026-10-23 運営者裁定）。サーバー側の部品。
 * - 日本語版：データの氏名をそのまま出す（表示を変えない）。
 * - 英語版：ローマ字に漢字を添える（Yamada Haruo (山田 晴夫)。文型は辞書の p-person-name）。漢字の部分には lang="ja" を付ける。
 *   読みを確かめられなかった人は、推測せず漢字のまま出す（D-25）。
 * 部品（<PersonName />）ではなく関数として呼ぶ：日本語版でデータの文字列をそのまま置き、
 * ページ移動用のデータ（RSC）の並びも変えないため（部品にすると1段の参照が増える）。
 */
export function personName(areaCode: string, name: string, opts: { stack?: boolean } = {}): ReactNode {
  if (LOCALE === "ja") return name;
  const { romaji, kanji } = personNameParts(areaCode, name);
  if (!romaji) return <span lang="ja">{kanji}</span>;
  if (opts.stack) {
    // カードの大きな氏名：ローマ字の行と漢字の行を分ける（漢字の途中で折れないよう、漢字の行は1行に保つ。2026-10-24 運営者指摘）。
    // 括弧は文型（p-person-name）の {kanji} の前後のものを使う
    const MARK = "\u0000";
    const [, after] = tf("p-person-name", { romaji: MARK, kanji: "\u0001" }).split(MARK);
    const [open, close] = after.trim().split("\u0001");
    return (
      <>
        {romaji}
        <span style={{ display: "block", whiteSpace: "nowrap", fontSize: "0.8em" }}>
          {open}
          <span lang="ja">{kanji}</span>
          {close}
        </span>
      </>
    );
  }
  // 文型の {kanji} の位置で分け、漢字の部分だけを lang="ja" で包む（印は文型に出てこない文字）
  const MARK = "\u0000";
  const [before, after] = tf("p-person-name", { romaji, kanji: MARK }).split(MARK);
  return (
    <>
      {before}
      <span lang="ja">{kanji}</span>
      {after}
    </>
  );
}

/**
 * 会派名・党派など、英語版で訳さず日本語のまま出すことがある名前（lib/party-labels.ts の NameLabel）。
 * 日本語版・訳した名前は文字列のまま、日本語のまま出す名前だけ lang="ja" で包む（関数で呼ぶ理由は personName と同じ）。
 */
export function nameLabelNode(l: { text: string; ja: boolean }): ReactNode {
  return l.ja ? <span lang="ja">{l.text}</span> : l.text;
}
