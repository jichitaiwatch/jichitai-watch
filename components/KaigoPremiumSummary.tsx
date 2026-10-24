import { prefLabel } from "@/lib/place-names";
import { LOCALE } from "@/lib/locale";
import { yenAmount } from "@/lib/format-units";
import type { KaigoAverageBlock } from "@/lib/metrics";
import { MARKER_FLIP_PCT, markerBlockStyle } from "./ExpenditureBarChart";
import { toFixedHalfUp } from "@/lib/format-decimal";
import { t, tf } from "@/lib/i18n";

interface KaigoPremiumSummaryProps {
  /** 当該自治体名（バーのラベル・広域連合時のeyebrowに使う） */
  cityName: string;
  /** 保険者名（＝データの市区町村名。広域連合の場合は広域連合名） */
  insurerName: string;
  premiumCurrent: number;
  premiumPrevious: number;
  growthRate: number;
  certificationRate: number;
  /** 全国平均（データセットが未整備の場合はnull） */
  nationalAverage: KaigoAverageBlock | null;
  /** 都道府県内平均（データセットが未整備の場合はnull） */
  prefectureAverage: (KaigoAverageBlock & { prefecture: string }) | null;
}

/** "official"＝厚労省公表値。それ以外（単純平均）は注記を付す */
function averageSuffix(source: "official" | "unweighted_mean"): string {
  return source === "official" ? "" : t("kp-simple-avg");
}

/** グラフの印に付ける単純平均の目印（日本語「（単純平均）」・英語「*」。英語はスマホ幅で印の文字が枠に収まらないため略す） */
function averageMark(source: "official" | "unweighted_mean"): string {
  return source === "official" ? "" : t("kp-simple-avg-mark");
}

/**
 * 県平均の印の文字。日本語版は「▲ 岐阜県平均 5,854円（単純平均）」（従来どおり）。
 * 英語版は県名を入れず「▲ Pref avg ¥5,854*」と略す（2026-10-23 運営者裁定。県名と単純平均の意味は読み上げ用の文と注記に残る）。
 */
function prefMarkerText(flip: boolean, prefName: string, amount: string, mark: string): string {
  if (LOCALE === "en") return tf(flip ? "p-ex-pref-avg-r" : "p-ex-pref-avg-l", { amount: `${amount}${mark}` });
  return tf(flip ? "p-kp-pref-r" : "p-kp-pref-l", { pref: prefName, amount, suffix: mark });
}

function clampPct(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.min(100, Math.max(0, x));
}

/**
 * M2（介護保険料 基準額）の可視化層。design/mock「くらし.html」準拠。
 *
 * - 保険者パネルは保険者が広域連合のときだけ表示する（eyebrow「広域連合所属｜自治体名」＋保険者名＋
 *   「複数自治体が同一の基準額を共有します」）。単独市町村では出さない（保険者＝自治体名で自明のため）。
 * - 第9期月額（大）＋第8期比。当該自治体の基準額バーに全国平均(▼)・県内平均(▲)をマーカーで重ねる。
 *   マーカーは三角+ラベル+金額を1要素にまとめ、位置pct%をアンカーに左右へ振り分ける
 *   （ExpenditureBarChart.tsx の markerBlockStyle/MARKER_FLIP_PCT を共有・2026-09-27運営者指摘で統一）。
 * - 要介護認定率は補完として小さく残す（実データ。モックでは省略されているが情報を捨てない）。
 * - 平均は識別マーカーであり優劣評価ではない（D-4/D-6/D-18）。単純平均は「（単純平均）」と明示し、
 *   厚労省公表値と混同させない（欠損・出所規律）。
 */
export function KaigoPremiumSummary({
  cityName,
  insurerName,
  premiumCurrent,
  premiumPrevious,
  growthRate,
  certificationRate,
  nationalAverage,
  prefectureAverage,
}: KaigoPremiumSummaryProps) {
  const isWideArea = insurerName.includes("広域連合");
  const growthLabel =
    growthRate === 0 ? "±0%" : `${growthRate > 0 ? "+" : ""}${toFixedHalfUp(growthRate, 2)}%`;
  const diff = premiumCurrent - premiumPrevious;
  const diffLabel = `${tf("p-kp-prev", { amount: premiumPrevious.toLocaleString() })}${
    diff !== 0 ? tf("p-kp-diff", { sign: diff > 0 ? "+" : "", d: diff.toLocaleString() }) : ""
  }`;

  // 画面に出す県名（英語版は Gifu Prefecture など。lib/place-names.ts）。県内平均が無いときは使わない
  const prefName = prefectureAverage ? prefLabel(prefectureAverage.prefecture) : "県";
  const hasAverages = Boolean(nationalAverage || prefectureAverage);

  // バー正規化：自治体・全国・県内の最大に少し余白を足した値を上限にする
  const scaleMax =
    Math.max(
      premiumCurrent,
      nationalAverage?.premium_9th_yen ?? 0,
      prefectureAverage?.premium_9th_yen ?? 0,
    ) * 1.08 || 1;
  const currentPct = clampPct((premiumCurrent / scaleMax) * 100);
  const nationalPct =
    nationalAverage !== null ? clampPct((nationalAverage.premium_9th_yen / scaleMax) * 100) : null;
  const prefPct =
    prefectureAverage !== null
      ? clampPct((prefectureAverage.premium_9th_yen / scaleMax) * 100)
      : null;

  const certSuffix = prefectureAverage
    ? averageSuffix(prefectureAverage.certification_rate_source)
    : nationalAverage
      ? averageSuffix(nationalAverage.certification_rate_source)
      : "";

  const hasUnweighted = [
    nationalAverage?.premium_average_source,
    nationalAverage?.certification_rate_source,
    prefectureAverage?.premium_average_source,
    prefectureAverage?.certification_rate_source,
  ].includes("unweighted_mean");

  return (
    <div className="flex h-full flex-col gap-3 text-[var(--body)]">
      {isWideArea && (
        <div>
          <p className="mb-2.5 fs-label font-extrabold tracking-[0.035em] text-[#315849]">
            {t("kp-wide-area-member")}{cityName}
          </p>
          <div className="rounded-[8px] border border-[#dbe6e1] bg-[#f6f9f7] px-2.5 py-2 fs-label text-[#315849]">
            <span>{t("kp-insurer")}</span>
            {/* 保険者（広域連合）の名前は団体の名前なので、英語版でも訳さず日本語のまま出す（2026-10-24 運営者承認） */}
            <b className="mt-[3px] block fs-label text-[var(--identity)]">{LOCALE === "en" ? <span lang="ja">{insurerName}</span> : insurerName}</b>
            <p className="mt-[5px] fs-label leading-[1.45] text-[#66756f]">
              {t("kp-shared")}
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="mx-px mb-3 flex items-end justify-between gap-2.5">
          <div>
            <small className="block fs-label text-[var(--muted)]">{t("kp-current")}</small>
            <strong className="block text-[36px] leading-[1.05] tracking-[-0.03em] text-[#17372c] sm:text-[38px]">
              {yenAmount(premiumCurrent)}
              {t("u-yen") && <em className="ml-1 fs-label not-italic tracking-normal">{t("u-yen")}</em>}
            </strong>
          </div>
          <div className="rounded-[7px] bg-[#eef3f1] px-[9px] py-[7px] text-right">
            <small className="block fs-label text-[var(--muted)]">{t("kp-vs-prev")}</small>
            <b className="fs-label text-[#203e34]">{growthLabel}</b>
          </div>
        </div>
        <p className="fs-label text-[var(--muted-light)]">{diffLabel}</p>
      </div>

      {hasAverages && (
        <div className="border-t border-[var(--line-soft)] pt-[11px]">
          <div className="mb-[3px] flex items-baseline justify-between gap-2 fs-key">
            <span className="font-medium text-[var(--body)]">{cityName}</span>
            <span className="font-semibold text-[var(--identity)]">{tf("p-yen", { amount: yenAmount(premiumCurrent) })}</span>
          </div>
          <div aria-hidden className="relative mx-1 mt-5 mb-5 h-[9px]">
            <span className="absolute inset-0 rounded-full bg-[#dcefe8]" />
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${currentPct}%`, background: "linear-gradient(90deg,#087858,#00684a)" }}
            />
            {nationalPct !== null && nationalAverage && (
              <span
                className="pointer-events-none absolute bottom-full mb-1 whitespace-nowrap fs-sub font-normal leading-none text-[var(--national-text)]"
                style={markerBlockStyle(nationalPct)}
              >
                {nationalPct > MARKER_FLIP_PCT
                  ? tf("p-kp-nat-r", { amount: tf("p-yen", { amount: yenAmount(nationalAverage.premium_9th_yen) }), suffix: averageMark(nationalAverage.premium_average_source) })
                  : tf("p-kp-nat-l", { amount: tf("p-yen", { amount: yenAmount(nationalAverage.premium_9th_yen) }), suffix: averageMark(nationalAverage.premium_average_source) })}
              </span>
            )}
            {prefPct !== null && prefectureAverage && (
              <span
                className="pointer-events-none absolute top-full mt-1 whitespace-nowrap fs-sub font-normal leading-none text-[var(--prefecture)]"
                style={markerBlockStyle(prefPct)}
              >
                {prefMarkerText(
                  prefPct > MARKER_FLIP_PCT,
                  prefName,
                  tf("p-yen", { amount: yenAmount(prefectureAverage.premium_9th_yen) }),
                  averageMark(prefectureAverage.premium_average_source),
                )}
              </span>
            )}
          </div>
          {/* 視覚マーカーはaria-hiddenのため、数値情報はsr-onlyで別途保持する（ExpenditureBarChartのsr-only表と同趣旨） */}
          <div className="sr-only">
            {nationalAverage && (
              <span>
                {tf("p-kp-nat-sr", { amount: tf("p-yen", { amount: yenAmount(nationalAverage.premium_9th_yen) }), suffix: averageSuffix(nationalAverage.premium_average_source) })}
              </span>
            )}
            {prefectureAverage && (
              <span>
                {tf("p-kp-pref-sr", { pref: prefName, amount: tf("p-yen", { amount: yenAmount(prefectureAverage.premium_9th_yen) }), suffix: averageSuffix(prefectureAverage.premium_average_source) })}
              </span>
            )}
          </div>
        </div>
      )}

      <p className="fs-label text-[var(--muted)]">
        {tf("p-kp-cert", { rate: toFixedHalfUp(certificationRate, 2) })}
        {(nationalAverage || prefectureAverage) && (
          // sm未満（スマホ幅）は改行して2行目とし、2行目自体は折り返さない1行にする。sm以上（PC）は
          // 同一行のまま（2026-09-28運営者指摘：外側の括弧は（）と）が連続して読みにくいため【】に変更、
          // 内側の「（単純平均）」は従来どおり（）を維持）。
          <span className="block text-[var(--muted-light)] sm:inline">
            {t("ui-bracket-open")}
            {nationalAverage && tf("p-kp-cert-nat", { rate: toFixedHalfUp(nationalAverage.certification_rate_pct, 2) })}
            {nationalAverage && prefectureAverage && t("ui-list-sep")}
            {prefectureAverage &&
              tf("p-kp-cert-pref", { pref: prefName, rate: toFixedHalfUp(prefectureAverage.certification_rate_pct, 2) })}
            {certSuffix}{t("ui-bracket-close")}
          </span>
        )}
      </p>

      {hasUnweighted && (
        <p className="mt-auto rounded-[6px] border border-[#e0e7e3] bg-[#fbfcfb] px-[9px] py-[7px] fs-source leading-[1.5] text-[#566660]">
          {t("kp-unweighted-note")}
        </p>
      )}
    </div>
  );
}
