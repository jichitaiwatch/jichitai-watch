import { t, tf } from "@/lib/i18n";
import type { ReactNode } from "react";
import { nameLabelNode } from "@/components/PersonName";
import { kaihaLabel } from "@/lib/party-labels";

interface KaihaCardProps {
  status: "有" | "無" | "確認できず";
  list: { name: string; count: number }[] | null;
  /** 会派としては未確定だが判明している参考情報（例：党派別内訳）。注記としてのみ表示する */
  note?: string;
}

/**
 * 会派カード（議会のすがた §0.10 3-2）。design/mock「議会のすがた.html」準拠。
 * - 「有」：会派別人数を group-row（会派名｜バー｜人数）で 1会派=1行 表示する。
 *   バー長は「カード内の最大人数=100%」の相対長（各会派の絶対人数の桁差を吸収するため。
 *   総数に対する構成比バーではない）。
 * - 「無」：state-panel＋state-line で「会派を組んでいません」。
 * - 「確認できず」：別アイコンの state-panel＋補足文。「無」と別状態として明示し、
 *   空欄や「無」に丸めない（content-spec §7.10・欠損規律）。
 * バー・凡例の色は会派の識別用で、データのリスト順に機械割当する。増減・多寡・党派に
 * 評価色を付けない（D-4/D-6/D-18）。
 */

// 識別用パレット（リスト順に割当。党派・イデオロギーへの対応づけはしない）
const BAR_COLORS = [
  "#2f7d5c",
  "#43a6d9",
  "#c94f4f",
  "#1f4e8c",
  "#86ad3d",
  "#8b5e9e",
  "#78b9c8",
];

/** モックの会派アイコン（人＋楕円）。頭部は塗り、体・矢印は線。 */
function KaihaGlyph() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="20" cy="8" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="17" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="32" cy="17" r="3.5" fill="currentColor" stroke="none" />
      <ellipse cx="20" cy="27" rx="12" ry="6" />
      <path d="M20 12v9M11 20l5 4m13-4-5 4" />
    </svg>
  );
}

/** モックの「確認できず」アイコン（文書＋離脱の矢印）。 */
function DocGlyph() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="4" width="20" height="31" rx="3" />
      <path d="M10 12h12m-12 6h12m-12 6h8M6 9H3m3 7H3m3 7H3M26 30 36 10" />
    </svg>
  );
}

function StatePanel({
  glyph,
  title,
  copy,
  note,
}: {
  glyph: ReactNode;
  title: string;
  copy?: string;
  note?: string;
}) {
  return (
    <div className="min-h-[146px] rounded-[10px] bg-[var(--panel)] p-[18px]">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[7px] bg-[var(--identity)] text-white">
          {glyph}
        </span>
        <strong className="fs-key font-bold text-[var(--body)]">{title}</strong>
      </div>
      {copy ? (
        <p className="ml-[48px] mt-2 fs-sub leading-relaxed text-[var(--muted)]">{copy}</p>
      ) : null}
      {note ? (
        <p className="ml-[48px] mt-2 fs-sub leading-snug text-[var(--muted-light)]">{note}</p>
      ) : null}
    </div>
  );
}

export function KaihaCard({ status, list, note }: KaihaCardProps) {
  if (status === "無") {
    return <StatePanel glyph={<KaihaGlyph />} title={t("kh-none")} note={note} />;
  }

  if (status === "確認できず" || !list) {
    return (
      <StatePanel
        glyph={<DocGlyph />}
        title={t("kh-unconfirmed")}
        copy={t("kh-not-found")}
        note={note}
      />
    );
  }

  // 有：バー長は最大人数=100%で正規化（0除算を避けるため下限1）
  const maxCount = Math.max(...list.map((e) => e.count), 1);

  return (
    <div className="flex flex-col gap-2">
      <p className="fs-label font-extrabold text-[var(--muted)]">{t("kh-members-heading")}</p>
      <ul className="flex flex-col gap-1.5">
        {list.map((entry, i) => {
          const pct = Math.max(0, Math.min(100, (entry.count / maxCount) * 100));
          const color = BAR_COLORS[i % BAR_COLORS.length];
          return (
            <li
              key={entry.name}
              className="grid grid-cols-[150px_minmax(0,1fr)_40px] items-center gap-2 fs-sub sm:grid-cols-[170px_minmax(0,1fr)_44px]"
            >
              <span className="break-words leading-tight text-[var(--body)]">{nameLabelNode(kaihaLabel(entry.name))}</span>
              <span
                aria-hidden
                className="h-[18px] overflow-hidden rounded-[5px] bg-[var(--track)]"
              >
                <span
                  className="block h-full"
                  style={{ width: `${pct}%`, backgroundColor: color, borderRadius: "inherit" }}
                />
              </span>
              <span className="whitespace-nowrap text-right text-[var(--body)]">
                {tf("p-people", { n: `${entry.count}` })}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 fs-note text-[var(--muted-light)]">
        {t("kh-colour-note")}
      </p>
    </div>
  );
}
