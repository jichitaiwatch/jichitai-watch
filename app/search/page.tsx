"use client";

// app/search/page.tsx
//
// 検索結果ページ（/search#q=…）。検索語は「#」以降で受ける（外へ送られない。D-5）。旧形式の /search?q=… も読む。docs/frontend-architecture.md §7 の実装仕様に準拠。
// - 索引は data/search_index.json（scripts/gen_search_index.py が生成）をimport。DB不要・
//   output:'export' 整合（§7.0/§7.4）。実行時は入力を正規化して索引を全走査するのみ。
// - マッチ評価は §7.1 の機械的順序（完全→前方→部分。読みカナ/ローマ字は索引キーに含むため
//   完全一致段で拾える）。異体字辞書(§7.1-3)・誤字候補(§7.1-6)はV1対象外（§7.5）。
// - 段内並び＝団体コード昇順（§7.1・D-6 中立性。総合スコア・順位付けをしない）。
// - 同名（府中市＝東京都/広島県）は両方表示し都道府県で区別（§7.0・design/mock 同名の場合の処理）。
// - 公開スコープ外（published=false）は「準備中」表示（未公開分岐・ui-vi §2.6 正直さの担保）。
//   ただし、このビルドにページがある団体（試作ビルドの愛知・三重。app/search/layout.tsx が団体コードで渡す）は
//   「自治体ページ」としてリンクにする（2026-10-18 運営者裁定・launch-backlog.md L-9。公開用ビルドでは該当なし）。
//
// 色は app/globals.css のVIトークン（--identity 系）。識別の色であり評価色ではない（D-4/D-6）。

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchExample, useSearchExtraPages } from "@/components/SearchExtraPages";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import searchIndex from "@/data/search_index.json";
import { normalizeSearchKey } from "@/lib/search-normalize";

interface SearchRecord {
  area_code: string;
  pref_code: string;
  level: "prefecture" | "municipality";
  name: string;
  pref_name: string;
  keys: string[];
  published: boolean;
  url: string | null;
}

const INDEX = (searchIndex as { data: SearchRecord[] }).data;

// マッチ段（数値が小さいほど厳密＝上位）。§7.1 の順序を数値化。
const TIER_EXACT = 1;
const TIER_PREFIX = 2;
const TIER_PARTIAL = 3;

function tierOf(rec: SearchRecord, q: string): number | null {
  if (rec.keys.some((k) => k === q)) return TIER_EXACT;
  if (rec.keys.some((k) => k.startsWith(q))) return TIER_PREFIX;
  if (rec.keys.some((k) => k.includes(q))) return TIER_PARTIAL;
  return null;
}

interface Hit {
  rec: SearchRecord;
  tier: number;
}

function runSearch(rawQuery: string, index: SearchRecord[]): Hit[] {
  const q = normalizeSearchKey(rawQuery);
  if (!q) return [];
  const hits: Hit[] = [];
  for (const rec of index) {
    const tier = tierOf(rec, q);
    if (tier !== null) hits.push({ rec, tier });
  }
  // 段昇順 → 団体コード昇順（§7.1）
  hits.sort((a, b) => a.tier - b.tier || a.rec.area_code.localeCompare(b.rec.area_code));
  return hits;
}

function BuildingIcon() {
  // design/mock 同名の場合の処理 のビル＋植栽アイコンの簡易再現。識別用の中立図形。
  return (
    <span
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full sm:h-16 sm:w-16"
      style={{ backgroundColor: "var(--identity-soft)" }}
      aria-hidden="true"
    >
      <svg width="32" height="32" viewBox="0 0 64 64" fill="none"
        stroke="var(--identity)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 54V22h20v32" />
        <path d="M42 54V32h8v22" />
        <path d="M28 30h4M36 30h2M28 38h4M36 38h2M28 46h4M36 46h2" />
        <path d="M14 54V40M14 40c-3 0-5-2-5-5s2-4 5-4 5 2 5 4-2 5-5 5Z" />
        <path d="M10 54h44" />
      </svg>
    </span>
  );
}

function ResultCard({ rec }: { rec: SearchRecord }) {
  const inner = (
    <div className="flex items-center gap-4 rounded-2xl border bg-white p-4 sm:p-5"
      style={{ borderColor: "var(--line)", boxShadow: "var(--card-shadow)" }}>
      <BuildingIcon />
      <div className="min-w-0 flex-1">
        <p className="fs-label font-semibold" style={{ color: "var(--identity)" }}>
          {rec.pref_name}
        </p>
        <p className="mt-0.5 text-xl font-bold sm:text-2xl" style={{ color: "var(--body)" }}>
          {rec.name}
        </p>
        <p className="mt-1 fs-label" style={{ color: "var(--muted)" }}>
          {rec.pref_name}
          <span className="mx-1.5" aria-hidden="true">›</span>
          {rec.name}
        </p>
        <p className="mt-1.5 fs-label font-medium"
          style={{ color: rec.published ? "var(--identity)" : "var(--muted-light)" }}>
          {rec.published ? "自治体ページ" : "準備中"}
        </p>
      </div>
      {rec.published && (
        <span className="shrink-0 text-2xl" style={{ color: "var(--identity)" }} aria-hidden="true">
          ›
        </span>
      )}
    </div>
  );

  if (rec.published && rec.url) {
    return (
      <li>
        <Link href={rec.url} className="block focus:outline-none focus-visible:ring-2"
          style={{ borderRadius: "1rem" }}>
          {inner}
        </Link>
      </li>
    );
  }
  // 未公開：リンクにしない（飛び先が無い）。準備中として静的表示。
  return (
    <li aria-disabled="true" className="opacity-95">
      {inner}
    </li>
  );
}

function InfoBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-xl px-4 py-3 fs-label"
      style={{ backgroundColor: "var(--identity-soft)", color: "var(--identity-dark)" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.5v.5" strokeLinecap="round" />
      </svg>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function SearchResults() {
  const params = useSearchParams();
  const initialQ = params.get("q") ?? ""; // 旧形式（/search?q=…）への互換。新しい導線は「#」以降を使う。
  // 検索語は「#q=…」で受ける。「#」以降は静的書き出しの段階では存在せず、ブラウザ上でのみ読める（表示後に反映）。
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const hashQ = new URLSearchParams(hash.replace(/^#/, "")).get("q");
  // 利用者が入力欄を触るまでは、アドレス由来の語を表示する。触ったあとは入力欄の値が優先。
  const [typed, setQuery] = useState<string | null>(null);
  const query = typed ?? hashQ ?? initialQ;

  const extra = useSearchExtraPages();
  const example = useSearchExample();
  const index = useMemo(
    () =>
      Object.keys(extra).length === 0
        ? INDEX
        : INDEX.map((r) => (extra[r.area_code] ? { ...r, published: true, url: extra[r.area_code] } : r)),
    [extra],
  );
  const hits = useMemo(() => runSearch(query, index), [query, index]);

  const prefs = hits.filter((h) => h.rec.level === "prefecture");
  const munis = hits.filter((h) => h.rec.level === "municipality");

  // 同名（正規化名称が2件以上）の市町村がいるか（§7.0 同名両掲の注記）
  const nameCount = new Map<string, number>();
  for (const h of munis) {
    const key = normalizeSearchKey(h.rec.name);
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }
  const hasDuplicateName = [...nameCount.values()].some((c) => c >= 2);

  const trimmed = query.trim();
  const hasResults = hits.length > 0;

  return (
    <main id="main" tabIndex={-1} className="focus:outline-none min-h-screen bg-stone-100 px-3 py-5 sm:px-8 sm:py-8 type-large">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-1 py-1.5 fs-label font-medium"
          style={{ color: "var(--muted)" }}>
          <span aria-hidden="true">←</span> 戻る
        </Link>

        <h1 className="mt-3 text-2xl font-bold sm:text-3xl" style={{ color: "var(--body)" }}>
          {trimmed ? `「${trimmed}」の検索結果` : "自治体を探す"}
        </h1>

        {/* 検索窓（design/mock トップ画面の検索窓に準拠） */}
        <div className="relative mt-4">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
            aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="var(--muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="市町村名・都道府県名を入力"
            aria-label="自治体名"
            className="w-full rounded-xl border bg-white py-4 pl-12 pr-12 text-lg outline-none focus:ring-2"
            style={{ borderColor: "var(--line)", color: "var(--body)" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="入力をクリア"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1"
              style={{ color: "var(--muted)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="m9 9 6 6M15 9l-6 6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {trimmed === "" ? (
          <p className="mt-6 fs-label" style={{ color: "var(--muted)" }}>
            {`市町村名または都道府県名を入力してください。例：${example}`}
          </p>
        ) : !hasResults ? (
          <div className="mt-6">
            <p className="text-base" style={{ color: "var(--body)" }}>
              該当する自治体が見つかりませんでした。
            </p>
            <p className="mt-2 fs-label" style={{ color: "var(--muted)" }}>
              表記や読みを変えて試してください。都道府県名を加えると絞り込めます（例：東京都 府中市）。
            </p>
          </div>
        ) : (
          <>
            {hasDuplicateName && (
              <InfoBar>
                同名の市町村が複数あります。都道府県を確認して選択してください。
              </InfoBar>
            )}

            {prefs.length > 0 && (
              <section className="mt-6">
                <h2 className="text-lg font-bold" style={{ color: "var(--body)" }}>
                  都道府県 <span className="fs-label font-normal" style={{ color: "var(--muted)" }}>{prefs.length}件</span>
                </h2>
                <ul className="mt-3 space-y-3">
                  {prefs.map((h) => (
                    <ResultCard key={h.rec.area_code} rec={h.rec} />
                  ))}
                </ul>
              </section>
            )}

            {munis.length > 0 && (
              <section className="mt-6">
                <h2 className="text-lg font-bold" style={{ color: "var(--body)" }}>
                  市町村 <span className="fs-label font-normal" style={{ color: "var(--muted)" }}>{munis.length}件</span>
                </h2>
                <ul className="mt-3 space-y-3">
                  {munis.map((h) => (
                    <ResultCard key={h.rec.area_code} rec={h.rec} />
                  ))}
                </ul>
              </section>
            )}

            <p className="mt-8 flex items-start gap-2 border-t pt-5 fs-label"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 7.5v.5" strokeLinecap="round" />
              </svg>
              <span className="min-w-0">
                都道府県名を加えて検索すると絞り込めます<br />
                例：東京都 府中市、広島県 府中市
              </span>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main id="main" tabIndex={-1} className="focus:outline-none min-h-screen bg-stone-100 px-3 py-5 sm:px-8 sm:py-8 type-large">
          <div className="mx-auto max-w-3xl">
            {/* 静的HTMLにもh1を持たせる（C-7）。水和後は SearchResults の h1 に置き換わる */}
            <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: "var(--body)" }}>自治体を探す</h1>
            <p className="mt-3 fs-label" style={{ color: "var(--muted)" }}>読み込み中…</p>
          </div>
        </main>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
