import { enMoneyFromThousandYen } from "@/lib/format-en";

// components/MoneyText.tsx — 英語版の大きな金額（¥66.03 billion）の表示（作業単位6）。
// 数字と単位の語（million・billion・trillion）を1つの塊にして折り返さず、単位の語を小さい字にする
// （英語は語が長く、カードからはみ出したり変な位置で改行したりしやすいため。2026-10-22 運営者指示）。
// 日本語版はこの部品を使わない（従来の formatManOku の文字列・NoBreakYen のまま）。
// 単位の字の大きさは style で付ける（Tailwind の新しいクラスを足すと、日本語版の CSS ファイルまで変わるため）
const UNIT_STYLE = { fontSize: "0.62em" } as const;

export function EnMoneyText({ thousandYen }: { thousandYen: number }) {
  const m = enMoneyFromThousandYen(thousandYen);
  return (
    <span className="inline-block whitespace-nowrap">
      {m.amount}
      {m.unit && <span style={UNIT_STYLE}> {m.unit}</span>}
    </span>
  );
}
