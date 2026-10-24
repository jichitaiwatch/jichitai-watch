import { yenAmountMan } from "@/lib/format-units";
import { EnMoneyText } from "@/components/MoneyText";
import { LOCALE } from "@/lib/locale";
import { formatManOku } from "@/lib/format-yen";
import { formatManUnit } from "@/lib/format-count";
import { t, tf } from "@/lib/i18n";

interface FurusatoBlock {
  /** 総額（円）。画面は万円位まで（切り捨て）、正確値は sr-only に保持する */
  amountYen: number;
  /** 一人あたり（円） */
  perCapitaYen: number;
  /** 補足の件数・人数ラベルと値（例「寄附件数」「10,689件」） */
  detailLabel: string;
  detailValue: string;
  /** 比較（全国順位の文言と類似団体平均）。省略時は一人あたり額のみ表示 */
  comparison?: { rankSuffix: string; averageText: string };
}

interface FurusatoCardProps {
  /** 当該自治体が受け入れた寄附（令和7年度・決算見込） */
  intake: FurusatoBlock;
  /** 住民が他自治体へ行った寄附に伴う住民税（市町村民税分）の控除（令和8年度課税） */
  deduction: FurusatoBlock;
}

/**
 * くらし「ふるさと納税」カード（F-6）。受入額と住民税控除額を、同じ形で並べて事実を示す。
 * - 差引・収支・増減は算出も表示もしない。大小に評価色・矢印・評価語を付けない（D-4/D-6/D-18）。
 * - 期間が異なる（受入＝令和7年度、控除＝令和8年度課税）ため、各ブロックの見出しに期間を明記する。
 * - 総額は万円位まで切り捨て表示（lib/format-yen.ts）。正確な円の値は読み上げ用に併記する。
 * - 比較は「一人あたり」の全国順位と類似団体平均（F-5と同じ形式。大小の望ましさを含意しない）。
 */
export function FurusatoCard({ intake, deduction }: FurusatoCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Block
          heading={t("fu-intake")}
          period={t("fu-intake-period")}
          block={intake}
        />
        <Block
          heading={t("fu-deduction")}
          period={t("fu-deduction-period")}
          block={deduction}
        />
      </div>
      <p className="fs-note text-stone-600">
        {t("fu-note-1")}
        <br />
        {t("fu-note-2")}
      </p>
    </div>
  );
}

function Block({
  heading,
  period,
  block,
}: {
  heading: string;
  period: string;
  block: FurusatoBlock;
}) {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-[9px] border border-[#dce6e1] bg-[#fbfcfb]"
      aria-label={heading}
    >
      <h3 className="m-0 bg-[#edf5f1] px-2.5 py-[7px] fs-label font-extrabold text-[var(--identity)]">
        {heading}
      </h3>
      <div className="px-2.5 pb-2.5 pt-3 text-center">
        <p className="fs-sub text-stone-600">{period}</p>
        <p className="mt-1 text-[24px] font-extrabold leading-none tracking-[-0.02em] text-[var(--identity)]">
          {LOCALE === "en" ? <EnMoneyText thousandYen={Math.floor(block.amountYen / 1000)} /> : formatManOku(Math.floor(block.amountYen / 1000))}
        </p>
        <p className="mt-1 fs-label text-stone-600">
          {block.detailLabel} {block.detailValue}
        </p>
        <div className="mt-2 border-t border-stone-200 pt-2 fs-sub text-stone-600">
          <p>{t("fu-per-resident")}{tf("p-yen", { amount: yenAmountMan(block.perCapitaYen) })}</p>
          {block.comparison && (
            <>
              <p>{block.comparison.rankSuffix}</p>
              <p>{block.comparison.averageText}</p>
            </>
          )}
        </div>
        <p className="sr-only">
          {tf("p-fu-exact", { heading, amount: block.amountYen.toLocaleString("ja-JP"), per: block.perCapitaYen.toLocaleString("ja-JP") })}
        </p>
      </div>
    </section>
  );
}
