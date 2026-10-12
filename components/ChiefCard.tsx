import type { ChiefRow } from "@/lib/metrics";

interface ChiefCardProps {
  row: ChiefRow;
}

/**
 * 首長カード（行政のすがた §0.9 案A・order10）の可視化層。design/mock「行政のすがた.html」準拠。
 * 事実提示のみ。
 *
 * - モックの仮ラベルは定義規律で是正する：
 *   ・「2期目」→「当選{回}回」（回＝自治総研定義の当選回数。期数とは別物で「○期」としない。content-spec §7.15）。
 *   ・「在任期間：開始〜終了」→ 終了日は ChiefRow に無いため出さず、当選日（当選年月日）のみ表示する
 *     （任期満了日を4年後などと仮定しない＝実在規律）。
 * - 無投票（無投票.is_mutou=true）は「無投票」を明示し、投票率・得票数・絶対得票率は出さない。
 * - 投票実施だが一次未確認（is_mutou=false かつ 各値=null）は「確認できず」と表示し、無投票・0 と混同しない（欠損規律）。
 * - 得票数の単位は「票」。首長を団体間で優劣比較せず、評価色・順位・評価語を付けない（D-4/D-6/D-18）。
 */
export function ChiefCard({ row }: ChiefCardProps) {
  const uncontested = row.無投票.is_mutou;
  const pct = (v: number | null) =>
    v === null ? "確認できず" : `${v.toLocaleString("ja-JP")}%`;
  const votes = (v: number | null) =>
    v === null ? "確認できず" : `${v.toLocaleString("ja-JP")}票`;

  return (
    <div className="flex flex-col gap-3 text-[var(--body)]">
      <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-[13px] px-0.5 pb-2 pt-1">
        <div className="grid h-[82px] w-[82px] place-items-center rounded-full bg-[#deede6] text-[var(--identity)]">
          <svg viewBox="0 0 24 24" className="h-12 w-12" aria-hidden>
            <circle cx="12" cy="7" r="4" fill="currentColor" />
            <path d="M4.5 21c.4-5.2 3.1-8 7.5-8s7.1 2.8 7.5 8h-15Z" fill="currentColor" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="m-0 fs-key font-extrabold leading-tight tracking-[0.025em] text-[#17372c]">
            {row.氏名}
          </p>
          <span className="mt-1.5 inline-flex rounded-full bg-[var(--identity-soft)] px-2.5 py-1 fs-sub font-extrabold text-[var(--identity)]">
            当選{row.回}回
          </span>
          <p className="mt-[7px] fs-sub font-semibold text-[#617069]">
            {row.党派 || "確認できず"}｜当選日：{row.当選年月日}
          </p>
        </div>
      </div>

      {uncontested ? (
        <div className="rounded-lg bg-[var(--identity-soft)] px-3 py-2.5">
          <p className="fs-sub font-medium text-[var(--identity)]">
            無投票（投票率・得票数・絶対得票率はありません）
          </p>
        </div>
      ) : (
        <dl className="grid grid-cols-3 border-y border-[var(--line-soft)]">
          <Fact label="投票率" value={pct(row.投票率)} />
          <Fact label="得票数" value={votes(row.得票数)} divider />
          <Fact label="絶対得票率" value={pct(row.絶対得票率)} divider />
        </dl>
      )}

      {row._note ? (
        Array.isArray(row._note) ? (
          <ul className="list-disc space-y-1 pl-4 fs-note leading-snug text-[var(--muted)]">
            {row._note.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="fs-note leading-snug text-[var(--muted)]">{row._note}</p>
        )
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`min-w-0 px-1.5 py-2.5 text-center [container-type:inline-size] ${
        divider ? "border-l border-[var(--line-soft)]" : ""
      }`}
    >
      <dt className="mb-0.5 fs-label font-bold text-[var(--muted)]">{label}</dt>
      {/* 文字数が多い値（得票数が数百万票の都道府県など）でも枠に収まるよう、セル幅（コンテナ）と
          推定文字幅から文字サイズを縮める。上限は標準の主要数値サイズ。 */}
      <dd
        className="m-0 whitespace-nowrap font-extrabold text-[var(--body)]"
        style={{ fontSize: `min(var(--fs-key), calc(100cqw / ${estimateEm(value)}))` }}
      >
        {value}
      </dd>
    </div>
  );
}

/** 値の文字列の概算幅（em）。数字0.6・桁区切り/小数点0.3・％と全角は1。 */
function estimateEm(text: string): number {
  let em = 0.2;
  for (const ch of text) {
    if (/[0-9]/.test(ch)) em += 0.6;
    else if (ch === "," || ch === ".") em += 0.3;
    else em += 1;
  }
  return Math.round(em * 100) / 100;
}
