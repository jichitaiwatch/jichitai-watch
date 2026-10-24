import { LOCALE } from "@/lib/locale";
import type { Metadata } from "next";
import { pageMeta, pageTitle } from "@/lib/site";
import { t, tf } from "@/lib/i18n";
import { PREFECTURES } from "@/lib/prefectures";

// 日本地図（トップの「地域から探す」）は県が複数のビルドだけに出る。出るときだけ出典の文を足す（岐阜のみの公開用ビルドは変わらない）。
const MAP_CREDIT =
  PREFECTURES.length > 1
    ? t("dt-map-credit")
    : "";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SitePageShell, DocSection } from "@/components/SitePageShell";

// app/data/page.tsx — 「データについて」。本文は確定稿の転記（ui-vi-handoff §2.8「データについて」）。
// 新しい方針は作らない（licenses.md 総括・README の要約）。AI関連は方針として（可能性形）記述。

// Lucide の許諾文（ISC／Feather由来分のMIT）は THIRD_PARTY_NOTICES.md の ```text ブロックが唯一の原本。
// 手で写さずビルド時に読み込む（写し間違い・二重管理の防止）。見つからなければビルドを失敗させる。
// 自治体Watch自身のソースコードの許諾文（MIT）は、リポジトリ直下の LICENSE が唯一の原本。同じくビルド時に読む。
function mitLicenseText(): string {
  return readFileSync(join(process.cwd(), "LICENSE"), "utf-8").trim();
}

function lucideLicenseText(): string {
  const md = readFileSync(join(process.cwd(), "THIRD_PARTY_NOTICES.md"), "utf-8");
  const m = md.match(/```text\n([\s\S]*?)\n```/);
  if (!m) throw new Error("THIRD_PARTY_NOTICES.md に ```text ブロックが見つかりません");
  return m[1];
}

// 許諾文の日本語参考訳。法的効力があるのは英語の原文のみ（画面にもそう明記する）。
// 参考訳（TRANSLATION_NOTE・MIT_BODY_JA・ISC_BODY_JA・Translation の見出し）は日本語版だけのもので、用語辞書には入れない。
// 英語版は原文（英語）がそのまま読めるため参考訳を出さない（Translation は日本語版のときだけ中身を出す。作業単位6）。
const TRANSLATION_NOTE = "参考訳（法的効力があるのは英語の原文です）";

const MIT_BODY_JA = [
  "本ソフトウェアおよび関連する文書ファイル（以下「本ソフトウェア」）の複製物を入手したすべての人に対し、無償で、本ソフトウェアを制限なく扱うことを許可します。これには、本ソフトウェアの複製を使用、複写、改変、結合、公開、頒布、サブライセンス、および／または販売する権利、ならびに本ソフトウェアを提供された者に同じことを許可する権利が、制限なく含まれます。ただし、次の条件に従うものとします。",
  "上記の著作権表示および本許諾表示を、本ソフトウェアのすべての複製物または重要な部分に含めなければなりません。",
  "本ソフトウェアは「現状のまま」で提供され、明示であるか黙示であるかを問わず、商品性、特定目的への適合性および権利非侵害の保証を含め、いかなる保証もありません。作者または著作権者は、契約行為、不法行為その他であるかを問わず、本ソフトウェアまたはその使用もしくはその他の取り扱いに起因または関連して生じた、いかなる請求、損害その他の責任についても負いません。",
];

const ISC_BODY_JA = [
  "上記の著作権表示および本許諾表示がすべての複製物に付されることを条件に、本ソフトウェアを、目的を問わず、有償・無償を問わず、使用、複写、改変、および／または頒布することを許可します。",
  "本ソフトウェアは「現状のまま」提供され、作者は、商品性および適合性に関する黙示の保証を含め、本ソフトウェアに関するすべての保証を否認します。作者は、契約上の行為、過失その他の不法行為であるかを問わず、本ソフトウェアの使用または性能に起因または関連する、使用機会・データ・利益の喪失から生じる特別損害、直接損害、間接損害もしくは結果的損害その他いかなる損害についても責任を負いません。",
];

function Translation({ blocks }: { blocks: { head: string; paras: string[] }[] }) {
  if (LOCALE !== "ja") return null;
  return (
    <details>
      <summary className="cursor-pointer py-2 font-bold">{TRANSLATION_NOTE}</summary>
      <div className="mt-2 max-h-96 space-y-4 overflow-auto rounded-lg border p-4 text-sm leading-relaxed" style={{ borderColor: "#d8e2ed" }}>
        {blocks.map((b) => (
          <div key={b.head} className="space-y-2">
            <p className="font-bold">{b.head}</p>
            {b.paras.map((para) => <p key={para}>{para}</p>)}
          </div>
        ))}
      </div>
    </details>
  );
}

export const metadata: Metadata = pageMeta({
  title: pageTitle(t("ui-nav-data")),
  description: t("ui-desc-data"),
  path: "/data",
});

export default function DataPage() {
  return (
    <SitePageShell title={t("ui-nav-data")}>
      <DocSection>
        <p>{t("dt-intro")}</p>
      </DocSection>

      <DocSection heading={t("dt-h-sources")}>
        <p>{t("dt-sources-p")}</p>
      </DocSection>

      <DocSection heading={t("dt-h-processed")}>
        <p>{t("dt-processed-p")}</p>
      </DocSection>

      <DocSection heading={t("dt-h-ai")}>
        <p>{t("dt-ai-p")}</p>
      </DocSection>

      <DocSection heading={t("dt-h-license")} id="license">
        <p>
          {t("dt-lic-1")}
          <a href="https://data.e-gov.go.jp/data/dataset/pulic_data_license" target="_blank" rel="noreferrer" className="underline underline-offset-2">{t("ab-data-pdl")}</a>
          {t("dt-lic-2")}
        </p>
        <p>{t("dt-lic-p2")}</p>
        <details>
          <summary className="cursor-pointer py-2 font-bold">{t("dt-mit-summary")}</summary>
          <pre tabIndex={0} role="region" aria-label={t("dt-mit-aria")} className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed" style={{ borderColor: "#d8e2ed" }}>
            {mitLicenseText()}
          </pre>
        </details>
        <Translation blocks={[{ head: "MITライセンス　著作権表示：Copyright (c) 2026 自治体Watch Project", paras: MIT_BODY_JA }]} />
      </DocSection>

      <DocSection heading={t("dt-h-materials")}>
        <p>
          {t("dt-mat-1")}
          <a href="https://www.gsi.go.jp/kankyochiri/gm_jpn.html" target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">https://www.gsi.go.jp/kankyochiri/gm_jpn.html</a>
          {t("dt-mat-2")}
          <a href="https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html" target="_blank" rel="noreferrer" className="underline underline-offset-2">{t("dt-mat-gsi-terms")}</a>
          {tf("p-dt-mat-3", { mapcredit: MAP_CREDIT })}
        </p>
        <p>{t("dt-lucide-p")}</p>
        <details>
          <summary className="cursor-pointer py-2 font-bold">{t("dt-lucide-summary")}</summary>
          <pre tabIndex={0} role="region" aria-label={t("dt-lucide-aria")} className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed" style={{ borderColor: "#d8e2ed" }}>
            {lucideLicenseText()}
          </pre>
        </details>
        <Translation
          blocks={[
            { head: "ISCライセンス　著作権表示：Copyright (c) 2026 Lucide Icons and Contributors", paras: ISC_BODY_JA },
            { head: "MITライセンス（Feather由来のアイコン分）　著作権表示：Copyright (c) 2013-present Cole Bemis", paras: MIT_BODY_JA },
          ]}
        />
      </DocSection>
    </SitePageShell>
  );
}
