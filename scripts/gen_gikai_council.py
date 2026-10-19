# -*- coding: utf-8 -*-
"""議会の正副議長・会派・議事録Web公開（試作県。D-24）を、調査の確定CSVから data/gikai_council_{県コード}.json に書く。

入力: poc/recon-20261018-gikai-aichi-mie/ の *-final.csv（Grok→Composer の独立突合を Claude が公式ページで裁定したもの）。
  23（愛知）= aichi1-final.csv + aichi2-final.csv ／ 24（三重）= mie-final.csv
出力: 岐阜の data/gikai_assembly.json と同じ形の 正副議長・会派・議事録公開（議員定数・比較値は gikai_teiin_{県}.json が別に持つ）。
規約（D-25：推定で埋めない）:
  - 会派一覧が空で、備考が「会派なし（公式」で始まるときだけ status「無」。空で公式の記載が無ければ「確認できず」。
  - 議事録の公開形式が空のときは議事録公開を持たない（null＝カードは「データ未整備」）。
使い方: python scripts/gen_gikai_council.py --pref 23
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pref_args import ROOT, load_master_cities, out_path, parse_pref  # noqa: E402

LEDGER = ROOT / "poc" / "recon-20261018-gikai-aichi-mie"
INPUTS = {"23": ["aichi1-final.csv", "aichi2-final.csv"], "24": ["mie-final.csv"]}
FORMAT = {"会議録検索システム": "会議録検索システム", "PDF": "PDF", "その他": "その他（HTML等）"}


def fmt_of(s: str) -> str | None:
    s = s.strip()
    if not s:
        return None
    for k, v in FORMAT.items():
        if s.startswith(k):
            return v
    raise SystemExit(f"公開形式が想定外: {s}")


def main() -> None:
    pref = parse_pref(sys.argv[1:])
    if pref not in INPUTS:
        raise SystemExit("--pref は 23 か 24")
    cities = load_master_cities(pref)
    src = {}
    for name in INPUTS[pref]:
        for r in csv.DictReader(open(LEDGER / name, encoding="utf-8")):
            src[r["area_code"]] = r
    missing = sorted(set(cities) - set(src))
    extra = sorted(set(src) - set(cities))
    if missing or extra:
        raise SystemExit(f"マスタと台帳が不一致 missing={missing} extra={extra}")
    out = []
    for code, name in cities.items():
        r = src[code]
        chair = r["議長氏名"].strip() or None
        vice = r["副議長氏名"].strip() or None
        kaiha_list = []
        for part in filter(None, r["会派一覧"].split("；")):
            n, c = part.rsplit(":", 1)
            kaiha_list.append({"会派名": n, "人数": int(c)})
        if kaiha_list:
            kaiha = {"status": "有", "会派一覧": kaiha_list}
        elif r["備考"].startswith("会派なし（公式"):
            kaiha = {"status": "無", "会派一覧": None}
        else:
            kaiha = {"status": "確認できず", "会派一覧": None}
        fmt = fmt_of(r["議事録_公開形式"])
        row = {
            "area_code": code,
            "市区町村名": name,
            "正副議長": {"議長氏名": chair, "副議長氏名": vice, "status": "有" if chair else "未発見"},
            "会派": kaiha,
            "議事録公開": {"status": "有", "公開形式": fmt, "url": r["議事録_URL"].strip() or None} if fmt else None,
        }
        out.append(row)
    ds = {
        "updated": date.today().isoformat(),
        "notes": [
            "各議会の公式サイトを Grok→Composer の独立突合で調べ、Claude が公式ページで裁定した確定CSVから生成（台帳＝poc/recon-20261018-gikai-aichi-mie/）。",
            "会派「有」は会派別人数。会派に属さない議員は「会派に属さない議員」1件で数える。議長・副議長が会派を離れている旨が公式に書かれているときは含めない。",
            "会派が空で『確認できず』は、名簿が党派のみ等で会派の記載も会派制を採らない旨の記載も見つからないもの。議事録公開が null は、会議録本文の公開を確認できなかったもの（非公開の意味ではない）。",
        ],
        "sources": [{"role": "議長・副議長・会派・議事録Web公開（各議会公式サイトの個別調査）", "fetched_at": "2026-10-18"}],
        "data": out,
    }
    p = out_path("gikai_council", pref)
    json.dump(ds, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(p.name, len(out), "団体",
          "会派:", {s: sum(1 for x in out if x["会派"]["status"] == s) for s in ("有", "無", "確認できず")},
          "議事録あり:", sum(1 for x in out if x["議事録公開"]))


main()
