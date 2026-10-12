import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalityDashboard } from "@/components/MunicipalityDashboard";
import { ENTRANCE_TABS, cardsForTab } from "@/lib/card-registry";
import { prefCardsForTab, resolvePrefSourceLabel } from "@/lib/pref-card-registry";
import { MUNICIPALITIES, getMunicipalityBySlug } from "@/lib/municipalities";
import { PREFECTURES, getPrefectureByGovSlug } from "@/lib/prefectures";
import { govPath, pageMeta, tabDescription } from "@/lib/site";

type PageParams = { gov: string; tab: string };

// {gov} × {tab}。gov＝市区町村スラッグ ∪ 県庁スラッグ。tab は共通4入口。
export function generateStaticParams() {
  const govs = [
    ...MUNICIPALITIES.map((m) => m.slug),
    ...PREFECTURES.map((p) => p.govSlug),
  ];
  return govs.flatMap((gov) => ENTRANCE_TABS.map(({ tab }) => ({ gov, tab })));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { gov, tab } = await params;
  const tabDef = ENTRANCE_TABS.find((t) => t.tab === tab);
  const prefecture = getPrefectureByGovSlug(gov);
  if (!tabDef) return { title: "自治体Watch" }; // dynamicParams=false のため到達しない
  // 説明文のカード名は、そのページに実際に載るカード（県＝prefCardsForTab／市区町村＝cardsForTab）から取る
  if (prefecture) {
    return pageMeta({
      title: `${tabDef.label} | ${prefecture.prefectureName} | 自治体Watch`,
      description: tabDescription(
        prefecture.prefectureName,
        tabDef.label,
        prefCardsForTab(tabDef.tab).map((c) => c.title),
      ),
      path: `${govPath(prefecture.prefSlug, prefecture.govSlug)}/${tab}`,
    });
  }
  const municipality = getMunicipalityBySlug(gov);
  if (!municipality) return { title: "自治体Watch" };
  return pageMeta({
    title: `${tabDef.label} | ${municipality.cityName} | 自治体Watch`,
    description: tabDescription(
      municipality.cityName,
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
  const { gov, tab } = await params;
  const tabDef = ENTRANCE_TABS.find((t) => t.tab === tab);
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
        displayName={prefecture.prefectureName}
        // 戻り先＝県庁の入口（/{pref}/{gov}）。文言「岐阜県の入口に戻る」どおり（C-2 N-2：
        // 従来は地域ページ /{pref} へ飛び、G-2 で新設した県庁入口を飛ばしていた）。
        backHref={`/${prefecture.prefSlug}/${prefecture.govSlug}`}
        identityColor="#073f91"
        breadcrumb={[
          { label: "日本", href: "/" },
          { label: prefecture.prefectureName, href: `/${prefecture.prefSlug}` },
          { label: `${prefecture.prefectureName}庁`, href: `/${prefecture.prefSlug}/${prefecture.govSlug}` },
          { label: tabDef.label },
        ]}
      />
    );
  }

  // 市区町村: 既定（teal）
  const municipality = getMunicipalityBySlug(gov);
  if (!municipality) {
    notFound();
  }

  return (
    <MunicipalityDashboard
      municipality={municipality}
      tab={tabDef.tab}
      tabLabel={tabDef.label}
      breadcrumb={[
        { label: "日本", href: "/" },
        { label: municipality.prefectureName, href: `/${municipality.prefSlug}` },
        { label: municipality.cityName, href: `/${municipality.prefSlug}/${municipality.slug}` },
        { label: tabDef.label },
      ]}
    />
  );
}
