"use client";

// components/RegionPicker.tsx
//
// トップ画面の「地域から探す」（docs/ui-vi-handoff.md §2.6・launch-backlog.md L-10）。
// 地方のタブを選ぶと、その地方の都道府県が並ぶ。ページのある県（active）はリンク、まだ無い県は
// グレーで押せない「準備中」にして、公開済みと区別する（§2.6 正直さの担保）。
// 県が1つだけのビルド（公開用）では使わない（app/page.tsx が従来の1枚カードを出す）。

import Link from "next/link";
import { useId, useState } from "react";
import { REGIONS } from "@/lib/regions";
import { REGION_MAP, REGION_MAP_VIEWBOX } from "@/lib/region-map";

export interface ActivePref {
  name: string;
  href: string;
  /** 県内の市町村数（政令市の区は数えない） */
  count: number;
}

const NAVY = "#062657";
const TEAL = "#008f89";
const TEAL_DARK = "#007b76";
const TEAL_PALE = "#e9f7f5";
const INK_MUTED = "#41577d";
const LINE = "#d8e2ed";

export function RegionPicker({ active, initialRegionId }: { active: ActivePref[]; initialRegionId: string }) {
  const [regionId, setRegionId] = useState(initialRegionId);
  const uid = useId();
  const byName = new Map(active.map((a) => [a.name, a]));
  const region = REGIONS.find((r) => r.id === regionId) ?? REGIONS[0];
  // その地方に、ページのある県がいくつあるか（タブの目印）
  const countIn = (names: string[]) => names.filter((n) => byName.has(n)).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start">
      {/* 日本地図（広い画面だけ。スマホは地方タブと県の一覧が主導線＝§2.6）。地図は補助で、操作はタブでも同じにできる */}
      <div
        aria-hidden="true"
        className="relative hidden rounded-xl border bg-white p-3 lg:block"
        style={{ borderColor: LINE }}
      >
        <svg viewBox={`0 0 ${REGION_MAP_VIEWBOX.width} ${REGION_MAP_VIEWBOX.height}`} className="block w-full" focusable="false">
          {REGIONS.map((r) => {
            const selected = r.id === region.id;
            const has = countIn(r.prefectures) > 0;
            return (
              <path
                key={r.id}
                d={REGION_MAP[r.id].d}
                onClick={() => setRegionId(r.id)}
                style={{
                  cursor: "pointer",
                  fill: selected ? TEAL : has ? "#bfe6e2" : "#e3eaf0",
                  stroke: "#ffffff",
                  strokeWidth: 1.5,
                  strokeLinejoin: "round",
                }}
              />
            );
          })}
        </svg>
        {REGIONS.map((r) => {
          const selected = r.id === region.id;
          const [ax, ay] = REGION_MAP[r.id].anchor;
          return (
            <button
              key={r.id}
              type="button"
              tabIndex={-1}
              onClick={() => setRegionId(r.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold"
              style={{
                left: `${(ax / REGION_MAP_VIEWBOX.width) * 100}%`,
                top: `${(ay / REGION_MAP_VIEWBOX.height) * 100}%`,
                background: "#ffffff",
                borderColor: selected ? TEAL : LINE,
                color: selected ? TEAL_DARK : NAVY,
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

    <div
      className="rounded-xl border bg-white"
      style={{ borderColor: LINE, boxShadow: "0 2px 8px rgba(21,49,86,.04)" }}
    >
      <div role="tablist" aria-label="地方" className="flex overflow-x-auto border-b px-2" style={{ borderColor: LINE }}>
        {REGIONS.map((r) => {
          const selected = r.id === region.id;
          const n = countIn(r.prefectures);
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              id={`${uid}-tab-${r.id}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel`}
              onClick={() => setRegionId(r.id)}
              className="relative shrink-0 whitespace-nowrap px-4 py-4 text-base font-bold lg:px-3 xl:px-5"
              style={{
                color: selected ? TEAL_DARK : NAVY,
                borderBottom: selected ? `3px solid ${TEAL}` : "3px solid transparent",
              }}
            >
              {r.label}
              {n > 0 ? (
                <span
                  aria-hidden="true"
                  className="ml-1 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: TEAL }}
                />
              ) : null}
              {n > 0 ? <span className="sr-only">（公開中の県あり）</span> : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${region.id}`} className="p-5 sm:p-6">
        <h3 className="text-xl font-extrabold sm:text-2xl" style={{ color: NAVY }}>{region.heading}</h3>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {region.prefectures.map((name) => {
            const a = byName.get(name);
            return (
              <li key={name}>
                {a ? (
                  <Link
                    href={a.href}
                    className="flex min-h-[48px] items-center justify-between gap-2 rounded-lg border-2 bg-white px-4 py-2 text-base font-bold"
                    style={{ borderColor: TEAL, color: TEAL_DARK, background: TEAL_PALE }}
                  >
                    <span>
                      {name}
                      <span className="block text-sm font-medium" style={{ color: INK_MUTED }}>{`${a.count}市町村`}</span>
                    </span>
                    <span aria-hidden="true" className="text-xl">→</span>
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="flex min-h-[48px] items-center justify-between gap-2 rounded-lg border px-4 py-2 text-base font-medium"
                    style={{ borderColor: LINE, color: "#7d8a9f", background: "#f3f5f8" }}
                  >
                    <span>{name}</span>
                    <span className="text-sm">準備中</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm" style={{ color: INK_MUTED }}>
          グレーの県は準備中で、まだ見られません。色のついた県は、市町村のデータを公開しています。
        </p>
      </div>
    </div>
    </div>
  );
}
