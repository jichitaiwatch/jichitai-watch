# scripts/qa — 実ブラウザ検査スクリプト（画面崩れ・a11y）

`out/`（`npm run build` の静的書き出し）を Chromium(Playwright) で開いて検査する。**リポジトリのルートで実行**する。
ビルド前（`out/` が古い・無い）に実行しない。コードを変えたら毎回 `npm run build` してから検査する。

## 前提
- Playwright は環境に導入済み（グローバル）。Chromium は `/opt/pw-browsers`（`playwright install` は実行しない）。
- `NODE_PATH` にグローバルの `node_modules` を通す: `export NODE_PATH=$(npm root -g)`
- axe-core が無い環境は `npm i -g axe-core`。

## スクリプト
| ファイル | 目的 | 成功の目安 |
|---|---|---|
| `layout-sweep.js` | 代表31ページ×6幅(320/360/390/768/1024/1440px)で横あふれ・タップ領域24px未満を検査（内蔵サーバーで配信するので `serve.js` 不要） | 「横あふれ 0件」「タップ領域 0件」 |
| `axe-scan.js` | axe-core(WCAG2.0/2.1/2.2 A・AA＋best-practice)で代表ページを検査。色コントラストは前景/背景/比率/文字サイズ付きで列挙 | 違反0（`color-contrast` は C-7 の未了分を除く） |
| `nav-check.js` | リンクのクリックで各種別のページを巡り、全て画面の差し替え移動（全ページ読込でない）・4xx/5xx 0・`__next.*` への要求 0・JSエラー 0・検索が動くことを検査。全ページに `ページ名.txt` があり、`__next.*` の消し忘れが無いことも検査（内蔵サーバーで配信するので `serve.js` 不要。D-26）。Next.js の版を上げたら必ず実行 | 最後に「検査OK」（失敗は終了コード1） |
| `serve.js` | `out/` を `http://localhost:4174` で配信（brotli）。スクリーンショットを撮るときに起動 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4174/gifu-pref/gifu-shi/machi` が200 |
| `screenshot.js` | 指定ページを幅375/1280でフルページ撮影＋横あふれ有無。`serve.js` 起動後に実行 | 画像を目視（Readで開く） |

```
export NODE_PATH=$(npm root -g)
node scripts/qa/layout-sweep.js
node scripts/qa/axe-scan.js
node scripts/qa/nav-check.js
(setsid nohup node scripts/qa/serve.js >/dev/null 2>&1 &) ; sleep 2
node scripts/qa/screenshot.js /tmp/shot_ '[["machi","/gifu-pref/gifu-shi/machi"],["trend","/gifu-pref/gifu-shi/trends/spending"]]'
```

## 注意事項（過去に踏んだ落とし穴）
- **`pkill -f` でサーバーを止めない。** 実行中のシェルごと落ちる（exit 144）。`ps aux | grep "[s]erve.js"` で PID を確認して `kill <PID>`。
- サーバーは「コマンドが終わると一緒に落ちる」ことがある。起動は `(setsid nohup … &)` を使い、検査は別コマンドで行う。接続拒否（ERR_CONNECTION_REFUSED）が出たら再起動する。
- 開発サーバー（`npm run dev`）にスマホ実機からLAN接続して確認するとき、`next.config.ts` の `allowedDevOrigins` が無いとHMR通信が遮断されハイドレーションされず、Rechartsのグラフ等のクライアント描画が出ない（設定済み。`192.168.*.*` / `10.*.*.*`）。静的書き出しや本番には無関係。
- 開発サーバーが正しいURLで404になる場合は古い `.next` キャッシュ。Windows cmd: `taskkill /f /im node.exe 2>nul & rmdir /s /q .next 2>nul & npm run dev`。「Slow filesystem」の警告は無害。
- `<table className="sr-only">` は `<table>` 要素に効かず横あふれの原因になる。`<div className="sr-only"><table>…</table></div>` で包む。
- 経年画面のグラフは最新年が見えるよう右端までスクロールした状態で開く（縦軸は左に隠れる。仕様）。
- 検査結果の判定基準・経緯は `docs/launch-backlog.md` の C-4（崩れ・折返し・タップ領域）・C-7（a11y）。字サイズの仕組みは `docs/ui-vi-handoff.md` §4.9 と C-12。
