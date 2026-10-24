import { LOCALE } from "@/lib/locale";
import type { ReactNode } from "react";
import type { KodomoDistribution } from "@/lib/metrics";
import { t, tf } from "@/lib/i18n";

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

const EN_AGE_STYLE = { fontSize: "0.85em" } as const;

/**
 * 年齢ごとの団体数の一覧の年齢（データの「18歳年度末」「上記以外」）。日本語版はそのまま、英語版は辞書で引く。
 * 知らない形はビルドを止める（訳し漏れを出さない）
 */
function ageListLabel(label: string): string {
  if (LOCALE === "ja") return label;
  const m = label.match(/^(\d+)歳年度末$/);
  if (m) return tf("p-cm-age-list", { n: m[1] });
  if (label === "上記以外") return t("cm-age-other");
  throw new Error(`[i18n] 子ども医療費の年齢の区分に英語が無い：${label}`);
}

/** 「15歳年度末」のような機械抽出データ表記を「15歳の年度末まで」に補って読みやすくする */
function formatAge(age: string): ReactNode {
  const m = age.match(/^(\d+)歳年度末$/);
  if (!m) return age;
  return (
    <>
      {/* 英語の「Up to age 24」は日本語より幅を取り、スマホ幅の2列ではみ出すので、英語だけ字を少し小さくする */}
      <span className="whitespace-nowrap" style={LOCALE === "en" ? EN_AGE_STYLE : undefined}>{tf("p-cm-age-1", { n: m[1] })}</span>
      <wbr />
      {/* 英語は「(until the end of that fiscal year)」が長く1行に収まらないので、折り返してよい形にする（日本語版は従来どおり） */}
      <span className={LOCALE === "en" ? undefined : "whitespace-nowrap"}>{t("cm-age-2")}</span>
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
      key: "通院",
      label: t("cm-outpatient"),
      age: ageOutpatient,
      incomeLimit: incomeLimitOutpatient,
      copay: copayOutpatient,
    },
    {
      key: "入院",
      label: t("cm-inpatient"),
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
            key={p.key}
            className="min-w-0 overflow-hidden rounded-[9px] border border-[#dce6e1] bg-[#fbfcfb]"
          >
            <h3 className="m-0 bg-[#edf5f1] px-2.5 py-[7px] fs-label font-extrabold text-[var(--identity)]">
              {p.label}
            </h3>
            <div className="px-2.5 pb-2.5 pt-3.5 text-center">
              <small className="mb-1 block fs-label text-[var(--muted)]">
                {t("cm-age")}
              </small>
              <strong className="block fs-key font-bold leading-[1.1] text-[#17372c]">
                {formatAge(p.age)}
              </strong>
            </div>
            <dl className="mx-2.5 mb-2.5 grid border-t border-[var(--line-soft)] fs-label">
              <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-0.5 py-[9px]">
                <dt className="text-[var(--muted)]">{t("cm-income-limit")}</dt>
                <dd className="fs-label text-[var(--body)]">{p.incomeLimit === "有" ? t("val-yes") : t("val-no")}</dd>
              </div>
              <div className="flex items-center justify-between px-0.5 py-[9px]">
                <dt className="text-[var(--muted)]">{t("cm-copay")}</dt>
                <dd className="fs-label text-[var(--body)]">{p.copay === "有" ? t("val-yes") : t("val-no")}</dd>
              </div>
            </dl>
            {distribution && (
              <div className="mx-2.5 mb-2.5 border-t border-[var(--line-soft)] pt-2 fs-sub text-[var(--muted)]">
                <p className="m-0 mb-1">
                  {tf("p-cm-dist", { pref: `${distribution.prefTotal}`, national: fmt(distribution.nationalTotal) })}
                </p>
                <ul className="m-0 grid list-none gap-0.5 p-0">
                  {distribution.age[p.key].map((a) => (
                    <li
                      key={a.label}
                      className="flex justify-between gap-1 text-[var(--body)]"
                    >
                      <span>{ageListLabel(a.label)}</span>
                      <span className="whitespace-nowrap">
                        {tf("p-cm-pair", { pref: fmt(a.pref), national: fmt(a.national) })}
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
            {t("cm-student-note")}
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
      ? tf("p-cm-lead-none", { n: `${d.prefTotal}` })
      : tf("p-cm-lead-some", { n: `${d.prefTotal}` });
  const nationalLine = (
    <p className="m-0">
      {tf("p-cm-national", {
        total: fmt(d.nationalTotal),
        io: fmt(d.incomeYes.通院.national),
        ii: fmt(d.incomeYes.入院.national),
        co: fmt(d.copayYes.通院.national),
        ci: fmt(d.copayYes.入院.national),
      })}
    </p>
  );
  const unitLine = (
    <p className="m-0">
      {t("cm-unit-line")}
    </p>
  );
  // 県内に「有」の団体があるときだけ、県内の団体数も併記する（無いときは従来と同じ表示）
  return prefYes > 0 ? (
    <div className="fs-note text-stone-600">
      <p className="m-0">{lead}</p>
      <p className="m-0">
        {tf("p-cm-pref-national", {
          iop: fmt(d.incomeYes.通院.pref),
          ion: fmt(d.incomeYes.通院.national),
          iip: fmt(d.incomeYes.入院.pref),
          iin: fmt(d.incomeYes.入院.national),
          cop: fmt(d.copayYes.通院.pref),
          con: fmt(d.copayYes.通院.national),
          cip: fmt(d.copayYes.入院.pref),
          cin: fmt(d.copayYes.入院.national),
        })}
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
