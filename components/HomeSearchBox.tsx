"use client";

// components/HomeSearchBox.tsx
// トップページの検索窓。入力を /search#q=… へ渡すだけのクライアント部品。
// 検索語はアドレスの「#」以降に載せる。「#」以降はブラウザから外へ送られないため、配信事業者やアクセス計測に
// 検索語が届かない（launch-backlog.md D-5。「?」以降に載せると通信として配信側に届く）。
// 検索の挙動・結果は app/search/page.tsx が担う（ui-vi §2.1/§2.3）。
// 色は design/mock 岐阜県版トップの実測値（teal 系）に準拠。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_SEARCH_EXAMPLE } from "@/lib/prefectures";
import { m, mf, type Msgs } from "@/lib/i18n-client";

/** msgs＝lib/i18n-ids.ts の HOME_SEARCH_MSG_IDS をサーバー側で辞書から引いたもの */
export function HomeSearchBox({ example = DEFAULT_SEARCH_EXAMPLE, msgs }: { example?: string; msgs: Msgs }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    router.push(v ? `/search#q=${encodeURIComponent(v)}` : "/search");
  };

  return (
    <form onSubmit={submit} className="mt-6 w-full max-w-[854px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2" aria-hidden="true">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#6c7f9f" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={m(msgs, "sr-placeholder")}
            aria-label={m(msgs, "sr-input-label")}
            className="h-[57px] w-full rounded-[10px] border bg-white pl-14 pr-6 text-base outline-none focus:ring-2 sm:h-[66px] sm:text-lg"
            style={{ borderColor: "#cbd8e6", color: "#062657", boxShadow: "0 4px 10px rgba(18,49,88,.08)" }}
          />
        </div>
        <button
          type="submit"
          className="h-[56px] rounded-[10px] px-8 font-extrabold text-white sm:h-[66px] sm:w-[182px]"
          style={{ background: "linear-gradient(135deg,#009b95,#00847e)", boxShadow: "0 7px 16px rgba(0,130,125,.22)" }}
        >
          {m(msgs, "ui-nav-search")}
        </button>
      </div>
      <p className="mt-3 text-base" style={{ color: "#41577d" }}>{mf(msgs, "p-example", { example })}</p>
    </form>
  );
}
