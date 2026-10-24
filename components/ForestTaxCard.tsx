import { yenAmount } from "@/lib/format-units";
import { EnMoneyText } from "@/components/MoneyText";
import { LOCALE } from "@/lib/locale";
import { formatManOku } from "@/lib/format-yen";
import type { ForestTaxUse } from "@/lib/forest-tax";
import { t, tf } from "@/lib/i18n";

interface ForestTaxCardProps {
  /** 受け取った額（譲与額・円） */
  jouyoYen: number;
  /** 使った額（基金積立を除く事業への充当額・円）。無ければ null */
  katsuyoYen: number | null;
  /** 使った額に付ける注記（資料の表記。「譲与税充当額」のときは付けない） */
  katsuyoNote?: string;
  /** 基金への積立額（円）。資料に無ければ null */
  tsumitateYen: number | null;
  /** 主な使途（金額の大きい順・最大3件。基金への積立を含む） */
  uses: ForestTaxUse[];
}

const yenText = (yen: number) =>
  yen === 0
    ? tf("p-yen", { amount: yenAmount(0) })
    : LOCALE === "en"
      ? <EnMoneyText thousandYen={Math.floor(yen / 1000)} />
      : formatManOku(Math.floor(yen / 1000));

/**
 * くらし「森林環境譲与税」カード（L-8）。受け取った額・使った額・基金への積立額・主な使途を、
 * 公表資料の数字のまま事実として並べる。
 * - 差引・割合・順位・増減は算出も表示もしない。使い方の良し悪しを示す色・語を付けない（D-4/D-6/D-18）。
 * - 基金積立は「使った額」に含めず別項目で示し、主な使途には含める（2026-10-17 運営者裁定）。
 * - 基金の残高・未執行額は載せない（L-8 裁定）。推定で埋めない（D-25）。
 */
export function ForestTaxCard({
  jouyoYen,
  katsuyoYen,
  katsuyoNote,
  tsumitateYen,
  uses,
}: ForestTaxCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Block heading={t("ft-received")} value={jouyoYen} exact />
        <Block heading={t("ft-used")} value={katsuyoYen} sub={katsuyoNote} />
        <Block heading={t("ft-fund")} value={tsumitateYen} />
      </div>
      {uses.length > 0 && (
        <section
          className="min-w-0 overflow-hidden rounded-[9px] border border-[#dce6e1] bg-[#fbfcfb]"
          aria-label={t("ft-uses")}
        >
          <h3 className="m-0 bg-[#edf5f1] px-2.5 py-[7px] fs-label font-extrabold text-[var(--identity)]">
            {t("ft-uses-heading")}
          </h3>
          <ul className="m-0 list-none px-2.5 py-2 fs-sub text-stone-700">
            {uses.map((u) => (
              <li key={u.name} className="flex justify-between gap-3 py-0.5">
                {/* 事業名は市町村が付けた名前なので、英語版でも訳さず日本語のまま出す（2026-10-24 運営者承認）。
                    lang="ja" を付けると文節で折り返す設定（globals.css の auto-phrase）が働き、長い事業名が横並びの欄で縮まずはみ出すため、
                    収まらないときはどこでも折り返せるようにする */}
                <span>{LOCALE === "en" ? <span lang="ja" style={{ overflowWrap: "anywhere" }}>{u.name}</span> : u.name}</span>
                <span className="shrink-0">{yenText(u.yen)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="fs-note text-stone-600">
        {t("ft-note")}
      </p>
    </div>
  );
}

function Block({
  heading,
  value,
  sub,
  exact,
}: {
  heading: string;
  value: number | null;
  sub?: string;
  exact?: boolean;
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
        <p className="text-[24px] font-extrabold leading-none tracking-[-0.02em] text-[var(--identity)]">
          {value === null ? "—" : yenText(value)}
        </p>
        {sub && <p className="mt-1 fs-sub text-stone-600">{sub}</p>}
        {value !== null && (
          <p className="sr-only">
            {tf("p-ft-exact", { heading, amount: value.toLocaleString("ja-JP") })}
          </p>
        )}
        {value === null && !exact && <p className="mt-1 fs-sub text-stone-600">{t("ft-not-stated")}</p>}
      </div>
    </section>
  );
}
