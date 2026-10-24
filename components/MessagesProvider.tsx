"use client";

// components/MessagesProvider.tsx
//
// ブラウザ側で動くページ（いまは検索ページ app/search/page.tsx）へ、画面の文言を文脈で渡す。
// 文言はサーバー側のレイアウトが lib/i18n.ts の msgsFor() で辞書から引いて渡す（辞書全体をブラウザへ送らない）。
// 部品の props で渡せるところは props で渡す。ページ自体が "use client" で props を受けられない場合だけこれを使う。

import { createContext, useContext } from "react";
import type { Msgs } from "@/lib/i18n-client";

const MessagesContext = createContext<Msgs>({});

export function MessagesProvider({ msgs, children }: { msgs: Msgs; children: React.ReactNode }) {
  return <MessagesContext.Provider value={msgs}>{children}</MessagesContext.Provider>;
}

export function useMsgs(): Msgs {
  return useContext(MessagesContext);
}
