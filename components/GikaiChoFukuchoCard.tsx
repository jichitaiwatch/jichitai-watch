import type { GikaiChoFukuchoPrevious } from "@/lib/metrics";

interface GikaiChoFukuchoCardProps {
  chairName: string | null;
  viceChairName: string | null;
  /** 就任日（YYYY-MM-DD）。null＝確認できず。undefined＝この地域は未収集（行を出さない） */
  chairSince?: string | null;
  viceChairSince?: string | null;
  /** 就任日を確認した日（YYYY-MM-DD）。あるときだけ就任日の行と「○年○月○日現在」を出す */
  sinceAsOf?: string;
  /** 改選後の正副議長が未公表の間の、直前の正副議長（任期つき） */
  previous?: GikaiChoFukuchoPrevious;
}

/** "2026-05-08" → "2026年5月8日"。形式が違う値は推測せずそのまま返す */
function ymd(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : s;
}

/**
 * 正副議長カード（議会のすがた §0.10 3-1）。design/mock の person-grid（2枚パネル）を再現。
 * 氏名に加え、就任日を出す（6県分のみ収集。2026-10-21 運営者裁定）。氏名が null は「確認できず」
 * （未発見status時のみ想定・欠損規律）。就任日が null も「確認できず」（推定で埋めない＝D-25）。
 * 任期は出さない：議長・副議長の任期は議会ごとの申合せで、公式の文言を確認できた団体が少ない。
 * 改選後の正副議長が未公表の間は、直前の正副議長を就任日・退任日・退任の理由つきで出す（誤認を避ける）。
 * 事実提示のみ。
 */
export function GikaiChoFukuchoCard({
  chairName,
  viceChairName,
  chairSince,
  viceChairSince,
  sinceAsOf,
  previous,
}: GikaiChoFukuchoCardProps) {
  const showSince = sinceAsOf !== undefined;
  const rows: [string, string | null, string | null | undefined][] = [
    ["議長", chairName, chairSince],
    ["副議長", viceChairName, viceChairSince],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {rows.map(([role, name, since]) => (
          <div key={role} className="flex min-w-0 flex-col rounded-[9px] bg-[var(--panel)] p-3.5">
            <small className="fs-label text-[var(--muted)]">{role}</small>
            <strong className="mt-1.5 truncate fs-key font-bold text-[var(--body)]">
              {name ?? "確認できず"}
            </strong>
            {showSince && name ? (
              <span className="mt-1.5 fs-sub text-[var(--muted)]">
                就任日：{since ? ymd(since) : "確認できず"}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {previous ? (
        <div className="rounded-[9px] bg-[var(--panel)] p-3.5 fs-sub leading-snug text-[var(--body)]">
          <p className="m-0 font-bold">直前の議長・副議長</p>
          <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
            <li>
              議長：{previous.議長氏名}（{ymd(previous.就任日)}就任、{ymd(previous.退任日)}に
              {previous.退任の理由}で退任）
            </li>
            <li>
              副議長：{previous.副議長氏名}（{ymd(previous.就任日)}就任、{ymd(previous.退任日)}に
              {previous.退任の理由}で退任）
            </li>
          </ul>
          <p className="m-0 mt-1.5 text-[var(--muted)]">
            {previous.注記}（{ymd(previous.基準日)}現在）
          </p>
        </div>
      ) : showSince ? (
        <p className="m-0 fs-note text-[var(--muted)]">就任日は{ymd(sinceAsOf)}現在の確認結果です。</p>
      ) : null}
    </div>
  );
}
