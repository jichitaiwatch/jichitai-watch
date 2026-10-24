import { prefLabel } from "@/lib/place-names";
import { t, tf } from "@/lib/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalityDashboard } from "@/components/MunicipalityDashboard";
import { ENTRANCE_TABS, cardsForTab, entranceTabsFor } from "@/lib/card-registry";
import { prefCardsForTab, resolvePrefSourceLabel } from "@/lib/pref-card-registry";
import { MUNICIPALITIES, WARDS, getMunicipalityBySlug, getWardParent } from "@/lib/municipalities";
import { PREFECTURES, getPrefectureByGovSlug } from "@/lib/prefectures";
import { SITE_NAME, govPath, pageMeta, pageTitleIn, tabDescription } from "@/lib/site";

type PageParams = { pref: string; gov: string; tab: string };

// {gov} × {tab}。gov＝市区町村スラッグ ∪ 県庁スラッグ。tab は共通4入口。
export function generateStaticParams() {
  const govs = [
    ...MUNICIPALITIES.map((m) => ({ pref: m.prefSlug, gov: m.slug })),
    ...PREFECTURES.map((p) => ({ pref: p.prefSlug, gov: p.govSlug })),
  ];
  const wardPages = WARDS.flatMap((w) =>
    entranceTabsFor(w).map(({ tab }) => ({ pref: w.prefSlug, gov: w.slug, tab })),
  );
  return [...govs.flatMap((g) => ENTRANCE_TABS.map(({ tab }) => ({ ...g, tab }))), ...wardPages];
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { pref, gov, tab } = await params;
  const tabDef = ENTRANCE_TABS.find((et) => et.tab === tab);
  const prefecture = getPrefectureByGovSlug(gov);
  if (!tabDef) return { title: SITE_NAME }; // dynamicParams=false のため到達しない
  // 説明文のカード名は、そのページに実際に載るカード（県＝prefCardsForTab／市区町村＝cardsForTab）から取る
  if (prefecture) {
    return pageMeta({
      title: pageTitleIn(tabDef.label, prefLabel(prefecture.prefectureName)),
      description: tabDescription(
        prefLabel(prefecture.prefectureName),
        tabDef.label,
        prefCardsForTab(tabDef.tab).map((c) => c.title),
      ),
      path: `${govPath(prefecture.prefSlug, prefecture.govSlug)}/${tab}`,
    });
  }
  const municipality = getMunicipalityBySlug(gov, pref);
  if (!municipality) return { title: SITE_NAME };
  return pageMeta({
    title: pageTitleIn(tabDef.label, municipality.label),
    description: tabDescription(
      municipality.label,
      tabDef.label,
      cardsForTab(tabDef.tab).map((c) => c.title),
    ),
    path: `${govPath(municipality.prefSlug, municipality.slug)}/${tab}`,
  });
}

export default async function GovTabPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { pref, gov, tab } = await params;
  const tabDef = ENTRANCE_TABS.find((et) => et.tab === tab);
  if (!tabDef) {
    notFound();
  }

  // 県庁: pref registry・青。共有 Dashboard をジェネリックに使う（G-1 と同じ呼び方）
  const prefecture = getPrefectureByGovSlug(gov);
  if (prefecture) {
    return (
      <MunicipalityDashboard
        municipality={prefecture}
        tab={tabDef.tab}
        tabLabel={tabDef.label}
        cardsForTabFn={prefCardsForTab}
        resolveSourceLabelFn={resolvePrefSourceLabel}
        displayName={prefLabel(prefecture.prefectureName)}
        // 戻り先＝県庁の入口（/{pref}/{gov}）。文言「岐阜県の入口に戻る」どおり（C-2 N-2：
        // 従来は地域ページ /{pref} へ飛び、G-2 で新設した県庁入口を飛ばしていた）。
        backHref={`/${prefecture.prefSlug}/${prefecture.govSlug}`}
        identityColor="#073f91"
        breadcrumb={[
          { label: t("crumb-japan"), href: "/" },
          { label: prefLabel(prefecture.prefectureName), href: `/${prefecture.prefSlug}` },
          { label: tf("p-pref-gov", { pref: prefLabel(prefecture.prefectureName) }), href: `/${prefecture.prefSlug}/${prefecture.govSlug}` },
          { label: tabDef.label },
        ]}
      />
    );
  }

  // 市区町村: 既定（teal）
  const municipality = getMunicipalityBySlug(gov, pref);
  if (!municipality) {
    notFound();
  }

  const parent = getWardParent(municipality);
  return (
    <MunicipalityDashboard
      municipality={municipality}
      tab={tabDef.tab}
      tabLabel={tabDef.label}
      breadcrumb={[
        { label: t("crumb-japan"), href: "/" },
        { label: municipality.prefectureLabel, href: `/${municipality.prefSlug}` },
        ...(parent ? [{ label: parent.label, href: `/${parent.prefSlug}/${parent.slug}` }] : []),
        { label: municipality.label, href: `/${municipality.prefSlug}/${municipality.slug}` },
        { label: tabDef.label },
      ]}
    />
  );
}
