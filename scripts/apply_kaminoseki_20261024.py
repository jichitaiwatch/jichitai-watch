#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/apply_kaminoseki_20261024.py — 上関町（山口・試作）の町長の選挙結果を 2026-10-04 執行分に更新する（2026-10-24）。

英語版の氏名の読みの調べもの（作業単位7・広島・山口の回。poc/recon-20261023-names-hiroshima-yamaguchi/）で、
外部AI（Grok）が町の開票結果（2026-10-04 執行の町長選挙）を示した。データは 2022-10-23 の初当選のままだった。
  - 当選：西 哲夫（現職・無所属）1,023票。相手は原 こうじ 428票（Grok が町の開票結果の PDF で報告）。
  - Claude が選挙ドットコムの選挙ページ（https://go2senkyo.com/local/senkyo/26326）で、投票日 2026-10-04・
    投票率 77.99%・有権者数 1,890人・西 哲夫 1,023票・現職・無所属を確認。現職の再選は熊本日日新聞（共同通信配信、
    https://kumanichi.com/articles/2043009）による。町の開票結果の PDF はこの作業環境から開けなかった。
  - 回 2：前回 2022-10-23 が初当選（データの回 1）で、今回が再選。
  - 絶対得票率は得票数÷当日有権者数×100（データの定義どおり）。
実行: python scripts/apply_kaminoseki_20261024.py   （リポジトリ直下。冪等）
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CODE = "353418"
PATH = "data/m2_1_chief_35.json"


def main():
    p = os.path.join(ROOT, PATH)
    with open(p, encoding="utf-8") as f:
        raw = f.read()
    ds = json.loads(raw)
    tail = "\n" if raw.endswith("\n") else ""  # 元のファイルの末尾の改行の有無を保つ
    r = next(x for x in ds["data"] if x["area_code"] == CODE)
    votes, electors = 1023, 1890
    r.update({
        "氏名": "西　哲夫",
        "当選年月日": "2026-10-04",
        "回": 2,
        "投票率": 77.99,
        "得票数": votes,
        "当日有権者数": electors,
        "絶対得票率": round(votes / electors * 100, 2),
        "無投票": {"is_mutou": False, "token": None},
        "党派": "無所属",
        "_source_year_file": "個別確認(2026-10-24)",
        "_note": "2026-10-04執行。現職の再選。得票数は町の開票結果（外部AIの報告）と選挙ドットコムの選挙ページ"
                 "（https://go2senkyo.com/local/senkyo/26326）で一致。投票率・有権者数・党派は選挙ドットコムによる。"
                 "再選は報道（共同通信）による。絶対得票率は得票数÷当日有権者数から算出。",
    })
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(ds, ensure_ascii=False, indent=2) + tail)
    print("上関町を更新した:", r["当選年月日"], r["回"], r["絶対得票率"])


if __name__ == "__main__":
    main()
