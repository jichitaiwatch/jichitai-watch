// lib/under-review.ts
//
// 「確認中」の注記の一覧（launch-backlog.md E-6・gate4-staleness-correction-spec.md B-2）。
// 公開文の約束：「確認が済むまでの間は、該当箇所に確認中である旨を表示します。」
// 指摘を受けて確認している間だけ、ここにカードを1行足す。確認が済んだら、その行を消す（訂正した場合は
// app/corrections/page.tsx の CORRECTION_LOG に記録する。手順は docs/succession-runbook-internal.md §7.2）。
//
// - 方針（B-2・D-3）：確認できるまで非表示にはしない。数値はそのまま表示し、「確認中」の旨だけを添える。
// - 市区町村版・県版のどちらも、カードの表示部品（components/MetricCard.tsx）が同じ一覧を見る。
// - cardId＝カード定義の id（lib/card-registry.tsx／lib/pref-card-registry.tsx の `id:`。例 "m1-population"）。
// - areaCode＝対象を1団体に絞るとき（市区町村は6桁の団体コード、県は都道府県コード2桁。例 岐阜県＝"21"）。
//   省略すると、そのカードを表示するすべての団体に出す。
// - since＝確認を始めた日（YYYY-MM-DD）。画面に表示する。

export interface UnderReviewEntry {
  cardId: string;
  areaCode?: string;
  since: string;
}

export const UNDER_REVIEW: UnderReviewEntry[] = [
  // 例: { cardId: "m1-population", areaCode: "212016", since: "2026-10-01" },
];

export function findUnderReview(
  cardId: string,
  areaCode?: string,
  list: UnderReviewEntry[] = UNDER_REVIEW,
): UnderReviewEntry | undefined {
  return list.find((e) => e.cardId === cardId && (e.areaCode === undefined || e.areaCode === areaCode));
}

/** "2026-10-01" → "2026年10月1日"。形式が違えば元の文字列をそのまま返す。 */
export function formatSince(since: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(since);
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : since;
}
