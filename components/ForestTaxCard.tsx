import { formatManOku } from "@/lib/format-yen";
import type { ForestTaxUse } from "@/lib/forest-tax";

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

const yenText = (yen: number) => (yen === 0 ? "0円" : formatManOku(Math.floor(yen / 1000)));

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
        <Block heading="受け取った額" value={jouyoYen} exact />
        <Block heading="使った額" value={katsuyoYen} sub={katsuyoNote} />
        <Block heading="基金への積立額" value={tsumitateYen} />
      </div>
      {uses.length > 0 && (
        <section
          className="min-w-0 overflow-hidden rounded-[9px] border border-[#dce6e1] bg-[#fbfcfb]"
          aria-label="主な使途"
        >
          <h3 className="m-0 bg-[#edf5f1] px-2.5 py-[7px] fs-label font-extrabold text-[var(--identity)]">
            主な使途（金額の大きい順）
          </h3>
          <ul className="m-0 list-none px-2.5 py-2 fs-sub text-stone-700">
            {uses.map((u) => (
              <li key={u.name} className="flex justify-between gap-3 py-0.5">
                <span>{u.name}</span>
                <span className="shrink-0">{yenText(u.yen)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="fs-note text-stone-600">
        令和6年度。各自治体の公表資料の数字をそのまま示しています。受け取った額と使った額は一致しない場合があります。
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
            {heading}の正確な値：{value.toLocaleString("ja-JP")}円。
          </p>
        )}
        {value === null && !exact && <p className="mt-1 fs-sub text-stone-600">資料に記載なし</p>}
      </div>
    </section>
  );
}
