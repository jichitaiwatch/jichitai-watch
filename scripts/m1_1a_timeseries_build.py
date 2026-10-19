# -*- coding: utf-8 -*-
import json
import os
import sys
from pathlib import Path

# 県引数（D-24 共通化）: --pref 23 など。岐阜（既定）は従来どおり data/m1_1a_population_timeseries.json。
# それ以外は out_merged_{県コード}.json から data/m1_1a_population_timeseries_{県コード}.json を書く（area_code 付き・公開しない）。
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pref_args import DEFAULT_PREF, load_master_pref_name, out_path, parse_pref  # noqa: E402

PREF = parse_pref(sys.argv[1:])
IS_DEFAULT = PREF == DEFAULT_PREF
PREF_NAME = load_master_pref_name(PREF)
OUT_PATH = out_path("m1_1a_population_timeseries", PREF)  # 絶対パス（下の chdir に影響されない）

# 原本と中間出力は poc/recon-20260830-1-1a-timeseries/ にある。相対パスをそのフォルダ基準にそろえる
os.chdir(Path(__file__).resolve().parents[1] / "poc" / "recon-20260830-1-1a-timeseries")

FILES = [
    {
        "key": "r2_2020",
        "year_label": "令和2年1月1日",
        "stat_inf_id": "000031971203",
        "path": "estat_000031971203_juki_shichoson_pop_hh_r2_2020.xls",
        "sha256": "65da53be4fde4c33d0af5c7d225f600bf5f22d961c62e6efc37d3e9c0d9b1011",
    },
    {
        "key": "r3_2021",
        "year_label": "令和3年1月1日",
        "stat_inf_id": "000040306659",
        "path": "estat_000040306659_juki_shichoson_pop_hh_r3_2021.xlsx",
        "sha256": "a38f7539e1587ed95d22fd8c12e151ac11697e9f0c95b1ab1ce5cc99656a3ce3",
    },
    {
        "key": "r4_2022",
        "year_label": "令和4年1月1日",
        "stat_inf_id": "000032224636",
        "path": "estat_000032224636_juki_shichoson_pop_hh_r4_2022.xlsx",
        "sha256": "72d4da673c384d824fd24f4ec3802e3c179183b5c3bcb67699b32e0eeb95a9f7",
    },
    {
        "key": "r5_2023",
        "year_label": "令和5年1月1日",
        "stat_inf_id": "000040306647",
        "path": "estat_000040306647_juki_shichoson_pop_hh_r5_2023.xlsx",
        "sha256": "09a35646f7dea3ea738be03cf03b70bccecffe55f916dd4d29a1d87cb722d100",
    },
    {
        "key": "r6_2024",
        "year_label": "令和6年1月1日",
        "stat_inf_id": "000040306672",
        "path": "estat_000040306672_juki_shichoson_pop_hh_r6_2024.xlsx",
        "sha256": "f76c54a5f59f1e78a53910a649d96fa24001bfd2efc5d91ecef66b4849bb246b",
    },
    {
        "key": "r7_2025",
        "year_label": "令和7年1月1日",
        "stat_inf_id": "000040306653",
        "path": "poc/recon-20260828/1-1a/estat_000040306653_juki_shichoson_pop_hh_r7.xlsx",
        "sha256": "5e6c474d2b0c89e6006b8ccca844b7422c3d867e2444e3f5ef14627b2bc06f8a",
    },
    {
        "key": "r8_2026",
        "year_label": "令和8年1月1日",
        "stat_inf_id": None,  # 総務省サイト掲載ファイル（e-Stat 経由ではない）
        "soumu_file_id": "000892952",
        "path": "poc/recon-20261012-juki-r8/soumu_000892952_juki_shichoson_pop_hh_r8.xlsx",
        "sha256": "0d044766466d28c4988414e93238148ecb1d764642542d48332064d51cdff3bc",
        "fetched_at": "2026-10-12",
    },
]

FETCHED_AT = "2026-10-12"  # 全体の更新日。令和2〜7年分の取得日は各 source の fetched_at に残す
OLD_FETCHED_AT = "2026-08-30"

sources = []
for f in FILES:
    if f["stat_inf_id"]:
        src = {
            "year_key": f["key"],
            "year_label": f["year_label"],
            "source_url": f"https://www.e-stat.go.jp/stat-search/file-download?statInfId={f['stat_inf_id']}&fileKind=0",
            "source_page": "https://www.e-stat.go.jp/stat-search/files?toukei=00200241&tstat=000001039591",
            "stat_name": "住民基本台帳に基づく人口、人口動態及び世帯数調査",
            "table_title": f"【総計】市区町村別人口、人口動態及び世帯数（{f['year_label']}時点）",
            "fetched_at": OLD_FETCHED_AT,
            "source_file_hash": f["sha256"],
        }
    else:
        src = {
            "year_key": f["key"],
            "year_label": f["year_label"],
            "source_url": f"https://www.soumu.go.jp/main_content/{f['soumu_file_id']}.xlsx",
            "source_page": "https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/jinkou_jinkoudoutai-setaisuu.html",
            "stat_name": "住民基本台帳に基づく人口、人口動態及び世帯数",
            "table_title": f"人口、世帯数、人口動態（市区町村別）【総計】（{f['year_label']}時点）",
            "fetched_at": f["fetched_at"],
            "source_file_hash": f["sha256"],
        }
    sources.append(src)

merged = json.load(open("out_merged.json" if IS_DEFAULT else f"out_merged_{PREF}.json", encoding="utf-8"))

data = []
for rec in merged:
    row = {} if IS_DEFAULT else {"area_code": rec["市区町村コード"]}
    row.update({
        "市区町村コード": rec["市区町村コード"],
        "都道府県": PREF_NAME,
        "市区町村名": rec["市区町村名"][0],
    })
    for f in FILES:
        key = f["key"]
        v = rec[key]
        row[key] = v
    data.append(row)

# sort by municipality code for stable output
data.sort(key=lambda r: r["市区町村コード"])

output = {
    "sources": sources,
    "period": "令和2年1月1日〜令和8年1月1日、各年1月1日時点（住民基本台帳）",
    "updated": FETCHED_AT,
    "notes": [
        "e-Stat「住民基本台帳に基づく人口、人口動態及び世帯数調査」（toukei=00200241, tstat=000001039591）の年次ファイルから、都道府県='" + PREF_NAME + "'・実市区町村（郡見出し行・都道府県計行を除く）をフィルタして取得。",
        "令和2年（2020年）分は旧形式(.xls)で提供されており、他年（.xlsx）とヘッダ行数が異なるが、データ列位置（団体コード/都道府県名/市区町村名/男/女/計/世帯数）は同一であることを確認済み。",
        "令和2.1.1〜令和8.1.1の7時点（各年1月1日）を収録した。令和2〜7年分はe-Stat、令和8年分は総務省サイト掲載ファイル（e-Statへの掲載前）から取得した。",
        f"{PREF_NAME}{len(data)}市町村は全7年で{len(data)}/{len(data)}が揃い、団体コード・市区町村名の変化（合併・改称）は無かったことを確認済み。",
        "本ファイルは生値のみを格納する。5年前との増減数・増減率はこのJSONを使う側（UI/集計）で計算する。",
        "r2_2020〜r8_2026の各キーは当該年1月1日時点の人口_男/人口_女/人口_計/世帯数を持つ。値が無い場合はnull（今回は全年で欠損なし）。",
    ],
    "data": data,
}

# 政令市の区（試作のみ）：wards 配列に置く（市の行 data とは分ける）。7年すべてで区の合計＝親の市の値を検算
wards_path = f"out_merged_{PREF}_wards.json"
if not IS_DEFAULT and os.path.exists(wards_path):
    wmerged = json.load(open(wards_path, encoding="utf-8"))
    wards = []
    for rec in wmerged:
        row = {"area_code": rec["市区町村コード"], "市区町村コード": rec["市区町村コード"], "都道府県": PREF_NAME,
               "市区町村名": rec["市区町村名"][0], "parent_area_code": rec["parent_area_code"]}
        for f in FILES:
            if rec[f["key"]] is None:
                raise SystemExit(f"区 {rec['市区町村名'][0]} の {f['key']} が原表に無い")
            row[f["key"]] = rec[f["key"]]
        wards.append(row)
    by_code = {r["area_code"]: r for r in data}
    for p6 in sorted({w["parent_area_code"] for w in wards}):
        kids = [w for w in wards if w["parent_area_code"] == p6]
        for f in FILES:
            for k in ("人口_男", "人口_女", "人口_計", "世帯数"):
                tot = sum(w[f["key"]][k] for w in kids)
                if tot != by_code[p6][f["key"]][k]:
                    raise SystemExit(f"{by_code[p6]['市区町村名']}の区{len(kids)}件の{f['key']} {k}合計{tot}が市の値{by_code[p6][f['key']][k]}と不一致")
        print(f"OK {by_code[p6]['市区町村名']}の区{len(kids)}件: 7年×(男・女・計・世帯数)の合計 = 市の値")
    output["wards"] = sorted(wards, key=lambda r: r["市区町村コード"])

if not IS_DEFAULT:
    output["notes"].append(f"D-24 の試作（公開しない）。対象は自治体マスタ data/municipality_master_{PREF}.json の団体（政令指定都市の区の行は含めない）。")
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print("wrote", len(data), "records")
