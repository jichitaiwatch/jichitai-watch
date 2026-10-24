"use client";

// components/SearchEnglish.tsx
//
// 英語版の検索で使う、県・市区町村の英語の名前と英語の検索キー（作業単位8。2026-10-24）。
// 中身は app/search/layout.tsx が英語版のビルドのときだけ i18n/place-names-en.json から作って渡す。
// 日本語版では出さない（日本語版の索引・出力を変えないため）。
// - prefs：pref_code → 県の英語の名前（47都道府県すべて）
// - example：検索の入力例（英語の名前）
// - units：area_code → 市区町村の英語の名前と検索キー（英語の名前があるデータのある県の団体だけ）
// 英語の名前が無い団体（データの無い県の市区町村）は、日本語の名前のまま lang="ja" で出す（推測で作らない）。

import { createContext, useContext } from "react";

export type SearchEnglish = {
  /** 入力例（英語の名前を「, 」でつないだもの） */
  example: string;
  prefs: Record<string, { name: string; keys: string[] }>;
  units: Record<string, { name: string; keys: string[] }>;
};

const SearchEnglishContext = createContext<SearchEnglish | null>(null);

export function SearchEnglishProvider({ value, children }: { value: SearchEnglish; children: React.ReactNode }) {
  return <SearchEnglishContext.Provider value={value}>{children}</SearchEnglishContext.Provider>;
}

export function useSearchEnglish(): SearchEnglish | null {
  return useContext(SearchEnglishContext);
}
