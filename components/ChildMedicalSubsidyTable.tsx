import type { ReactNode } from "react";
import type { KodomoDistribution } from "@/lib/metrics";

interface ChildMedicalSubsidyTableProps {
  ageOutpatient: string;
  ageInpatient: string;
  incomeLimitOutpatient: "有" | "無";
  incomeLimitInpatient: "有" | "無";
  copayOutpatient: "有" | "無";
  copayInpatient: "有" | "無";
  /** 県内・全国の団体数（事実の件数。順位・評価なし） */
  distribution?: KodomoDistribution;
  /** 原表の「※」の団体＝18歳年度末以降は学生医療として実施（事実の注記） */
  studentMedical?: boolean;
}

/** 「15歳年度末」のような機械抽出データ表記を「15歳の年度末まで」に補って読みやすくする */
function formatAge(age: string): ReactNode {
  const m = age.match(/^(\d+)歳年度末$/);
  if (!m) return age;
  return (
    <>
      <span className="whitespace-nowrap">{m[1]}歳の</span>
      <wbr />
      <span className="whitespace-nowrap">年度末まで</span>
    </>
  );
}

/**
 * M1（子ども医療費助成）の可視化層。design/mock「くらし.html」準拠。
 * 通院／入院を2パネルで並べ、各パネルに対象年齢（大）＋所得制限・一部自己負担の有無を示す。
 * 「有／無」は事実の記載であり評価色を付けない（D-4/D-6/D-18）。
 */
export function ChildMedicalSubsidyTable({
  ageOutpatient,
  ageInpatient,
  incomeLimitOutpatient,
  incomeLimitInpatient,
  copayOutpatient,
  copayInpatient,
  distribution,
  studentMedical,
}: ChildMedicalSubsidyTableProps) {
  const panels = [
    {
      label: "通院",
      age: ageOutpatient,
      incomeLimit: incomeLimitOutpatient,
      copay: copayOutpatient,
    },
    {
      label: "入院",
      age: ageInpatient,
      incomeLimit: incomeLimitInpatient,
      copay: copayInpatient,
    },
  ] as const;

  const fmt = (n: number) => n.toLocaleString("ja-JP");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {panels.map((p) => (
          <section
            key={p.label}
            className="min-w-0 overflow-hidden rounded-[9px] border border-[#dce6e1] bg-[#fbfcfb]"
          >
            <h3 className="m-0 bg-[#edf5f1] px-2.5 py-[7px] fs-label font-extrabold text-[var(--identity)]">
              {p.label}
            </h3>
            <div className="px-2.5 pb-2.5 pt-3.5 text-center">
              <small className="mb-1 block fs-label text-[var(--muted)]">
                対象年齢
              </small>
              <strong className="block fs-key font-bold leading-[1.1] text-[#17372c]">
                {formatAge(p.age)}
              </strong>
            </div>
            <dl className="mx-2.5 mb-2.5 grid border-t border-[var(--line-soft)] fs-label">
              <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-0.5 py-[9px]">
                <dt className="text-[var(--muted)]">所得制限</dt>
                <dd className="fs-label text-[var(--body)]">{p.incomeLimit}</dd>
              </div>
              <div className="flex items-center justify-between px-0.5 py-[9px]">
                <dt className="text-[var(--muted)]">一部自己負担</dt>
                <dd className="fs-label text-[var(--body)]">{p.copay}</dd>
              </div>
            </dl>
            {distribution && (
              <div className="mx-2.5 mb-2.5 border-t border-[var(--line-soft)] pt-2 fs-sub text-[var(--muted)]">
                <p className="m-0 mb-1">
                  対象年齢ごとの団体数（県内{distribution.prefTotal}／全国
                  {fmt(distribution.nationalTotal)}）
                </p>
                <ul className="m-0 grid list-none gap-0.5 p-0">
                  {distribution.age[p.label].map((a) => (
                    <li
                      key={a.label}
                      className="flex justify-between gap-1 text-[var(--body)]"
                    >
                      <span>{a.label}</span>
                      <span className="whitespace-nowrap">
                        {fmt(a.pref)}／{fmt(a.national)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
      {studentMedical ? (
        // 「※」の団体だけ注記を足す。それ以外は従来と同じ子要素のまま（岐阜の出力を変えない）
        <>
          <p className="m-0 fs-note text-stone-600">
            ※ 18歳年度末以降は学生医療として実施しており、対象は大学等に通う者に限る。（一定の所得制限あり。）
          </p>
          {distribution && <PolicyNote d={distribution} />}
        </>
      ) : (
        distribution && <PolicyNote d={distribution} />
      )}
    </div>
  );
}

/** 所得制限・一部自己負担の「有」の団体数（県内・全国）。県内が全団体で同じなら、そのことを事実として記す */
function PolicyNote({ d }: { d: KodomoDistribution }) {
  const fmt = (n: number) => n.toLocaleString("ja-JP");
  const prefYes =
    d.incomeYes.通院.pref +
    d.incomeYes.入院.pref +
    d.copayYes.通院.pref +
    d.copayYes.入院.pref;
  const lead =
    prefYes === 0
      ? `県内${d.prefTotal}市町村は、すべて所得制限・一部自己負担とも「無」です。`
      : `県内${d.prefTotal}市町村の所得制限・一部自己負担の「有」の団体数は次のとおりです。`;
  const nationalLine = (
    <p className="m-0">
      全国{fmt(d.nationalTotal)}市区町村で「有」の団体数：所得制限は通院
      {fmt(d.incomeYes.通院.national)}・入院
      {fmt(d.incomeYes.入院.national)}、一部自己負担は通院
      {fmt(d.copayYes.通院.national)}・入院
      {fmt(d.copayYes.入院.national)}。
    </p>
  );
  const unitLine = (
    <p className="m-0">
      各数字は「県内の団体数／全国の団体数」。団体数であり、優劣を示すものではありません。
    </p>
  );
  // 県内に「有」の団体があるときだけ、県内の団体数も併記する（無いときは従来と同じ表示）
  return prefYes > 0 ? (
    <div className="fs-note text-stone-600">
      <p className="m-0">{lead}</p>
      <p className="m-0">
        「有」の団体数（県内／全国）：所得制限は通院
        {fmt(d.incomeYes.通院.pref)}／{fmt(d.incomeYes.通院.national)}・入院
        {fmt(d.incomeYes.入院.pref)}／{fmt(d.incomeYes.入院.national)}、一部自己負担は通院
        {fmt(d.copayYes.通院.pref)}／{fmt(d.copayYes.通院.national)}・入院
        {fmt(d.copayYes.入院.pref)}／{fmt(d.copayYes.入院.national)}。
      </p>
      {nationalLine}
      {unitLine}
    </div>
  ) : (
    <div className="fs-note text-stone-600">
      <p className="m-0">{lead}</p>
      {nationalLine}
      {unitLine}
    </div>
  );
}
