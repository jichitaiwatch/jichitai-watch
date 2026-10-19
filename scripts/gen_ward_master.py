# -*- coding: utf-8 -*-
"""政令指定都市の区を、自治体マスタに「区」の行として足す（D-24 試作。20260808_decisions.md D-24・docs/launch-backlog.md L-9 の名古屋市16区）。

入力（取得済みのローカルファイルのみ。ネットワークに接続しない）:
  data/municipality_master_{県コード}.json … gen_municipality_master.py --pref が作る試作マスタ（市の行）
  data/municipality_kana.json … 総務省コード表のカナ（政令市の区を含む全国全件。gen_municipality_kana.py が単一ソース）

出力: 同じマスタに区の行を追加（既にある区の行は作り直す。何度実行しても同じ結果）
  区の行の追加キー: "kind": "ward"、"parent_area_code": 親の市の6桁コード
  city_name は「名古屋市千種区」（住基・国勢調査の原表の表記と同じ）、city_slug は「nagoya-shi-chikusa-ku」
  （親のスラッグ＋区のスラッグ。区だけだと県をまたいで重なる〈西区・中央区など〉ため、親のスラッグを前に付ける）
  kaigo_insurer_name は親の市と同じ。市の行・県の行は変更しない。

使い方:
  python scripts/gen_ward_master.py --pref 23
  （gen_municipality_master.py --pref を再実行するとマスタが作り直され区の行が消えるため、その後にこれを再実行する）
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_municipality_master import kana_to_city_slug, to_fullwidth_katakana  # noqa: E402
from pref_args import ROOT, master_path  # noqa: E402

KANA_PATH = ROOT / "data" / "municipality_kana.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pref", required=True, help="県コード2桁（岐阜〈21〉には政令市が無いので対象外）")
    args = ap.parse_args()
    if args.pref == "21":
        raise SystemExit("岐阜（21）に政令指定都市は無い。対象は試作県だけ。")

    mpath = master_path(args.pref)
    master = json.loads(mpath.read_text(encoding="utf-8"))
    records = [r for r in master["data"] if r.get("kind") != "ward"]
    parents = {r["area_code"]: r for r in records if r["city_name"] and r["status"] == "active"}

    kana_rows = [
        r for r in json.loads(KANA_PATH.read_text(encoding="utf-8"))["data"]
        if r["pref_code"] == args.pref and r["level"] == "municipality"
    ]
    kana_by_code = {r["area_code"]: r for r in kana_rows}

    wards: list[dict] = []
    for pcode, p in sorted(parents.items()):
        pk = kana_by_code.get(pcode)
        if pk is None:
            raise SystemExit(f"カナの表に親の市が無い: {pcode} {p['city_name']}")
        for r in kana_rows:
            n = r["name"]
            # 親の名前＋「…区」の行（例：名古屋市＋千種区）。親そのものは除く
            if r["area_code"] == pcode or not (n.startswith(p["city_name"]) and n.endswith("区")):
                continue
            if not r["kana"].startswith(pk["kana"]):
                raise SystemExit(f"区のカナが親のカナで始まらない: {r}")
            ward_kana = r["kana"][len(pk["kana"]):]
            ward_slug = kana_to_city_slug(ward_kana, r["area_code"])
            slug = f"{p['city_slug']}-{ward_slug}"
            if not re.fullmatch(r"[a-z]+(?:-[a-z]+)*", slug):
                raise SystemExit(f"スラッグが規約外: {slug!r}")
            wards.append({
                "area_code": r["area_code"],
                "pref_name": p["pref_name"],
                "pref_slug": p["pref_slug"],
                "city_name": n,
                "city_slug": slug,
                "kaigo_insurer_name": p["kaigo_insurer_name"],
                "status": "active",
                "effective_from": p["effective_from"],
                "effective_to": None,
                "successor_area_code": None,
                "kind": "ward",
                "parent_area_code": pcode,
            })
    if not wards:
        print(f"[info] {args.pref}: 区を持つ市は無い。マスタは変更しない。")
        return

    slugs = [w["city_slug"] for w in wards] + [r["city_slug"] for r in records if r["city_name"]]
    dup = {s for s in slugs if slugs.count(s) > 1}
    if dup:
        raise SystemExit(f"city_slug が重なる: {sorted(dup)}")

    out = sorted(records + wards, key=lambda r: r["area_code"])
    master["data"] = out
    note = "政令指定都市の区は kind='ward'・parent_area_code の行（scripts/gen_ward_master.py。カナは data/municipality_kana.json）。市の行の集計・件数には含めない。"
    master["notes"] = [n for n in master.get("notes", []) if not n.startswith("政令指定都市の区は kind=")] + [note]
    mpath.write_text(json.dumps(master, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[ok] {mpath.relative_to(ROOT)}: 区 {len(wards)} 行（親の市: {sorted({w['parent_area_code'] for w in wards})}）")
    for w in wards[:3] + wards[-2:]:
        print(f"  {w['area_code']} {w['city_name']} → {w['city_slug']}")


if __name__ == "__main__":
    main()
