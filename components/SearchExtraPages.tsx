"use client";

// components/SearchExtraPages.tsx
//
// 検索の索引（data/search_index.json）では未公開（published=false）だが、このビルドにはページがある団体の URL を、
// 検索ページへ渡す入れ物（2026-10-18 運営者裁定・launch-backlog.md L-9）。
// 中身は app/search/layout.tsx がビルド時に、実在するページ（lib/municipalities.ts・lib/prefectures.ts）と
// 索引を団体コード（area_code）で突き合わせて作る。いまは試作ビルド（JICHITAI_TRIAL_PREFS）の愛知・三重の
// 市町村・区・県だけが該当し、公開用ビルドでは空のため、この入れ物自体を出さない（出力は変わらない）。
// 索引ファイルには試作のURLを書かない（公開側の索引に試作のページ名を載せないため）。

import { createContext, useContext } from "react";
import { DEFAULT_SEARCH_EXAMPLE } from "@/lib/prefectures";

/** area_code → このビルドにあるページのURL（索引の url と同じ形＝末尾 /） */
export type ExtraPages = Record<string, string>;

const ExtraPagesContext = createContext<ExtraPages>({});

/** 検索の入力例（既定＝岐阜県だけのときの文言）。県が増えたビルドでは app/search/layout.tsx が県の一覧から作って渡す。 */
const ExampleContext = createContext<string>(DEFAULT_SEARCH_EXAMPLE);

export function SearchExtraPagesProvider({
  pages,
  example,
  children,
}: {
  pages: ExtraPages;
  example: string;
  children: React.ReactNode;
}) {
  return (
    <ExtraPagesContext.Provider value={pages}>
      <ExampleContext.Provider value={example}>{children}</ExampleContext.Provider>
    </ExtraPagesContext.Provider>
  );
}

export function useSearchExample(): string {
  return useContext(ExampleContext);
}

export function useSearchExtraPages(): ExtraPages {
  return useContext(ExtraPagesContext);
}
