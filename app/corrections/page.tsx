import type { Metadata } from "next";
import Link from "@/components/SiteLink";
import { pageMeta, pageTitle } from "@/lib/site";
import { t } from "@/lib/i18n";
import { CONTACT_EMAIL, CONTACT_FORM_URL, contactFormEnabled } from "@/lib/contact";
import { SitePageShell, DocSection } from "@/components/SitePageShell";

// app/corrections/page.tsx — 訂正・お問い合わせ。
// 本文は確定稿の転記：gate4-staleness-correction-spec.md C（訂正公開文）・B-2（手順）・B-3（訂正履歴）。
// 訂正履歴は現時点で該当なし。履歴の中身（対象・要旨）はデータとして日本語で持ち、英語版での出し方は作業単位7（データ由来の語）で決める。履歴が生じた時点で下記リストに時系列で追記する運用（B-3）。

export const metadata: Metadata = pageMeta({
  title: pageTitle(t("ui-nav-corrections")),
  description: t("ui-desc-corrections"),
  path: "/corrections",
});

const CORRECTION_LOG: { date: string; target: string; summary: string }[] = [
  // 例: { date: "2026-10-01", target: "岐阜市／介護保険料", summary: "第9期基準額を6,900円に訂正（出典差し替え）" }
];

export default function CorrectionsPage() {
  return (
    <SitePageShell title={t("ui-nav-corrections")}>
      <DocSection>
        <p>{t("co-intro")}</p>
        {contactFormEnabled() && (
          <>
            <p>
              <strong>{t("co-l-form")}</strong>{t("ui-label-space")}
              <a href={CONTACT_FORM_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">{t("co-form-link")}</a>
              {t("co-form-types")}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>{t("co-l-purpose")}</strong>{t("co-purpose-v")}</li>
              <li><strong>{t("co-l-retention")}</strong>{t("co-retention-v")}</li>
              <li><strong>{t("co-l-method")}</strong>{t("co-method-v")}</li>
            </ul>
          </>
        )}
        <p><strong>{contactFormEnabled() ? t("co-l-email") : t("co-l-contact")}</strong>{t("ui-label-space")}{CONTACT_EMAIL}</p>
        <p>{t("co-privacy-1")}<Link href="/about#privacy" className="underline underline-offset-2">{t("co-about-link")}</Link>{t("co-privacy-2")}</p>
      </DocSection>

      <DocSection heading={t("co-h-steps")}>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t("co-step-1")}</li>
          <li>{t("co-step-2")}</li>
          <li>{t("co-step-3")}</li>
          <li>{t("co-step-4")}</li>
        </ol>
      </DocSection>

      <DocSection heading={t("co-h-log")}>
        {CORRECTION_LOG.length === 0 ? (
          <p style={{ color: "#41577d" }}>{t("co-log-empty")}</p>
        ) : (
          <ul className="space-y-3">
            {CORRECTION_LOG.map((c, i) => (
              <li key={i} className="border-l-2 pl-4" style={{ borderColor: "#d8e2ed" }}>
                <span className="block text-base font-bold" style={{ color: "#062657" }}>{c.date}{t("ui-label-space")}{c.target}</span>
                <span className="mt-1 block text-base" style={{ color: "#1f3350" }}>{c.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </DocSection>
    </SitePageShell>
  );
}
