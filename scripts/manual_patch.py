# -*- coding: utf-8 -*-
"""手作業で確認した値（個別サイト・一次情報で補った値）を、再生成したデータへ当て直す共通処理。

自治総研のExcelは更新が遅く、直近の首長交代が載らない。その分は各自治体・都道府県の公式情報で個別に確認して補っており、
補った値は scripts/patches/*.json に保存してある。build_m2_1_chief.py・build_pref_governor.py は、
Excel から再生成したあとにここで当て直す。

規則:
  - 補正の当選年月日が、再生成した値より新しい場合だけ当てる（古い・同じなら再生成した値を優先する）。
    自治総研が追いついたら、補正は自然に外れる。
  - 1件でも当てたときだけ、patch の merge（説明・注記・修正記録）も反映する。
"""
from __future__ import annotations

import json
from pathlib import Path


def _merge(dst: dict, src: dict) -> dict:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            _merge(dst[k], v)
        else:
            dst[k] = v
    return dst


def apply_manual_patch(output: dict, patch_path: Path, key: str) -> tuple[list[str], list[str]]:
    """output["data"] の key（area_code / pref_code）が一致するレコードに補正を当てる。(当てた, 外れた) を返す。"""
    patch = json.loads(patch_path.read_text(encoding="utf-8"))
    by_key = {r[key]: i for i, r in enumerate(output["data"])}
    applied: list[str] = []
    superseded: list[str] = []
    for prec in patch["records"]:
        i = by_key[prec[key]]
        if prec["当選年月日"] > output["data"][i]["当選年月日"]:
            output["data"][i] = prec
            applied.append(prec[key])
        else:
            superseded.append(prec[key])
    if applied:
        _merge(output, patch.get("merge", {}))
    return applied, superseded
