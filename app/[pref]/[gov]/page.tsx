import { prefLabel } from "@/lib/place-names";
import type { Metadata } from "next";
import Link from "@/components/SiteLink";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EntranceCard } from "@/components/EntranceCard";
import { ENTRANCE_TABS, entranceTabsFor, getEntranceSummary } from "@/lib/card-registry";
import { getPrefEntranceSummary } from "@/lib/pref-card-registry";
import { MUNICIPALITIES, WARDS, getMunicipalityBySlug, getWardParent, getWardsOf } from "@/lib/municipalities";
import { PREFECTURES, getPrefectureByGovSlug } from "@/lib/prefectures";
import { MunicipalitySwitcher } from "@/components/MunicipalitySwitcher";
import { SITE_NAME, govPath, pageMeta, pageTitle } from "@/lib/site";
import { msgsFor, t, tf } from "@/lib/i18n";
import { SWITCHER_MSG_IDS } from "@/lib/i18n-ids";

type PageParams = { pref: string; gov: string };

// 政府（{gov}）スロットは県庁と市区町村を同一解決する（§5.6.1）。
// param 集合＝市区町村スラッグ ∪ 県庁スラッグ（gifu-shi / mizuho-shi / gifu-ken）。
export function generateStaticParams() {
  return [
    ...[...MUNICIPALITIES, ...WARDS].map((m) => ({ pref: m.prefSlug, gov: m.slug })),
    ...PREFECTURES.map((p) => ({ pref: p.prefSlug, gov: p.govSlug })),
  ];
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { pref, gov } = await params;
  const prefecture = getPrefectureByGovSlug(gov);
  if (prefecture) {
    // 地域ページ（/gifu-pref・title「岐阜県」）と同名にならないよう県庁は「庁」付き（WCAG 2.4.2・C-7）
    return pageMeta({
      title: pageTitle(tf("p-pref-gov", { pref: prefLabel(prefecture.prefectureName) })),
      description: entranceDescription(prefLabel(prefecture.prefectureName)),
      path: govPath(prefecture.prefSlug, prefecture.govSlug),
    });
  }
  const municipality = getMunicipalityBySlug(gov, pref);
  if (!municipality) return { title: SITE_NAME }; // dynamicParams=false のため到達しない
  return pageMeta({
    title: pageTitle(municipality.label),
    description: entranceDescription(municipality.label, entranceTabsFor(municipality)),
    path: govPath(municipality.prefSlug, municipality.slug),
  });
}

/**
 * 政府入口の説明文。入口の名前はそのページに実際にあるタブから取る（手書きしない）。
 * 県庁・市町村は ENTRANCE_TABS の4入口。政令市の区は entranceTabsFor が返す入口だけ（いまは「まちのすがた」。L-9）。
 */
function entranceDescription(name: string, tabs: { label: string }[] = ENTRANCE_TABS): string {
  const labels = tabs.map((tb) => tf("p-quoted", { x: tb.label })).join(t("ui-join-quoted"));
  return tf("p-desc-entrance", { name, tabs: labels });
}

export default async function GovEntrancePage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { pref, gov } = await params;

  // 県庁（政府＝都道府県）: 青・pref registry のサマリー、tab 先は {pref}/{govSlug}/{tab}
  const prefecture = getPrefectureByGovSlug(gov);
  if (prefecture) {
    return (
      <main id="main" tabIndex={-1} className="focus:outline-none min-h-screen bg-stone-100 px-3 py-6 sm:px-8 sm:py-10 type-large">
        <div className="mx-auto max-w-6xl">
          {/* パンくず＋戻る（ui-vi §2.5・C-2 N-1）。1つ上＝地域ページ（県内市町村の一覧） */}
          <Breadcrumb
            items={[
              { label: t("crumb-japan"), href: "/" },
              { label: prefLabel(prefecture.prefectureName), href: `/${prefecture.prefSlug}` },
              { label: tf("p-pref-gov", { pref: prefLabel(prefecture.prefectureName) }) },
            ]}
          />
          <Link
            href={`/${prefecture.prefSlug}`}
            className="mt-1 inline-block py-1.5 fs-back hover:underline"
            style={{ color: "#073f91" }}
          >
            {tf("p-back-to-pref-list", { pref: prefLabel(prefecture.prefectureName) })}
          </Link>
          <p className="mt-3 fs-label font-medium" style={{ color: "#073f91" }}>
            {t("area-prefecture")}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ color: "#073f91" }}>
            {prefLabel(prefecture.prefectureName)}
          </h1>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
            {ENTRANCE_TABS.map(({ tab, label }) => (
              <EntranceCard
                key={tab}
                href={`/${prefecture.prefSlug}/${prefecture.govSlug}/${tab}`}
                label={label}
                summary={getPrefEntranceSummary(tab, prefecture)}
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // 市区町村: teal・既定サマリー、tab 先は {pref}/{slug}/{tab}
  const municipality = getMunicipalityBySlug(gov, pref);
  if (!municipality) {
    notFound();
  }

  const parent = getWardParent(municipality); // 政令市の区（試作）のときだけ親の市
  const wards = getWardsOf(municipality); // 区を持つ市（試作）のときだけ区の一覧
  return (
    <main id="main" tabIndex={-1} className="focus:outline-none min-h-screen bg-stone-100 px-3 py-6 sm:px-8 sm:py-10 type-large">
      <div className="mx-auto max-w-6xl">
        {/* パンくず＋戻る（ui-vi §2.5・C-2 N-1）。1つ上＝地域ページ（県内市町村の一覧）。区は親の市のページ */}
        <Breadcrumb
          items={[
            { label: t("crumb-japan"), href: "/" },
            { label: municipality.prefectureLabel, href: `/${municipality.prefSlug}` },
            ...(parent ? [{ label: parent.label, href: `/${parent.prefSlug}/${parent.slug}` }] : []),
            { label: municipality.label },
          ]}
        />
        {parent ? (
          <Link
            href={`/${parent.prefSlug}/${parent.slug}`}
            className="mt-1 mb-3 inline-block py-1.5 fs-back hover:underline"
            style={{ color: "var(--identity)" }}
          >
            {tf("p-back-to-city", { city: parent.label })}
          </Link>
        ) : (
        <Link
          href={`/${municipality.prefSlug}`}
          className="mt-1 mb-3 inline-block py-1.5 fs-back hover:underline"
          style={{ color: "var(--identity)" }}
        >
          {tf("p-back-to-pref-list", { pref: municipality.prefectureLabel })}
        </Link>
        )}
        {/* h1（C-7）：切替ボタン内の団体名は見出しではないため、読み上げ・見出しナビ用に団体名のh1を置く（見た目は不変） */}
        <h1 className="sr-only">{municipality.label}</h1>
        <div>
          <MunicipalitySwitcher
            msgs={msgsFor(SWITCHER_MSG_IDS)}
            current={municipality}
            list={[...MUNICIPALITIES, ...WARDS].filter((x) => x.prefSlug === municipality.prefSlug)}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
          {[
            ...entranceTabsFor(municipality).map(({ tab, label }) => (
              <EntranceCard
                key={tab}
                href={`/${municipality.prefSlug}/${municipality.slug}/${tab}`}
                label={label}
                summary={getEntranceSummary(tab, municipality)}
              />
            )),
            // 区を持つ市（試作）：区のページへの導線。区を持たない市では何も足さない
            ...(wards.length > 0
              ? [
                  <h2 key="wards-heading" className="col-span-full mt-4 fs-title font-semibold text-teal-950">
                    {tf("p-city-wards", { city: municipality.label })}
                  </h2>,
                  ...wards.map((w) => (
                    <EntranceCard
                      key={w.slug}
                      href={`/${w.prefSlug}/${w.slug}`}
                      label={w.shortLabel ?? w.label}
                      summary={getEntranceSummary("machi", w)}
                    />
                  )),
                ]
              : []),
          ]}
        </div>
      </div>
    </main>
  );
}
