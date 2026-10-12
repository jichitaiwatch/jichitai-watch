import { getIndustryIconColors, IndustryIcon } from "./IndustryIcon";

interface TopIndustryEntry {
  産業名: string;
  就業者数: number;
}

interface TopIndustriesListProps {
  industries: TopIndustryEntry[];
}

/**
 * 「まちのすがた」上位3業種カード。design/mock の industry-row 表現（順位バッジ＋業種名＋就業者数）を
 * 実データで再現する。原本の「構成比・前回調査比」列は実データで裏付けできないため出さない
 * （欠損規律・不確実な対応付けをしない）。業種名は国勢調査産業大分類20区分の固定分類のため機械対応可能。
 * IndustryIcon（20区分対応表）で表示。色は産業分類の識別であって評価ではない（D-4/D-6）。
 * 原本の順位別背景色（r1/r2/r3）は採らず一律の中立地色にする＝順位を色で価値付けしない（D-4/D-6）。
 * 順位は就業者数の降順という事実であって優劣評価ではない。
 */
export function TopIndustriesList({ industries }: TopIndustriesListProps) {
  return (
    <ol className="overflow-hidden rounded-md border border-[var(--line-soft)] fs-label">
      {industries.map((item, i) => {
        const { bg } = getIndustryIconColors(item.産業名);
        return (
          <li
            key={item.産業名}
            className="grid grid-cols-[24px_28px_1fr_auto] items-center gap-2 border-b border-[var(--line-soft)] bg-[var(--identity-soft)]/30 px-3 py-2 last:border-b-0"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--identity)] fs-sub font-extrabold text-white">
              {i + 1}
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-full" style={{ backgroundColor: bg }}>
              <IndustryIcon industryName={item.産業名} size={16} />
            </span>
            <span className="min-w-0 truncate font-semibold text-[var(--body)]">{item.産業名}</span>
            <span className="text-right fs-key font-extrabold text-[var(--current)]">
              {item.就業者数.toLocaleString()}
              <span className="ml-0.5 fs-sub font-semibold text-[var(--muted)]">人</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
