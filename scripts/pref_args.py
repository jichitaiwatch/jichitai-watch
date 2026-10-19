# -*- coding: utf-8 -*-
"""取得スクリプトの県引数化の共通部品（20260808_decisions.md D-24 共通化・D-17・pre-launch-blockers.md #2）。

使い方（各スクリプトの先頭で）:
    from pref_args import DEFAULT_PREF, parse_pref, out_path, load_master_cities
    PREF = parse_pref(sys.argv[1:])            # --pref NN（既定 21＝岐阜）
    OUT = out_path("m1_2c_taxable_income", PREF)

規約:
  - 既定（21＝岐阜）の出力は従来どおり data/{basename}.json（公開対象）。
  - それ以外の県は data/{basename}_{県コード}.json（D-24 の試作。publish/allowlist.txt で除外し公開しない）。
  - 対象団体と名前の基準は自治体マスタ（data/municipality_master.json／_{県コード}.json）の市区町村行。
    政令市の区はマスタに無い（市の単位で扱う）。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PREF = "21"  # 引数なしの既定（V1 公開分）


def parse_pref(argv: list[str]) -> str:
    """--pref NN（都道府県コード2桁）。無ければ既定。"""
    if "--pref" not in argv:
        return DEFAULT_PREF
    i = argv.index("--pref")
    if i + 1 >= len(argv) or not re.fullmatch(r"\d{2}", argv[i + 1]):
        raise SystemExit("--pref には都道府県コード2桁を指定する（例 --pref 23）")
    return argv[i + 1]


def out_path(basename: str, pref: str) -> Path:
    name = f"{basename}.json" if pref == DEFAULT_PREF else f"{basename}_{pref}.json"
    return ROOT / "data" / name


def master_path(pref: str) -> Path:
    name = "municipality_master.json" if pref == DEFAULT_PREF else f"municipality_master_{pref}.json"
    return ROOT / "data" / name


def _master_rows(pref: str) -> list[dict]:
    p = master_path(pref)
    if not p.exists():
        raise SystemExit(f"自治体マスタが無い: {p.relative_to(ROOT)}")
    return json.load(open(p, encoding="utf-8"))["data"]


def load_master_cities(pref: str) -> dict[str, str]:
    """自治体マスタの市区町村行（city_name が空でない active 行）を area_code(6桁)→名前で返す。"""
    out = {r["area_code"]: r["city_name"] for r in _master_rows(pref)
           if r.get("city_name") and r.get("status") == "active" and r["area_code"].startswith(pref)
           and r.get("kind") != "ward"}  # 政令市の区の行（scripts/gen_ward_master.py が足す）は市の一覧に含めない
    if not out:
        raise SystemExit(f"自治体マスタに県コード{pref}の市区町村行が無い")
    return out


def load_master_wards(pref: str) -> dict[str, tuple[str, str]]:
    """自治体マスタの政令市の区の行（kind='ward'）を area_code(6桁)→(名前, 親の市の area_code) で返す。無ければ空。"""
    return {r["area_code"]: (r["city_name"], r["parent_area_code"]) for r in _master_rows(pref)
            if r.get("kind") == "ward" and r.get("status") == "active" and r["area_code"].startswith(pref)}


def load_master_pref_name(pref: str) -> str:
    """自治体マスタの県の行の県名（例 '愛知県'）。"""
    names = {r["pref_name"] for r in _master_rows(pref) if r["area_code"].startswith(pref) and r.get("pref_name")}
    if len(names) != 1:
        raise SystemExit(f"自治体マスタの県名が1つに定まらない: {sorted(names)}")
    return names.pop()
