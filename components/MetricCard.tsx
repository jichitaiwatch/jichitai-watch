import { LOCALE } from "@/lib/locale";
import type { ReactNode } from "react";
import Link from "@/components/SiteLink";
import { CardIcon, type CardIconId } from "./CardIcon";
import { formatSince, type UnderReviewEntry } from "@/lib/under-review";
import { t } from "@/lib/i18n";

interface MetricCardProps {
  /** ヘッダー層: 指標名 */
  title: string;
  /** ヘッダー層: 更新頻度 */
  updateFrequency: string;
  /** ヘッダー層: カード見出し左のアイコン（任意。未設定＝アイコン枠なし） */
  iconId?: CardIconId;
  /** ソースフッター層: 出典名 */
  source: string;
  /** ソースフッター層: 出典元へのリンク（存在する場合のみ） */
  sourceUrl?: string;
  /** ソースフッター層: データ更新日 */
  updatedDate: string;
  /** ソースフッター層: 対象年度（Gate 4・例「令和5年度（2023）」）。無ければ非表示 */
  periodLabel?: string;
  /** ソースフッター層: データ取得日（Gate 4）。無ければ非表示 */
  fetchedDate?: string;
  /** Gate 4: 期限超過（次回更新予定＋猶予を過ぎた）。true でフッター上部に注記 */
  stale?: boolean;
  /** 誤りの指摘を受けて確認中のカード（lib/under-review.ts）。あればカード内に「確認中」の旨を表示する。数値は非表示にしない。 */
  underReview?: UnderReviewEntry;
  /** ソースフッター層: 追加の注記（例: 「機械抽出データ」） */
  note?: string;
  /** 可視化層: カードタイプごとに差し替える中身 */
  children: ReactNode;
}

/**
 * CLAUDE.md記載のカード3層構造（ヘッダー／可視化／ソースフッター）を共通実装する唯一のカード。
 * ヘッダーは design/mock の card-head を再現：左に title-icon（identity地・白）＋見出し（identity・800）、
 * 右に更新頻度バッジ（identity-soft地・identity文字・999px）。色・寸法・グラデは全て原本実測（行政のすがた.html）。
 * 中立性：アイコン・色は識別であって評価ではない（D-4/D-6/D-12）。M1〜M3はchildrenだけ差し替えて再利用する。
 */
export function MetricCard({
  title,
  updateFrequency,
  iconId,
  source,
  sourceUrl,
  updatedDate,
  periodLabel,
  fetchedDate,
  stale,
  underReview,
  note,
  children,
}: MetricCardProps) {
  return (
    <section
      className="flex h-full flex-col overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <header
        className="metric-head flex min-h-[38px] items-center justify-between gap-2.5 border-b border-[var(--card-head-border)] px-2.5 py-1.5 sm:px-3"
        style={{ background: "var(--card-head-bg)" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {iconId && (
            <span
              aria-hidden
              className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[5px] text-white sm:h-[29px] sm:w-[29px]"
              style={{ background: "var(--identity)", boxShadow: "0 2px 5px rgb(0 73 49 / 17%)" }}
            >
              <CardIcon
                id={iconId}
                className={
                  iconId === "daynight"
                    ? "h-6 w-6 sm:h-[25px] sm:w-[25px]"
                    : "h-[19px] w-[19px] sm:h-5 sm:w-5"
                }
              />
            </span>
          )}
          <h2 className="metric-title truncate fs-title font-extrabold tracking-[0.015em] text-[var(--identity)]">
            {title}
          </h2>
        </div>
        {/* 英語は更新頻度の文が長く、縮めずに置くとスマホ幅で右へはみ出すので、縮めて折り返す形にする（日本語版は従来どおり） */}
        <span
          className={
            LOCALE === "en"
              ? "rounded-full bg-[var(--identity-soft)] px-2.5 py-1 fs-badge font-extrabold leading-tight text-[var(--identity)]"
              : "shrink-0 rounded-full bg-[var(--identity-soft)] px-2.5 py-1 fs-badge font-extrabold leading-none text-[var(--identity)]"
          }
        >
          {t("frame-freq")}{updateFrequency}
        </span>
      </header>

      {underReview && (
        <p
          role="note"
          className="mx-3 mt-3 rounded border border-[var(--line)] bg-[var(--identity-soft)]/40 px-2.5 py-1.5 fs-source font-semibold text-[var(--muted)] sm:mx-4"
        >
          {t("frame-review-1")}{formatSince(underReview.since)}{t("frame-review-2")}
          <Link href="/corrections" className="underline underline-offset-2">{t("ui-nav-corrections")}</Link>
          {t("frame-review-3")}
        </p>
      )}

      <div className="flex-1 px-3 py-4 sm:px-4">{children}</div>

      <footer className="border-t border-[var(--line-soft)] bg-[var(--identity-soft)]/40 px-3 py-2.5 fs-source text-[var(--muted-light)] sm:px-4">
        {stale && (
          <p className="mb-1.5 fs-source font-semibold text-[var(--muted)]">
            {t("frame-stale")}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {t("frame-source")}{" "}
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--identity)]"
              >
                {source}
              </a>
            ) : (
              source
            )}
          </span>
          {periodLabel && (
            <>
              <span aria-hidden className="text-[var(--line)]">{t("ui-dot-sep")}</span>
              <span>{t("frame-period")}{periodLabel}</span>
            </>
          )}
          <span aria-hidden className="text-[var(--line)]">
            {t("ui-dot-sep")}
          </span>
          <span>{t("frame-updated")}{updatedDate}</span>
          {fetchedDate && (
            <>
              <span aria-hidden className="text-[var(--line)]">{t("ui-dot-sep")}</span>
              <span>{t("frame-fetched")}{fetchedDate}</span>
            </>
          )}
          {note && (
            <span className="ml-auto rounded border border-[var(--line)] px-1.5 py-0.5 fs-chip text-[var(--muted)]">
              {note}
            </span>
          )}
        </div>
      </footer>
    </section>
  );
}
