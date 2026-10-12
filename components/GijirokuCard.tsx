interface GijirokuCardProps {
  status: "有" | "無";
  format: string | null;
  url: string | string[] | null;
}

/**
 * 議事録Web公開カード（議会のすがた §0.10 3-4）。design/mock の minutes-panel（Web公開パネル＋文書図）を再現。
 * 会議録本文のWeb公開有無を事実として提示する（議決結果一覧・録画配信・議会だよりは会議録本文でない）。
 * 「無」は評価語を付けず事実の記述に留める（D-6）。
 */
export function GijirokuCard({ status, format, url }: GijirokuCardProps) {
  if (status === "無") {
    return <p className="fs-label text-[var(--muted)]">会議録本文のWeb公開なし</p>;
  }

  const urls = url === null ? [] : Array.isArray(url) ? url : [url];

  return (
    <div className="flex items-center gap-4 rounded-[10px] bg-[var(--panel)] p-4">
      {/* 文書図（装飾） */}
      <div
        aria-hidden
        className="h-[100px] w-[90px] shrink-0 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3"
      >
        <div className="-mx-3 mb-2.5 bg-[var(--identity-soft)] px-2.5 py-1.5 fs-sub font-bold tracking-[2px] text-[var(--identity)]">
          WEB
        </div>
        <div className="my-2 h-0.5 bg-[#d9e4de]" />
        <div className="my-2 h-0.5 bg-[#d9e4de]" />
        <div className="my-2 h-0.5 w-2/3 bg-[#d9e4de]" />
      </div>
      <div className="min-w-0">
        <strong className="block fs-key font-bold text-[var(--body)]">会議録本文を<span className="whitespace-nowrap">Web公開</span></strong>
        {format && <p className="mt-1.5 fs-sub text-[var(--muted)]">公開形式：{format}</p>}
        {urls.map((u) => (
          <a
            key={u}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all py-1 fs-sub text-[var(--identity)] underline"
          >
            {u}
          </a>
        ))}
      </div>
    </div>
  );
}
