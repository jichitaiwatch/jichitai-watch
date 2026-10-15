# 承継手順書（データ更新・ビルド）— 自治体Watch

> この文書は、自治体Watch のデータを作り直し・更新し、サイトをビルドするための手順です。内部知識のない第三者が、読んで実行すれば再現できることを目標にしています。
> 節番号は運営側の内部手順書と共通です（欠番の §0・§2・§5・§7 は、アカウント管理・訂正対応など運営側の内部手順で、公開していません）。
> 本文中の `launch-backlog.md`・`security-model.md`・`20260808_decisions.md` などは運営側の内部文書を指し、このリポジトリには含まれません。

---

## 1. システム全体像（`git ls-files` に基づく）
- **技術スタック**：Next.js 16.3.8 / React 19.2.8 / TypeScript 5.9.3 / Tailwind v4。静的エクスポート（`next.config.ts`＝`output:'export'`・`images.unoptimized`）。Node **24.11.1**（`.nvmrc`）。データ加工は Python（`scripts/`）。
- **リポジトリ構成**（単一リポジトリ）：
  - `app/` App Router。公開ルートは `gifu-pref` 固定リテラル配下（`[city]`／`[city]/[tab]`／`[city]/trends/[category]`／`machi`・`gyosei`・`gikai`・`kurashi` の4入口）。※固定リテラルは D-2（他県2件目で動的化）。
  - `components/` 表示カード約40点（`MunicipalityDashboard.tsx` ほか M1〜M3・pref 各カード）。
  - `lib/` `metrics.ts`／`municipalities.ts`／`prefectures.ts`／`card-registry.tsx`／`pref-*`。
  - `data/` 公開データJSON（`m1_*`・`m2_*`・`m3_*`・`pref_*`・`gikai_assembly`・`pref_comparison_*`）。
  - `scripts/` データ取得・整形・検査（一覧と実行順は §3）。
  - `docs/` 手順・仕様・出典台帳（公開分。一覧はルートの `README.md`）。
  - `poc/`・`handoff/`・`recon/` は、`scripts/` が読む原本（取得した Excel・PDF 等）の置き場（**公開サイトには含まれない**）。
  - 設定：`package.json`・`next.config.ts`・`tsconfig.json`・`postcss.config.mjs`・`eslint.config.mjs`・`.nvmrc`・`.npmrc`。
- **データの流れ**：上流（総務省/厚労省/こども家庭庁/e-Stat）→ `scripts/*.py`（取得→`data/cache/`→整形）→ `data/*.json` → `next build` で静的サイト。

## 3. データ更新手順（実スクリプトに基づく）

**共通準備**：Python 3系。依存インストール `pip install -r scripts/requirements.txt`（requests / xlrd / openpyxl）。各スクリプトはリポジトリのルートから実行。多くが上流を取得し `data/cache/` に保存してから `data/*.json` を生成する。

### 3.0 データ更新の全体の流れ（2026-10-12 追記）
個々のスクリプトの使い方は §3.1〜§3.7。ここでは、1回の更新を始めから終わりまで通す順序を示す。
1. **更新の時期か確かめる**：`update_calendar.yaml` を開き、`next_check` が今日より前の項目を探す（一覧は §8）。カレンダーに無いデータは、各 JSON の `sources` に記録された取得元を開いて、新しい版が出ているかを確かめる。
2. **原本を取り直す**：ネットワークから取得するスクリプトはそのまま実行する。`poc/` の原本を読むスクリプトは、取得元から新しい原本を取り直して `poc/` に置き、スクリプト内の入力パスを差し替える（§3.5 冒頭）。**ダウンロードした Excel は開いて保存し直さない**（§3.7「再実行して分かった注意」）。
3. **データを作る**：該当するスクリプトを実行する（§3.1〜§3.7）。
4. **順序のあるものを続けて実行する**：基本形を作り直したデータは、続けて §3.5 の比較スクリプトを実行する（実行しないと比較値が消える）。`pref_*` を作り直したら `build_pref_comparison.py`。自治体マスタか読みを変えたら §3.6。
5. **変化を確かめる**：`git status` で変わったファイルを、`git diff` で値の変化を見る。次のどれかに当たれば、公開する前に原本と突き合わせる（`operations-runbook.md` 4節）：数値が前回から±30%以上変わった、対象の自治体の数が減った、必須の項目が消えた。日付（`updated`・`fetched_at`・`generated_at`）だけの変化は正常。※この確認を自動で行う仕組みは、まだ無い（`operations-runbook.md` 冒頭「実装状況」）。
6. **ビルドして画面で確かめる**：§4 の手順でビルドし、変えたデータを表示するページを開いて、値と、データの時点の表示が新しい版になっていることを確かめる。
7. **カレンダーを更新する**：`update_calendar.yaml` の該当項目の `last_fetched`（取得した日）と `next_check`（次に確かめる日）を書き換える。
8. **公開する**：変更を commit し、§4 の手順で反映する。公開後に本番のページで値を確かめる。

### 3.1 V1コア（岐阜42市町村・3指標）
| 指標 | コマンド | 出力 | 取得元 | 周期 / 次回確認 | 検証 |
|---|---|---|---|---|---|
| M1 こども医療費助成 | `python scripts/m1_kodomo_iryohi.py`（動作確認 `--test`＝岐阜市のみ） | `data/m1_kodomo_iryohi.json` | こども家庭庁（R7.4.1時点・別紙3 PDF。2026-10-07 R6から更新） | yearly / 2026-12-01 | §3.4 の回帰チェック |
| M2 介護保険料基準額 | `python scripts/m2_kaigo_premium.py`（`--inspect` 列確認／`--test` 3件） | `data/m2_kaigo_premium.json` | 厚労省 第9期 xlsx | 3years / 2027-04-01（第10期） | 同上 |
| M3 一人あたり分野別支出 | `python scripts/m3_expenditure.py`（`--test`＝岐阜市のみ） | `data/m3_expenditure.json` | 総務省 市町村別決算状況調（FY2024・令和6年度。2026-10-12 更新）。入力は `poc/recon-20260830/raw/` の6ファイル（ネットワークに接続しない。原本が無いと取得元URLを表示して止まる）。列は見出しの文字から特定して自己検証する | yearly / 2027-03-01 | 同上 |

### 3.2 都道府県版（§7.16系）
- `python scripts/build_pref_kessan.py` → `data/pref_kessan.json`（総務省 都道府県決算状況調 R6/R5）
- `python scripts/build_pref_fiscal_indicators.py` → `data/pref_fiscal_indicators.json`（主要財政指標＋健全化判断比率）
- `python scripts/build_pref_expenditure_percapita.py` → `data/pref_expenditure_percapita.json`（e-Stat R6）。**依存**：先に `data/m3_expenditure.json` と `data/pref_kessan.json` を生成しておくこと。

### 3.3 経年（multiyear）
実行順：`python scripts/fetch_multiyear_kessan.py`（A/B/C用Excelを `data/cache/` に一括取得）→ `python scripts/build_multiyear_ab.py`（→ `data/m3_expenditure_multiyear.json`・`data/m2_3_finance_scale_multiyear.json`）→ `python scripts/build_multiyear_c.py`（→ `data/m2_4_kenzenka_shichoson_multiyear.json`）→ `python scripts/verify_multiyear_kessan.py`（自己検証を `data/_verify_multiyear.txt` に出力）。

### 3.4 データ系譜・検証
- `scripts/lineage.py`：`sources[]` メタ構築ヘルパー。正本＝`docs/data-schema.md` 5節、運用＝`docs/operations-runbook.md` 6節。
- 更新後は前回JSONとの差分を取り、±30%変動・対象自治体数の減少・必須フィールド欠落を人間レビューに回してから公開（`operations-runbook.md` 4節）。
- 注：`scripts/kaigiroku_prototype.py` はV2会議録取得の試作で**V1対象外**。

### 3.5 まち・くらし・議会の比較値と追加カード（2026-10-08 追記・launch-backlog.md E-8）
**共通**：ネットワークに接続しない。入力は `poc/` に保存した原本（Excel・テキスト）と、類似団体区分マスタ `poc/recon-20260828/0/ruikei_kubun_r06.xlsx`。各スクリプトは表題・単位・列見出しをコードで確かめ、合わなければ書き出さずに止まる。新しい年次へ更新するときは、スクリプト冒頭の説明にある取得元から原本を取り直して `poc/` に置き、スクリプト内の入力パスを差し替える。比較値（全国平均・類似団体平均・全国順位）の計算方法の正本は `docs/similar-group-aggregation-design.md`。

| コマンド | 書き出すファイル | 入力（`poc/` 内） | 前提 |
|---|---|---|---|
| `python scripts/m1_1a_population_comparison.py` | `data/m1_1a_population_timeseries.json` の最新年（令和8年）の値に比較値を追加 | `recon-20261012-juki-r8/` 住基人口 令和8年（総務省ファイル000892952） | 生値の JSON があること（§3.7） |
| `python scripts/m1_1b_single_household_aging_comparison.py` | `data/m1_1b_single_household.json`・`data/m1_1c_aging_rate.json` に比較値を追加 | `recon-20261012-kokusei2025/` 令和7年国勢調査 第9-1表（家族類型）、`recon-20261012-juki-r8/` 住基 年齢 令和8年（総務省ファイル000892953） | 同上 |
| `python scripts/m1_2a_industry_comparison.py` | `data/m1_2a_industry.json` に比較値を追加 | `recon-20260828/1-2a/` 国勢調査 従業地 | 同上 |
| `python scripts/m1_2b_daynight_comparison.py` | `data/m1_2b_daynight.json` に比較値を追加 | `recon-20260828/1-2b/` 国勢調査 昼夜間人口 | **入力ファイルがリポジトリに無い**（E-8） |
| `python scripts/m1_2c_taxable_income.py` | `data/m1_2c_taxable_income.json`（新規生成） | `poc/recon-20261012-sugata-city2026/` 統計でみる市区町村のすがた2026 C経済基盤（statInfId 000040463586・2024年の値。2026-10-12 に2025年版から更新） | 県版 `data/pref_1d_taxable_income.json`（先に作っておく。突合に読む） |
| `python scripts/m4_5_furusato.py` | `data/m4_5_furusato.json`（新規生成） | `recon-20261007-furusato/` 総務省 受入額・控除額、`recon-20260828/1-1a/` 住基人口 | `data/m1_kodomo_iryohi.json`（42団体の名前とコードの照合に使う） |
| `python scripts/gikai_3_2_teiin_comparison.py` | `data/gikai_assembly.json` に比較値を追加 | `recon-20260828/3-2/` 総務省 議員定数調（PDF とそこから抜き出したテキスト） | 再実行できる（2026-10-08 修正：裁定済みの3件が適用済みでも止まらず、出典・注記も重複しない）。**次の年次更新で新しい議員定数調に差し替えると、定数が変わった団体は「想定外の不一致」として止まる。これは設計どおり**で、変わった団体を確認して裁定してから、`KNOWN_UPDATES` に加える |

**成功の確認方法**：実行後、`git status` で変わったファイルを見て、`git diff` で値の変化を確かめる。同じ原本で再実行した場合は、`updated` の日付以外は変わらない（2026-10-08、上の表の4本〈1-1a・1-1b・2a・ふるさと納税〉で確認済み）。値が変わったときは §3.4 の回帰チェックに回す。

### 3.6 自治体マスタ・読み・検索索引
| コマンド | 書き出すファイル | 取得元・前提 |
|---|---|---|
| `python scripts/gen_municipality_master.py` | `data/municipality_master.json`、あわせて §3.5 の M1 系 JSON と `data/m1_kodomo_iryohi.json` に `area_code` を付ける | 総務省「全国地方公共団体コード」（ネットワーク接続あり。取り込んだ原本は `data/cache/`）。`--attach-only` は取得せず `area_code` の付与だけを行う（再実行しても変化なし＝2026-10-08 確認） |
| `python scripts/gen_municipality_kana.py` | `data/municipality_kana.json`（全国の読み） | 同上 |
| `python scripts/gen_search_index.py` | `data/search_index.json` | 上の2ファイルから作る。**自治体マスタか読みを更新したら、ビルドの前に必ず実行する**（再実行しても変化なし＝2026-10-08 確認） |

- 自治体を追加する、またはデータ JSON を作り直したときの順序：データ生成（§3.1〜§3.5）→ `gen_municipality_master.py --attach-only` → `gen_search_index.py` → §4 のビルド。
- `scripts/gen_gifu_kana.py`（岐阜県分の読み）は、現在は使っていない（`data/gifu_kana.json` は存在せず、全国版の `gen_municipality_kana.py` に置き換わっている）。

### 3.7 国勢調査・住基・選挙・財政・学校など、一括で作るデータ（2026-10-08・E-8）
次のデータの作成スクリプトは、すべて `scripts/` にある（2026-10-08 に `poc/` から移した。移動前後で出力が一致することは、別の作業フォルダからの実行も含めて確認済み。違いは実行時刻の記録のみ）。**原本（取得したExcel等）は引き続き `poc/` と `handoff/` にある**。どれもリポジトリのルートから `python scripts/<スクリプト>` で実行する（入力パスはスクリプト内に定義。どのフォルダから実行しても動く）。取得元の URL・取得日・ハッシュは、各 JSON の `sources` にも記録されている。

| データ | スクリプト | 入力（原本） | 取得元 | 状態 |
|---|---|---|---|---|
| `m2_1_chief.json` | `scripts/build_m2_1_chief.py` | `poc/recon-20260830/raw/{年}_shikucyouson.xlsx`（2018〜2025の8本） | 自治総研「自治体選挙結果調査」の年版Excel。URL はスクリプト内 `SOURCE_FILE_URLS`。利用条件：申請不要・出典明記（実施機関名＋「自治体選挙結果調査」） | 再実行で現行データと一致（手作業の補正は自動で当て直す。下記） |
| `pref_governor.json` | `scripts/build_pref_governor.py` | `poc/recon-20260830/raw_pref/`（2018〜2024の7本） | 自治総研の都道府県版Excel（URL はスクリプト内）。日付が+1年ずれた行は補正して `data_correction_log` に記録 | 再実行で現行データと一致（手作業の補正は自動で当て直す。下記） |
| `m2_2_finance.json` | `scripts/build_m2_2_finance.py`。先に `scripts/fetch_m2_2_raw.py` を実行して原本を `raw/` へ取得する | `poc/recon-20260830/raw/` の総務省 xlsx（`001061669` ほか。ファイル名はスクリプト内） | 総務省 R6／R5 決算状況調 | 再実行で現行データとバイト一致（2026-10-08）。`fetch_m2_2_raw.py` は原本が `raw/` に無いときだけ要る。`fetch_raw.json`（中間ファイル）が無くても、ビルドは JSON の `sources` に記録された取得日と原本のハッシュを使う |
| `m1_1b_single_household`・`m1_2a_industry`・`m1_2b_daynight`・`pref_1b_single_household`・`pref_2a_industry`・`pref_2b_daynight` | `scripts/build_kokusei_json.py`（単身世帯だけ作り直すときは末尾に `single` を付ける。産業・昼夜間の既存JSONを消さないため） | 単身世帯＝`poc/recon-20261012-kokusei2025/`（令和7年）、産業・昼夜間＝`poc/recon-20260828/1-2a/`・`1-2b/`（令和2年） | e-Stat 国勢調査（statInfId 000040506456〔令和7年〕／000032214499／000032214141〔令和2年〕） | 再実行で一致（基本形。比較値は §3.5 で追加） |
| `m1_1c_aging_rate`・`pref_1c_aging_rate` | `scripts/build_koreika_json.py` | `poc/recon-20261012-juki-r8/soumu_000892953_juki_shichoson_age_r8.xlsx`（令和8年1月1日） | 総務省 住基 年齢階級別（ファイル000892953） | 再実行で一致（基本形。比較値は §3.5 で追加） |
| `pref_1a_population` | `scripts/build_pref_population_json.py` | `poc/recon-20261012-juki-r8/soumu_000892948_juki_pref_pop_hh_r8.xlsx`（令和8年1月1日） | 総務省 住基 都道府県別（ファイル000892948） | 再実行で一致 |
| `pref_1d_taxable_income` | `scripts/build_pref_income_json.py` | `poc/recon-20261012-pref-sugata2026/estat_000040412525_sugata_pref2026_D_gyosei.xls`（OLE形式。xlrd で読む。2026-10-12 に経路Aへ切替） | e-Stat 統計でみる都道府県のすがた2026 D行政基盤（000040412525） | 再実行で一致。入力のハッシュ・原表の順位列との照合を自動で行う |
| `pref_comparison_*`（6本） | `scripts/build_pref_comparison.py` | 上の `pref_*` の JSON 6本 | （上記の各取得元） | 再実行で一致（`generated_at` のみ変わる） |
| `pref_1a_population_timeseries` | `scripts/build_pref_population_timeseries.py` | `poc/recon-20260905-pref-ts/` の R2〜R6（`000031971201`・`000040306655`・`000032224634`・`000040306645`・`000040306668`）と同フォルダの `_fetch_log.json`、R7 は `handoff/pref-machi-verify/2501stjin.xlsx`（`000040306651`）、R8 は `poc/recon-20261012-juki-r8/soumu_000892948_juki_pref_pop_hh_r8.xlsx`。検証用に `data/pref_1a_population.json`（先に作っておく）も読む | e-Stat・総務省 住基 都道府県別 | 再実行で一致 |
| `m1_1a_population_timeseries` | ①`scripts/m1_1a_timeseries_extract.py`（中間出力 `out_merged.json`）→②`scripts/m1_1a_timeseries_build.py` の順に実行 | `poc/recon-20260830-1-1a-timeseries/` の R2〜R6 と、R7 は `poc/recon-20260828/1-1a/…000040306653.xlsx`、R8 は `poc/recon-20261012-juki-r8/soumu_000892952_juki_shichoson_pop_hh_r8.xlsx` | e-Stat・総務省 住基 市区町村別 | 再実行で一致（基本形。比較値は §3.5 で追加） |
| `m4_4_school` | `scripts/build_m4_4_school.py` | `poc/m4_4_school_src/` の e-Stat 学校基本調査4本（`eyx37`・`eyx42`・`eyx66`・`eyx71`） | e-Stat 学校基本調査 | 再実行で一致（抽出団体数 42） |
| `pref_assembly` | `scripts/build_pref_assembly.py`（定数・現員・議会費・議事録公開を再生成。`--check` で書き込まず照合）。正副議長・会派は `poc/pref-gikai-20260902/README.md` の手順で調べ直す（プロンプトも同フォルダ） | 定数・現員＝`poc/recon-20260828/3-2/000932784_giin_teisuu_r5.pdf`（pdftotext が要る）、議会費＝`data/pref_kessan.json`（先に `build_pref_kessan.py`）、議事録公開＝`recon/pref-gikai-koho-20260905.md`、正副議長・会派＝`poc/pref-gikai-20260902/chair-kaiha.csv`（Grok分） | 総務省（議員定数に関する調・決算状況調）、各都道府県議会サイト | 再実行で現行データと**バイト一致**。正副議長・会派は Web 調査のため再現ではなく**調べ直し**。Composer 分の CSV はリポジトリに無く、突合スクリプトも未保存（突合ルールは README に記載） |

**自治総研の原本**：`m2_1_chief`・`pref_governor` が読む自治総研の年版Excelは、再配布の可否が未確認のため公開用リポジトリには含めていない。スクリプトは、原本が無いと取得先の URL を表示して止まるので、そこから取得して `poc/recon-20260830/raw/`（市区町村版）・`raw_pref/`（都道府県版）に、表示された名前で置いてから再実行する（申請不要・出典明記が条件）。

**再実行して分かった注意**
- **順序**：`m1_1a`・`m1_1b`・`m1_1c`・`m1_2a`・`m1_2b` などは、まず上のスクリプトが基本形を作り、そのあと §3.5 の比較スクリプトが `area_code`・`comparison` を追加する。基本形だけを再生成すると比較値が消える。**再生成後は必ず §3.5 を続けて実行する。** `pref_comparison_*` は `pref_*` の JSON を読むので、`pref_*` を作り直したあとに実行する。
- 再実行すると `updated`・`fetched_at`・`generated_at`（日付・時刻）だけが変わる。
- **`pref_1d` のハッシュ（2026-10-08 解消）**：`a003.xls` は、e-Stat の原本（recon の記録 `216d9b51…`）が一度 Excel で開いて保存し直された版と見られる（保存者名の欄に運営者名が残っていた。バイト数と読み取る値は同じ）。公開前の個人情報除去（Gate 5）で、その欄だけを同じ長さの `(anonymous)` に置き換えたため、現在のハッシュは `f5a44d47…`。スクリプトの確認値と JSON の `sources` はこの値にしてある。次に e-Stat から取り直したときは、値が同じかを確かめてから `CURRENT_SHA256` を更新する。**ダウンロードした原本は、Excel で開いて保存し直さないこと**（保存者名が入り、ハッシュも変わる）。（2026-10-12 以降は経路Aの新しい原本に切り替えたため、この件は現行スクリプトには関係しない。`handoff/pref-machi-verify/a003.xls` は旧経路の記録として残る。）

**手作業を含むもの（2026-10-08 から、再実行しても失われない）**：`m2_1_chief` は、自治総研が未反映の直近5団体（岐阜市・美濃市・美濃加茂市・大野町・東白川村）を、各自治体の公式サイトで個別に確認して補っている（`poc/recon-20260830/RECON-BATCH4B.md`・`_fetch_batch4b*.py`）。`pref_governor` は、直近の首長交代5県（石川・福井・和歌山・広島・長崎）をWebの一次情報で補っている。`pref_assembly` の正副議長・会派は、Web 調査（Grok→Composer→Claude の突合）の結果で、スクリプトでは再現できない（`poc/pref-gikai-20260902/README.md`）。

**補正の仕組み**：`m2_1_chief`・`pref_governor` で補った値は `scripts/patches/m2_1_chief_manual.json`・`scripts/patches/pref_governor_manual.json` に保存してあり、`build_m2_1_chief.py`・`build_pref_governor.py` が、Excel から作り直したあとに当て直す（共通処理は `scripts/manual_patch.py`）。**補正の当選年月日が、作り直した値より新しい場合だけ当てる**ので、自治総研が追いついてその選挙が載れば、補正は自然に外れる（実行時に「適用」「不要」と表示される）。自治総研の年次更新後は、(1) 年版Excelを `raw/`・`raw_pref/` に追加して再実行 (2) 「適用」と表示された団体の任期満了（当選年月日＋4年）を確認 (3) 任期が過ぎた団体は、公式サイトで現職を個別確認して patch を更新する。

### 3.8 データ以外の生成・検査スクリプト（2026-10-12 追記）
通常のデータ更新やビルドでは使わない。必要なときだけ実行する。
| コマンド | 何をするか | いつ使うか |
|---|---|---|
| `python scripts/audit_neutrality.py` | 表示に関わるソースと `data/*.json` から、評価語・評価的な色・欠損表示の不揃いの**候補**を全件抜き出し、`scripts/audit_neutrality_result.txt` に書く。最終判定ではないので、人が1件ずつ確かめる（点検表は `docs/neutrality-ui-audit-checklist.md`） | 表示の文言・色・カードを変えたとき |
| `python scripts/gen_site_images.py` | 正式ロゴから、ファビコン・アイコン・共有用画像・ページのロゴ画像を作る（出力先はスクリプト冒頭の説明） | ロゴや共有用画像を変えるときだけ。原本のロゴ（`design/brand/`）は運営側が持ち、このリポジトリには含まれない。日本語フォント Noto Sans CJK JP と Pillow・numpy が要る |
| `python scripts/generate_prefecture_outlines.py` | 47都道府県の輪郭の図形を、公開の地図データから作る（`design/prefecture-outlines/prefecture-outlines.json`） | 輪郭を作り直すときだけ。作り方は `design/prefecture-outlines/prefecture-outlines-howto.md` |
| `scripts/qa/` の各スクリプト | ビルドした `out/` を実ブラウザで開き、画面崩れ・タップ領域・アクセシビリティを検査する | 画面に関わる変更をしたとき（§4 手順6）。使い方は `scripts/qa/qa-browser-checks.md` |

## 4. ビルドと公開手順（package.json / next.config.ts に基づく）
1. Node **24.11.1** を用意（`.nvmrc`。`.npmrc` は `engine-strict=true`＝不一致ならエラー、`save-exact=true`）。
2. 依存インストール：`npm ci`（`package-lock.json` を厳密再現。承継時はこれを推奨）。運営者の PC（Windows・Node v24.11.1）で成功を確認済み（2026-10-08・遅いディスクで49分かかった。失敗ではない）。`npm audit` の high 6件は launch-backlog D-12 で扱う。
3. Lint（任意）：`npm run lint`（`eslint`。`scripts/`・`data/`・`out/`・`.next/` は対象外）。
4. ビルド：`npm run build`（＝`next build`）。`output:'export'` のため静的ファイルが **`out/`** に生成される。
   - **成功の確認方法**：エラーで止まらずに終わり、`out/index.html` と `out/404.html` ができていること。失敗したときは、表示されたエラーのファイル名・行を直してから再実行する。`out/` は生成物なので手で直さない。
5. 手元で表示を確かめる（任意・推奨）：`node scripts/qa/serve.js` で `out/` を配信し、ブラウザで `http://localhost:4174/` を開く。止めるときは、そのコマンドを実行した画面で Ctrl+C。
6. 画面に関わる変更をしたときは、`scripts/qa/qa-browser-checks.md` の検査（横あふれ・タップ領域・アクセシビリティ）を行う。
7. デプロイ：ホスティング＝**Cloudflare**（Workers の静的配信。設定は `wrangler.jsonc`＝`out/` をそのまま配信し、存在しないURLには `out/404.html` を返す。D-22）。公開用リポジトリの `main` に変更が入ると、Cloudflare の自動ビルド（Workers Builds）がビルドと反映を行う予定。Cloudflareアカウントは2FAをアカウント作成と同時に有効化する。
   - 設定する予定の値（Cloudflare の公式説明〈Workers Builds の設定〉に基づく。2026-10-12 時点・未接続）：本番のブランチ＝`main`、ビルドコマンド＝`npm run build`、デプロイコマンド＝`npx wrangler deploy`（Cloudflare の既定値）。wrangler は `package.json` の devDependencies に版を固定してある（2026-10-12 から 4.149.0）。Cloudflare の説明では、自動ビルドは `package.json` に書かれた wrangler の版を使う。版を上げるときは `npm install --save-dev --save-exact wrangler@<版>` で上げ、`npm audit` で新しい脆弱性が出ていないことを確かめる。Node の版は `.nvmrc` から選ばれる（Cloudflare の説明では `.nvmrc` か `.node-version`、または変数 `NODE_VERSION`）。
   - **接続時に実際に設定した値（2026-10-13 接続・Cloudflare 画面で確認）**：Cloudflare の「Create app」→「Connect GitHub」で、GitHub 側に Cloudflare のアプリ（Cloudflare Workers and Pages）を組織 `jichitaiwatch` へ入れる。対象のリポジトリは「Only select repositories」で `jichitaiwatch/jichitai-watch` の1つだけにする（Cloudflare に渡る権限は固定で、コード・チェック・デプロイ・プルリクエストの読み書きを含むため）。設定値：Project name＝`jichitai-watch`（`wrangler.jsonc` の `name` と同じ）、Build command＝`npm run build`、Deploy command＝`npx wrangler deploy`、Preview command＝`npx wrangler preview`（使わない）、**Enable Preview builds＝オフ**（`main` 以外のブランチではビルドしない）、Protect with Cloudflare Access＝オフ、Advanced settings の Path（ルートディレクトリ）＝`/`、API token＝自動作成（`jichitai-watch build token`）、Build variables＝なし。
   - **ビルドの記録の見方**：Cloudflare の「Workers & Pages」→ `jichitai-watch` →「Deployments」で、各ビルドを開く。段階（Initializing・Cloning・Installing・Building・Deploying）ごとの成否と所要時間、全文の記録（Download log／Copy build log）が見られる。初回（2026-10-13）の実績：Node 24.11.1（`.nvmrc` から自動検出）、`npm clean-install` で437個、`next build` で355ページ、wrangler 4.149.0、全体で約2分半。ファイル送信の一時的な失敗と自動の再試行が記録に出ることがあるが、最後に `Success! Build completed.` が出ていれば成功。
   - **成功の確認方法**：Cloudflare の「Deployments」で、そのコミットのビルドが全段階で成功し、記録の最後に `Success! Build completed.` が出ていること。そのうえで本番の URL（`https://jichitaiwatch.jp`）を開き、変えたページが新しい内容になっていることを確かめる。
6. HTTPセキュリティヘッダ（CSP/HSTS等）：`output:'export'` では `next.config` から設定できないため、Cloudflareでは `public/_headers` で設定する（`security-model.md` S-1）。**`public/_headers` で設定済み（2026-10-05 `vercel.json` から移行・D-22。`vercel.json` は削除済み）**。ヘッダの一覧と理由は `security-model.md` S-1 実装記録。CSPを変えたら、`public/_headers` のヘッダを付けた配信で実ブラウザのCSP違反が0であることを確かめてから反映する。他ホスト移行時は同等設定を再現する。
- **変更経路の原則**：本番への変更はGit経由のみ。ホスティング側の直接編集機能は使わない（`security-model.md` §5。唯一の例外は、緊急時に過去の版へ戻すこと＝§6.1）。
- **役割境界（現行）**：`npm run build`・`git` 操作は運営者が実行。承継者運用への移行時の権限は §2 に従う。

## 6. 障害時のロールバック（`operations-runbook.md` 4・5節に基づく）
**原則**：元に戻すときも、変更は Git 経由で行う（§4 の変更経路の原則）。問題を起こしたコミットを `git revert` で打ち消すコミットを作り、通常の公開と同じ手順で反映する。`git reset` や強制 push で履歴を消さない（打ち消した記録が残る方が、後から原因を追える）。

### 6.1 公開した変更を元に戻す手順（2026-10-12 追記）
1. **戻すコミットを特定する**：`git log --oneline -20` で、問題が出る直前に入ったコミットを探す。`git show <コミット番号>` で、そのコミットが変えた内容を確かめる。
2. **打ち消すコミットを作る**：`git revert <コミット番号>`（編集画面が開いたら、そのまま保存して閉じる）。複数のコミットを戻すときは、新しい方から順に1つずつ revert する。
3. **手元でビルドして確かめる**：§4 の手順4（必要なら5）。問題が消えていることを確かめる。
4. **反映する**：commit を §4 の手順7で反映し、本番の URL で問題が消えたことを確かめる。
- **成功の確認方法**：本番のページが問題の出る前の表示に戻り、`git log` に「Revert "…"」のコミットが残っていること。
- **試行の記録（2026-10-15・launch-backlog E-4）**：公開中の本番で1回試行した。直前の版（`2ec4b350`）へ戻して 21:45:45 頃に実行し、確認のあと 21:49:30 頃に元の版（`36914aca`）へ戻した（試行全体で約4分）。戻している間も本番（`https://jichitaiwatch.jp`）は表示された。戻したあとも、仮のアドレス（workers.dev）は復活せず、Cloudflare の「There is nothing here yet」の画面のままだった。なお、戻した版と元の版の見た目の違いは、今回は確かめていない（内容がほぼ同じ版へ戻したため）。実行してから本番へ反映されるまでの時間は測っていない。
- **Cloudflare の画面での確認方法**：「Workers & Pages」→ `jichitai-watch` →「Deployments」の一覧で、配信中の版の行に青い縦線が付く。操作の直後に、戻した版の行へ青い線が移っていることを確かめる。
- **緊急時の例外（2026-10-12 運営者裁定・`security-model.md` §5）**：Cloudflare の管理画面（または `wrangler rollback`）で、直前の版の配信に戻してよい。公式説明では直近100版まで戻せ、戻すとその版がすぐに全体へ反映される。過去に Git から作られた版へ戻すだけなので、Git に無い内容は入らない。使ってよいのは次の3条件をすべて守るときだけ。
  1. 本番の表示が壊れているとき（見た目の小さな乱れや、データの数値の誤りは、上の 1〜4 の通常の手順で直す）。
  2. 同じ日のうちに、上の 1〜4 を必ず行う（管理画面で戻しても、次に `main` へ変更が入ると、その内容で反映し直されるため）。
  3. 戻した日時と理由を、手順2の revert コミットのメッセージに書く。
  - **管理画面での操作（2026-10-15 に実画面で確認）**：「Workers & Pages」→ `jichitai-watch` →「Deployments」を開く。**戻したい版の行**の右端「⋯」→「**Rollback**」を押す。確認の画面で、上の「Current deployed version」が今の版、下の「Rolling back to version」が戻す版であることを確かめる。Message 欄（任意・50文字まで）に、戻した理由を短く書く（既定は「Rollback to previous version」）。青い「Rollback」を押すと実行される。
  - **元の（新しい）版へ進め直す操作**：今の版より新しい版の行の「⋯」には「Rollback」が出ず、代わりに「**Promote version**」が出る。確認の画面で「Current deployed version」と「Promoting to 100%」の版を確かめ、青い「Promote version」を押す。
  - **戻したあとの確認方法**：①「Deployments」の一覧で、戻した版の行に青い縦線が付いていること。②本番の URL（`https://jichitaiwatch.jp`）を開き、表示されること。③仮のアドレス（workers.dev）が復活していないこと（開いて「There is nothing here yet」が出ること）。

### 6.2 種類別の扱い
- **ビルド/デプロイ失敗**：ビルドが失敗した場合、本番は直前の版のまま動き続ける見込み（**未確認**。2026-10-15 に Cloudflare の公式説明〈Workers Builds〉を確認したが、失敗時の本番の扱いの記載はなかった。成功したビルドだけが配信中の版に切り替わる、という記載のみ。わざと失敗させる確認は、公開用リポジトリの履歴に壊れたコミットが残るため行わない。**実際に失敗が起きたとき**に、「Workers & Pages」→ `jichitai-watch` →「Deployments」で配信中の版〈青い縦線〉が変わっていないことと、本番の表示を確かめ、ここに結果を記録する）。原因のコミットを直すか、§6.1 で打ち消す。`out/` は生成物なので手で編集しない。
- **データ異常**（回帰検出ヒット＝`operations-runbook.md` 4節の閾値：自治体数減・必須欠落等）：公開前なら、当該JSONの変更を取り消し（`git checkout -- data/<ファイル名>`）、上流を再確認してから再生成。公開後に気づいたら、§6.1 でそのコミットを打ち消してから同じく再生成する。
- **上流404/5xx**：取得スクリプトは自動リトライで押し切らず停止しログ（`[要人間判断] source=… url=…`）を出す。代替URL探索または当該ソース一時停止を判断。実装後は `fetch_error`/`parse_error` で当該箇所のみ更新ブロックし last-good を維持、サイト全体は停止しない（`frontend-architecture.md` 4節・現状一部未実装）。

## 8. 定期作業カレンダー（`update_calendar.yaml` に基づく）
| source | cadence | 次回確認 | script | status |
|---|---|---|---|---|
| M1 こども家庭庁 乳幼児等医療費援助 | yearly | 2026-12-01 | `scripts/m1_kodomo_iryohi.py` | fresh |
| M2 厚労省 介護保険料基準額 | 3years | 2027-04-01 | `scripts/m2_kaigo_premium.py` | fresh |
| M3 総務省 決算統計・財政状況資料集 | yearly | 2027-03-01 | `scripts/m3_expenditure.py` | fresh |
| マイナンバーカード保有率 | monthly | 未設定 | 未着手 | check_needed |
| 待機児童数 | yearly | 未設定 | 未着手 | check_needed |
| 社会増減（住民基本台帳人口移動報告） | yearly | 未設定 | 未着手 | check_needed |
| 住民基本台帳に基づく人口・人口動態及び世帯数 | yearly | 2027-07-01 | scripts/m1_1a_population_comparison.py ほか（succession-runbook.md §3.5・§3.7） | fresh |
| 国勢調査（単身世帯割合：人口等基本集計） | 5years | 2031-06-01 | `scripts/build_kokusei_json.py single` | fresh |
| 国勢調査（産業別就業者・昼夜間人口：従業地・通学地による人口・就業状態等集計） | 5years | 2027-05-01 | `scripts/build_kokusei_json.py` | fresh |
| 総務省 市町村別決算状況調（財政概況・財政規模・健全性・経年。M3は別行） | yearly | 2027-03-01 | `scripts/build_m2_2_finance.py` | fresh |
| 総務省 都道府県決算状況調（県の財政・支出・議会費） | yearly | 2027-02-01 | `scripts/build_pref_kessan.py` | fresh |
| 健全化判断比率及び資金不足比率（総務省） | yearly | 未設定 | `scripts/build_pref_fiscal_indicators.py` | check_needed |
| ふるさと納税に関する現況調査（総務省。市区町村別の受入額・控除額） | yearly | 2027-07-31 | `scripts/m4_5_furusato.py` | fresh |
| 自治総研 自治体選挙結果調査・全国首長名簿（市区町村長・知事） | yearly | 2027-01-31 | scripts/build_m2_1_chief.py・scripts/build_pref_governor.py | fresh |
| 総務省 議員定数に関する調 | 未確認 | 未設定 | scripts/gikai_3_2_teiin_comparison.py・scripts/build_pref_assembly.py | check_needed |
| 学校基本調査（文部科学省。市町村別の学校数・児童生徒数） | yearly | 未設定 | `scripts/build_m4_4_school.py` | stale |
| 統計でみる市区町村のすがた（課税対象所得） | yearly | 未設定 | `scripts/m1_2c_taxable_income.py` | fresh |
| 社会生活統計指標（都道府県の指標。県の課税対象所得） | yearly | 未設定 | `scripts/build_pref_income_json.py` | check_needed |
| 議会の個別情報（正副議長・会派・議事録公開の有無。各議会サイト） | 改選・議長交代のたび（周期は未決定） | 未設定 | 手作業の調査（poc/pref-gikai-20260902/README.md） | check_needed |
| 全国地方公共団体コード・類似団体区分（自治体マスタ・読み・比較値の基礎） | 不定（合併・名称変更のとき） | 未設定 | scripts/gen_municipality_master.py・scripts/gen_municipality_kana.py | check_needed |

- 一覧は `update_calendar.yaml` が正本（各行の `note` に根拠と注意を書いてある。この表は要約）。`status` が `stale` の行は、新しい版がすでに公表されている（更新するかは運営者が決める＝launch-backlog.md E-9）。`check_needed` の行は、公表の周期や最新版を公式ページで確認できていない。
- 次回確認日が未設定のデータは、各 JSON の `sources` に記録された取得元で、新しい版が出ているかを確かめる（§3.0 手順1）。確認できた周期と日付は `update_calendar.yaml` に書き足す。

---
