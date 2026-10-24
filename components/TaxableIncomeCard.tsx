import { manYenAmount } from "@/lib/format-units";
import { t, tf } from "@/lib/i18n";
import ComparisonNote, { type ComparisonNoteProps } from "./ComparisonNote";
import { toFixedHalfUp } from "@/lib/format-decimal";

/**
 * 「まちのすがた」7枚目カード（§0.7案A）。一人あたり課税対象所得を表示する。
 * 比較値・順位は出さない（他のまちカードと同じ素の値提示・D-4/D-6/D-18）。
 */
// 変更は props 型定義と JSX への1行追加のみ。既存ロジックは無改変。
export function TaxableIncomeCard({
  perCapitaTaxableIncomeManYen,
  comparison,
}: {
  perCapitaTaxableIncomeManYen: number;
  comparison?: ComparisonNoteProps;
}) {
  return (
    <div className="text-center">
      <p className="text-[36px] font-bold leading-none text-[#3f7d68] sm:text-[38px]">
        {tf("p-man-yen", { amount: manYenAmount(toFixedHalfUp(perCapitaTaxableIncomeManYen, 1)) })}
      </p>
      <p className="mt-1 fs-label text-stone-600">{t("ti-label")}</p>
      <p className="fs-label text-stone-600">{t("ti-sub")}</p>
      {comparison && <ComparisonNote {...comparison} />}
    </div>
  );
}
