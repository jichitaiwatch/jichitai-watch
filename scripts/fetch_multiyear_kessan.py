# -*- coding: utf-8 -*-
"""FY2015-2024 多年度化: A/B/C 用Excelファイルの一括取得。data/cache/へ保存。"""
import hashlib
import shutil
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache"
OLD_CACHE = ROOT / "data" / "cache" / "multiyear"
CACHE.mkdir(parents=True, exist_ok=True)

BASE = "https://www.soumu.go.jp/main_content/{}"

# (fy, role, file_id_with_ext)
AB_FILES = {
    2024: ("001061669.xlsx", "001061671.xlsx", "001061672.xlsx", "001061674.xlsx", "001061676.xlsx", "001061677.xlsx"),
    2023: ("000999900.xlsx", "000999902.xlsx", "000999903.xlsx", "000999905.xlsx", "000999908.xlsx", "000999910.xlsx"),
    2022: ("000937287.xlsx", "000937289.xlsx", "000937290.xlsx", "000937292.xlsx", "000937294.xlsx", "000937295.xlsx"),
    2021: ("000871018.xlsx", "000871020.xlsx", "000871021.xlsx", "000871023.xlsx", "000871025.xlsx", "000871026.xlsx"),
    2020: ("000800819.xlsx", "000800822.xlsx", "000800823.xlsx", "000800826.xlsx", "000800830.xlsx", "000800832.xlsx"),
    2019: ("000738076.xlsx", "000738078.xlsx", "000738079.xlsx", "000738081.xlsx", "000738083.xlsx", "000738084.xlsx"),
    2018: ("000676020.xlsx", "000676022.xlsx", "000676023.xlsx", "000676025.xlsx", "000676027.xlsx", "000676028.xlsx"),
    2017: ("000607403.xlsx", "000607405.xlsx", "000607406.xlsx", "000607408.xlsx", "000607410.xlsx", "000607411.xlsx"),
    2016: ("000539364.xls", "000539366.xls", "000539367.xls", "000539369.xls", "000539371.xls", "000539372.xls"),
    2015: ("000473891.xls", "000473893.xls", "000473894.xls", "000473896.xls", "000473898.xls", "000473899.xls"),
}
AB_ROLES = ("shi_gaikyo", "shi_mokuteki", "shi_seishitsu", "machi_gaikyo", "machi_mokuteki", "machi_seishitsu")

C_FILES = {
    2024: ("001060123.xlsx", "001047934.xlsm"),
    2023: ("001001455.xlsx", "000984544.xlsm"),
    2022: ("000941189.xls", "000956932.xlsx"),
    2021: ("000885693.xls", "000851882.xlsx"),
    2020: ("000802550.xls", "001063147.xlsx"),
    2019: ("000802553.xls", "000718731.xlsx"),
    2018: ("000802556.xls", "000656966.xlsx"),
    2017: ("000802559.xls", "000586607.xlsx"),
    2016: ("000802562.xls", "000533720.xls"),
    2015: ("000450176.xls", "000451780.xls"),
}
C_ROLES = ("gaiyou", "kiso")

# 既にmultiyear/配下に取得済みのファイル(プローブ時)を流用するための対応表
REUSE = {
    ("2024", "shi_gaikyo"): "fy2024_shi_gaikyo.xlsx",
    ("2024", "shi_mokuteki"): "fy2024_shi_mokuteki.xlsx",
    ("2024", "shi_seishitsu"): "fy2024_shi_seishitsu.xlsx",
    ("2015", "shi_gaikyo"): "fy2015_shi_gaikyo.xls",
    ("2015", "shi_mokuteki"): "fy2015_shi_mokuteki.xls",
    ("2015", "shi_seishitsu"): "fy2015_shi_seishitsu.xls",
}
REUSE_C = {
    ("2024", "gaiyou"): "fy2024_kenzen_gaiyou.xlsx",
    ("2024", "kiso"): "fy2024_kenzen_kiso.xlsm",
    ("2015", "gaiyou"): "fy2015_kenzen_gaiyou.xls",
    ("2015", "kiso"): "fy2015_kenzen_kiso.xls",
}


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def fetch(url: str, dest: Path) -> None:
    if dest.exists():
        print(f"  [cache] {dest.name}")
        return
    print(f"  [DL] {url} -> {dest.name} ...", end=" ", flush=True)
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    dest.write_bytes(r.content)
    print(f"ok ({len(r.content):,} bytes)")
    time.sleep(0.5)


def main():
    log = []
    for fy, files in AB_FILES.items():
        for role, fid in zip(AB_ROLES, files):
            ext = fid.split(".")[-1]
            dest = CACHE / f"kessan_fy{fy}_{role}.{ext}"
            reuse_name = REUSE.get((str(fy), role))
            if reuse_name and not dest.exists() and (OLD_CACHE / reuse_name).exists():
                shutil.copy(OLD_CACHE / reuse_name, dest)
                print(f"  [reuse] {dest.name}")
            else:
                fetch(BASE.format(fid), dest)
            log.append((dest.name, BASE.format(fid), sha256(dest)))

    # kiso(基礎数値)は数十MB級のため、まずgaiyou(概要)のみ全年度取得。
    # kisoは検証で欠損が出た年度だけ後段で個別取得する。
    for fy, files in C_FILES.items():
        role, fid = C_ROLES[0], files[0]
        ext = fid.split(".")[-1]
        dest = CACHE / f"kenzenka_fy{fy}_{role}.{ext}"
        reuse_name = REUSE_C.get((str(fy), role))
        if reuse_name and not dest.exists() and (OLD_CACHE / reuse_name).exists():
            shutil.copy(OLD_CACHE / reuse_name, dest)
            print(f"  [reuse] {dest.name}")
        else:
            fetch(BASE.format(fid), dest)
        log.append((dest.name, BASE.format(fid), sha256(dest)))

    out = ROOT / "scripts" / "_tmp_fetch_log.txt"
    out.write_text("\n".join(f"{n}\t{u}\t{h}" for n, u, h in log), encoding="utf-8")
    print(f"\n[log] {out}  ({len(log)} files)")


if __name__ == "__main__":
    main()
