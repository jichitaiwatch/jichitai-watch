import type { Metadata } from "next";
import Link from "@/components/SiteLink";
import { pageMeta, pageTitle, REGION_LABEL } from "@/lib/site";
import { t, tf } from "@/lib/i18n";
import { CONTACT_EMAIL, contactFormEnabled } from "@/lib/contact";
import { SitePageShell, DocSection } from "@/components/SitePageShell";

// app/about/page.tsx — 「自治体Watchとは」＋ブランド公開文①②③を集約。
// 本文はすべて確定稿の転記：ui-vi-handoff §2.8「自治体Watchとは」／
// docs/gate4-brand-public-docs.md 公開文①このサイトについて・②利益相反方針・③運営者と名称・④個人情報とアクセス状況の取り扱い（D-4）。

export const metadata: Metadata = pageMeta({
  title: pageTitle(t("ui-nav-about")),
  description: t("ui-desc-about"),
  path: "/about",
});

export default function AboutPage() {
  const form = contactFormEnabled();
  return (
    <SitePageShell title={t("ui-nav-about")}>
      <DocSection>
        <p>{t("ab-p1")}</p>
        <p>{t("ab-p2")}</p>
        <p>{tf("p-ab-p3", { region: REGION_LABEL })}</p>
        <p>{t("ab-p4")}</p>
        <p>{t("ab-p5")}</p>
      </DocSection>

      <DocSection heading={t("ab-h-about")}>
        <p>{t("ab-about-p")}</p>
        <ul className="space-y-2">
          <li><strong>{t("ab-l-operation")}</strong>{t("ab-operation-v")}</li>
          <li><strong>{t("ab-l-contact")}</strong>{t("ui-label-space")}{CONTACT_EMAIL}</li>
          <li><strong>{t("ab-l-source")}</strong>{t("ab-source-1")}<Link href="/data#license" className="underline underline-offset-2">{t("ab-source-link")}</Link>{t("ab-source-2")}</li>
          <li><strong>{t("ab-l-data")}</strong>{t("ab-data-1")}<a href="https://data.e-gov.go.jp/data/dataset/pulic_data_license" target="_blank" rel="noreferrer" className="underline underline-offset-2">{t("ab-data-pdl")}</a>{t("ab-data-2")}<Link href="/data#license" className="underline underline-offset-2">{t("ui-nav-data")}</Link>{t("frame-review-3")}</li>
          <li><strong>{t("ab-l-finance")}</strong>{t("ab-finance-v")}</li>
        </ul>
      </DocSection>

      <DocSection heading={t("ab-h-coi")}>
        <p>{t("ab-coi-p")}</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li><strong>{t("ab-l-funds")}</strong>{t("ab-funds-v")}</li>
          <li><strong>{t("ab-l-neutrality")}</strong>{t("ab-neutrality-v")}</li>
          <li><strong>{t("ab-l-editorial")}</strong>{t("ab-editorial-v")}</li>
        </ol>
      </DocSection>

      <DocSection heading={t("ab-h-operator")}>
        <p>{t("ab-op-p1")}</p>
        <p>{t("ab-op-p2")}</p>
      </DocSection>

      <DocSection heading={t("ab-h-privacy")} id="privacy">
        <p>{t("ab-pr-intro")}</p>
        <ul className="space-y-3">
          {form ? (
            <li><strong>{t("ab-l-form-only")}</strong>{t("ab-form-only-v")}</li>
          ) : (
            <li><strong>{t("ab-l-no-input")}</strong>{t("ab-no-input-v")}</li>
          )}
          <li><strong>{t("ab-l-search")}</strong>{t("ab-search-v")}</li>
          <li><strong>{t("ab-l-analytics")}</strong>{t("ab-analytics-v")}</li>
          <li><strong>{t("ab-l-server")}</strong>{t("ab-server-1")}<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer" className="underline underline-offset-2">{t("ab-server-link")}</a>{t("ab-server-2")}</li>
          {form ? (
            <li><strong>{t("ab-l-mail-form")}</strong>{t("ab-mail-form-v")}</li>
          ) : (
            <li><strong>{t("ab-l-mail")}</strong>{t("ab-mail-v")}</li>
          )}
          <li><strong>{t("ab-l-external")}</strong>{t("ab-external-v")}</li>
        </ul>
        <p>{t("ab-pr-change")}</p>
      </DocSection>
    </SitePageShell>
  );
}
