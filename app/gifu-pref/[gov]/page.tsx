import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EntranceCard } from "@/components/EntranceCard";
import { ENTRANCE_TABS, getEntranceSummary } from "@/lib/card-registry";
import { getPrefEntranceSummary } from "@/lib/pref-card-registry";
import { MUNICIPALITIES, getMunicipalityBySlug } from "@/lib/municipalities";
import { PREFECTURES, getPrefectureByGovSlug } from "@/lib/prefectures";
import { MunicipalitySwitcher } from "@/components/MunicipalitySwitcher";
import { govPath, pageMeta } from "@/lib/site";

type PageParams = { gov: string };

// 政府（{gov}）スロットは県庁と市区町村を同一解決する（§5.6.1）。
// param 集合＝市区町村スラッグ ∪ 県庁スラッグ（gifu-shi / mizuho-shi / gifu-ken）。
export function generateStaticParams() {
  return [
    ...MUNICIPALITIES.map((m) => ({ gov: m.slug })),
    ...PREFECTURES.map((p) => ({ gov: p.govSlug })),
  ];
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { gov } = await params;
  const prefecture = getPrefectureByGovSlug(gov);
  if (prefecture) {
    // 地域ページ（/gifu-pref・title「岐阜県」）と同名にならないよう県庁は「庁」付き（WCAG 2.4.2・C-7）
    return pageMeta({
      title: `${prefecture.prefectureName}庁 | 自治体Watch`,
      description: entranceDescription(prefecture.prefectureName),
      path: govPath(prefecture.prefSlug, prefecture.govSlug),
    });
  }
  const municipality = getMunicipalityBySlug(gov);
  if (!municipality) return { title: "自治体Watch" }; // dynamicParams=false のため到達しない
  return pageMeta({
    title: `${municipality.cityName} | 自治体Watch`,
    description: entranceDescription(municipality.cityName),
    path: govPath(municipality.prefSlug, municipality.slug),
  });
}

/** 政府入口の説明文。4入口の名前は ENTRANCE_TABS から取る（手書きしない）。 */
function entranceDescription(name: string): string {
  const labels = ENTRANCE_TABS.map((t) => `「${t.label}」`).join("");
  return `${name}の${labels}を、出典つきで見られます。`;
}

export default async function GovEntrancePage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { gov } = await params;

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
  const municipality = getMunicipalityBySlug(gov);
  if (!municipality) {
    notFound();
  }

  return (
    <main id="main" tabIndex={-1} className="focus:outline-none min-h-screen bg-stone-100 px-3 py-6 sm:px-8 sm:py-10 type-large">
      <div className="mx-auto max-w-6xl">
        {/* パンくず＋戻る（ui-vi §2.5・C-2 N-1）。1つ上＝地域ページ（県内市町村の一覧） */}
        <Breadcrumb
          items={[
            { label: "日本", href: "/" },
            { label: municipality.prefectureName, href: `/${municipality.prefSlug}` },
            { label: municipality.cityName },
          ]}
        />
        <Link
          href={`/${municipality.prefSlug}`}
          className="mt-1 mb-3 inline-block py-1.5 fs-back hover:underline"
          style={{ color: "var(--identity)" }}
        >
          ← {municipality.prefectureName}の自治体一覧に戻る
        </Link>
        {/* h1（C-7）：切替ボタン内の団体名は見出しではないため、読み上げ・見出しナビ用に団体名のh1を置く（見た目は不変） */}
        <h1 className="sr-only">{municipality.cityName}</h1>
        <div>
          <MunicipalitySwitcher current={municipality} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
          {ENTRANCE_TABS.map(({ tab, label }) => (
            <EntranceCard
              key={tab}
              href={`/${municipality.prefSlug}/${municipality.slug}/${tab}`}
              label={label}
              summary={getEntranceSummary(tab, municipality)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
