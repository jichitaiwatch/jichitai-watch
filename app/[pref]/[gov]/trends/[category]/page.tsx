import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import Link from "@/components/SiteLink";
import { notFound } from "next/navigation";
import { MUNICIPALITIES, getMunicipalityBySlug } from "@/lib/municipalities";
import { getTrendsCard, getTrendsCategory, listTrendsCategories } from "@/lib/card-registry";
import { shouldSuppressComparison } from "@/lib/staleness";
import { SITE_NAME, govPath, pageMeta, pageTitleIn } from "@/lib/site";
import { t, tf } from "@/lib/i18n";

type PageParams = { pref: string; gov: string; category: string };

/**
 * 経年画面のURLは市町村ページ直下にネスト（ui-vi-handoff §5.3・[tab] 配下ではない）。
 * 生成対象＝(全市区町村 × trendsCategory 設定済みカテゴリ)。カテゴリ一覧・描画は
 * card-registry が唯一の源（§5.6.3・§0.8.3）。cardKey ごとの chart/出典/note/lead は
 * カード定義の trends（getTrendsCard）に集約し、本ページは分岐を持たず委譲する（#11.1 直書き負債の解消）。
 * 経年は市区町村専用（県V1に経年画面なし）。gov には県庁スラッグを含めない。output:'export'（D-10）。
 */
export function generateStaticParams() {
  const cats = listTrendsCategories();
  return MUNICIPALITIES.flatMap((m) =>
    cats.map((c) => ({ pref: m.prefSlug, gov: m.slug, category: c.category })),
  );
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { pref, gov, category } = await params;
  const municipality = getMunicipalityBySlug(gov, pref);
  const cat = getTrendsCategory(category);
  if (!municipality || !cat) return { title: SITE_NAME }; // dynamicParams=false のため到達しない
  return pageMeta({
    title: pageTitleIn(tf("p-trends", { card: cat.cardTitle }), municipality.label),
    description: tf("p-desc-trends", { name: municipality.label, card: cat.cardTitle }),
    path: `${govPath(municipality.prefSlug, municipality.slug)}/trends/${category}`,
  });
}

export default async function TrendsPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { pref, gov, category } = await params;
  const municipality = getMunicipalityBySlug(gov, pref);
  const cat = getTrendsCategory(category);
  const card = getTrendsCard(category);
  if (!municipality || !cat || !card || !card.trends) {
    notFound();
  }

  // 呼び出しをまたぐネスト参照の narrowing 解除を避けるため、確定した trends を局所へ捕捉
  const trends = card.trends;
  const rendered = trends.render(municipality);
  if (!rendered) {
    notFound();
  }

  // A-5：経年集計の表示停止判定（gate4-staleness-correction-spec.md A-5「経年集計の表示を停止」）。
  // 単年カードのresolve()と同じmeta.fetchedAt・updateFrequencyを流用し、単年画面（A-4/A-5）と
  // 判定基準を揃える。停止時も出典・データ更新日は表示を続ける（停止するのはチャートのみ）。
  const cardData = card.resolve(municipality);
  const suppressTrends = cardData
    ? shouldSuppressComparison(cardData.meta.fetchedAt, card.updateFrequency)
    : false;

  return (
    <main id="main" tabIndex={-1} className="focus:outline-none min-h-screen bg-stone-100 px-3 py-6 sm:px-8 sm:py-10 type-large">
      <div className="mx-auto max-w-5xl">
        {/* パンくず（§0.8.4）: 日本＞県＞市＞入口名＞カテゴリ名 */}
        {/* 各段リンク（ui-vi §2.5・C-2 N-3：従来は文字のみで <a> 0件） */}
        <Breadcrumb
          items={[
            { label: t("crumb-japan"), href: "/" },
            { label: municipality.prefectureLabel, href: `/${municipality.prefSlug}` },
            { label: municipality.label, href: `/${municipality.prefSlug}/${municipality.slug}` },
            { label: cat.tabLabel, href: `/${municipality.prefSlug}/${municipality.slug}/${cat.tab}` },
            { label: tf("p-trends", { card: cat.cardTitle }) },
          ]}
        />

        {/* 戻り先＝当該入口の情報画面（§0.8.4） */}
        <Link
          href={`/${municipality.prefSlug}/${municipality.slug}/${cat.tab}`}
          className="mt-1 inline-block py-1.5 fs-back text-teal-700 hover:underline"
        >
          {tf("p-back-to-tab", { tab: cat.tabLabel })}
        </Link>

        <h1 className="mt-2 text-xl font-bold text-teal-950 sm:text-2xl">
          {tf("p-trends-h1", { city: municipality.label, card: cat.cardTitle })}
        </h1>
        <p className="mt-1 fs-label text-stone-600">{trends.lead}</p>

        <section className="mt-5 overflow-hidden rounded-xl border border-teal-900/10 bg-white p-3 shadow-sm sm:p-6">
          {suppressTrends ? (
            <p className="fs-label text-stone-600">
              {t("tr-suppressed")}
            </p>
          ) : (
            rendered.chart
          )}
        </section>

        <footer className="mt-3 fs-note text-stone-600">
          {t("frame-source")}{" "}
          {rendered.sourceUrl ? (
            <a
              href={rendered.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-teal-800"
            >
              {trends.sourceLabel}
            </a>
          ) : (
            trends.sourceLabel
          )}
          <span aria-hidden className="mx-2 text-stone-300">
            {t("ui-dot-sep")}
          </span>
          {t("frame-updated")}{rendered.updated}
          <span aria-hidden className="mx-2 text-stone-300">
            {t("ui-dot-sep")}
          </span>
          {trends.note}
        </footer>
      </div>
    </main>
  );
}
