import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { contactFormEnabled } from "@/lib/contact";
import { SitePageShell, DocSection } from "@/components/SitePageShell";

// app/about/page.tsx — 「自治体Watchとは」＋ブランド公開文①②③を集約。
// 本文はすべて確定稿の転記：ui-vi-handoff §2.8「自治体Watchとは」／
// docs/gate4-brand-public-docs.md 公開文①このサイトについて・②利益相反方針・③運営者と名称・④個人情報とアクセス状況の取り扱い（D-4）。

export const metadata: Metadata = pageMeta({
  title: "自治体Watchとは | 自治体Watch",
  description: "自治体Watchの目的・運営・中立性・利益相反方針・個人情報の取り扱いについて。",
  path: "/about",
});

export default function AboutPage() {
  const form = contactFormEnabled();
  return (
    <SitePageShell title="自治体Watchとは">
      <DocSection>
        <p>自治体Watchは、日本の地方自治体（市区町村）の財政や暮らしに関わる制度を、誰もが分かりやすく確認できるようにする情報サイトです。</p>
        <p>本プロジェクトは、日本の地方自治体の状況を誰もが簡単に把握できるようにするため、無償で開発・運営されているオープンソースプロジェクトです。広告は一切掲載せず、特定の政党・企業・団体の利害から独立した、中立的なデータ提供を目指しています。</p>
        <p>岐阜県内の市町村を起点に、財政の状況（歳入・歳出、財政の健全性）や、暮らしに関わる制度（子ども医療費助成、介護保険料、ふるさと納税など）を掲載しています。数値は総務省・こども家庭庁・厚生労働省など公的機関が公表する資料をもとに整理したもので、各カードから元の出典を確認できます。</p>
        <p>現在の値だけでなく、制度の変遷や指標の推移も確認できるようにしており、「今どうなっているか」だけでなく「これまでどう変わってきたか」を追えることを目指しています。</p>
        <p>総合評価点は作成していません。実測値そのままの全国順位・都道府県内順位を指標ごとに示すことはありますが、複数の指標を運営が選んだ重みで合成した総合ランキングは作成しません。掲載順や表示方法はあらかじめ定めた機械的な基準に沿っており、特定の自治体を目立たせたりすることはありません。</p>
      </DocSection>

      <DocSection heading="このサイトについて">
        <p>自治体Watchは、日本の地方自治体の状況を誰もが簡単にみることができるよう、無償で開発・運営されているオープンソースプロジェクトです。広告は一切掲載せず、特定の政党・企業・団体の利害から独立した、中立的なデータ提供を目指しています。</p>
        <ul className="space-y-2">
          <li><strong>運営</strong>　自治体Watch運営者（個人）</li>
          <li><strong>連絡窓口</strong>　jichitaiwatch.official@gmail.com</li>
          <li><strong>ソースコード</strong>　MITライセンスで公開しています（<Link href="/data#license" className="underline underline-offset-2">許諾文の全文</Link>）。</li>
          <li><strong>データ</strong>　政府機関などが公開するデータをもとにしており、利用条件は提供元に従います。多くは<a href="https://data.e-gov.go.jp/data/dataset/pulic_data_license" target="_blank" rel="noreferrer" className="underline underline-offset-2">公共データ利用規約（第1.0版・PDL1.0）</a>のもとで公開されています。詳しくは<Link href="/data#license" className="underline underline-offset-2">データについて</Link>をご覧ください。</li>
          <li><strong>収支</strong>　現時点で収益・寄付はありません。今後収支が生じた場合は本ページで開示します。</li>
        </ul>
      </DocSection>

      <DocSection heading="利益相反方針">
        <p>自治体Watchは、特定の政党・企業・団体・候補者の利害から独立して運営します。</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li><strong>資金</strong>　広告を掲載せず、掲載内容に影響を与えうる資金提供は受けません。将来、寄付などを受け入れる場合も、中立性を損なう出所からは受領せず、受入と使途を本サイトで開示します。</li>
          <li><strong>中立性の担保</strong>　掲載の中立性は運営者の個別判断ではなく、公開された機械的な基準で担保します。</li>
          <li><strong>編集判断の開示</strong>　どの指標を置くか、比較対象（全国／県内／類似団体）や視点の切り替えといった編集判断は、指標選定基準・計算式を公開することで、誰でも検証できるようにします。</li>
        </ol>
      </DocSection>

      <DocSection heading="運営者と名称の利用について">
        <p>本プロジェクトは現在、個人が運営しています。</p>
        <p>名称「自治体Watch」およびドメインの利用は、品質と中立性の方針を守ることを条件とする許諾とし、無条件・無期限・撤回不能の許諾は行いません。</p>
      </DocSection>

      <DocSection heading="個人情報とアクセス状況の取り扱い" id="privacy">
        <p>自治体Watchは、利用者の個人情報を集めない作りにしています。取り扱いは次のとおりです。</p>
        <ul className="space-y-3">
          {form ? (
            <li><strong>入力をお願いするのは問い合わせだけです</strong>　会員登録、コメントの投稿、アンケートなどの機能はありません。入力をお願いするのは、訂正・お問い合わせのフォームだけです。フォームでは氏名はうかがわず、メールアドレスも返信を希望される場合だけの任意です。</li>
          ) : (
            <li><strong>入力をお願いしません</strong>　会員登録、コメントの投稿、アンケートなどの機能はなく、氏名やメールアドレスなどの入力をお願いすることはありません。</li>
          )}
          <li><strong>検索窓に入力した文字</strong>　自治体名の検索は、お使いのブラウザの中だけで処理します。入力した文字は、自治体Watchや配信事業者、アクセス状況の計測のいずれにも送られず、保存もされません。トップページの検索窓から検索すると、結果のページのアドレス（URL）の「#」より後ろに入力した文字が付きますが、この部分はブラウザの外へ送られません。お使いの端末のブラウザの履歴には残ることがありますので、共用の端末では履歴にご注意ください。</li>
          <li><strong>アクセス状況の計測</strong>　どのページがどれくらい見られているかを知るため、Cloudflare, Inc. の「Cloudflare Web Analytics」を使っています。Cookie（クッキー）やブラウザの保存領域は使わず、利用者一人ひとりを識別する仕組みも使いません。見ているのは、ページごとの閲覧数、どこから来たか（参照元）、国、端末の種類、ブラウザ、OSなどを集計した数字です。掲載内容の改善と、対象とする地域を広げる順番を考えるためだけに使い、広告には使いません。Google Analytics など、広告を目的とする解析サービスは使っていません。</li>
          <li><strong>サーバーの記録</strong>　サイトの配信には、Cloudflare, Inc. のサービスを使っています。同社は、サイトを閲覧した端末のIPアドレスなど、通信に関する情報を、配信と安全の確保のために処理します。保管の期間などは、<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer" className="underline underline-offset-2">同社のプライバシーポリシー</a>に従います。自治体Watch自身は、閲覧した方のIPアドレスを取得・保存せず、この記録から個人を特定することもしません。</li>
          {form ? (
            <li><strong>お問い合わせのメールとフォーム</strong>　訂正・お問い合わせの窓口にメールをいただいた場合や、フォームから送信いただいた場合、書かれた氏名やメールアドレスなどは、ご指摘・ご意見の確認とご連絡のためだけに使います。法令に基づく場合を除き、ご本人の同意なく第三者に提供したり、公開したりしません。フォームはGoogleフォームで受け付けており、回答はGoogleのサーバーに保存されます。いただいたメールとフォームの回答は、対応が完了してから1年を目安に削除します。訂正履歴には、日付・対象・内容の要旨だけを載せ、ご指摘いただいた方の氏名やメールアドレスは載せません。</li>
          ) : (
            <li><strong>お問い合わせのメール</strong>　訂正・お問い合わせの窓口にメールをいただいた場合、メールに書かれた氏名やメールアドレスなどは、ご指摘の確認と返信のためだけに使います。法令に基づく場合を除き、ご本人の同意なく第三者に提供したり、公開したりしません。いただいたメールは、対応が完了してから1年を目安に削除します。訂正履歴には、日付・対象・内容の要旨だけを載せ、ご指摘いただいた方の氏名やメールアドレスは載せません。</li>
          )}
          <li><strong>外部のサイト</strong>　出典として案内している国や自治体などのサイトでの情報の扱いは、それぞれのサイトの定めによります。</li>
        </ul>
        <p>この取り扱いを変更するときは、このページでお知らせします。</p>
      </DocSection>
    </SitePageShell>
  );
}
