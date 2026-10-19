// lib/trial.ts
//
// 試作モード（20260808_decisions.md D-24）。愛知・三重の試作データは Gate 7 の実測まで公開しない。
// 環境変数 JICHITAI_TRIAL_PREFS（例 "24" または "23,24"）に県コードを入れたときだけ、
// その県の自治体マスタ・ページ・試作カードをビルドに含める。未設定＝岐阜のみ（公開用ビルドと同じ）。
// 値の判定だけを持つ（fs を使わない）ので、クライアントからも参照できる。

/**
 * 公開に加えた試作県の県コード（例 ["23"]＝愛知）。**県を公開するときに書き換える場所はここだけ**（lib の側）。
 * 空のあいだは環境変数 JICHITAI_TRIAL_PREFS を指定したビルドだけにその県が入る（公開用ビルドは岐阜のみ）。
 * ここに入れた県は、環境変数なしの公開用ビルドにも入る（ページ・サイトマップ・一覧・検索・トップのカード）。
 * 公開用リポジトリへ載せるデータは `publish/allowlist.txt` の除外（!data/…_NN.json）を外して合わせる。
 * 食い違いは `publish/check.py` が検出して止める（docs/launch-backlog.md L-9）。
 */
export const PUBLISHED_TRIAL_PREF_CODES: string[] = [];

const FROM_ENV: string[] = (process.env.JICHITAI_TRIAL_PREFS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s !== "");

export const TRIAL_PREF_CODES: string[] = [...new Set([...PUBLISHED_TRIAL_PREF_CODES, ...FROM_ENV])];

export const TRIAL_ENABLED = TRIAL_PREF_CODES.length > 0;
