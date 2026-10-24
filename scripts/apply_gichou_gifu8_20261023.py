#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/apply_gichou_gifu8_20261023.py — 岐阜の8町の正副議長を確かめた結果を data/gikai_assembly.json に反映する
（2026-10-23 運営者指示「4町について調べ、変わっていれば直す」。英語版の氏名の読みの調べもの〈作業単位7〉の途中で、
外部AIが「正副議長が替わっている」と報告したため）。

入力: poc/recon-20261023-gichou-gifu8/chairs-gifu8-{grok,composer}.csv（外部AI2系統・相互に非公開。
      今回から、各行にページの日付と原文の抜き書きを書かせている）
採用規則（推定で埋めない・D-25。scripts/apply_gichou_shunin.py と同じ考え方）:
  1. 氏名は、2系統が同じ人を出したものを採る。食い違ったものは、抜き書きとページの日付で新しい方を採り、理由を記録する。
  2. 就任日は、2系統が同じ日付を出したものだけを採る。片方だけ・空の就任日は null（画面は「確認できず」）。
  3. 町の公式資料どうしで決められないもの（川辺町）は、データを変えずに理由を記録する。
実行: python scripts/apply_gichou_gifu8_20261023.py   （リポジトリ直下。冪等）
"""
import csv
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "poc", "recon-20261023-gichou-gifu8")
PATH = os.path.join(ROOT, "data", "gikai_assembly.json")
TODAY = "2026-10-23"
RECON_NOTE = "poc/recon-20261023-gichou-gifu8/"


def norm(s):
    return re.sub(r"[\s　]|（.*?）", "", s or "")


def load_ai(who):
    with open(os.path.join(P, f"chairs-gifu8-{who}.csv"), encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    out = {}
    for r in rows:
        town = re.sub(r"（.*?）", "", r["町名"])
        out[(town, r["役職（議長／副議長）"])] = r
    return out


G, C = load_ai("grok"), load_ai("composer")


def ai(town, role, who):
    r = (G if who == "grok" else C)[(town, role)]
    return norm(r["氏名"]), r["就任日（YYYY-MM-DD・分からなければ空）"], r["出典URL"]


# 町ごとの裁定。name＝データに書く氏名（データの書き方＝姓と名の間に半角空白）。None は変えない。
DECISIONS = {
    "岐南町": {
        "議長": "松原 浩二", "副議長": "松本 暁大", "date": None,
        "check": {"grok": ("松原浩二", "松本暁大"), "composer": ("加藤雅浩", "長谷川淳")},
        "log": "2026-10-23 正副議長を加藤雅浩・長谷川淳から松原浩二・松本暁大へ更新。町の議員名簿（https://www.town.ginan.lg.jp/1335.htm、"
               "令和8年9月25日現在）に「議長 松原 浩二」「副議長 松本 暁大」（外部AI Grok の抜き書き）。外部AI Composer は議会だより第63号"
               "（2026年9月1日発行・令和8年6月定例会の記事）の加藤・長谷川を採ったが、名簿の方が日付が新しい（加藤・長谷川の選出は令和7年9月26日）。"
               "就任日は2系統とも確認できず。",
    },
    "揖斐川町": {
        "議長": None, "副議長": "若園 敏朗", "date": None,
        "check": {"grok": ("大西惠子", "若園敏朗"), "composer": ("大西惠子", "若園敏朗")},
        "log": "2026-10-23 副議長を高橋径夫から若園敏朗へ更新。町の議会構成（https://www.town.ibigawa.lg.jp/site/gikai/5587.html、令和8年3月5日現在）"
               "で2系統が一致。高橋径夫は令和7年3月6日現在の副議長。県の市町村長等名簿（令和8年10月1日現在）の揖斐川町の行も若園敏朗（Claude 確認）。就任日は確認できず。",
    },
    "川辺町": {
        "議長": None, "副議長": None, "date": "2025-09-09",
        "check": {"grok": ("佐伯雄幸", "石原利春"), "composer": ("佐伯雄幸", "石原利春")},
        "log": "2026-10-23 正副議長（佐伯雄幸・石原利春）は町の会議録（令和7年9月9日に選出、令和8年6月3日の会議録でも同じ）で2系統が一致したため変えず、"
               "就任日 2025-09-09 を追加。県の市町村長等名簿（令和8年10月1日現在）は議長を櫻井芳男と書いているが、町のサイトがメンテナンス中で"
               "6月より後の町の資料（議会報188号）を確かめられず、決められなかった。",
    },
    "白川町": {
        "議長": "三戸 勝徳", "副議長": "杉山 哉史", "date": "2026-09-18",
        "check": {"grok": ("三戸勝徳", "杉山哉史"), "composer": ("三戸勝徳", "杉山哉史")},
        "log": "2026-10-23 正副議長を田口守也・伊佐治優から三戸勝徳・杉山哉史へ更新。町の議長・副議長就任のあいさつ"
               "（https://www.town.shirakawa.lg.jp/chousei/gikai/1002054.html、令和8年9月18日）と議会構成名簿（令和8年9月18日現在）で2系統が一致。",
    },
    "輪之内町": {
        "議長": None, "副議長": "浅野 重行", "date": "2026-05-08",
        "check": {"grok": ("上野賢二", "浅野重行"), "composer": ("上野賢二", "浅野重行")},
        "log": "2026-10-23 副議長（空欄だった）を浅野重行と確認。令和8年5月8日の第2回臨時会の会議録（https://town.wanouchi.gifu.jp/wp-content/uploads/gikai260508.pdf）"
               "で上野賢二が議長、浅野重行が副議長に当選（2系統が一致）。就任日 2026-05-08 を追加。",
    },
    "池田町": {
        "議長": None, "副議長": "臼井 幹夫", "date": None,
        "check": {"grok": ("重綱秀次", "臼井幹夫"), "composer": ("重綱秀次", "臼井幹夫")},
        "log": "2026-10-23 副議長（空欄だった）を臼井幹夫と確認。町の議会のページ（https://www.town.gifu-ikeda.lg.jp/0000000009.html、更新日2026年4月1日）で2系統が一致。"
               "就任日は2系統で揃わず確認できず。",
    },
    "北方町": {
        "議長": None, "副議長": None, "date": None,
        "check": {"grok": ("杉本真由美", "安藤哲雄"), "composer": ("杉本真由美", "安藤哲雄")},
        "log": None,  # データどおり（就任日も既にある）
    },
    "富加町": {
        "議長": None, "副議長": None, "date": "2025-05-08",
        "check": {"grok": ("福田定道", "森利和"), "composer": ("福田定道", "森利和")},
        "log": "2026-10-23 正副議長（福田定道・森利和）は町のページ（https://www.town.tomika.gifu.jp/docs/1488951.html『議長・副議長（令和7年5月8日就任）』）"
               "で2系統が一致したため変えず、就任日 2025-05-08 を追加。",
    },
}


def main():
    with open(PATH, encoding="utf-8") as f:
        ds = json.load(f)
    done = []
    for r in ds["data"]:
        town = r["市区町村名"]
        dec = DECISIONS.get(town)
        if not dec:
            continue
        # 2系統の出力が裁定の前提どおりか（入力を取り違えていないか）を確かめる
        for who in ("grok", "composer"):
            got = (ai(town, "議長", who)[0], ai(town, "副議長", who)[0])
            if got != dec["check"][who]:
                raise SystemExit(f"[gifu8] {town} の {who} の出力が裁定の前提と違う：{got}")
        ch = r["正副議長"]
        for role in ("議長", "副議長"):
            if dec[role]:
                ch[f"{role}氏名"] = dec[role]
        if dec["date"]:
            # 就任日は2系統が同じ日付のものだけ
            for role in ("議長", "副議長"):
                dg, dc = ai(town, role, "grok")[1], ai(town, role, "composer")[1]
                if dg == dc == dec["date"]:
                    ch[f"{role}就任日"] = dec["date"]
                    ch[f"{role}就任日_出典"] = ai(town, role, "grok")[2] or ai(town, role, "composer")[2]
        elif dec["議長"] or dec["副議長"]:
            # 人が替わった役職の就任日は、確かめられないので空にする（前の人の日付を残さない）
            for role in ("議長", "副議長"):
                if dec[role]:
                    ch[f"{role}就任日"] = None
                    ch[f"{role}就任日_出典"] = None
        if dec["log"]:
            ch["status"] = "有"
            ch["就任日_基準日"] = TODAY
            log = r.setdefault("data_correction_log", [])
            if dec["log"] not in log:
                log.append(dec["log"])
        done.append(town)
    missing = set(DECISIONS) - set(done)
    if missing:
        raise SystemExit(f"[gifu8] データに無い町：{missing}")
    ds["updated"] = TODAY
    srcs = ds.setdefault("sources", [])
    if not any(s.get("source_url") == RECON_NOTE for s in srcs):
        srcs.append({
            "role": "岐阜の8町の正副議長の確認（外部AI2系統＋裁定）",
            "source_url": RECON_NOTE,
            "fetched_at": TODAY,
            "note": "氏名は2系統の一致、食い違いはページの日付が新しい方。就任日は2系統が同じ日付のものだけ。詳細＝scripts/apply_gichou_gifu8_20261023.py",
        })
    with open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(ds, ensure_ascii=False, indent=2) + "\n")
    print("反映した町：", done)


if __name__ == "__main__":
    main()
