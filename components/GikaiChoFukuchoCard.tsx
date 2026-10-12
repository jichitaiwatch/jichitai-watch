interface GikaiChoFukuchoCardProps {
  chairName: string | null;
  viceChairName: string | null;
}

/**
 * 正副議長カード（議会のすがた §0.10 3-1）。design/mock の person-grid（2枚パネル）を再現。氏名のみV1採用
 * （content-spec §7.13）。氏名が null は「確認できず」（未発見status時のみ想定・欠損規律）。事実提示のみ。
 */
export function GikaiChoFukuchoCard({ chairName, viceChairName }: GikaiChoFukuchoCardProps) {
  const rows: [string, string | null][] = [
    ["議長", chairName],
    ["副議長", viceChairName],
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {rows.map(([role, name]) => (
        <div key={role} className="flex min-w-0 flex-col rounded-[9px] bg-[var(--panel)] p-3.5">
          <small className="fs-label text-[var(--muted)]">{role}</small>
          <strong className="mt-1.5 truncate fs-key font-bold text-[var(--body)]">
            {name ?? "確認できず"}
          </strong>
        </div>
      ))}
    </div>
  );
}
