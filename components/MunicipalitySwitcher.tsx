"use client";

// components/MunicipalitySwitcher.tsx
// 自治体切替（ui-vi §1.3）。自治体名自体をタップ対象にし、隣にシェブロン、
// ボタンに「自治体切替」を明記する。タップで同一県内の市町村リストをその場で開き、
// 選ぶとその市町村ページへ遷移する。ヘッダーではなくコンテンツ側に置く（§1.2/§1.3）。
// 並びは団体コード昇順＝機械的順序（評価順を作らない・ui-vi §2.3・D-6）。市区町村＝teal 系。

import { useEffect, useRef, useState } from "react";
import Link from "@/components/SiteLink";
import type { MunicipalityConfig } from "@/lib/municipalities";
import { m, type Msgs } from "@/lib/i18n-client";

/**
 * list＝同一県内の市町村と政令市の区（サーバー側で渡す。クライアントから lib/municipalities を値として読まない）。
 * 区（kind="ward"）は親の市の直後に字下げで並べる（2026-10-18 運営者裁定・launch-backlog.md L-9）。
 * 区と市は parentAreaCode（団体コード）で結ぶ。表示名は親の市名を除いた区名（名古屋市のページの区の一覧と同じ）。
 */
export function MunicipalitySwitcher({
  current,
  list,
  msgs,
}: {
  current: MunicipalityConfig;
  list: MunicipalityConfig[];
  /** lib/i18n-ids.ts の SWITCHER_MSG_IDS をサーバー側で辞書から引いたもの */
  msgs: Msgs;
}) {
  const byCode = (a: MunicipalityConfig, b: MunicipalityConfig) => a.areaCode.localeCompare(b.areaCode);
  const LIST = list
    .filter((m) => m.kind !== "ward")
    .sort(byCode)
    .flatMap((m) => [m, ...list.filter((w) => w.kind === "ward" && w.parentAreaCode === m.areaCode).sort(byCode)]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <p className="fs-label font-medium text-teal-800">{current.prefectureLabel}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="mt-1 flex items-center gap-2 rounded-lg text-left focus:outline-none focus-visible:ring-2"
      >
        <span className="text-2xl font-bold text-teal-950 sm:text-3xl">{current.label}</span>
        <span className={`text-xl text-teal-700 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          ⌄
        </span>
        <span className="ml-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 fs-sub font-bold text-teal-800">
          {m(msgs, "sw-switch")}
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 z-30 mt-2 max-h-[70vh] w-64 overflow-y-auto overscroll-contain rounded-xl border bg-white p-2 shadow-lg"
          style={{ borderColor: "var(--line)" }}
          role="listbox"
          aria-label={m(msgs, "sw-list-label")}
        >
          <ul className="space-y-0.5">
            {LIST.map((mu) => {
              const isCurrent = mu.slug === current.slug;
              return (
                <li key={mu.areaCode}>
                  <Link
                    href={`/${mu.prefSlug}/${mu.slug}/`}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`flex items-center justify-between rounded-lg py-2 fs-label ${
                      mu.kind === "ward" ? "ml-4 border-l-2 border-stone-200 pl-3 pr-3" : "px-3"
                    } ${isCurrent ? "bg-teal-50 font-bold text-teal-900" : "text-teal-950 hover:bg-stone-100"}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="truncate">{mu.kind === "ward" ? mu.shortLabel : mu.label}</span>
                    {isCurrent && <span className="shrink-0 fs-sub text-teal-700">{m(msgs, "sw-current")}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
