import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EntranceCard } from "@/components/EntranceCard";
import { ENTRANCE_TABS, entranceTabsFor, getEntranceSummary } from "@/lib/card-registry";
import { getPrefEntranceSummary } from "@/lib/pref-card-registry";
import { MUNICIPALITIES, WARDS, getMunicipalityBySlug, getWardParent, getWardsOf } from "@/lib/municipalities";
import { PREFECTURES, getPrefectureByGovSlug } from "@/lib/prefectures";
import { MunicipalitySwitcher } from "@/components/MunicipalitySwitcher";
import { govPath, pageMeta } from "@/lib/site";

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
      title: `${prefecture.prefectureName}庁 | 自治体Watch`,
      description: entranceDescription(prefecture.prefectureName),
      path: govPath(prefecture.prefSlug, prefecture.govSlug),
    });
  }
  const municipality = getMunicipalityBySlug(gov, pref);
  if (!municipality) return { title: "自治体Watch" }; // dynamicParams=false のため到達しない
  return pageMeta({
    title: `${municipality.cityName} | 自治体Watch`,
    description: entranceDescription(municipality.cityName, entranceTabsFor(municipality)),
    path: govPath(municipality.prefSlug, municipality.slug),
  });
}

/**
 * 政府入口の説明文。入口の名前はそのページに実際にあるタブから取る（手書きしない）。
 * 県庁・市町村は ENTRANCE_TABS の4入口。政令市の区は entranceTabsFor が返す入口だけ（いまは「まちのすがた」。L-9）。
 */
function entranceDescription(name: string, tabs: { label: string }[] = ENTRANCE_TABS): string {
  const labels = tabs.map((t) => `「${t.label}」`).join("");
  return `${name}の${labels}を、出典つきで見られます。`;
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
              { label: "日本", href: "/" },
              { label: prefecture.prefectureName, href: `/${prefecture.prefSlug}` },
              { label: `${prefecture.prefectureName}庁` },
            ]}
          />
          <Link
            href={`/${prefecture.prefSlug}`}
            className="mt-1 inline-block py-1.5 fs-back hover:underline"
            style={{ color: "#073f91" }}
          >
            ← {prefecture.prefectureName}の自治体一覧に戻る
          </Link>
          <p className="mt-3 fs-label font-medium" style={{ color: "#073f91" }}>
            都道府県
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ color: "#073f91" }}>
            {prefecture.prefectureName}
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
            { label: "日本", href: "/" },
            { label: municipality.prefectureName, href: `/${municipality.prefSlug}` },
            ...(parent ? [{ label: parent.cityName, href: `/${parent.prefSlug}/${parent.slug}` }] : []),
            { label: municipality.cityName },
          ]}
        />
        {parent ? (
          <Link
            href={`/${parent.prefSlug}/${parent.slug}`}
            className="mt-1 mb-3 inline-block py-1.5 fs-back hover:underline"
            style={{ color: "var(--identity)" }}
          >
            {`← ${parent.cityName}のページに戻る`}
          </Link>
        ) : (
        <Link
          href={`/${municipality.prefSlug}`}
          className="mt-1 mb-3 inline-block py-1.5 fs-back hover:underline"
          style={{ color: "var(--identity)" }}
        >
          ← {municipality.prefectureName}の自治体一覧に戻る
        </Link>
        )}
        {/* h1（C-7）：切替ボタン内の団体名は見出しではないため、読み上げ・見出しナビ用に団体名のh1を置く（見た目は不変） */}
        <h1 className="sr-only">{municipality.cityName}</h1>
        <div>
          <MunicipalitySwitcher
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
                    {`${municipality.cityName}の区`}
                  </h2>,
                  ...wards.map((w) => (
                    <EntranceCard
                      key={w.slug}
                      href={`/${w.prefSlug}/${w.slug}`}
                      label={w.cityName.replace(municipality.cityName, "")}
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
