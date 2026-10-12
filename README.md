# 自治体Watch（jichitai-watch）

日本の地方自治体の基本的な情報を、誰もが簡単に見られるようにするためのウェブサイト「自治体Watch」（https://jichitaiwatch.jp）のソースコードとデータです。
まず岐阜県と県内42市町村を対象に、人口・財政・議会・くらしの指標を、公的な統計から集めて掲載しています。

- 広告は掲載しません。特定の政党・企業・団体の利害から独立した、中立的なデータ提供を目指しています。
- 議会活動などは評価・採点をせず、事実の記録として示します。
- データの誤りのご指摘は、サイトの「訂正」ページ（https://jichitaiwatch.jp/corrections）の窓口へお願いします。

## このリポジトリについて

このリポジトリは、公開用の写しです。開発は非公開の作業リポジトリで行い、公開してよいものだけをここに反映しています。
そのため、文書の中には、ここに含まれない運営側の内部文書（`launch-backlog.md` など）を参照している箇所があります。

## 中身の一覧

| 場所 | 中身 |
|---|---|
| `app/`・`components/`・`lib/` | サイト本体（Next.js の静的書き出し） |
| `public/` | そのまま配信するファイル（HTTP ヘッダの設定 `_headers` など） |
| `data/` | サイトが表示するデータ（JSON）。各ファイルの `sources` に取得元 URL・取得日・ハッシュを記録 |
| `scripts/` | データを取得・作成・検査するスクリプト |
| `scripts/patches/` | 公式サイトで個別に確認して補った値（スクリプトが自動で当て直す） |
| `scripts/qa/qa-browser-checks.md` | 実ブラウザでの画面検査ツールの使い方 |
| `poc/`・`handoff/`・`recon/` | `scripts/` が読む原本（取得した Excel・PDF など）の置き場 |
| `poc/pref-gikai-20260902/collection-procedure.md` | 都道府県議会の議長・副議長・会派の集め方 |
| `design/prefecture-outlines/prefecture-outlines-howto.md` | 都道府県の輪郭図の作り方 |
| `docs/succession-runbook.md` | データの作り直し・更新と、サイトのビルドの手順 |
| `docs/operations-runbook.md` | 定期的なデータ更新などの運用手順 |
| `docs/volunteer-guide.md` | 協力者向けの作業マニュアル |
| `docs/data-schema.md` | データ（JSON）の構造の仕様 |
| `docs/similar-group-aggregation-design.md` | 全国平均・類似団体平均・順位の計算方法 |
| `docs/frontend-architecture.md` | サイトの構成の仕様 |
| `docs/neutrality-ui-audit-checklist.md` | 中立性を保つための画面の点検表 |
| `docs/lessons-learned.md` | 作業でつまずいた点と対処（Tips） |
| `docs/licenses.md` | データの出典と利用条件の台帳 |
| `LICENSE`・`THIRD_PARTY_NOTICES.md` | コードのライセンスと、第三者素材の著作権表示 |

## ビルド

Node.js 24.11.1（`.nvmrc`）を使います。

```
npm ci
npm run build
```

静的なファイルが `out/` に作られます。データの作り直し・更新の手順は `docs/succession-runbook.md` を参照してください。

## ライセンスと著作権

- **コード**：MIT License（[LICENSE](./LICENSE)）。Copyright (c) 2026 自治体Watch Project
- **データ**：各データは日本の政府機関などが公開するデータに由来し、それぞれの提供元の利用条件に従います（MIT License の対象外）。提供元・利用条件・出典の書き方は [docs/licenses.md](./docs/licenses.md) を参照してください。
- **第三者素材**：アイコンなどの著作権表示は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) を参照してください。

---

## English

Jichitai Watch (https://jichitaiwatch.jp) publishes basic information about local governments in Japan, starting with Gifu Prefecture and its 42 municipalities, using public statistics. It carries no advertising and aims to stay neutral; council activity is recorded as facts, not scored.

- **Code**: MIT License. See [LICENSE](./LICENSE). Copyright (c) 2026 自治体Watch Project
- **Data**: Sourced from Japanese government open data and governed by each source's own terms, not by the MIT License. See [docs/licenses.md](./docs/licenses.md).

This repository is a public copy; development happens in a private working repository.
