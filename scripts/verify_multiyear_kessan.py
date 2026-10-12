# -*- coding: utf-8 -*-
"""生成済み3ファイルを開き直して自己検証し、data/_verify_multiyear.txt に出力する。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "_verify_multiyear.txt"
YEARS = list(range(2015, 2025))

a = json.loads((ROOT / "data" / "m3_expenditure_multiyear.json").read_text(encoding="utf-8"))
b = json.loads((ROOT / "data" / "m2_3_finance_scale_multiyear.json").read_text(encoding="utf-8"))
c = json.loads((ROOT / "data" / "m2_4_kenzenka_shichoson_multiyear.json").read_text(encoding="utf-8"))

lines = []
lines.append("=" * 70)
lines.append("多年度化 自己検証レポート")
lines.append("=" * 70)

for label, d in (("A: m3_expenditure_multiyear.json", a),
                  ("B: m2_3_finance_scale_multiyear.json", b),
                  ("C: m2_4_kenzenka_shichoson_multiyear.json", c)):
    lines.append("")
    lines.append(f"### {label}")
    year_keys = sorted({k for rec in d["data"] for k in rec.keys() if k.startswith("fy")})
    lines.append(f"(1) 格納年度数: {len(year_keys)} / 年度ラベル一覧: {year_keys}")

    lines.append("(2) 岐阜42市町村の充足確認（年度ごと）:")
    for fy in YEARS:
        yk = f"fy{fy}"
        present = [r["area_code"] for r in d["data"] if r.get(yk) is not None]
        missing = [r["area_code"] for r in d["data"] if r.get(yk) is None]
        status = "OK 42/42" if len(present) == 42 else f"NG {len(present)}/42 欠け={missing}"
        lines.append(f"    {yk}: {status}")

    lines.append("(3) 欠損内訳（年度別）:")
    missing_log = d.get("data_check_log", {}).get("missing_codes_by_year", {})
    for fy in YEARS:
        yk = f"fy{fy}"
        n_unconfirmed = len(missing_log.get(yk, []))
        # "-"（構造的ゼロ）件数のカウント: レコード内の値を走査
        n_dash = 0
        for rec in d["data"]:
            row = rec.get(yk)
            if isinstance(row, dict):
                n_dash += sum(1 for v in row.values() if v == "-")
        lines.append(f"    {yk}: 確認できず(null)={n_unconfirmed}件, \"-\"(構造的ゼロ)={n_dash}件")

lines.append("")
lines.append("(4) 岐阜市(212016) 全年度・系統別の値（連続性の目視確認用）")
gifu_a = next(r for r in a["data"] if r["area_code"] == "212016")
gifu_b = next(r for r in b["data"] if r["area_code"] == "212016")
gifu_c = next(r for r in c["data"] if r["area_code"] == "212016")

lines.append("")
lines.append("[A: 分野別支出 円/人]")
for fy in YEARS:
    row = gifu_a[f"fy{fy}"]
    lines.append(f"  FY{fy}: 民生費={row['民生費_円/人']:>7,} 教育費={row['教育費_円/人']:>7,} "
                 f"土木費={row['土木費_円/人']:>7,} 普通建設事業費={row['普通建設事業費_円/人']:>7,} "
                 f"(人口={row['人口_人']:,})")

lines.append("")
lines.append("[B: 財政規模 千円]")
for fy in YEARS:
    row = gifu_b[f"fy{fy}"]
    lines.append(f"  FY{fy}: 歳入総額={row['歳入総額_千円']:>14,} 歳出総額={row['歳出総額_千円']:>14,}")

lines.append("")
lines.append("[C: 財政健全化指標 ％]")
for fy in YEARS:
    row = gifu_c[f"fy{fy}"]
    lines.append(f"  FY{fy}: {row}")

lines.append("")
lines.append("=" * 70)
lines.append("[既存単年度ファイルとの突合]")
old_m3 = json.loads((ROOT / "data" / "m3_expenditure.json").read_text(encoding="utf-8"))
old_m3_gifu = next(r for r in old_m3["data"] if r["area_code"] == "212016")
new_fy2023_a = gifu_a["fy2023"]
match_a = all(old_m3_gifu[k] == new_fy2023_a[k] for k in
              ("民生費_円/人", "教育費_円/人", "土木費_円/人", "普通建設事業費_円/人"))
lines.append(f"m3_expenditure.json(FY2023) vs 多年度版fy2023 一致: {match_a}")
match_avg = (old_m3["national_average"]["民生費_円/人"] == a["averages_by_year"]["fy2023"]["national"]["民生費_円/人"]
             and old_m3["prefecture_average"]["民生費_円/人"] == a["averages_by_year"]["fy2023"]["prefecture"]["民生費_円/人"])
lines.append(f"national_average/prefecture_average(FY2023) 一致: {match_avg}")

old_m2 = json.loads((ROOT / "data" / "m2_2_finance.json").read_text(encoding="utf-8"))
old_m2_gifu = next(r for r in old_m2["data"] if r["area_code"] == "212016")
new_fy2024_c = gifu_c["fy2024"]
match_c = (
    new_fy2024_c["実質公債費比率"] == old_m2_gifu["実質公債費比率"] and
    new_fy2024_c["実質赤字比率"] == old_m2_gifu["ratio_source_tokens"]["実質赤字比率"] and
    new_fy2024_c["連結実質赤字比率"] == old_m2_gifu["ratio_source_tokens"]["連結実質赤字比率"] and
    new_fy2024_c["将来負担比率"] == old_m2_gifu["ratio_source_tokens"]["将来負担比率"]
)
lines.append(f"m2_2_finance.json(FY2024健全化指標) vs 多年度版fy2024 一致: {match_c}")

new_fy2024_b = gifu_b["fy2024"]
old_m2_verif = old_m2["verification"]["gifu_shi"]
match_b = (new_fy2024_b["歳入総額_千円"] == old_m2_verif["歳入総額_概況"] and
           new_fy2024_b["歳出総額_千円"] == old_m2_verif["歳出総額_概況"])
lines.append(f"m2_2_finance.json(FY2024歳入歳出概況・verification block) vs 多年度版fy2024 一致: {match_b}")

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"[output] {OUT}")
