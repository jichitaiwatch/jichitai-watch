import { EnMoneyText } from "@/components/MoneyText";
import { LOCALE } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { type ComparisonNoteProps } from "./ComparisonNote";
import { formatManOku, formatThousandYenExact } from "@/lib/format-yen";
import { toFixedHalfUp } from "@/lib/format-decimal";

interface GikaihiCardProps {
  current: number | null;
  prior: number | null;
  absoluteComparison?: ComparisonNoteProps;
  perCapitaComparison?: ComparisonNoteProps;
}

/**
 * 議会費カード（議会のすがた §0.10 3-3）。design/mock の cost-main（大数値＋前年比）を再現。
 * 金額は億・万円表示（万円位まで・切り捨て）、正確な千円値はsr-onlyに保持（A-1・裁定(c)）。前年比は当該団体内のみ（同一団体比較）。増減に評価色・矢印を付けない（D-6）。
 * 原本の cost-compare（全国/類団）はV1で意図的に不採用（content-spec §7.13）＝出さない。
 */
export function GikaihiCard({ current, prior }: GikaihiCardProps) {
  const yoy =
    current !== null && prior !== null && prior !== 0
      ? ((current - prior) / prior) * 100
      : null;

  return (
    <div className="flex flex-col gap-2">
      <p className="fs-label text-[var(--muted)]">{t("gh-label")}</p>
      <p className="leading-none text-[var(--identity)]">
        <span className="text-[36px] font-extrabold tracking-[-0.02em] sm:text-[38px]">
          {current !== null ? (LOCALE === "en" ? <EnMoneyText thousandYen={current} /> : formatManOku(current)) : t("val-not-confirmed")}
        </span>
      </p>
      {current !== null && (
        <span className="sr-only">{t("gh-exact")}{formatThousandYenExact(current)}</span>
      )}
      <p className="fs-sub text-[var(--muted)]">
        {t("gh-yoy")}
        <span className="font-semibold text-[var(--body)]">
          {yoy !== null ? `${yoy >= 0 ? "+" : ""}${toFixedHalfUp(yoy, 1)}%` : t("val-not-confirmed")}
        </span>
      </p>
    </div>
  );
}
