"use client";

// components/MunicipalitySwitcher.tsx
// 自治体切替（ui-vi §1.3）。自治体名自体をタップ対象にし、隣にシェブロン、
// ボタンに「自治体切替」を明記する。タップで同一県内の市町村リストをその場で開き、
// 選ぶとその市町村ページへ遷移する。ヘッダーではなくコンテンツ側に置く（§1.2/§1.3）。
// 並びは団体コード昇順＝機械的順序（評価順を作らない・ui-vi §2.3・D-6）。市区町村＝teal 系。

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MUNICIPALITIES, type MunicipalityConfig } from "@/lib/municipalities";

const LIST = [...MUNICIPALITIES].sort((a, b) => a.areaCode.localeCompare(b.areaCode));

export function MunicipalitySwitcher({ current }: { current: MunicipalityConfig }) {
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
      <p className="fs-label font-medium text-teal-800">{current.prefectureName}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="mt-1 flex items-center gap-2 rounded-lg text-left focus:outline-none focus-visible:ring-2"
      >
        <span className="text-2xl font-bold text-teal-950 sm:text-3xl">{current.cityName}</span>
        <span className={`text-xl text-teal-700 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          ⌄
        </span>
        <span className="ml-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 fs-sub font-bold text-teal-800">
          自治体切替
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 z-30 mt-2 max-h-[70vh] w-64 overflow-y-auto overscroll-contain rounded-xl border bg-white p-2 shadow-lg"
          style={{ borderColor: "var(--line)" }}
          role="listbox"
          aria-label="県内の市町村"
        >
          <ul className="space-y-0.5">
            {LIST.map((m) => {
              const isCurrent = m.slug === current.slug;
              return (
                <li key={m.areaCode}>
                  <Link
                    href={`/${m.prefSlug}/${m.slug}/`}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 fs-label ${
                      isCurrent ? "bg-teal-50 font-bold text-teal-900" : "text-teal-950 hover:bg-stone-100"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="truncate">{m.cityName}</span>
                    {isCurrent && <span className="shrink-0 fs-sub text-teal-700">表示中</span>}
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
