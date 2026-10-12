# 都道府県議会 正副議長・会派の収集（pref_assembly の B 系統）

`data/pref_assembly.json` のうち、正副議長・会派は中央統計に無く、各都道府県議会サイトを個別に調べて集めた（2026-09-02）。

## 手順（実際に行ったもの）
1. `prompt-grok.md` を Cursor の Grok に渡し、47都道府県を調べる。結果は CSV に書き出させる（指示しないと書き出さない）→ `chair-kaiha.csv`（このフォルダ）。
2. `prompt-composer.md` を、**Grok の成果物が一切無い別の空フォルダ**で Cursor の Composer に渡し、独立に調べさせる（同じフォルダだと Grok の結果を参照して反証にならない）。結果の CSV は `pref_gikai_verification.csv` という名前だったが、**リポジトリには残っていない**（JSON の `出典_composer`・`会派一覧_composer` にだけ値が残る）。次に行うときは、結果の CSV をこのフォルダに必ず保存する。
3. 2つの CSV を突合する。ルール：実質的な値があるほうを採用／食い違いは Web で一次情報を確認して決める（福岡県で実施：前議長・前副議長の辞職を Composer が反映していなかった）／会派は食い違いを機械で決めず、Grok 値・Composer 値を併記する。突合は Claude.ai の作業環境で都度実行され、スクリプトは保存されていない。

## 機械的に作れる部分
`scripts/build_pref_assembly.py` が、議員定数・現員数（総務省PDF）、議会費（`data/pref_kessan.json`）、議事録公開（`recon/pref-gikai-koho-20260905.md`）を再生成する。正副議長・会派は既存の値を残す。
