# -*- coding: utf-8 -*-
import json
import os
from pathlib import Path

# 原本と中間出力は poc/recon-20260830-1-1a-timeseries/ にある。相対パスをそのフォルダ基準にそろえる
os.chdir(Path(__file__).resolve().parents[1] / "poc" / "recon-20260830-1-1a-timeseries")
import openpyxl
import xlrd

FILES = [
    {
        "key": "r2_2020",
        "reiwa_label": "令和2年",
        "date": "2020-01-01",
        "path": "estat_000031971203_juki_shichoson_pop_hh_r2_2020.xls",
        "engine": "xlrd",
        "stat_inf_id": "000031971203",
    },
    {
        "key": "r3_2021",
        "reiwa_label": "令和3年",
        "date": "2021-01-01",
        "path": "estat_000040306659_juki_shichoson_pop_hh_r3_2021.xlsx",
        "engine": "openpyxl",
        "stat_inf_id": "000040306659",
    },
    {
        "key": "r4_2022",
        "reiwa_label": "令和4年",
        "date": "2022-01-01",
        "path": "estat_000032224636_juki_shichoson_pop_hh_r4_2022.xlsx",
        "engine": "openpyxl",
        "stat_inf_id": "000032224636",
    },
    {
        "key": "r5_2023",
        "reiwa_label": "令和5年",
        "date": "2023-01-01",
        "path": "estat_000040306647_juki_shichoson_pop_hh_r5_2023.xlsx",
        "engine": "openpyxl",
        "stat_inf_id": "000040306647",
    },
    {
        "key": "r6_2024",
        "reiwa_label": "令和6年",
        "date": "2024-01-01",
        "path": "estat_000040306672_juki_shichoson_pop_hh_r6_2024.xlsx",
        "engine": "openpyxl",
        "stat_inf_id": "000040306672",
    },
    {
        "key": "r7_2025",
        "reiwa_label": "令和7年",
        "date": "2025-01-01",
        "path": "../recon-20260828/1-1a/estat_000040306653_juki_shichoson_pop_hh_r7.xlsx",
        "engine": "openpyxl",
        "stat_inf_id": "000040306653",
    },
    {
        "key": "r8_2026",
        "reiwa_label": "令和8年",
        "date": "2026-01-01",
        # 総務省サイト掲載ファイル（e-Stat 経由ではない）。ファイルID 000892952
        "path": "../recon-20261012-juki-r8/soumu_000892952_juki_shichoson_pop_hh_r8.xlsx",
        "engine": "openpyxl",
        "stat_inf_id": None,
    },
]


def load_rows_openpyxl(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.worksheets[0]
    rows = []
    for r in range(1, ws.max_row + 1):
        rows.append([ws.cell(row=r, column=c).value for c in range(1, 8)])
    return rows


def load_rows_xlrd(path):
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    rows = []
    for r in range(sh.nrows):
        row = []
        for c in range(7):
            v = sh.cell_value(r, c) if c < sh.ncols else None
            row.append(v)
        rows.append(row)
    return rows


def find_header_row(rows):
    for i, row in enumerate(rows):
        if row and row[0] == "団体コード":
            return i
    raise ValueError("header row (団体コード) not found")


def is_real_municipality(code, name):
    if not name:
        return False
    if name == "-":
        return False
    if name.endswith("郡"):
        return False
    return True


def extract_gifu(fmeta):
    if fmeta["engine"] == "xlrd":
        rows = load_rows_xlrd(fmeta["path"])
    else:
        rows = load_rows_openpyxl(fmeta["path"])

    header_idx = find_header_row(rows)
    data_rows = rows[header_idx + 1 :]

    result = {}
    for row in data_rows:
        code, pref, name, male, female, total, households = row[:7]
        if pref != "岐阜県":
            continue
        if not is_real_municipality(code, name):
            continue
        code = str(code)
        result[code] = {
            "市区町村コード": code,
            "市区町村名": name,
            "男": int(male) if male is not None else None,
            "女": int(female) if female is not None else None,
            "計": int(total) if total is not None else None,
            "世帯数": int(households) if households is not None else None,
        }
    return result


def main():
    per_year = {}
    counts = {}
    for fmeta in FILES:
        key = fmeta["key"]
        gifu = extract_gifu(fmeta)
        per_year[key] = gifu
        counts[key] = len(gifu)

    with open("out_extract_summary.json", "w", encoding="utf-8") as f:
        json.dump(counts, f, ensure_ascii=False, indent=1)

    # merge by code
    all_codes = set()
    for gifu in per_year.values():
        all_codes.update(gifu.keys())

    merged = []
    for code in sorted(all_codes):
        rec = {"市区町村コード": code}
        name_set = set()
        for fmeta in FILES:
            key = fmeta["key"]
            entry = per_year[key].get(code)
            if entry:
                name_set.add(entry["市区町村名"])
                rec[key] = {
                    "人口_男": entry["男"],
                    "人口_女": entry["女"],
                    "人口_計": entry["計"],
                    "世帯数": entry["世帯数"],
                }
            else:
                rec[key] = None
        rec["市区町村名"] = sorted(name_set)
        merged.append(rec)

    with open("out_merged.json", "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=1)

    print("counts:", counts)
    print("total distinct codes:", len(all_codes))


if __name__ == "__main__":
    main()
