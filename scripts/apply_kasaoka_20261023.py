#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/apply_kasaoka_20261023.py — 笠岡市（岡山・試作）の市長の氏名の表記を直す（2026-10-23）。

英語版の氏名の読みの調べもの（作業単位7・三重・岡山の回。poc/recon-20261023-names-mie-okayama/）で、外部AI2系統が
データの「村上　典子」は市の公式サイトに無く、市長は「栗尾 典子（くりお のりこ）」と報告した。
Claude が選挙ドットコムの笠岡市長選挙（2024-04-14 投票）のページで、当選者が「くりお 典子」（クリオ ノリコ）、
新人・無所属・13,465票であることを確認した（データの当選年月日・得票数・投票率と一致。氏名の表記だけが違う）。
市の市長のページ（https://www.city.kasaoka.okayama.jp/site/mayor/3121.html）と岡山県の市町村長一覧（令和8年9月8日現在）の表記に合わせる。
実行: python scripts/apply_kasaoka_20261023.py   （リポジトリ直下。冪等）
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "m2_1_chief_33.json")
NOTE = ("氏名は市の市長のページと岡山県の市町村長一覧（令和8年9月8日現在）の表記（栗尾典子）。"
        "以前のデータは「村上典子」と書いていたが、市・県の公表に無いため直した（2026-10-23）。")


def main():
    with open(PATH, encoding="utf-8") as f:
        ds = json.load(f)
    r = next(x for x in ds["data"] if x["area_code"] == "332054")
    if r["得票数"] != 13465 or r["当選年月日"] != "2024-04-14":
        raise SystemExit("[kasaoka] 前提（2024-04-14・13,465票）と違う")
    r["氏名"] = "栗尾　典子"
    r["_note"] = NOTE
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(ds, ensure_ascii=False, indent=2) + "\n")
    print("笠岡市を直した")


if __name__ == "__main__":
    main()
