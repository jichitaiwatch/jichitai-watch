#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/apply_gichou_shunin.py — 正副議長の就任日を data/ に反映する（2026-10-21・運営者裁定A）。

入力: poc/recon-20261021-gichou-shunin/gichou-<県コード>-{grok,composer}.csv（外部AI2系統）
採用規則（推定で埋めない・D-25）:
  1. 就任日は「Grok と Composer が同じ日付を出した」ものだけを採用する。
  2. 片方だけの日付は採用しない。ただし Claude が公式ページを開いて確認した分は VERIFIED で採用する
     （根拠は poc/recon-20261021-gichou-shunin/verification-20261021.md）。
  3. 上に当たらない就任日は null（画面は「確認できず」）。氏名は変えない（VERIFIED の2団体を除く）。
実行: python scripts/apply_gichou_shunin.py   （リポジトリ直下。冪等）
"""
import csv
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "poc", "recon-20261021-gichou-shunin")
TODAY = "2026-10-21"
RECON_NOTE = "poc/recon-20261021-gichou-shunin/"

# 県コード → 市町村データのファイル
MUNI_FILES = {
    "21": "data/gikai_assembly.json",
    "23": "data/gikai_council_23.json",
    "24": "data/gikai_council_24.json",
    "33": "data/gikai_council_33.json",
    "34": "data/gikai_council_34.json",
    "35": "data/gikai_council_35.json",
}
PREF_FILE = "data/pref_assembly.json"

# Claude が公式ページで確認した分（団体名 → 上書き）。出典は verification-20261021.md と同じ。
VERIFIED = {
    ("21", "関市"): {
        "副議長氏名": "池村 真一郎",
        "議長就任日": "2026-05-08", "副議長就任日": "2026-05-08",
        "src": "https://www.city.seki.lg.jp/0000001555.html", "asof": "2026-10-21",
        "log": "2026-10-21 市の歴代正副議長一覧（第79代・令和8年5月8日就任）で副議長を池村真一郎氏と確認（外部AI Composer の長尾一郎氏は旧）。就任日を追加。",
    },
    ("21", "本巣市"): {
        "議長氏名": "臼井 悦子", "副議長氏名": "髙橋 時男",
        "議長就任日": "2026-09-25", "副議長就任日": "2026-09-25",
        "src": "https://www.city.motosu.lg.jp/0000000379.html", "asof": "2026-10-21",
        "log": "2026-10-21 市の『議会構成（令和8年9月25日現在）』（更新日2026-09-28）に『正副議長（令和8年9月25日就任）』議長 臼井悦子・副議長 髙橋時男とあり、旧体制（今枝和子・髙橋勇樹）から更新。",
    },
    ("21", "下呂市"): {
        "議長就任日": "2026-04-30", "副議長就任日": "2026-04-30",
        "src": "https://www.city.gero.lg.jp/site/gikai/1842.html", "asof": "2026-10-21",
        "log": "2026-10-21 市の正副議長ページで選出日・就任日とも令和8年4月30日（臨時会）を確認し、就任日を追加。",
    },
    ("21", "瑞穂市"): {
        "議長就任日": "2026-06-04", "副議長就任日": "2026-06-04",
        "src": "https://www.city.mizuho.lg.jp/1909.htm", "asof": "2026-10-21",
        "log": "2026-10-21 市の議会構成ページの『議長及び副議長』に『令和8年6月4日～』とあり、就任日として追加（選出日との区別の記載はない）。",
    },
}
# 美濃加茂市：改選後の正副議長が未公表の間、直前の正副議長を任期つきで掲示する（運営者方針・L-14）
MINOKAMO_PREV = {
    "議長氏名": "村瀬 正樹",
    "副議長氏名": "坂井 文好",
    "就任日": "2025-10-21",
    "退任日": "2026-10-12",
    "退任の理由": "議員の任期満了",
    "出典": [
        "https://www.city.minokamo.lg.jp/uploaded/attachment/18600.pdf",
        "https://www.city.minokamo.lg.jp/uploaded/attachment/22513.pdf",
    ],
    "基準日": "2026-10-20",
    "注記": "改選後の議長・副議長は、2026年10月20日時点で未公表",
}


def norm(s):
    return re.sub(r"[\s　]", "", s or "")


def load_csv(pc, who):
    with open(os.path.join(P, f"gichou-{pc}-{who}.csv"), encoding="utf-8") as f:
        return {r["団体名"]: r for r in csv.DictReader(f)}


def consensus(g, c, role):
    """両系統が同じ日付 → (日付, 出典URL, 確認日)。違う・片方だけ → None。"""
    d = f"{role}_就任日"
    if g[d] and c[d] and g[d] == c[d]:
        asof = min(x for x in (g["確認日"], c["確認日"]) if x)
        return g[d], g[f"{d}_出典URL"] or c[f"{d}_出典URL"], asof
    return None


def dump(path, d):
    with open(os.path.join(ROOT, path), "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")


def load(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return json.load(f)


def set_dates(ch, name, g, c, ver):
    """正副議長 dict ch に就任日の項目を書く。戻り値: (議長採用, 副議長採用)"""
    got = {}
    for role in ("議長", "副議長"):
        k = consensus(g, c, role) if g and c else None
        if ver and ver.get(f"{role}就任日"):
            k = (ver[f"{role}就任日"], ver["src"], ver["asof"])
        got[role] = k
        ch[f"{role}就任日"] = k[0] if k else None
        ch[f"{role}就任日_出典"] = k[1] if k else None
    asofs = [k[2] for k in got.values() if k]
    ch["就任日_基準日"] = max(asofs) if asofs else TODAY
    return bool(got["議長"]), bool(got["副議長"])


def main():
    stat = {}
    for pc, path in MUNI_FILES.items():
        ds = load(path)
        g, c = load_csv(pc, "grok"), load_csv(pc, "composer")
        n_ok = [0, 0]
        seen = set()
        for r in ds["data"]:
            name = r["市区町村名"]
            ver = VERIFIED.get((pc, name))
            ch = r["正副議長"]
            if name == "美濃加茂市":
                ch["議長就任日"] = ch["副議長就任日"] = None
                ch["議長就任日_出典"] = ch["副議長就任日_出典"] = None
                ch["就任日_基準日"] = MINOKAMO_PREV["基準日"]
                ch["直前"] = MINOKAMO_PREV
                r.setdefault("data_correction_log", []).append(
                    "2026-10-21 改選後の正副議長が未公表の間、直前の議長・副議長（村瀬正樹・坂井文好）を任期つきで掲示するため『直前』を追加。"
                    "就任＝令和7年第1回臨時会（2025-10-21）で正副議長がそれぞれ辞職・選挙（市の議決結果 attachment/18600.pdf）。"
                    "退任＝議員の任期満了日 2026-10-12（議長・副議長の任期は議員の任期による＝地方自治法103条2項）。"
                    "外部AI Composer が両氏を現職として記載していたが、改選後の名簿（attachment/22513.pdf）に記載がなく採用しなかった。"
                )
                seen.add(name)
                continue
            if name not in g or name not in c:
                raise SystemExit(f"CSVに無い団体: {pc} {name}")
            if ver:
                for k in ("議長氏名", "副議長氏名"):
                    if ver.get(k):
                        ch[k] = ver[k]
                r.setdefault("data_correction_log", []).append(ver["log"])
            a, b = set_dates(ch, name, g[name], c[name], ver)
            n_ok[0] += a
            n_ok[1] += b
            seen.add(name)
        ds["updated"] = TODAY
        srcs = ds.setdefault("sources", [])
        entry = {
            "role": "正副議長の就任日（外部AI2系統の一致分＋Claudeが公式ページで確認した分）",
            "source_url": RECON_NOTE,
            "fetched_at": TODAY,
            "note": "Grok と Composer が同じ日付を出したものだけ採用。片方だけの日付は採用せず『確認できず』。詳細＝scripts/apply_gichou_shunin.py・verification-20261021.md",
        }
        if not any(s.get("source_url") == RECON_NOTE for s in srcs):
            srcs.append(entry)
        dump(path, ds)
        stat[pc] = (len(ds["data"]), n_ok[0], n_ok[1])

    # 県議会（6県）
    ds = load(PREF_FILE)
    n_ok = [0, 0]
    for pc in MUNI_FILES:
        g, c = load_csv(pc, "grok"), load_csv(pc, "composer")
        gk = [r for r in g.values() if r["区分"] == "県議会"][0]
        ck = [r for r in c.values() if r["区分"] == "県議会"][0]
        rec = [r for r in ds["data"] if r["pref_code"] == pc][0]
        for role, nm in (("議長", "議長氏名"), ("副議長", "副議長氏名")):
            if norm(gk[nm]) != norm(ck[nm]) or norm(gk[nm]) != norm(rec["正副議長"][nm]):
                raise SystemExit(f"県議会の氏名が不一致: {pc} {role}")
        a, b = set_dates(rec["正副議長"], rec["pref_name"], gk, ck, None)
        n_ok[0] += a
        n_ok[1] += b
    if "updated" in ds:
        ds["updated"] = TODAY
    ds.setdefault("sources", [])
    if not any(s.get("source_url") == RECON_NOTE for s in ds["sources"]):
        ds["sources"].append(
            {
                "role": "正副議長の就任日（岐阜・愛知・三重・岡山・広島・山口の県議会）",
                "source_url": RECON_NOTE,
                "fetched_at": TODAY,
                "note": "Grok と Composer が同じ日付を出したものだけ採用（6県以外の41都道府県は未収集のため項目なし）。",
            }
        )
    dump(PREF_FILE, ds)
    print("市町村（団体数, 議長就任日あり, 副議長就任日あり）:", stat)
    print("県議会6県（議長就任日あり, 副議長就任日あり）:", tuple(n_ok))


if __name__ == "__main__":
    main()
