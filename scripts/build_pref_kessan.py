# -*- coding: utf-8 -*-
"""47都道府県 決算状況調（令和6年度＝R6／令和5年度＝R5）データ取得スクリプト。
出力: data/pref_kessan.json

出典:
  総務省「地方財政状況調査関係資料｜令和6年度都道府県決算状況調」
    https://www.soumu.go.jp/iken/zaisei/r06_todohuken.html
  総務省「地方財政状況調査関係資料｜令和5年度都道府県決算状況調」
    https://www.soumu.go.jp/iken/zaisei/r05_todohuken.html

保持構造は data/m2_2_finance.json（市区町村）に倣う：
  revenue_r6 / expenditure_purpose_r6 / revenue_r5 / expenditure_purpose_r5 の入れ子。
ただし款・目的の区分セットは都道府県固有のものを使う（市区町村の28款・14目的に丸めない）。
  歳入 = 都道府県固有の17款（区分「一」〜「十七」／R6・R5とも同一）
  歳出 = 目的別 R6は26区分（「一」〜「二十六」）／R5は27区分（「一」〜「二十七」）
        R5にのみ「特別地方消費税交付金」（区分「二十二」）が存在する（現物確認・2026-09-03）。

金額の単位は全て千円（各表ヘッダ「(単位 千円)」）。
"""
import hashlib
import json
from datetime import date
from pathlib import Path

import openpyxl
from openpyxl.utils import column_index_from_string

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache"
OUT = ROOT / "data" / "pref_kessan.json"
EXISTING_PREF_ASSEMBLY = ROOT / "data" / "pref_assembly.json"

TODAY = date.today().isoformat()

SOURCE_PAGE_URL_R6 = "https://www.soumu.go.jp/iken/zaisei/r06_todohuken.html"
SOURCE_PAGE_URL_R5 = "https://www.soumu.go.jp/iken/zaisei/r05_todohuken.html"

# ---------------------------------------------------------------------------
# ソースファイル（キャッシュ名, URL, 表の説明）
# 「同一ソースは再取得しない」原則により、既に data/cache に存在するファイルは
# ダウンロードせずハッシュ照合のみ行う（fetched_at は既存出力JSONから引き継ぐ）。
# ---------------------------------------------------------------------------
FILE_R6_1_1 = CACHE / "pref_kessan_1-1.xlsx"   # 第1表 1-1 決算状況（既取得・R6）
FILE_R6_3_2 = CACHE / "pref_r06_3-2.xlsx"      # 第3表 3-2 歳入内訳 都道府県別内訳（R6）
FILE_R6_5_2 = CACHE / "pref_kessan_5-2.xlsx"   # 第5表 5-2 目的別歳出内訳（既取得・R6／pref_assemblyと同一）
FILE_R6_6_2 = CACHE / "pref_kessan_6-2.xlsx"   # 第6表 6-2 性質別歳出内訳（既取得・R6）
FILE_R5_1_1 = CACHE / "pref_r05_1-1.xlsx"      # 第1表 1-1 決算状況（R5）
FILE_R5_3_2 = CACHE / "pref_r05_3-2.xlsx"      # 第3表 3-2 歳入内訳 都道府県別内訳（R5）
FILE_R5_5_2 = CACHE / "pref_r05_5-2.xlsx"      # 第5表 5-2 目的別歳出内訳 都道府県別内訳（R5）

URL_R6_1_1 = "https://www.soumu.go.jp/main_content/001056118.xlsx"
URL_R6_3_2 = "https://www.soumu.go.jp/main_content/001056125.xlsx"
URL_R6_5_2 = "https://www.soumu.go.jp/main_content/001056128.xlsx"
URL_R6_6_2 = "https://www.soumu.go.jp/main_content/001056130.xlsx"
URL_R5_1_1 = "https://www.soumu.go.jp/main_content/000994147.xlsx"
URL_R5_3_2 = "https://www.soumu.go.jp/main_content/000994258.xlsx"
URL_R5_5_2 = "https://www.soumu.go.jp/main_content/000994261.xlsx"

# ---------------------------------------------------------------------------
# 列マップ（全てヘッダ行を現物確認して確定。r3=区分「一」〜、r4=款名／目的名）
# ---------------------------------------------------------------------------

# 第3表 3-2 歳入内訳（R6）区分「一」〜「十七」。CT列以降は「参考」（不納欠損額等）で歳入款ではない。
REVENUE_COLS_R6 = {
    "地方税": "C",                                    # 一
    "地方譲与税": "D",                                # 二
    "市町村たばこ税都道府県交付金": "L",              # 三
    "地方特例交付金等": "M",                          # 四
    "地方交付税": "Q",                                # 五
    "交通安全対策特別交付金": "U",                    # 六
    "分担金及び負担金": "V",                          # 七
    "使用料": "Z",                                    # 八
    "手数料": "AH",                                   # 九
    "国庫支出金": "AK",                               # 十
    "国有提供施設等所在市町村助成交付金": "BN",       # 十一
    "財産収入": "BO",                                 # 十二
    "寄附金": "BU",                                   # 十三
    "繰入金": "BZ",                                   # 十四
    "繰越金": "CA",                                   # 十五
    "諸収入": "CD",                                   # 十六
    "地方債": "CS",                                   # 十七
}

# 第3表 3-2 歳入内訳（R5）。款名はR6と同一17款だが、内訳列数の差で列位置がずれる。
REVENUE_COLS_R5 = {
    "地方税": "C",                                    # 一
    "地方譲与税": "D",                                # 二
    "市町村たばこ税都道府県交付金": "L",              # 三
    "地方特例交付金等": "M",                          # 四
    "地方交付税": "P",                                # 五
    "交通安全対策特別交付金": "T",                    # 六
    "分担金及び負担金": "U",                          # 七
    "使用料": "Y",                                    # 八
    "手数料": "AG",                                   # 九
    "国庫支出金": "AJ",                               # 十
    "国有提供施設等所在市町村助成交付金": "BL",       # 十一
    "財産収入": "BM",                                 # 十二
    "寄附金": "BS",                                   # 十三
    "繰入金": "BX",                                   # 十四
    "繰越金": "BY",                                   # 十五
    "諸収入": "CB",                                   # 十六
    "地方債": "CQ",                                   # 十七
}

# 第5表 5-2 目的別歳出内訳（R6）区分「一」〜「二十六」。
# 2026-09-03再検証の経緯：初版は「一」〜「十四」14項目のみで47件全件が歳出総額と不一致だった。
# 「十五」〜「二十六」（前年度繰上充用金＋税交付金10種）を追加して全件一致。
EXPENDITURE_COLS_R6 = {
    "議会費": "C",                    # 一
    "総務費": "D",                    # 二
    "民生費": "N",                    # 三
    "衛生費": "T",                    # 四
    "労働費": "AB",                   # 五
    "農林水産業費": "AG",             # 六
    "商工費": "AM",                   # 七
    "土木費": "AQ",                   # 八
    "警察費": "BC",                   # 九
    "消防費": "BD",                   # 十
    "教育費": "BE",                   # 十一
    "災害復旧費": "BQ",               # 十二
    "公債費": "CM",                   # 十三
    "諸支出金": "CN",                 # 十四
    "前年度繰上充用金": "CQ",         # 十五
    "利子割交付金": "CR",             # 十六
    "配当割交付金": "CS",             # 十七
    "株式等譲渡所得割交付金": "CT",   # 十八
    "分離課税所得割交付金": "CU",     # 十九
    "地方消費税交付金": "CV",         # 二十
    "ゴルフ場利用税交付金": "CW",     # 二十一
    "自動車取得税交付金": "CX",       # 二十二
    "軽油引取税交付金": "CY",         # 二十三
    "自動車税環境性能割交付金": "CZ", # 二十四
    "法人事業税交付金": "DA",         # 二十五
    "特別区財政調整交付金": "DB",     # 二十六
}

# 第5表 5-2 目的別歳出内訳（R5）区分「一」〜「二十七」。
# R6との差分は「特別地方消費税交付金」（区分「二十二」・CX列）が1区分多いこと。
# これによりR6でCX〜DBに入る税交付金5種がR5ではCY〜DCへ1列ずれる。
EXPENDITURE_COLS_R5 = {
    "議会費": "C",                    # 一
    "総務費": "D",                    # 二
    "民生費": "N",                    # 三
    "衛生費": "T",                    # 四
    "労働費": "AB",                   # 五
    "農林水産業費": "AG",             # 六
    "商工費": "AM",                   # 七
    "土木費": "AQ",                   # 八
    "警察費": "BC",                   # 九
    "消防費": "BD",                   # 十
    "教育費": "BE",                   # 十一
    "災害復旧費": "BQ",               # 十二
    "公債費": "CM",                   # 十三
    "諸支出金": "CN",                 # 十四
    "前年度繰上充用金": "CQ",         # 十五
    "利子割交付金": "CR",             # 十六
    "配当割交付金": "CS",             # 十七
    "株式等譲渡所得割交付金": "CT",   # 十八
    "分離課税所得割交付金": "CU",     # 十九
    "地方消費税交付金": "CV",         # 二十
    "ゴルフ場利用税交付金": "CW",     # 二十一
    "特別地方消費税交付金": "CX",     # 二十二（R5のみ）
    "自動車取得税交付金": "CY",       # 二十三
    "軽油引取税交付金": "CZ",         # 二十四
    "自動車税環境性能割交付金": "DA", # 二十五
    "法人事業税交付金": "DB",         # 二十六
    "特別区財政調整交付金": "DC",     # 二十七
}

COL_TOTAL = "B"           # 3-2/5-2/6-2 いずれも B列が総額（歳入総額／歳出総額／歳出合計）
COL_FUTSUU_KENSETSU = "EF"  # 6-2 性質別歳出内訳の普通建設事業費

# データ範囲（現物確認）
ROWS_5_2 = (6, 52)        # 第5表 5-2 は row6〜52 が47都道府県、row53=合計
ROWS_1_1_3_2_6_2 = (7, 53)  # 第1表1-1・第3表3-2・第6表6-2 は row7〜53、row54=合計

DASH_TOKENS = ("-", "‐", "―", "－", "△")  # △は負値表記の接頭辞なので単独出現のみ対象


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_prev_sources() -> dict:
    """既存出力JSONのsourcesを source_url キーで引く（fetched_at引き継ぎ判定用）。"""
    if not OUT.exists():
        return {}
    try:
        prev = json.loads(OUT.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {s.get("source_url"): s for s in prev.get("sources", [])}


def resolve_fetched_at(source_url: str, current_hash: str, prev: dict, fallback: str) -> str:
    """ハッシュ一致なら既存 fetched_at（原初取得時刻）を引き継ぐ（docs/data-schema.md 5.3）。"""
    old = prev.get(source_url)
    if old and old.get("source_file_hash_sha256") == current_hash:
        return old["fetched_at"]
    return fallback


def get_pref_master() -> list[tuple[str, str]]:
    """data/pref_assembly.json から pref_code・pref_name の47件（JIS標準順01〜47）を借用。"""
    d = json.loads(EXISTING_PREF_ASSEMBLY.read_text(encoding="utf-8"))
    return [(x["pref_code"], x["pref_name"]) for x in d["data"]]


def classify(value):
    """セル値を (格納値, 種別) に分類する。

    数値            → (数値, "present")
    リテラル "-" 等 → ("-",  "zero_literal")   … 皆無・該当計上額なし（ゼロ）
    空欄・None      → (None, "unconfirmed")    … 未記載＝確認できず
    """
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value, "present"
    if value is None:
        return None, "unconfirmed"
    s = str(value).strip()
    if s == "":
        return None, "unconfirmed"
    if s in DASH_TOKENS:
        return "-", "zero_literal"
    return s, "unexpected"


def numeric(value) -> float:
    """合計検算用。"-" はゼロとして扱う。"""
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.0


def read_table(path: Path, rows: tuple[int, int], col_map: dict[str, str],
               total_key: str) -> tuple[list[str], list[dict], str]:
    """1シートから47行分を読む。戻り値: (行名リスト, レコード辞書リスト, 次行の列A値)。"""
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[wb.sheetnames[0]]
    idx = {k: column_index_from_string(v) for k, v in col_map.items()}
    idx_total = column_index_from_string(COL_TOTAL)

    names: list[str] = []
    recs: list[dict] = []
    lo, hi = rows
    for r in range(lo, hi + 1):
        name = ws.cell(r, 1).value
        names.append(str(name).strip() if name is not None else "")
        rec = {"__row": r, total_key: ws.cell(r, idx_total).value}
        for k, ci in idx.items():
            rec[k] = ws.cell(r, ci).value
        recs.append(rec)
    after = ws.cell(hi + 1, 1).value
    return names, recs, (str(after).strip() if after is not None else "")


def build_block(rec: dict, col_map: dict[str, str], issues: list, label: str,
                pref_name: str) -> dict:
    """1団体・1年度・1表の区分辞書を作る。分類できない値はissuesに記録する。"""
    out = {}
    for key in col_map:
        v, kind = classify(rec[key])
        out[key] = v
        if kind in ("unconfirmed", "unexpected"):
            issues.append({
                "pref_name": pref_name,
                "block": label,
                "item": key,
                "excel_row": rec["__row"],
                "raw": None if rec[key] is None else str(rec[key]),
                "kind": "確認できず（空欄）" if kind == "unconfirmed" else "想定外のリテラル",
            })
    return out


def main() -> None:
    prefs = get_pref_master()
    assert len(prefs) == 47, f"pref_assembly.json に47件ない: {len(prefs)}"
    master_names = [n for _, n in prefs]

    # ---- 読み込み ----
    names_r6_1_1, rows_r6_1_1, after_r6_1_1 = read_table(
        FILE_R6_1_1, ROWS_1_1_3_2_6_2, {"歳出総額": "C"}, "歳入総額")
    names_r6_3_2, rows_r6_3_2, after_r6_3_2 = read_table(
        FILE_R6_3_2, ROWS_1_1_3_2_6_2, REVENUE_COLS_R6, "歳入総額")
    names_r6_5_2, rows_r6_5_2, after_r6_5_2 = read_table(
        FILE_R6_5_2, ROWS_5_2, EXPENDITURE_COLS_R6, "歳出総額")
    names_r6_6_2, rows_r6_6_2, after_r6_6_2 = read_table(
        FILE_R6_6_2, ROWS_1_1_3_2_6_2, {"普通建設事業費": COL_FUTSUU_KENSETSU}, "歳出合計")
    names_r5_1_1, rows_r5_1_1, after_r5_1_1 = read_table(
        FILE_R5_1_1, ROWS_1_1_3_2_6_2, {"歳出総額": "C"}, "歳入総額")
    names_r5_3_2, rows_r5_3_2, after_r5_3_2 = read_table(
        FILE_R5_3_2, ROWS_1_1_3_2_6_2, REVENUE_COLS_R5, "歳入総額")
    names_r5_5_2, rows_r5_5_2, after_r5_5_2 = read_table(
        FILE_R5_5_2, ROWS_5_2, EXPENDITURE_COLS_R5, "歳出総額")

    # ---- 行の位置合わせ検証（位置一致ではなく都道府県名一致で確認する） ----
    name_alignment = {}
    for label, names, after in (
        ("R6 1-1", names_r6_1_1, after_r6_1_1),
        ("R6 3-2", names_r6_3_2, after_r6_3_2),
        ("R6 5-2", names_r6_5_2, after_r6_5_2),
        ("R6 6-2", names_r6_6_2, after_r6_6_2),
        ("R5 1-1", names_r5_1_1, after_r5_1_1),
        ("R5 3-2", names_r5_3_2, after_r5_3_2),
        ("R5 5-2", names_r5_5_2, after_r5_5_2),
    ):
        diff = [(i, a, b) for i, (a, b) in enumerate(zip(master_names, names)) if a != b]
        name_alignment[label] = {
            "rows_read": len(names),
            "name_mismatch_count": len(diff),
            "name_mismatch": [{"index": i, "master": a, "excel": b} for i, a, b in diff],
            "row_after_last": after,
        }

    # ---- レコード組み立て ----
    pref_assembly = json.loads(EXISTING_PREF_ASSEMBLY.read_text(encoding="utf-8"))
    gikaihi_r6_by_code = {x["pref_code"]: x["議会費_total_千円"] for x in pref_assembly["data"]}

    data: list[dict] = []
    issues: list[dict] = []
    total_mismatch_r6: list[dict] = []
    revenue_sum_mismatch: list[dict] = []
    expenditure_sum_mismatch: list[dict] = []
    gikaihi_mismatch: list[dict] = []

    for i, (pref_code, pref_name) in enumerate(prefs):
        r6_1_1, r6_3_2, r6_5_2, r6_6_2 = rows_r6_1_1[i], rows_r6_3_2[i], rows_r6_5_2[i], rows_r6_6_2[i]
        r5_1_1, r5_3_2, r5_5_2 = rows_r5_1_1[i], rows_r5_3_2[i], rows_r5_5_2[i]

        rev_r6 = build_block(r6_3_2, REVENUE_COLS_R6, issues, "revenue_r6", pref_name)
        exp_r6 = build_block(r6_5_2, EXPENDITURE_COLS_R6, issues, "expenditure_purpose_r6", pref_name)
        rev_r5 = build_block(r5_3_2, REVENUE_COLS_R5, issues, "revenue_r5", pref_name)
        exp_r5 = build_block(r5_5_2, EXPENDITURE_COLS_R5, issues, "expenditure_purpose_r5", pref_name)

        zeinyu_r6 = r6_1_1["歳入総額"]
        saishutsu_r6 = r6_1_1["歳出総額"]
        zeinyu_r5 = r5_1_1["歳入総額"]
        saishutsu_r5 = r5_1_1["歳出総額"]

        # 歳出総額の4表突合（R6: 1-1歳出 / 5-2 B / 6-2 B、R5: 1-1歳出 / 5-2 B）
        if not (saishutsu_r6 == r6_5_2["歳出総額"] == r6_6_2["歳出合計"]):
            total_mismatch_r6.append({
                "pref_code": pref_code, "pref_name": pref_name,
                "歳出総額_1-1": saishutsu_r6,
                "歳出総額_5-2": r6_5_2["歳出総額"],
                "歳出合計_6-2": r6_6_2["歳出合計"],
            })
        # 歳入総額の2表突合（1-1 vs 3-2）
        for year, a, b in (("R6", zeinyu_r6, r6_3_2["歳入総額"]), ("R5", zeinyu_r5, r5_3_2["歳入総額"])):
            if a != b:
                revenue_sum_mismatch.append({
                    "pref_code": pref_code, "pref_name": pref_name, "year": year,
                    "check": "歳入総額 1-1 vs 3-2", "歳入総額_1-1": a, "歳入総額_3-2": b,
                })
        if saishutsu_r5 != r5_5_2["歳出総額"]:
            total_mismatch_r6.append({
                "pref_code": pref_code, "pref_name": pref_name,
                "year": "R5", "歳出総額_1-1": saishutsu_r5, "歳出総額_5-2": r5_5_2["歳出総額"],
            })

        # 恒等式：Σ款 == 歳入総額／Σ目的 == 歳出総額
        for year, block, total in (("R6", rev_r6, r6_3_2["歳入総額"]), ("R5", rev_r5, r5_3_2["歳入総額"])):
            s = sum(numeric(v) for v in block.values())
            if s != numeric(total):
                revenue_sum_mismatch.append({
                    "pref_code": pref_code, "pref_name": pref_name, "year": year,
                    "check": "Σ歳入款 vs 歳入総額",
                    "Σ款_千円": s, "歳入総額_千円": total, "差額_千円": s - numeric(total),
                })
        for year, block, total in (("R6", exp_r6, r6_5_2["歳出総額"]), ("R5", exp_r5, r5_5_2["歳出総額"])):
            s = sum(numeric(v) for v in block.values())
            if s != numeric(total):
                expenditure_sum_mismatch.append({
                    "pref_code": pref_code, "pref_name": pref_name, "year": year,
                    "check": "Σ目的別歳出 vs 歳出総額",
                    "Σ目的_千円": s, "歳出総額_千円": total, "差額_千円": s - numeric(total),
                })

        # 議会費R6の正本照合（正本は pref_assembly.json 側）
        g_assembly = gikaihi_r6_by_code.get(pref_code)
        if g_assembly is not None and g_assembly != exp_r6["議会費"]:
            gikaihi_mismatch.append({
                "pref_code": pref_code, "pref_name": pref_name,
                "議会費_pref_assembly": g_assembly, "議会費_kessan_r6": exp_r6["議会費"],
            })

        fk, _ = classify(r6_6_2["普通建設事業費"])

        data.append({
            "pref_code": pref_code,
            "pref_name": pref_name,
            "歳入総額_千円": zeinyu_r6,
            "歳出総額_千円": saishutsu_r6,
            "歳入総額_r5_千円": zeinyu_r5,
            "歳出総額_r5_千円": saishutsu_r5,
            "revenue_r6": rev_r6,
            "expenditure_purpose_r6": exp_r6,
            "revenue_r5": rev_r5,
            "expenditure_purpose_r5": exp_r5,
            "普通建設事業費_千円": fk,
            "excel_rows": {
                "r6_1_1": r6_1_1["__row"], "r6_3_2": r6_3_2["__row"],
                "r6_5_2": r6_5_2["__row"], "r6_6_2": r6_6_2["__row"],
                "r5_1_1": r5_1_1["__row"], "r5_3_2": r5_3_2["__row"],
                "r5_5_2": r5_5_2["__row"],
            },
            "status": "確定",
        })

    # ---- sources（データ系譜・#8） ----
    prev = load_prev_sources()
    specs = [
        (URL_R6_1_1, FILE_R6_1_1, "R6 決算状況（歳入総額・歳出総額）",
         "総務省「地方財政状況調査関係資料｜令和6年度都道府県決算状況調」第1表 決算状況 1-1 決算状況（令和6年度＝2024年度決算）",
         SOURCE_PAGE_URL_R6, ["歳入総額_千円", "歳出総額_千円"],
         "歳出総額は5-2・6-2の歳出合計と一致することを機械照合済み（不一致は saishutsu_mismatch_log へ）。"),
        (URL_R6_3_2, FILE_R6_3_2, "R6 歳入内訳（都道府県固有の17款・区分「一」〜「十七」）",
         "総務省「地方財政状況関係資料｜令和6年度都道府県決算状況調」第3表 歳入内訳 3-2 都道府県別内訳（令和6年度＝2024年度決算）",
         SOURCE_PAGE_URL_R6, ["revenue_r6"],
         "歳入款は都道府県固有の17款。市区町村の28款（data/m2_2_finance.json revenue_kan_keys_r6）とは別セットであり丸めていない。"
         "都道府県では利子割交付金・地方消費税交付金等の税交付金は市町村への交付側＝歳出（expenditure_purpose_r6 の区分「十六」〜「二十六」）に立つため歳入款には現れず、"
         "逆に「市町村たばこ税都道府県交付金」（区分「三」）が歳入款として立つ。歳入款と歳出の交付金区分を取り違えていないことを、この非対称性で確認済み。"
         "CT列以降は表内の別枠「参考」（不納欠損額等）であり歳入款ではない（使用していない）。"
         "Σ17款＝歳入総額（B列）＝第1表1-1の歳入(Ａ)の一致を47件全件で機械照合済み。"),
        (URL_R6_5_2, FILE_R6_5_2, "R6 目的別歳出内訳（区分「一」〜「二十六」全26項目）",
         "総務省「地方財政状況調査関係資料｜令和6年度都道府県決算状況調」第5表 目的別歳出内訳 5-2 都道府県別内訳（令和6年度＝2024年度決算）",
         SOURCE_PAGE_URL_R6, ["expenditure_purpose_r6"],
         "data/pref_assembly.json と同一ファイル（hash一致確認済み・再ダウンロードせず流用）。"
         "議会費は pref_assembly.json の議会費_total_千円 と機械照合済み（正本はpref_assembly.json側）。"
         "2026-09-03再検証：初版は区分「一」〜「十四」14項目のみを取得し47件全件で歳出総額と不一致だった"
         "（例：北海道は差額173,604,430千円）。原因は区分「十五」〜「二十六」（前年度繰上充用金＋税交付金10種）の未捕捉。"
         "26項目合計が47件全件で歳出総額・1-1表の歳出(Ｂ)と一致することを機械照合済み。"
         "税交付金系（区分「十六」〜「二十六」）は歳出の独立区分として保持し除外しない（歳出総額＝Σ一〜二十六の恒等式が成立する）。"
         "DR列「合計」は表内の別枠（参考）一般行政経費内訳の小計であり歳出総額の検算列ではない（使用していない）。"),
        (URL_R6_6_2, FILE_R6_6_2, "R6 性質別歳出内訳（普通建設事業費）",
         "総務省「地方財政状況調査関係資料｜令和6年度都道府県決算状況調」第6表 性質別歳出内訳 6-2 都道府県別内訳（令和6年度＝2024年度決算）",
         SOURCE_PAGE_URL_R6, ["普通建設事業費_千円"],
         "普通建設事業費は目的別ではなく性質別の区分。歳出合計（B列）は1-1・5-2の歳出総額と一致することを機械照合済み。"),
        (URL_R5_1_1, FILE_R5_1_1, "R5 決算状況（歳入総額・歳出総額）",
         "総務省「地方財政状況調査関係資料｜令和5年度都道府県決算状況調」第1表 決算状況 1-1 決算状況（令和5年度＝2023年度決算）",
         SOURCE_PAGE_URL_R5, ["歳入総額_r5_千円", "歳出総額_r5_千円"],
         "前年度同項目（m2_2_finance.json の revenue_r5 / expenditure_purpose_r5 と同じ持ち方）用のR5総額。"),
        (URL_R5_3_2, FILE_R5_3_2, "R5 歳入内訳（都道府県固有の17款・区分「一」〜「十七」）",
         "総務省「地方財政状況調査関係資料｜令和5年度都道府県決算状況調」第3表 歳入内訳 3-2 都道府県別内訳（令和5年度＝2023年度決算）",
         SOURCE_PAGE_URL_R5, ["revenue_r5"],
         "款名はR6と同一の17款（市区町村側でR5にのみ現れる「特別地方消費税交付金」は都道府県の歳入款には無い）。"
         "ただし内訳列数の違い（地方特例交付金等内訳がR6=3列・R5=2列）により列位置がR6と1列ずれる。現物のヘッダ行で確認済み。"),
        (URL_R5_5_2, FILE_R5_5_2, "R5 目的別歳出内訳（区分「一」〜「二十七」全27項目）",
         "総務省「地方財政状況調査関係資料｜令和5年度都道府県決算状況調」第5表 目的別歳出内訳 5-2 都道府県別内訳（令和5年度＝2023年度決算）",
         SOURCE_PAGE_URL_R5, ["expenditure_purpose_r5"],
         "R5は26区分ではなく27区分。R6に無い「特別地方消費税交付金」（区分「二十二」・CX列）が1区分多く、"
         "これによりR6でCX〜DBに入る税交付金5種がR5ではCY〜DCへ1列ずれる。列位置は現物のヘッダ行（r3=区分・r4=目的名）で確認済み。"
         "27項目合計が47件全件で歳出総額・R5第1表1-1の歳出と一致することを機械照合済み。"),
    ]

    sources = []
    for url, path, role, source_page, page_url, provides, note in specs:
        h = sha256_of(path)
        sources.append({
            "role": role,
            "source_url": url,
            "source_page": source_page,
            "source_page_url": page_url,
            "fetched_at": resolve_fetched_at(url, h, prev, TODAY),
            "source_file_hash_sha256": h,
            "cache_file": path.name,
            "provides": provides,
            "note": note,
        })

    # 区分名の意味が構造的に妥当かの検査。
    # 特定の団体にしか立たないはずの区分（東京都固有の消防費・特別区財政調整交付金など）で、
    # 実際に値を持つ団体が想定と合うかを機械的に列挙する。名前と中身の取り違えはここに出る。
    structural = {}
    for block, cols in (
        ("revenue_r6", REVENUE_COLS_R6), ("revenue_r5", REVENUE_COLS_R5),
        ("expenditure_purpose_r6", EXPENDITURE_COLS_R6),
        ("expenditure_purpose_r5", EXPENDITURE_COLS_R5),
    ):
        for item in cols:
            holders = [r["pref_name"] for r in data if isinstance(r[block][item], (int, float))]
            dashes = [r["pref_name"] for r in data if r[block][item] == "-"]
            # 全団体に一律で立つ区分は検査対象にしない。少数側が3件以下の区分だけを載せる。
            if not (0 < len(holders) <= 3 or 0 < len(dashes) <= 3 or len(holders) == 0):
                continue
            structural[f"{block}.{item}"] = {
                "値を持つ団体数": len(holders),
                "値を持つ団体": holders if len(holders) <= 3 else "（4件以上・列挙省略）",
                "\"-\"の団体数": len(dashes),
                "\"-\"の団体": dashes if len(dashes) <= 3 else "（4件以上・列挙省略）",
            }

    out = {
        "schema_version": "1.0",
        "title": "都道府県決算状況調（歳入款別・目的別歳出・普通建設事業費）",
        "provider": "総務省",
        "year": "2024年度（令和6年度）",
        "prior_year": "2023年度（令和5年度）",
        "updated": TODAY,
        "unit_amount": "千円（各表ヘッダ「(単位 千円)」）",
        "layer": "都道府県（市区町村指標の集計ではなく都道府県自身の統治データ）",
        "revenue_kan_keys_r6": list(REVENUE_COLS_R6.keys()),
        "revenue_kan_keys_r5": list(REVENUE_COLS_R5.keys()),
        "expenditure_purpose_keys_r6": list(EXPENDITURE_COLS_R6.keys()),
        "expenditure_purpose_keys_r5": list(EXPENDITURE_COLS_R5.keys()),
        "record_keys": [
            "pref_code", "pref_name",
            "歳入総額_千円", "歳出総額_千円", "歳入総額_r5_千円", "歳出総額_r5_千円",
            "revenue_r6", "expenditure_purpose_r6", "revenue_r5", "expenditure_purpose_r5",
            "普通建設事業費_千円", "excel_rows", "status",
        ],
        "missing_model": {
            "present": "数値をそのまま格納",
            "該当なし（ゼロ）": "リテラル文字列 \"-\"。総務省統計表の表記慣行で「－」＝皆無・該当計上額なし。空欄（＝未記載＝確認できず）とは区別する",
            "確認できず": "null（空欄セル）。本ファイルでは0件（data_check_log.value_issues参照）",
        },
        "notes": [
            "保持構造は data/m2_2_finance.json（市区町村）に倣った入れ子（revenue_r6 / expenditure_purpose_r6 / revenue_r5 / expenditure_purpose_r5）。"
            "ただし区分セットは都道府県固有：歳入17款（市区町村は28款）、目的別歳出R6=26区分・R5=27区分（市区町村は14目的）。市区町村の区分に丸めていない。",
            "都道府県の目的別歳出には「警察費」があり（市区町村には無い）、逆に市区町村側の款であった税交付金各種は都道府県では歳出区分として立つ。"
            "この非対称は都道府県が市町村への交付主体であることの反映であり、歳入・歳出の取り違えではない。",
            "R5の目的別歳出は27区分。R6に無い「特別地方消費税交付金」（区分「二十二」）が存在する。"
            "市区町村側でもR5歳入款にのみ「特別地方消費税交付金」が残る現象（m2_2_finance.json notes）と同じ経過措置由来の差分。",
            "議会費の正本は data/pref_assembly.json（議会費_total_千円・R6）。本ファイルの expenditure_purpose_r6.議会費 は一致確認のみに用いる（照合結果は data_check_log.gikaihi_mismatch_log）。"
            "R5議会費は pref_assembly.json に対応値が無いため照合先なし（expenditure_purpose_r5.議会費 が唯一の格納先）。",
            "数値は事実の提示のみ。順位・複合スコア・評価語・強調色は本ファイルに持たせない。",
        ],
        "sources": sources,
        "data": data,
        "data_check_log": {
            "count": {"expected": 47, "actual": len(data)},
            "name_alignment": name_alignment,
            "saishutsu_mismatch_log": total_mismatch_r6,
            "revenue_sum_mismatch_log": revenue_sum_mismatch,
            "expenditure_sum_mismatch_log": expenditure_sum_mismatch,
            "gikaihi_mismatch_log": gikaihi_mismatch,
            "value_issues": issues,
            "structural_checks": structural,
            "zero_literal_counts": {
                block: {
                    item: sum(1 for rec in data if rec[block][item] == "-")
                    for item in cols
                    if any(rec[block][item] == "-" for rec in data)
                }
                for block, cols in (
                    ("revenue_r6", REVENUE_COLS_R6), ("revenue_r5", REVENUE_COLS_R5),
                    ("expenditure_purpose_r6", EXPENDITURE_COLS_R6),
                    ("expenditure_purpose_r5", EXPENDITURE_COLS_R5),
                )
            },
        },
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    # ---- 報告（コンソールのcp932依存を避けてUTF-8ファイルへ書く） ----
    lines = [f"[出力] {OUT.relative_to(ROOT)}", f"[件数] {len(data)}/47", "",
             "[行の名寄せ（都道府県名一致で確認）]"]
    for label, v in name_alignment.items():
        lines.append(f"  {label}: 読込{v['rows_read']}行 / 名称不一致 {v['name_mismatch_count']} 件 "
                     f"/ 47行目の次の列A='{v['row_after_last']}'")
        lines += [f"      {m}" for m in v["name_mismatch"]]
    lines += [
        "",
        f"[歳出総額 表間突合（1-1 vs 5-2 vs 6-2）] 不一致 {len(total_mismatch_r6)} 件",
        *[f"    {m}" for m in total_mismatch_r6],
        f"[歳入 恒等式（Σ17款＝歳入総額）＋表間突合（1-1 vs 3-2）] 不一致 {len(revenue_sum_mismatch)} 件",
        *[f"    {m}" for m in revenue_sum_mismatch],
        f"[歳出 恒等式（Σ目的別＝歳出総額）] 不一致 {len(expenditure_sum_mismatch)} 件",
        *[f"    {m}" for m in expenditure_sum_mismatch],
        f"[議会費R6 pref_assembly照合] 不一致 {len(gikaihi_mismatch)} 件",
        *[f"    {m}" for m in gikaihi_mismatch],
        f"[値の分類問題（空欄＝確認できず・想定外リテラル）] {len(issues)} 件",
        *[f"    {m}" for m in issues],
        "",
        '[リテラル"-"（該当なし＝ゼロ）の出現件数]',
    ]
    for block, items in out["data_check_log"]["zero_literal_counts"].items():
        if items:
            lines.append(f"  {block}: {json.dumps(items, ensure_ascii=False)}")
    lines += ["", "[区分の構造的妥当性検査（値を持つ団体・\"-\"の団体のどちらかが3件以下の区分）]"]
    for k, v in structural.items():
        lines.append(f"  {k}: 値を持つ {v['値を持つ団体数']} 件 {v['値を持つ団体']} "
                     f"/ \"-\" {v['\"-\"の団体数']} 件 {v['\"-\"の団体']}")
    lines += ["", "[岐阜県レコード]",
              json.dumps(next(x for x in data if x["pref_code"] == "21"), ensure_ascii=False, indent=2)]

    report = ROOT / "scripts" / "_tmp_report_build_kessan.txt"
    report.write_text("\n".join(lines), encoding="utf-8")
    print(f"[report] {report.name}")


if __name__ == "__main__":
    main()
