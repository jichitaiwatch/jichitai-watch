// lib/text.ts
//
// 「・」の直後で行が折れないようにする（U+2060 WORD JOINER を「・」の後ろに挟む）。
// 「・」は直前では折れない（禁則）が、直後では折れてしまい「開発・|運営」のように
// 並列語が分断される。CSS だけでは止められないため、文字列側で抑える。
// 折り返しは「、」「。」や文節の切れ目に任せる。字形は変わらず、検索・コピーにも影響しない。
// React の子要素を再帰的にたどり、文字列だけを置換する（要素・属性はそのまま）。

import { Children, cloneElement, isValidElement, type ReactNode } from "react";

const WJ = "⁠";

export function noBreakAfterDot(node: ReactNode): ReactNode {
  if (typeof node === "string") return node.replace(/・(?!⁠)/g, `・${WJ}`);
  if (Array.isArray(node)) return Children.map(node, noBreakAfterDot);
  if (isValidElement<{ children?: ReactNode }>(node) && node.props.children !== undefined) {
    // 関数コンポーネントの children はそのまま渡す（呼び出し側が描画する）。
    return cloneElement(node, undefined, noBreakAfterDot(node.props.children));
  }
  return node;
}
