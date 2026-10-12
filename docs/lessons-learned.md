# 技術的な躓きと対処

作成日: 2026-08-06
位置づけ: `docs/review-2026-08.md` §5-Bの後続実装。技術的な躓きと対処法のみを扱う。運用ルール・ボランティア向け手順は`docs/volunteer-guide.md`、Cursorの実行時制約の原文は`.cursorrules`を参照。

---

## 環境構築

### create-next-appは空ディレクトリを要求する

- 症状: 既存ファイルがあるディレクトリで`create-next-app`を実行すると失敗する。
- 対処: 隣接ディレクトリへ既存ファイルを一時退避してから実行し、完了後に戻す。

### npm installのpeer dependency警告（訂正済み）

- 当初の想定: eslint-config-nextがESLint 10未対応で`--legacy-peer-deps`が必要という前提があった。
- 実際: 現在の固定バージョン（ESLint 10.8.0 + eslint-config-next 16.2.12）は完全な`package-lock.json`を生成しており、競合なく解決する。`--legacy-peer-deps`は不要。
- 教訓: バージョン起因の問題は記憶に頼らず、その時点のpackage.json/lockfileを確認する。フラグでの隠蔽よりバージョンピンでの解決を優先する。

### npm installが遅い（Windows特有）

- 原因: `node_modules`内の数万の小ファイルに対するWindows Defenderのリアルタイムスキャンが遅延の主因。
- 対処: リポジトリフォルダとnpmキャッシュをDefenderの除外対象に追加する。lockfile確立後は`npm install`でなく`npm ci`を使う（依存解決をスキップし、lockfile通りに再現的インストールする）。

### Cursorがnpm install無応答中に勝手に複数コマンドを実行した

- 原因: エージェントが「長時間無出力＝ハング」と誤認し、"助けよう"として別コマンドを実行する。`npm install`は数分間無出力になることがある。
- この事象への恒久対策（環境系コマンドをエージェントに実行させない等）は運用ルールとして`.cursorrules`・`docs/volunteer-guide.md`に記載する。本節は事象と原因の記録に限定する。

---

## データ取得

### PDFのCIDフォントはpdfplumber/PyMuPDFで文字化けする

- 症状: M1（こども家庭庁の乳幼児等医療費援助実施状況PDF）はMS-PGothic CIDフォントを使用しており、pdfplumber・PyMuPDFでは正しく抽出できない。
- 対処: Poppler `pdftotext -enc UTF-8`のみが有効。ページ区切り`\x0c`で分割し、ヘッダートークンを除去してパースする方式で確立済み。

### e-Stat統計表は古い年度で更新が止まっていることがある

- 症状: e-Stat統計コード00200251は2021年10月が最終更新で、全265テーブルが平成30年度（FY2018）で終端していた。令和2〜5年度分は存在しない。
- 対処: 総務省の直接公開ページ（決算統計・財政状況資料集）を優先ソースとする。旧statdisp_idを使えばFY2018以前のデータは再現可能だが、cat01/cat03/cdTimeフィルタが必須（APIの10万行上限を回避するため）。
- 教訓: e-Statのstat_infid・tstatは統計ごとに更新タイミングがまちまちなため、疎通確認時に必ず最新年度の有無を確認する。

### kaigiroku.netはheadless browser不要、JSONP形式で完結する

- 当初の想定: SPAのためPlaywright等のheadless browserが必要と想定していた。
- 実際: `requests.Session()`のみで検索から本文取得まで完結する。エンドポイントはJSONP形式（`callback`パラメータは任意の文字列でよい）。セッションは`sid_search`クッキーに依存するため、検索ページに一度GETしてクッキーを発行させてからPOSTする必要がある。
- tenant_idはHTML/JSに埋め込まれており、`web_fetch`・`curl`では取得できない。DevToolsのPayloadタブでの手動確認が唯一の方法。

### 打ち切り検知ヒューリスティックの穴

- 症状: 「件数がキリの良い数字（50/100/150等）」を検知する簡易ヒューリスティックは、中津川市で4年連続28件という「複数年で同一件数」のパターンを検知できなかった（実害はなく、手動確認で実数と判明）。
- 教訓: ヒューリスティックによる打ち切り検知は万能ではない。今回は空振りだったが、他ソースへ一般化する際はこの穴を踏まえて改善する。

---

## Git運用

### `git add .`は無関係な変更を混在コミットさせる

- 症状: 未コミットのスキャフォールドファイルとCLAUDE.md編集が同一コミットに混ざる。
- 対処: 完了した作業単位ごとに対象ファイルを明示して`git add <file>`し、即座にコミットする。

### 手元の`package-lock.json`の未コミット変更で`git pull`が止まる（2026-10-03）

- 症状: `git pull origin main & npm ci & npm run dev`を1行で実行すると、`git pull`が「Your local changes to the following files would be overwritten by merge: package-lock.json」で中止する。`&`連結のため後続の`npm ci`・`npm run dev`は古いコードのまま実行され、「更新したのに画面が変わらない」ように見える。
- 原因: 手元で`npm install`等を実行すると`package-lock.json`が書き換わる。リモート側でも同ファイルが更新されると衝突する。
- 対処: 手元の`package-lock.json`はリモートが正本なので、`git checkout -- package-lock.json`で破棄してから`git pull`する。実行中の`npm run dev`は先にCtrl+Cで止める（止めないと`npm ci`がファイル使用中で失敗する）。連結は`&`でなく`&&`にして、`git pull`が失敗したら後続を実行しない。

### AIツールの中で`next dev`を起動すると`CLAUDE.md`に注意書きが自動追記される（2026-10-04）

- 症状: Claude Code 上で `npm run dev` を起動した後、`CLAUDE.md` の末尾に `<!-- BEGIN:nextjs-agent-rules -->`〜`<!-- END:nextjs-agent-rules -->` の英語ブロック（「This is NOT the Next.js you know …」）が書き足され、未コミット変更として残った。
- 原因: Next.js 16.3 系の `next dev` は、AIのコーディング支援ツールの中で起動されたと判断すると、`AGENTS.md` か `CLAUDE.md` にこのブロックを書き込む（`node_modules/next/dist/server/lib/app-info-log.js` の `ensureAgentRulesForDev` → `generate-agent-files.js`）。判断は環境変数で行い、対象は Claude Code（`CLAUDECODE` 等）・**Cursor のターミナル（`CURSOR_TRACE_ID` 等）**・Codex・Gemini CLI・GitHub Copilot ほか（`next/dist/compiled/@vercel/detect-agent`）。普通のコマンドプロンプトでの起動では書かれない。`AGENTS.md` が既にブロックを持っていれば `CLAUDE.md` には書かない。
- 対処: `CLAUDE.md` は運用規則の正本のため、追記は取り込まず `git checkout -- CLAUDE.md` で戻した。AI側の画面確認は `npm run build` ＋ `scripts/qa/` の静的配信で行い、`next dev` は起動しない。Cursor のターミナルで `npm run dev` を使う場合も同じ追記が手元で起き、`git pull` を止める原因になりうる。恒久対策（取り込む／`AGENTS.md`へ逃がす）は `launch-backlog.md` K-5 で裁定する。

### 空文字で置いた定数との比較が、値を入れた瞬間に型エラーになる（2026-10-04）

- 症状: `export const CF_BEACON_TOKEN = "";` と置き、`CF_BEACON_TOKEN !== ""` で判定していた。仮の値を入れて `npm run build` すると `TS2367: This comparison appears to be unintentional` で型検査に失敗した。空のままではビルドが通るため、本番の値を入れる時まで気づけない。
- 原因: TypeScript は `const` の文字列を「その文字列そのもの」の型として扱うため、値を入れると `""` との比較が「常に偽」と判定される。
- 対処: 後から値を入れる定数は `export const X: string = "";` と型を明示する。値を入れた状態でも一度ビルドして確かめる。

### 手元で`npm ci`が数時間止まったように見え、強制終了を重ねると`node_modules`が壊れる（2026-10-04）

- 症状: 取り込み（git pull）の直後に`npm ci`を実行すると、画面が回転表示のまま2時間以上進まなかった。止めて再実行した2回目は約15〜20分かかり、`added ○○ packages`の行が出ないまま入力待ちに戻った。`npm ls --depth=0`は`next`・`react-dom`・`recharts`・`typescript`・`eslint`・`@types/node`を`invalid`（版が読めない）と報告し、数百の部品が`extraneous`と出た（主要部品が壊れた連鎖で、数百個すべてが壊れたわけではない）。
- 原因（推定・確証なし）: 手元のディスクの書き込みが遅く（Node.jsのディスク欄で約0.2MB/秒）、数万ファイルの`node_modules`の削除と展開に長時間かかる。その途中で強制終了を重ねたため、`node_modules`が中途半端な状態で残った。
- 対処: node の処理を終了→`rmdir /s /q node_modules`で直接削除→残っていないことを確認→`npm ci`の出力をファイルへ書き出して実行（画面には何も出ない。`done`と出るまで待つ）。結果は26分で`added 403 packages`。表示された「5 high severity vulnerabilities」は既知（D-12・開発用の`braces`系）。
- 教訓: (1) `package.json`と`package-lock.json`が取り込みで変わっていないなら`npm ci`は不要。pullの案内に機械的に入れない（今回は不要だった）。(2) 手元では数十分かかりうる。待ち時間の目安を先に伝え、止まったように見えても止めさせない。進行はタスクマネージャーのNode.jsのディスク欄で見る。(3) 完了は`added`の行、または`npm ls --depth=0`に`invalid`が出ないことで確認する。

---

## 未収載（今後追記候補）

- M2/M3データ検証で発見された欠損パターン（要介護認定率の「－」表記など）は、現状`content-spec-v1.md`とスクリプトのdocstringに記載済みのため、重複回避のため本ファイルへの転記は保留する。
