import type { ReactNode } from "react";

// components/SrOnlyDataTable.tsx — グラフの「同値テーブル」（読み上げ専用・C-6・pre-launch-gates Gate 11 #9）。
// グラフ（Recharts の SVG）は視覚のみの情報になりやすいため、同じ数値を表で併設する。
// 値の文言は各グラフの Tooltip と同一の formatter を呼び出し側から渡し、欠損（null）は
// 0 と混同せず Tooltip と同じ語（「データなし」）で出す（欠損規律）。
// sr-only は <table> 要素自体には効かない（幅1px・overflow:hidden が無視され横あふれする）ため、
// 必ず <div className="sr-only"> で包む（C-4 で ExpenditureBarChart 等と同様に是正済みの落とし穴）。

export function SrOnlyDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  /** 先頭列（年度）の見出しは含めない。系列名のみ */
  columns: string[];
  rows: { label: string; cells: ReactNode[] }[];
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">年度</th>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}年度</th>
              {r.cells.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
