#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/gen_search_index.py

検索クライアント索引（data/search_index.json）をビルド前に生成する単一ソース。
docs/frontend-architecture.md §7.2（ビルド時生成・手書き禁止・実行時は参照のみ）に従う。

入力（いずれも既存の権威ソース。別マスタを新設しない＝§7.5）：
  - data/municipality_master.json … 公開スコープ（active な自治体）と確定スラッグURL
  - data/municipality_kana.json   … 全国全件の読み（カナ）。§5.4.6 総務省コード表由来

出力：
  - data/search_index.json … area_code をキーに、表示名・検索キー群・公開状態・URL をまとめた
    小さな静的索引。ブラウザ側で §7.1 の評価を全走査で行う（DB不要・output:'export' 整合）。

方針（2026-09-20 決定）：データは全国全件を保持する。公開範囲が岐阜なだけで索引は全国を載せ、
未公開自治体は published=false（同名処理・未公開分岐のため）。岐阜（master active）のみ
published=true・スラッグURL を持つ。

正規化は lib/search-normalize.ts と厳密に一致させること（入力と索引キーを同じ空間へ畳む）。
本スクリプトの normalize_key は当該 TS 実装の移植であり、両者を勝手に分岐させない。
"""

import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")

MASTER = os.path.join(DATA, "municipality_master.json")
KANA = os.path.join(DATA, "municipality_kana.json")
OUT = os.path.join(DATA, "search_index.json")


# ── 正規化（lib/search-normalize.ts の移植・厳密一致）─────────────────
_SYM = re.compile(r"[ー・\u3000\s\u002d\u2010-\u2015\u2212]")


def _hira_to_kata(s: str) -> str:
    return "".join(
        chr(ord(c) + 0x60) if 0x3041 <= ord(c) <= 0x3096 else c for c in s
    )


def normalize_key(raw: str) -> str:
    if not raw:
        return ""
    s = unicodedata.normalize("NFKC", raw)
    s = s.lower()
    s = _hira_to_kata(s)
    s = s.replace("ヶ", "ケ").replace("ヵ", "カ")
    s = _SYM.sub("", s)
    return s


# ── ヘボン式ローマ字化（§5.4.1/5.4.2・カナ→ローマ字の読みキー生成用）──────
# published 自治体は確定スラッグ（city_slug）を優先採用するため、本変換は主に
# 未公開（全国）自治体の読みローマ字キー生成に使う。機械変換で吸収しきれない語は
# 名寄せ辞書の例外エントリ（§7.2 手順3）で将来上書きする。
_DIGRAPH = {
    "キャ": "kya", "キュ": "kyu", "キョ": "kyo",
    "シャ": "sha", "シュ": "shu", "ショ": "sho",
    "チャ": "cha", "チュ": "chu", "チョ": "cho",
    "ニャ": "nya", "ニュ": "nyu", "ニョ": "nyo",
    "ヒャ": "hya", "ヒュ": "hyu", "ヒョ": "hyo",
    "ミャ": "mya", "ミュ": "myu", "ミョ": "myo",
    "リャ": "rya", "リュ": "ryu", "リョ": "ryo",
    "ギャ": "gya", "ギュ": "gyu", "ギョ": "gyo",
    "ジャ": "ja", "ジュ": "ju", "ジョ": "jo",
    "ビャ": "bya", "ビュ": "byu", "ビョ": "byo",
    "ピャ": "pya", "ピュ": "pyu", "ピョ": "pyo",
}
_MONO = {
    "ア": "a", "イ": "i", "ウ": "u", "エ": "e", "オ": "o",
    "カ": "ka", "キ": "ki", "ク": "ku", "ケ": "ke", "コ": "ko",
    "サ": "sa", "シ": "shi", "ス": "su", "セ": "se", "ソ": "so",
    "タ": "ta", "チ": "chi", "ツ": "tsu", "テ": "te", "ト": "to",
    "ナ": "na", "ニ": "ni", "ヌ": "nu", "ネ": "ne", "ノ": "no",
    "ハ": "ha", "ヒ": "hi", "フ": "fu", "ヘ": "he", "ホ": "ho",
    "マ": "ma", "ミ": "mi", "ム": "mu", "メ": "me", "モ": "mo",
    "ヤ": "ya", "ユ": "yu", "ヨ": "yo",
    "ラ": "ra", "リ": "ri", "ル": "ru", "レ": "re", "ロ": "ro",
    "ワ": "wa", "ヲ": "o", "ン": "n",
    "ガ": "ga", "ギ": "gi", "グ": "gu", "ゲ": "ge", "ゴ": "go",
    "ザ": "za", "ジ": "ji", "ズ": "zu", "ゼ": "ze", "ゾ": "zo",
    "ダ": "da", "ヂ": "ji", "ヅ": "zu", "デ": "de", "ド": "do",
    "バ": "ba", "ビ": "bi", "ブ": "bu", "ベ": "be", "ボ": "bo",
    "パ": "pa", "ピ": "pi", "プ": "pu", "ペ": "pe", "ポ": "po",
    "ー": "",
}


def kana_to_romaji(kana_raw: str) -> str:
    """半角/全角カナ → ヘボン式ローマ字（読みキー用）。"""
    if not kana_raw:
        return ""
    k = unicodedata.normalize("NFKC", kana_raw)  # 半角カナ→全角カナ（濁点結合）
    out = []
    i = 0
    n = len(k)
    while i < n:
        ch = k[i]
        # 促音「ッ」：後続の子音を重ねる（§5.4.2）
        if ch == "ッ" and i + 1 < n:
            nxt2 = k[i + 1 : i + 3]
            nxt1 = k[i + 1]
            r = _DIGRAPH.get(nxt2) or _MONO.get(nxt1, "")
            if r:
                out.append(r[0])
            i += 1
            continue
        # 拗音（2文字）
        two = k[i : i + 2]
        if two in _DIGRAPH:
            out.append(_DIGRAPH[two])
            i += 2
            continue
        # 単音
        out.append(_MONO.get(ch, ""))
        i += 1
    s = "".join(out)
    # 長音の単母音化（§5.4.2：おう/おお→o、うう→u）
    s = s.replace("ou", "o").replace("oo", "o").replace("uu", "u")
    return s


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    master = load_json(MASTER)["data"]
    kana = load_json(KANA)["data"]

    # pref_code → 都道府県表示名（kana の level=prefecture 行から）
    pref_name_by_code = {
        r["pref_code"]: r["name"] for r in kana if r.get("level") == "prefecture"
    }

    # master（active のみ）: area_code → 公開情報
    published = {}
    for r in master:
        if r.get("status") != "active":
            continue
        ac = r["area_code"]
        pref_slug = r["pref_slug"]
        city_slug = r["city_slug"]
        if r["city_name"] == "":
            # 地域（県）ページ
            url = f"/{pref_slug}/"
        else:
            # 市区町村ページ（/{pref}/{gov}/）
            url = f"/{pref_slug}/{city_slug}/"
        published[ac] = {
            "url": url,
            "city_slug": city_slug,
            "name": r["city_name"] or r["pref_name"],
        }

    records = []
    for r in kana:
        ac = r["area_code"]
        level = r["level"]
        name = r["name"]
        pref_name = pref_name_by_code.get(r["pref_code"], "")
        pub = published.get(ac)

        # 読みローマ字キー：published は確定スラッグを優先（凍結値と整合）
        if pub and pub["city_slug"]:
            romaji_key = normalize_key(pub["city_slug"])
        else:
            romaji_key = normalize_key(kana_to_romaji(r["kana"]))

        keys = {
            normalize_key(name),              # 名称キー
            normalize_key(r["kana"]),         # 読みカナキー
            romaji_key,                       # 読みローマ字キー
        }
        # 都道府県名を冠した複合キー（絞り込み・§7.1 同名区別の補助）。
        # 県レコード（pref_name == name）は重複するだけなので付さない。
        if pref_name and pref_name != name:
            keys.add(normalize_key(pref_name + name))
        keys.discard("")

        records.append(
            {
                "area_code": ac,
                "pref_code": r["pref_code"],
                "level": level,          # "prefecture" | "municipality"
                "name": name,            # 表示名（不変・§7.0）
                "pref_name": pref_name,  # パンくず・区別表示用
                "keys": sorted(keys),
                "published": pub is not None,
                "url": pub["url"] if pub else None,
            }
        )

    # area_code 昇順（§7.1 段内並び＝団体コード昇順）
    records.sort(key=lambda x: x["area_code"])

    out = {
        "generated_from": [
            "data/municipality_master.json",
            "data/municipality_kana.json",
        ],
        "notes": [
            "検索クライアント索引（frontend-architecture §7.2 生成物）。手書き禁止・再生成でのみ更新。",
            "全国全件。published=true は公開スコープ（岐阜 active）・url あり。false は未公開（準備中表示）。",
        ],
        "count": len(records),
        "published_count": sum(1 for r in records if r["published"]),
        "data": records,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)

    print(f"wrote {OUT}")
    print(f"  total   : {out['count']}")
    print(f"  published: {out['published_count']}")


if __name__ == "__main__":
    main()
