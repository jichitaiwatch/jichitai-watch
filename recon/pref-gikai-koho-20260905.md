# 都道府県版「議事録Web公開の有無」(B1) 手がかり確認（2026-09-05）

- 位置づけ：**recon生成物**。設計・状態の正本ではない。`docs/` 配下および `content-spec-v1.md`・`data/` は本作業で一切変更していない。
- 目的：`content-spec-v1.md` §7.16.2 残留作業(1)／都道府県版カード「議事録Web公開の有無」の**採否判断材料**として、既存 `data/pref_assembly.json` の出典URL（会派・正副議長）を起点に、47都道府県の議会サイトで会議録本文のWeb公開が辿れるかを確認する。新規の出典収集・JSON化はしない。
- 本作業でやっていないこと：採否の決定、`pref_assembly.json` へのフィールド追加、会議録本文の取得、システムごとの技術調査（Playwright要否の深掘り）。
- 判定定義（市区町村版 `content-spec-v1.md` §7.8 と同じ）：
  - **有**＝会議録本文（発言全文）のWeb公開がある。全文検索テキスト／会議録PDF／会議録検索システムを含む。
  - **無**＝議会トップから「会議録」「議事録」「本会議」等を最低2階層辿っても会議録本文カテゴリがない。議決結果一覧・議会だより・録画配信は本文ではない。
  - **確認できず**＝サイト到達失敗、または到達先が本文か判定不能。
- 確認方法：`pref_assembly.json` の `出典_grok`／`出典_composer`（会派・正副議長）またはそこから辿れる議会トップを起点に、パス構造だけの推測はせずリンクを辿る。1階層でヒットしなければカテゴリを2階層辿る。「無」は2階層到達後に本文不在を確認してから付ける。
- 起点ファイル：`data/pref_assembly.json`（読み取りのみ）。

---

## 1. 内訳

| 判定 | 件数 |
|---|---|
| 有 | **47** |
| 無 | **0** |
| 確認できず | **0** |

47件すべてで、既存出典URLまたは同一サイトの議会トップから2階層以内に、会議録本文（検索システムまたはPDF/HTML全文）へ到達した。市区町村版（有37／無5／未発見0）と異なり、都道府県版では「無」候補は出ていない。

公開形式の粗分類（主形式。併用がある県は「＋」で併記）：

| 主形式 | 件数（目安） | 備考 |
|---|---|---|
| 会議録検索システム（全文検索テキスト） | 大半（40件超） | kaigiroku.net / dbsr.jp / gijiroku.com / kensakusystem.jp / 独自ドメイン |
| 会議録PDFを公式HPに直接掲載 | 複数 | 長野・高知・大分・熊本・宮崎・沖縄・和歌山（HTML号単位）等。多くは検索システムも併用 |
| 動画のみ | 0 | 録画ページは本文判定に使っていない |

---

## 2. 47件一覧

階層数は「既知URLまたは議会トップから、会議録本文（またはその検索UI）に到達するまでのクリック相当」。1＝起点／トップに本文案内と到達先、2＝カテゴリを1段辿った。

| # | 都道府県 | 判定 | 公開形式 | 該当URL | 階層 | 起点（pref_assembly 出典から） | 根拠（到達先の見出し・文言） |
|---|---|---|---|---|---|---|---|
| 01 | 北海道 | 有 | 全文検索テキスト（会議録データベース）＋インターネット版 | https://www.gikai.pref.hokkaido.lg.jp/kaigiroku/ ／ https://pref-hokkaido.gijiroku.com/voices/index.asp | 2 | `www.gikai.pref.hokkaido.lg.jp`（正副議長・会派）→ 議会トップ | 公式「会議録データベース」は「どなたでも閲覧、検索をすることができます」（親エージェントが当該ページを再取得して確認） |
| 02 | 青森県 | 有 | 全文検索テキスト（＋速報版の告知） | https://www.pref.aomori.dbsr.jp/ | 1 | `www.pref.aomori.lg.jp/soshiki/gikai/` | 事務局「本会議の会議録、委員会等の記録の検索・閲覧ができます」 |
| 03 | 岩手県 | 有 | 全文検索テキスト（本会議。委員会は「会議記録」） | https://www.pref.iwate.jp/gikai/kaigiroku/1035822.html ／ https://iwatekengikai.gijiroku.com/kaigiroku_idx_s.asp | 1 | 会派出典が既に `iwatekengikai.gijiroku.com`。議会トップにも「会議録等」 | 「キーワードなどの条件を設定し、会議録等の本文を検索することができます」 |
| 04 | 宮城県 | 有 | 全文検索テキスト＋速報製本用PDF | https://www.pref.miyagi.jp/site/kengikai/ ／ https://ssp.kaigiroku.net/tenant/prefmiyagi/SpTop.html | 1 | `www.pref.miyagi.jp/site/kengikai/` | トップ「会議録の検索・閲覧」。検索登録までの間は製本用PDFを速報として掲載 |
| 05 | 秋田県 | 有 | 全文検索テキスト＋速報「本文」PDF | https://pref.akita.gsl-service.net/doc/2019012300013/ ／ https://ssp.kaigiroku.net/tenant/prefakita/SpMinuteSearch.html | 2 | 議長・会派出典（gsl-service）→ 公式トップ「会議録・インターネット中継」 | 「会議録検索システムでは…本会議（平成11年5月臨時会以降）」 |
| 06 | 山形県 | 有 | 会議録PDF（速報）＋全文検索テキスト | https://www.pref.yamagata.jp/600006/kaigirokusokuho/r0802teireikai.html ／ https://ssp.kaigiroku.net/tenant/prefyamagata/SpMinuteSearch.html | 1 | 議長あいさつ（議会トップ候補は403） | 議長ページ本文に「会議録の閲覧・検索」。親エージェントが当該ページを再取得して確認 |
| 07 | 福島県 | 有 | 全文検索テキスト＋冊子体裁PDF | https://www.pref.fukushima.lg.jp/site/gikai/kaigirokukensaku-top.html ／ https://ssp.kaigiroku.net/tenant/fukushima/pg/index.html | 1 | `www.pref.fukushima.lg.jp/site/gikai/` | 「ことば（キーワード）」「年」「発言者」を指定して検索。冊子と同じ形式のデータ |
| 08 | 茨城県 | 有 | 全文検索テキスト | https://www.pref.ibaraki.dbsr.jp/ | 2 | `www.pref.ibaraki.jp/gikai/` → サイトマップ「会議録検索」 | 「本会議は平成元年以降、委員会は平成3年以降の会議録を検索、閲覧」 |
| 09 | 栃木県 | 有 | 全文検索テキスト（本会議は全文。委員会は要約） | https://pref-tochigi.gijiroku.com/ | 1 | `www.pref.tochigi.lg.jp/kengikai/index.html` | 検索側「本会議会議録については、製本されるまでの暫定版」「委員会会議録については要約記録」 |
| 10 | 群馬県 | 有 | 全文検索テキスト | https://www07.gijiroku.com/voices/ | 1 | `www.pref.gunma.jp/site/gikai/` | トップ「会議録検索システム」。検索側「本会議の閲覧｜平成7年5月臨時会以降」 |
| 11 | 埼玉県 | 有 | 全文検索テキスト | https://www.pref.saitama.lg.jp/f1603/kaigiroku-kensaku.html ／ https://ssp.kaigiroku.net/tenant/prefsaitama/pg/index.html | 1 | 議長出典 `e1601/gikai-chairman.html` | 「会議録の内容を、検索したい言葉や発言者などで検索できます」 |
| 12 | 千葉県 | 有 | 全文検索テキスト（速報PDF枠あり） | https://www.pref.chiba.lg.jp/gikai/kaiginogaiyou/kaigiroku/index.html ／ https://pref-chiba.gijiroku.com/kaigiroku/index.asp | 1 | `www.pref.chiba.lg.jp/gikai/` | 「本会議及び各種委員会の会議録」「本会議・委員会等の全発言を対象に言葉で検索」 |
| 13 | 東京都 | 有 | 会議録検索＋本会議会議録HTML（速報含む）＋委員会速記録 | https://www.record.gikai.metro.tokyo.lg.jp/ ／ https://www.gikai.metro.tokyo.lg.jp/record/proceedings/ | 1 | `www.gikai.metro.tokyo.lg.jp` | トップ見出し「会議録・速記録」。検索系「本文から検索」 |
| 14 | 神奈川県 | 有 | 全文検索テキスト（kaigiroku.net） | https://ssp.kaigiroku.net/tenant/prefkanagawa/pg/index.html | 1〜2 | `www.pref.kanagawa.jp/gikai/` | 「会議録の発行（会議録の検索）」「本会議録については、平成15年5月臨時会以降」 |
| 15 | 新潟県 | 有 | 全文検索テキスト（kaigiroku.net） | https://ssp.kaigiroku.net/tenant/prefniigata/pg/index.html | 1 | `www.pref.niigata.lg.jp/site/gikai/` | 新着「会議録を掲載しました＜外部リンク＞」。到達先「会議録検索システム」 |
| 16 | 富山県 | 有 | 全文検索テキスト＋速報版PDF | https://www.pref.toyama.dbsr.jp/ | 1 | `www.pref.toyama.jp/0100/gikai/` | 「会議録と議決結果」「平成６年からの本会議…の会議録が登録」 |
| 17 | 石川県 | 有 | 全文検索テキスト（gijiroku.com） | https://pref-ishikawa.gijiroku.com/voices/ | 1 | 議会トップ／お知らせ | 「本会議会議録について」「会議録の検索」。定例会概要PDFは本文ではない（有の根拠に未使用） |
| 18 | 福井県 | 有 | 全文検索テキスト（dbsr） | https://www.pref.fukui.lg.jp/gikai/kaigiroku/index.html ／ https://www.pref.fukui.dbsr.jp/ | 2 | 議長あいさつには会議録なし → 議会ホーム | 「平成12年度（2000年度）以降の本会議、委員会の会議録から検索」 |
| 19 | 山梨県 | 有 | 本会議は検索システム、委員会は年度別PDF | https://www.pref.yamanashi.jp/gikaisom/kaigiroku.html ／ https://kaigiroku.pref.yamanashi.jp/ | 2 | 既知頁ナビ「定例会・臨時会」 | 「会議録検索システムで、本会議の会議録を御覧いただけます」 |
| 20 | 長野県 | 有 | 会議録PDF＋検索システム | https://www.pref.nagano.lg.jp/gikai/giji/kaigiroku/pdf.html ／ https://www.pref.nagano.lg.jp/gikai/giji/kaigiroku/index.html | 1 | 指定トップ `/gikai/` は403。既知URLフッタ「会議録」 | 「平成7年2月定例会以降の本会議…が閲覧・検索」。PDF全体版を取得し発言を確認 |
| 21 | 岐阜県 | 有 | 全文検索テキスト（kaigiroku.net）。特別委等は要点筆記PDF | https://www.pref.gifu.lg.jp/site/gikai/4531.html ／ https://ssp.kaigiroku.net/tenant/prefgifu/pg/index.html | 2 | `www.pref.gifu.lg.jp/site/gikai/` → 議会図書室 → 会議録検索システム | 「平成元年以降の本会議の会議録…がご覧いただけます」（親エージェントが4531.htmlを再取得して確認）。定例会の「概要／議決内容」は本文ではない |
| 22 | 静岡県 | 有 | 本会議・委員会ともNotes型会議録検索 | https://www2.pref.shizuoka.jp/all/ggiji.nsf/WebSearch | 1〜2 | `www.pref.shizuoka.jp/kensei/kengikai/` | トップ「本会議会議録」「委員会会議録」。到達先見出し「本会議会議録」と会期一覧 |
| 23 | 愛知県 | 有 | 全文検索テキスト（dbsr） | https://www.pref.aichi.dbsr.jp/ | 2 | トップに「会議録」ラベルなし →「議会の広報」 | 「インターネットによる会議録の閲覧と検索」「本会議会議録及び委員会記録」 |
| 24 | 三重県 | 有 | 検索システム＋本会議PDF＋委員会HTML | https://www.kensakusystem.jp/mie/index.html ／ https://www.pref.mie.lg.jp/KENGIKAI/51097008511.htm | 1〜2 | `www.pref.mie.lg.jp/KENGIKAI/` | 「平成元年以降の本会議録」。委員会HTML例「議会運営委員会 会議録」 |
| 25 | 滋賀県 | 有 | 全文検索テキスト（gijiroku.com系） | https://www.shigaken-gikai.jp/voices/g08v_viewh.asp ／ https://www.shigaken-gikai.jp/voices/g07v_search.asp | 1 | 会派出典が既に `shigaken-gikai.jp`。`pref.shiga.lg.jp/gikai/` は404 | 「昭和62年以降の本会議会議録を掲載」 |
| 26 | 京都府 | 有 | 全文検索テキスト（dbsr） | https://www.pref.kyoto.dbsr.jp/ | 1 | `www.pref.kyoto.jp/gikai/` | 「会議録中の言葉・詳細条件で検索が可能」。本会議は平成7年5月以降 |
| 27 | 大阪府 | 有 | 全文検索テキスト（kaigiroku.net） | https://www.pref.osaka.lg.jp/gikai/kaigirokukensaku.html ／ https://ssp.kaigiroku.net/tenant/prefosaka/pg/index.html | 1 | 正副議長・会派ページに「会議録検索」。別ドメイン会派ページは500 | FAQ「本会議及び委員会の会議録」「キーワード検索」 |
| 28 | 兵庫県 | 有 | 全文検索テキスト（kensakusystem.jp） | https://www.kensakusystem.jp/hyogopref/index.html | 1 | `web.pref.hyogo.lg.jp/gikai/` | 「議会中継・会議録」→「会議録検索」。昭和61年以降の本会議等 |
| 29 | 奈良県 | 有 | 全文検索テキスト（kaigiroku.net） | https://ssp.kaigiroku.net/tenant/prefnara/pg/index.html | 2（既知頁起点）／1（ポータル起点） | 既知頁側欄「委員会活動・委員会記録」 | 本会議は平成3年以降、委員会は令和4年以降。録画サイトは有に未使用 |
| 30 | 和歌山県 | 有 | HTML会議録（号単位の全文）＋キーワード検索 | https://www.pref.wakayama.lg.jp/gijiroku/d00203238.html | 2 | 議会トップ候補は初回タイムアウト。既知頁「県議会の活動」 | 「会議録全文を通して閲覧」。定例会目次に「◎第○号全文」 |
| 31 | 鳥取県 | 有 | 本会議は検索システム、委員会はHTML本文 | https://www.pref.tottori.dbsr.jp/index.php/ ／ 委員会例 https://www.pref.tottori.lg.jp/item/1433299.htm | 1〜2 | 既知頁「記録・報告」／議会トップ「本会議議事録検索」 | 本会議は平成7年5月以降。委員会ページに発言本文 |
| 32 | 島根県 | 有 | 全文検索テキスト（dbsr） | https://www2.pref.shimane.dbsr.jp/ | 1 | `www1.pref.shimane.lg.jp/gikai/` | 「会議録の検索(外部サイト)」「発言内容から検索」 |
| 33 | 岡山県 | 有 | 全文検索テキスト（kaigiroku.net） | https://ssp.kaigiroku.net/tenant/prefokayama/pg/index.html | 1 | `www.pref.okayama.jp/site/gikai/` | サイトマップ「会議録検索」「過去の会議録を検索できます」 |
| 34 | 広島県 | 有 | 全文検索テキスト（dbsr。公式表記は「議事録」） | https://www.pref.hiroshima.dbsr.jp/index.php/ | 2 | トップ1階層に「会議録」なし →「本会議情報」 | 「議事録は『議事録の閲覧と検索』ページで御確認」。本会議は平成3年5月以降。録画は有に未使用 |
| 35 | 山口県 | 有 | 全文検索テキスト（kaigiroku.net） | https://ssp.kaigiroku.net/tenant/prefyamaguchi/pg/index.html | 1 | `www.pref.yamaguchi.lg.jp/site/gikai/` | 「会議録検索＜外部リンク＞（本会議、常任委員会、議会運営委員会、特別委員会の会議録が検索できます）」 |
| 36 | 徳島県 | 有 | 全文検索テキスト（kaigiroku.net） | https://ssp.kaigiroku.net/tenant/tokushimapref/pg/index.html | 2 | トップ「過去の会議録についても検索」→ 本会議の概要 | 「平成3年以降の本会議会議録」 |
| 37 | 香川県 | 有 | 全文検索テキスト（dbsr） | https://www.pref.kagawa.dbsr.jp/ | 1 | `www.pref.kagawa.lg.jp/gikai/` | 「会議録の閲覧・検索」。ことば／発言者／会議名検索 |
| 38 | 愛媛県 | 有 | 全文検索テキスト（kensakusystem.jp） | https://www.kensakusystem.jp/ehime/index.html | 1 | `www.pref.ehime.jp/site/gikai/` | 「会議録検索システム＜外部リンク＞」。本会議録は平成3年第229回以降 |
| 39 | 高知県 | 有 | 会議録PDF（本会議「本文」）＋検索システム | https://gikai.pref.kochi.lg.jp/minutes/ ／ 本文例 `0802teireikaihonbun.pdf` | 2 | トップ本文には会議録メニューが薄い → サイトマップ | 第378回定例会本文PDFで「これより本日の会議を開きます」を確認 |
| 40 | 福岡県 | 有 | 全文検索テキスト（dbsr） | https://www.pref.fukuoka.dbsr.jp/ | 1〜2 | `www.gikai.pref.fukuoka.lg.jp/` | 新着「会議録を掲載しました＜外部リンク＞」。本会議情報末尾「会議録検索システムはこちら」 |
| 41 | 佐賀県 | 有 | 全文検索テキスト＋会議録PDF／速報 | https://www.pref.saga.dbsr.jp/index.php/ ／ https://www.pref.saga.lg.jp/gikai/list01856.html | 1 | `www.pref.saga.lg.jp/gikai/` | 「会議録の検索」。本会議・委員会録の本文検索 |
| 42 | 長崎県 | 有 | 会議録PDF＋検索システム（kaigiroku.net） | https://www.pref.nagasaki.lg.jp/gikai/ ／ https://ssp.kaigiroku.net/tenant/prefnagasaki/pg/ | 1 | `www.pref.nagasaki.lg.jp/gikai/` | 新着に本会議録PDF。委員会録PDFで総括質疑の発言全文を確認 |
| 43 | 熊本県 | 有 | 本会議録PDF＋検索システム | https://www.pref.kumamoto.jp/site/gikai/list4-1079.html ／ https://ssp.kaigiroku.net/tenant/prefkumamoto/pg/index.html | 1 | `www.pref.kumamoto.jp/site/gikai/` | 「本会議録(PDF)」「昭和55年9月定例会からの本会議録が検索できます」 |
| 44 | 大分県 | 有 | 会議録PDF（本会議）。委員会は「会議記録」PDF | https://www.pref.oita.jp/site/gikai/kaigroku001.html | 2 | `www.pref.oita.jp/site/gikai/` → 定例会・臨時会 → 会議録 | 令和4〜8年の本会議録PDFを年度別に掲載（親エージェントが当該ページを再取得して確認）。ナビの「県議会検索システム」本体URLは本作業では未特定（有の根拠に未使用） |
| 45 | 宮崎県 | 有 | 会議録PDF＋検索システム | https://www.pref.miyazaki.lg.jp/gikai/minutes/plenary/index.html | 1 | `www.pref.miyazaki.lg.jp/gikai/` | 「本会議の会議録を検索・閲覧できます」。フルバージョンPDF（例：令和8年6月定例会） |
| 46 | 鹿児島県 | 有 | 全文検索テキスト（dbsr） | https://www.pref.kagoshima.jp/aa02/gikai/koremade/kaigirokukensaku.html ／ https://www.pref.kagoshima.dbsr.jp/ | 1〜2 | 指定トップ `aa02/gikai/` はForbidden。既知の会派頁フッタ「会議録検索」 | 「本会議(昭和60年～)及び委員会（平成7年～）の会議録を言葉や発言者名から検索」（親エージェントが案内ページを再取得して確認） |
| 47 | 沖縄県 | 有 | 会議録PDF＋検索システム | https://www.pref.okinawa.lg.jp/kensei/gikai/1040847/index.html ／ https://ssp.kaigiroku.net/tenant/prefokinawa/SpTop.html | 1 | `www.pref.okinawa.lg.jp/kensei/gikai/` | 「会議録の閲覧と検索（本会議、委員会）」。平成28年以降は新システム |

---

## 3. 到達障害・取り違え防止

辿ったが本文判定に使わなかったもの（市区町村版と同じ峻別）：

- 議決結果・賛否・定例会「概要」PDF（石川・岐阜・愛知など）
- インターネット中継・録画配信（奈良・広島・福井など）
- 議会だより・広報紙
- 冊子版の館内閲覧案内だけ（山口「会議録の閲覧場所」など）

起点・トップが開けなかったが、既知URLから代替到達できたもの：

| 県 | 障害 | 代替 |
|---|---|---|
| 山形県 | 議会トップ候補 `.../kensei/assembly/` が403 | 議長あいさつ（出典URL）から「会議録の閲覧・検索」 |
| 長野県 | `/gikai/` が403 | 既知URLフッタ「会議録」 |
| 滋賀県 | `pref.shiga.lg.jp/gikai/` が404 | 会派出典ドメイン `shigaken-gikai.jp` |
| 大阪府 | `gikai.pref.osaka.lg.jp` 会派頁が500 | `pref.osaka.lg.jp` 側の会議録検索案内 |
| 和歌山県 | 議会トップ候補が初回タイムアウト | 既知頁「県議会の活動」 |
| 鹿児島県 | `aa02/gikai/` Forbidden、`ha01/gikai/` タイムアウト | 会派名簿（出典URL）フッタ「会議録検索」 |

栃木県は本会議が全文、委員会が要約。本会議本文があるため「有」（委員会要約だけでは「有」にしない、という定義は維持）。

岐阜県は本会議・常任・決算特委が全文検索、特別委・協議会は要点筆記。本会議全文があるため「有」。

---

## 4. 既存出典URLが手がかりになったか

- **なった（47/47）**。会派・正副議長ページは会議録本文そのものではないが、同一ドメイン（または同一議会サイト群）のナビ／フッタ／関連リンクから、2階層以内に会議録本文へ辿れた。
- 例外的に起点ページ自体に会議録リンクが無い県（福井・愛知・広島・高知など）も、議会トップまたは1段上のカテゴリ（広報／本会議情報／サイトマップ）で到達した。パスを捏造してはいない。
- 岩手・滋賀は会派出典が既に会議録システムドメイン（`gijiroku.com` 系）だった。
- したがって「新規の47県探索をゼロから始める」必要は、手がかりの観点では小さい。採否とJSON化は別判断。

---

## 5. 採否判断に渡す事実（判断はしない）

- 手がかりの到達コストは、市区町村版の「無5件を2階層追認」より低い（全件が有で、無の追認作業が発生していない）。
- 公開形式は検索システムが支配的で、テナント（kaigiroku.net / dbsr / gijiroku.com / kensakusystem）が分かれる。V2会議録パイプライン（`docs/v2-gikai-pipeline-handoff.md`）と同型の技術差が県版でも再現する。
- カードが要求するのは「有／無／確認できず」の事実提示であり、本文取得は不要。本reconの47/47「有」は、その3値カードを埋める材料としては足りる。
- 本reconはスナップショット（2026-09-05）。URL移転・システム更新で変わりうる。

---

## 6. 作業時間（コスト見積もり用）

| 内訳 | 目安 |
|---|---|
| 壁時計 | 約35分（47件を4班並列で実ページ辿り＋親が北海道・山形・岐阜・大分・鹿児島を再取得して突合） |
| 直列換算 | 県あたりおおよそ2〜4分。47件なら約2〜3時間 |
| 環境変更 | なし（Web取得のみ。pip/npmなし） |
| 新規ダウンロードした会議録本文 | なし（判定に必要な案内ページと、高知・長野等で本文確認に使ったPDFの閲覧のみ） |

市区町村42団体×個別サイト収集（Batch2）より、都道府県47はサイトが単一・導線が太い分だけ安い。ただし検索システムの中身（JS-SPA）まで本文を機械取得するとコストは別物になる（本タスクの範囲外）。
