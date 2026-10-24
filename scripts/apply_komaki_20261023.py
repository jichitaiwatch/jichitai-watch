#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/apply_komaki_20261023.py — 小牧市（愛知・試作）の市長と正副議長の入れ替わりを反映する（2026-10-23）。

英語版の氏名の読みの調べもの（作業単位7・愛知の回。poc/recon-20261023-names-aichi/）で、外部AI2系統が
「いまは現職でない」と報告した分を確かめて直す（2026-10-23 運営者指示：替わっていれば直す）。
  - 正副議長：2系統とも、市の正副議長のページ（https://www.city.komaki.aichi.jp/admin/soshiki/gikai/giji/3/2/4527.html、
    2026年10月5日更新）で議長 加藤晶子・副議長 小沢国大と報告（一致）。就任日は2系統とも示さず null（確認できず）。
  - 市長：Grok が愛知県の市町村長等名簿で現職を天野正基と報告。Claude が選挙ドットコムの選挙ページで、
    2026-02-15 告示・2026-02-22 投票予定の小牧市長選挙（前市長の辞職による）で新人・無所属の天野氏が無投票で当選したことを確認（報道による）。
    Composer は 2023年の資料で山下史守朗を現職としていたが、採らない。
実行: python scripts/apply_komaki_20261023.py   （リポジトリ直下。冪等）
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = "2026-10-23"
CODE = "232190"


def load(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return json.load(f)


def dump(p, d):
    with open(os.path.join(ROOT, p), "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")


def main():
    path = "data/gikai_council_23.json"
    ds = load(path)
    r = next(x for x in ds["data"] if x["area_code"] == CODE)
    ch = r["正副議長"]
    if ch["議長氏名"] != "加藤 晶子":
        ch.update({
            "議長氏名": "加藤 晶子", "副議長氏名": "小沢 国大",
            "議長就任日": None, "議長就任日_出典": None, "副議長就任日": None, "副議長就任日_出典": None,
            "就任日_基準日": TODAY,
        })
        r.setdefault("data_correction_log", []).append(
            "2026-10-23 正副議長を舟橋秀和・谷田貝将典から加藤晶子・小沢国大へ更新。市の正副議長のページ"
            "（https://www.city.komaki.aichi.jp/admin/soshiki/gikai/giji/3/2/4527.html、2026年10月5日更新）で外部AI2系統が一致"
            "（poc/recon-20261023-names-aichi/）。就任日は確認できず。"
        )
    dump(path, ds)

    path = "data/m2_1_chief_23.json"
    ds = load(path)
    r = next(x for x in ds["data"] if x["area_code"] == CODE)
    r.update({
        "氏名": "天野　正基",
        "当選年月日": "2026-02-22",
        "回": 1,
        "投票率": None, "得票数": None, "当日有権者数": None, "絶対得票率": None,
        "無投票": {"is_mutou": True, "token": "無投票"},
        "党派": "無所属",
        "_source_year_file": "個別確認(2026-10-23)",
        "_note": "2026-02-15告示の無投票で初当選（前市長の辞職による選挙）。当選年月日は投票予定日（無投票の記録方法に合わせた）。"
                 "氏名は愛知県の市町村長等名簿による。告示日・投票予定日・新人・無所属・辞職は選挙ドットコムの選挙ページ"
                 "（https://go2senkyo.com/local/senkyo/26565）による（報道による）。",
    })
    dump(path, ds)
    print("小牧市を更新した")


if __name__ == "__main__":
    main()
