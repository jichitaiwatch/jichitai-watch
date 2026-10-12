import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
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
  return (
    <details>
      <summary className="cursor-pointer py-2 font-bold">{TRANSLATION_NOTE}</summary>
      <div className="mt-2 max-h-96 space-y-4 overflow-auto rounded-lg border p-4 text-sm leading-relaxed" style={{ borderColor: "#d8e2ed" }}>
        {blocks.map((b) => (
          <div key={b.head} className="space-y-2">
            <p className="font-bold">{b.head}</p>
            {b.paras.map((t) => <p key={t}>{t}</p>)}
          </div>
        ))}
      </div>
    </details>
  );
}

export const metadata: Metadata = pageMeta({
  title: "データについて | 自治体Watch",
  description: "出典・加工した数値・AIの扱い・ライセンスについて。",
  path: "/data",
});

export default function DataPage() {
  return (
    <SitePageShell title="データについて">
      <DocSection>
        <p>このページでは、自治体Watchが掲載しているデータの扱い方について説明します。</p>
      </DocSection>

      <DocSection heading="出典について">
        <p>各カードには、データの提供元（総務省・こども家庭庁・厚生労働省など）、調査名、更新日を明記しています。出典は各カードのフッターから確認できます。原則として、政府・自治体が公表している統計資料をもとにしています。</p>
      </DocSection>

      <DocSection heading="加工した数値について">
        <p>自治体Watchが独自に計算・加工した数値（一人あたりの金額に換算した値など）には、その旨と加工主体（自治体Watch）を明記しています。未加工の統計データと区別できるようにしています。</p>
      </DocSection>

      <DocSection heading="AIによる抽出・要約について">
        <p>自治体Watchでは、統計データの整理にAIを用いる場合があります。AIが生成・抽出したコンテンツには、その旨を示す表示を付け、非公式・要検証の情報であることを明示します。正確な情報が必要な場合は、あわせて表示している出典元の一次資料をご確認ください。</p>
      </DocSection>

      <DocSection heading="ライセンスについて" id="license">
        <p>
          掲載データの多くは、
          <a href="https://data.e-gov.go.jp/data/dataset/pulic_data_license" target="_blank" rel="noreferrer" className="underline underline-offset-2">公共データ利用規約（第1.0版・PDL1.0）</a>
          等のもとで公開されている政府の公開データです。出典の明記と加工した旨の明示を条件に、自由な二次利用が認められています。提供元ごとに利用条件が異なるデータは、各カードの出典に従います。
        </p>
        <p>サイトのソースコードは、次のMITライセンスで公開しています。MITライセンスはソースコードに適用されるもので、掲載データの利用条件を定めるものではありません。</p>
        <details>
          <summary className="cursor-pointer py-2 font-bold">自治体Watch のソースコードのライセンス（MIT・全文・英語）</summary>
          <pre tabIndex={0} role="region" aria-label="自治体Watch のソースコードのライセンス（矢印キーでスクロールできます）" className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed" style={{ borderColor: "#d8e2ed" }}>
            {mitLicenseText()}
          </pre>
        </details>
        <Translation blocks={[{ head: "MITライセンス　著作権表示：Copyright (c) 2026 自治体Watch Project", paras: MIT_BODY_JA }]} />
      </DocSection>

      <DocSection heading="素材の出典について">
        <p>
          トップ画面と岐阜県の入口画面にある岐阜県の形のアイコンは、「地球地図日本」（国土地理院）（
          <a href="https://www.gsi.go.jp/kankyochiri/gm_jpn.html" target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">https://www.gsi.go.jp/kankyochiri/gm_jpn.html</a>
          ）を加工して作成したものです。このデータには
          <a href="https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html" target="_blank" rel="noreferrer" className="underline underline-offset-2">国土地理院コンテンツ利用規約</a>
          が適用されます。GitHubで公開されている変換データ（dataofjapan/land）から取得し、自治体Watchが輪郭を簡略化して描き直しています。
        </p>
        <p>上位3業種カードの業種別アイコンの意匠は、Lucide（ISC License）によります。著作権表示と許諾文は次のとおりです。</p>
        <details>
          <summary className="cursor-pointer py-2 font-bold">Lucide の著作権表示と許諾文（全文・英語）</summary>
          <pre tabIndex={0} role="region" aria-label="Lucide の著作権表示と許諾文（矢印キーでスクロールできます）" className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed" style={{ borderColor: "#d8e2ed" }}>
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
