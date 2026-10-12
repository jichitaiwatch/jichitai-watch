import type { ReactNode } from "react";
import Link from "next/link";
import { MetricCard } from "./MetricCard";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import type { MunicipalityConfig } from "@/lib/municipalities";
import { isStale, shouldSuppressComparison } from "@/lib/staleness";
import { findUnderReview } from "@/lib/under-review";
import {
  cardsForTab,
  resolveSourceLabel as defaultResolveSourceLabel,
  type IaTab,
  type CardDefinition,
} from "@/lib/card-registry";

interface MunicipalityDashboardProps<E = MunicipalityConfig> {
  municipality: E;
  tab: IaTab;
  tabLabel: string;
  cardsForTabFn?: (tab: IaTab) => CardDefinition<unknown, E>[];
  resolveSourceLabelFn?: (def: CardDefinition<unknown, E>, entity: E) => string;
  displayName?: string;
  backHref?: string;
  identityColor?: string;
  /** パンくず（ui-vi §2.5）。呼び出し側が団体種別（県庁／市区町村）に応じて組み立てて渡す。 */
  breadcrumb?: BreadcrumbItem[];
}

function DataPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[88px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--line)] bg-[var(--identity-soft)]/40 px-3 py-6 text-center sm:min-h-[120px] sm:gap-1.5">
      <span className="fs-label font-semibold text-[var(--muted)]">データ未整備</span>
      <span className="fs-note text-[var(--muted-light)]">{label}のデータは現在準備中です</span>
    </div>
  );
}

function EmptyTabPlaceholder() {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center fs-label text-[var(--muted)] sm:mt-8">
      この区分の情報は現在準備中です
    </div>
  );
}

// 団体コード：市区町村＝areaCode（6桁）、県＝prefCode（2桁）。「確認中」の一覧（lib/under-review.ts）の照合に使う。
function areaCodeOf(entity: unknown): string | undefined {
  const e = entity as { areaCode?: string; prefCode?: string };
  return e.areaCode ?? e.prefCode;
}

export function MunicipalityDashboard<E = MunicipalityConfig>({
  municipality,
  tab,
  tabLabel,
  cardsForTabFn,
  resolveSourceLabelFn,
  displayName,
  backHref,
  identityColor,
  breadcrumb,
}: MunicipalityDashboardProps<E>) {
  const resolveCards =
    cardsForTabFn ?? (cardsForTab as unknown as (tab: IaTab) => CardDefinition<unknown, E>[]);
  const resolveLabel =
    resolveSourceLabelFn ??
    (defaultResolveSourceLabel as unknown as (def: CardDefinition<unknown, E>, entity: E) => string);
  const cards = resolveCards(tab);

  // 市区町村版の既存挙動フォールバック。都道府県呼び出しは displayName・backHref を
  // 必ず明示的に渡すため、この cast の中身（cityName/prefSlug/slug）が実行時に参照されるのは
  // 市区町村パス（既存呼び出し）のみ。trendsCategory は都道府県カードに一つも設定されない
  // （V1に経年画面なし）ため、経年リンク分岐も pref 呼び出しでは発火しない。
  const muni = municipality as unknown as MunicipalityConfig;
  const resolvedDisplayName = displayName ?? muni.cityName;
  const resolvedBackHref = backHref ?? `/${muni.prefSlug}/${muni.slug}`;
  // identityColor 明示時（都道府県）はその色を、未指定時（市区町村）は VI トークン --identity を使う。
  const identity = identityColor ?? "var(--identity)";
  const identityStyle = { color: identity };

  const renderCard = (def: CardDefinition<unknown, E>) => {
    const data = def.resolve(municipality);
    const source = resolveLabel(def, municipality);
    // A-5：比較値・経年集計の表示停止判定（A-4のisStaleより厳しい閾値）。
    const suppressComparison = data ? shouldSuppressComparison(data.meta.fetchedAt, def.updateFrequency) : false;
    const chart: ReactNode = data ? (
      def.renderVisualization(data, municipality, suppressComparison)
    ) : (
      <DataPlaceholder label={def.title} />
    );
    const visualization: ReactNode =
      data && def.trendsCategory ? (
        <div className="flex h-full flex-col">
          <div className="flex-1">{chart}</div>
          <Link
            href={`/${muni.prefSlug}/${muni.slug}/trends/${def.trendsCategory}`}
            className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 fs-sub font-medium hover:bg-[var(--identity-soft)]"
            style={{ color: identity, borderColor: `color-mix(in srgb, ${identity} 30%, transparent)` }}
          >
            推移を見る →
          </Link>
        </div>
      ) : (
        chart
      );
    return (
      <div key={def.id} className="min-w-0">
        <MetricCard
          title={def.title}
          updateFrequency={def.updateFrequency}
          iconId={def.iconId}
          source={source}
          sourceUrl={data?.meta.sourceUrl}
          updatedDate={data ? data.meta.updated : "-"}
          periodLabel={data?.meta.periodLabel}
          fetchedDate={data?.meta.fetchedAt}
          stale={data ? isStale(data.meta.fetchedAt, def.updateFrequency) : false}
          underReview={findUnderReview(def.id, areaCodeOf(municipality))}
          note={data ? def.note : undefined}
        >
          {visualization}
        </MetricCard>
      </div>
    );
  };
  const compactCards = cards.filter((d) => d.gridSize === "compact");
  const standardCards = cards.filter((d) => d.gridSize !== "compact");

  return (
    <main id="main" tabIndex={-1} className={`focus:outline-none min-h-screen bg-[var(--page)] px-3 py-6 sm:px-8 sm:py-10 type-large`}>
      {/* レイアウト（2026-09-14）: スマホ=1列／PC(lg≥1024px)=2列。compact指定のカード（人口/世帯/
          単身高齢のトリオ）のみ別グリッドで3列。実績のある grid-cols-1/2/3 のみ使用（旧実装の
          lg:grid-cols-6 + col-span は生成されず1列化したため撤去）。 */}
      <div className="mx-auto max-w-6xl">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        <Link
          href={resolvedBackHref}
          className={`inline-block py-1.5 fs-back hover:underline ${breadcrumb ? "mt-1" : ""}`}
          style={identityStyle}
        >
          ← {resolvedDisplayName}の入口に戻る
        </Link>

        <p className="mt-3 text-sm font-medium" style={identityStyle}>
          {resolvedDisplayName}
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl" style={identityStyle}>
          {tabLabel}
        </h1>

        {cards.length === 0 ? (
          <EmptyTabPlaceholder />
        ) : (
          <div className="mt-6 flex flex-col gap-4 sm:mt-8">
            {compactCards.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {compactCards.map(renderCard)}
              </div>
            )}
            {standardCards.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {standardCards.map(renderCard)}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
