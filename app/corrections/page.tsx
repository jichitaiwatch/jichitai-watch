import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { CONTACT_EMAIL, CONTACT_FORM_URL, contactFormEnabled } from "@/lib/contact";
import { SitePageShell, DocSection } from "@/components/SitePageShell";

// app/corrections/page.tsx — 訂正・お問い合わせ。
// 本文は確定稿の転記：gate4-staleness-correction-spec.md C（訂正公開文）・B-2（手順）・B-3（訂正履歴）。
// 訂正履歴は現時点で該当なし。履歴が生じた時点で下記リストに時系列で追記する運用（B-3）。

export const metadata: Metadata = pageMeta({
  title: "訂正・お問い合わせ | 自治体Watch",
  description: "掲載内容の誤りの指摘窓口、訂正の手順、訂正履歴。",
  path: "/corrections",
});

const CORRECTION_LOG: { date: string; target: string; summary: string }[] = [
  // 例: { date: "2026-10-01", target: "岐阜市／介護保険料", summary: "第9期基準額を6,900円に訂正（出典差し替え）" }
];

export default function CorrectionsPage() {
  return (
    <SitePageShell title="訂正・お問い合わせ">
      <DocSection>
        <p>掲載内容に誤りを見つけられた場合は、下記の窓口までお知らせください。出典と照合して確認し、誤りが確認された場合は訂正のうえ、訂正の記録をこのページで公開します。確認が済むまでの間は、該当箇所に確認中である旨を表示します。</p>
        {contactFormEnabled() && (
          <>
            <p>
              <strong>お問い合わせフォーム</strong>　
              <a href={CONTACT_FORM_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">訂正・お問い合わせフォームを開く（Googleフォーム）</a>
              。種別は「訂正のご指摘（数値・出典・定義）」「ご意見、ご感想」「掲載の要望」「その他」から選べます。
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>利用目的</strong>　送信いただいた氏名・メールアドレス等は、ご指摘・ご意見の確認とご連絡の目的にのみ使用します。法令に基づく場合を除き、第三者に提供・公開しません。</li>
              <li><strong>保管と削除</strong>　対応が完了したメールとフォームの回答は、完了から1年を目安に削除します。</li>
              <li><strong>受付の方法</strong>　フォームはGoogleフォームで受け付けており、回答はGoogleのサーバーに保存されます。</li>
            </ul>
          </>
        )}
        <p><strong>{contactFormEnabled() ? "メールでの窓口" : "窓口"}</strong>　{CONTACT_EMAIL}</p>
        <p>お寄せいただいた内容の取り扱いは、<Link href="/about#privacy" className="underline underline-offset-2">「自治体Watchとは」</Link>の「個人情報とアクセス状況の取り扱い」に記載しています。</p>
      </DocSection>

      <DocSection heading="訂正までの手順">
        <ol className="list-decimal space-y-2 pl-5">
          <li>ご指摘を上記窓口で受け付けます。</li>
          <li>出典と照合して事実を確認します。</li>
          <li>確認が済むまでの間、該当箇所には確認中である旨を注記します。</li>
          <li>誤りが確認された場合は訂正し、訂正履歴に記録します。</li>
        </ol>
      </DocSection>

      <DocSection heading="訂正履歴">
        {CORRECTION_LOG.length === 0 ? (
          <p style={{ color: "#41577d" }}>現在、公開している訂正はありません。数値・出典・定義に関わる訂正が生じた場合に、日付・対象・内容の要旨を時系列で掲載します。</p>
        ) : (
          <ul className="space-y-3">
            {CORRECTION_LOG.map((c, i) => (
              <li key={i} className="border-l-2 pl-4" style={{ borderColor: "#d8e2ed" }}>
                <span className="block text-base font-bold" style={{ color: "#062657" }}>{c.date}　{c.target}</span>
                <span className="mt-1 block text-base" style={{ color: "#1f3350" }}>{c.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </DocSection>
    </SitePageShell>
  );
}
