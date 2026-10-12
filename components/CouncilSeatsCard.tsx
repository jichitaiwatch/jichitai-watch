import ComparisonNote, { type ComparisonNoteProps } from "./ComparisonNote";

interface CouncilSeatsCardProps {
  teisu: number;
  genin: number;
  /**
   * muni版：モック準拠の「条例定数の比較」を描画する場合の自団体ラベル。
   * これが渡されたときだけ compare-row（自団体バー＋全国/類団）を出す（＝判別キー）。
   */
  cityName?: string;
  /** muni版の全国平均（単位「人」）。未収集は null。cityName 指定時のみ使用 */
  nationalAverage?: number | null;
  /** muni版の類似団体平均（単位「人」）。未収集は null。cityName 指定時のみ使用 */
  similarAverage?: number | null;
  /**
   * 県版（pref-card-registry）の既存比較（順位・平均テキスト）。cityName 未指定時のみ使用。
   * 県版のモック準拠再現は別タスク（県モック未反映）。ここでは従来表示を保持して回帰を防ぐ。
   */
  comparison?: ComparisonNoteProps;
}

/**
 * 議員定数カード（議会のすがた §0.10 3-2）。design/mock「議会のすがた.html」準拠。
 * - KPIトリオ：条例定数／現員／欠員（欠員＝定数−現員をカード内で算出）。
 * - muni（cityName あり）：「条例定数の比較」を compare-row で描画。自団体は実バー、
 *   全国平均・類似団体平均は未収集のためバーを描かず「データ未整備」と明示する
 *   （仮値を置かない・上位制約①・欠損規律）。バー長は表示可能な値の最大＝100%で正規化。
 *   平均は number|null props で受け、収集後は registry 側の値差し替えのみで足りる。
 * - 県（cityName なし）：従来の ComparisonNote（順位・全国平均テキスト）を保持。県モックの
 *   反映は別タスクのため、ここでは既存表示を温存して回帰を防ぐ。
 * バー・凡例の色は識別用で、多寡・順位に評価色を付けない（D-4/D-6/D-18）。
 */
export function CouncilSeatsCard({
  teisu,
  genin,
  cityName,
  nationalAverage,
  similarAverage,
  comparison,
}: CouncilSeatsCardProps) {
  const vacancy = teisu - genin;

  const kpis: { label: string; value: number }[] = [
    { label: "条例定数", value: teisu },
    { label: "現員", value: genin },
    { label: "欠員", value: vacancy },
  ];

  return (
    <div className="flex flex-col">
      <dl className="grid grid-cols-3 gap-2.5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[9px] bg-[var(--panel)] px-1.5 pb-3 pt-3.5 text-center">
            <dt className="fs-label text-[var(--muted)]">{k.label}</dt>
            <dd className="mt-2 text-[var(--body)]">
              <span className="fs-key font-bold leading-none">{k.value}</span>
              <span className="ml-1 fs-sub text-[var(--muted)]">人</span>
            </dd>
          </div>
        ))}
      </dl>

      {cityName != null ? (
        <MunicipalityCompare
          cityName={cityName}
          teisu={teisu}
          nationalAverage={nationalAverage ?? null}
          similarAverage={similarAverage ?? null}
        />
      ) : comparison ? (
        <ComparisonNote {...comparison} />
      ) : null}
    </div>
  );
}

/** muni版の「条例定数の比較」（compare-row）。自団体は実バー、未収集の平均は「データ未整備」表記。 */
function MunicipalityCompare({
  cityName,
  teisu,
  nationalAverage,
  similarAverage,
}: {
  cityName: string;
  teisu: number;
  nationalAverage: number | null;
  similarAverage: number | null;
}) {
  const compareRows: { label: string; value: number | null; color: string }[] = [
    { label: cityName, value: teisu, color: "var(--current)" },
    { label: "全国平均", value: nationalAverage, color: "var(--national)" },
    { label: "類似団体平均", value: similarAverage, color: "var(--similar)" },
  ];

  // 表示可能な値の最大を 100% とする（自団体は常に存在するため最低1件）
  const maxValue = Math.max(
    ...compareRows.map((r) => r.value).filter((v): v is number => v !== null),
    1,
  );

  const rowCls =
    "grid grid-cols-[104px_minmax(0,1fr)_64px] items-center gap-2 min-h-[29px] fs-sub sm:grid-cols-[108px_minmax(0,1fr)_64px]";

  return (
    <>
      <p className="mt-4 fs-label font-extrabold text-[var(--muted)]">条例定数の比較</p>
      <div className="mt-2 flex flex-col gap-1">
        {compareRows.map((r) => {
          if (r.value === null) {
            return (
              <div key={r.label} className={rowCls}>
                <span className="break-words leading-tight text-[var(--body)]">{r.label}</span>
                <span className="col-span-2 text-right text-[var(--muted-light)]">データ未整備</span>
              </div>
            );
          }
          const barPct = Math.max(0, Math.min(100, (r.value / maxValue) * 100));
          return (
            <div key={r.label} className={rowCls}>
              <span className="break-words leading-tight text-[var(--body)]">{r.label}</span>
              <span aria-hidden className="h-[17px] overflow-hidden rounded-[5px] bg-[var(--track)]">
                <span
                  className="block h-full"
                  style={{ width: `${barPct}%`, backgroundColor: r.color, borderRadius: "inherit" }}
                />
              </span>
              <span className="whitespace-nowrap text-right text-[var(--body)]">{r.value}人</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 fs-note text-[var(--muted-light)]">色は識別のために使用</p>
    </>
  );
}
