# -*- coding: utf-8 -*-
"""FY2015-2024 多年度化 C(財政健全化指標・市区町村版)
出力: data/m2_4_kenzenka_shichoson_multiyear.json

概要(gaiyou)ファイルを主とする。同一workbook内に複数シートがあり、
市区町村版の健全化判断比率シートは年度によりシート名が変わるため、
「行数が最も多いシート」（市区町村は約1700件超、他の表は数十〜百件程度）
で機械的に識別する。見出しテキストで列を検出する点はA/Bと同じ方式。
"-" は該当なし(構造的ゼロ)としてリテラル保持し、null(確認できず)とは区別する。
"""
import hashlib
import json
import re
from datetime import date
from pathlib import Path

import openpyxl
import xlrd

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache"
OUT = ROOT / "data" / "m2_4_kenzenka_shichoson_multiyear.json"
GIFU_MASTER = ROOT / "data" / "m1_1a_population_timeseries.json"
TODAY = date.today().isoformat()

SOURCE_PAGE = "https://www.soumu.go.jp/iken/zaisei/kenzenka/kenzen_shikin.html"
YEARS = list(range(2015, 2025))

C_GAIYOU_FILE_IDS = {
    2024: "001060123.xlsx", 2023: "001001455.xlsx", 2022: "000941189.xls",
    2021: "000885693.xls", 2020: "000802550.xls", 2019: "000802553.xls",
    2018: "000802556.xls", 2017: "000802559.xls", 2016: "000802562.xls",
    2015: "000450176.xls",
}

ITEMS = ["実質赤字比率", "連結実質赤字比率", "実質公債費比率", "将来負担比率"]

# 表記ゆれ（旧字体）。FY2015〜2017の概要表は「飛驒市」（驒）、
# 現行マスタ・FY2018以降は「飛騨市」（騨）で揺れることを現物確認済み。
NAME_ALIASES = {"飛騨市": "飛驒市"}


def normalize(s) -> str:
    if s is None:
        return ""
    return str(s).replace("\n", "").replace("　", "").replace(" ", "").strip()


class Workbook:
    def __init__(self, path: Path):
        self.path = path
        self.is_xlrd = path.suffix.lower() == ".xls"
        if self.is_xlrd:
            self._wb = xlrd.open_workbook(path)
            self.sheet_names = self._wb.sheet_names()
        else:
            self._wb = openpyxl.load_workbook(path, data_only=True)
            self.sheet_names = self._wb.sheetnames

    def sheet_dims(self, name):
        if self.is_xlrd:
            ws = self._wb.sheet_by_name(name)
            return ws.nrows, ws.ncols
        ws = self._wb[name]
        return ws.max_row, ws.max_column

    def cell(self, name, r1, c1):
        if self.is_xlrd:
            ws = self._wb.sheet_by_name(name)
            if r1 - 1 >= ws.nrows or c1 - 1 >= ws.ncols:
                return None
            v = ws.cell_value(r1 - 1, c1 - 1)
            return None if v == "" else v
        ws = self._wb[name]
        return ws.cell(r1, c1).value


def find_municipal_sheet(wb: Workbook) -> tuple[str, int, int]:
    """'都道府県名'+'市区町村名'+'実質赤字比率'の見出しが揃うシートのうち、
    行数が最大のもの(=市区町村版。他候補はSheet1等の重複集計シート)を選ぶ。
    戻り値: (シート名, nrows, ncols)。見つからない場合は (None, 0, 0)。
    """
    candidates = []
    for n in wb.sheet_names:
        nrows, ncols = wb.sheet_dims(n)
        header_row, cols = find_header_row_cols(wb, n, nrows, ncols)
        if header_row is not None and all(v is not None for v in cols.values()):
            candidates.append((n, nrows, ncols))
    if not candidates:
        return None, 0, 0
    return max(candidates, key=lambda t: t[1])


def find_header_row_cols(wb: Workbook, sheet: str, nrows: int, ncols: int) -> tuple[int, dict]:
    """先頭20行を走査し、'実質赤字比率'等のラベル列を検出。戻り値: (header_row, {label: col})"""
    targets = {"都道府県名": None, "市区町村名": None,
               "実質赤字比率": None, "連結実質赤字比率": None,
               "実質公債費比率": None, "将来負担比率": None}
    header_row = None
    for r in range(1, min(20, nrows) + 1):
        found_this_row = {}
        for c in range(1, ncols + 1):
            v = normalize(wb.cell(sheet, r, c))
            if v in targets and targets[v] is None:
                found_this_row[v] = c
        if "実質赤字比率" in found_this_row and "市区町村名" in found_this_row:
            header_row = r
            targets.update(found_this_row)
            break
    return header_row, targets


def bare_muni_name(name: str) -> str:
    """マスタの市区町村名から先頭の郡名を除いた表記を返す（例:'羽島郡岐南町'→'岐南町'）。
    健全化判断比率の概要表は町村名に郡名を冠していないため、この表記でも突合を試みる。"""
    return re.sub(r"^[^郡]*郡", "", name)


def classify(v):
    if isinstance(v, (int, float)):
        return v
    if v is None:
        return None
    s = str(v).strip()
    if s in ("-", "‐", "―", "－"):
        return "-"
    return None


def load_year(fy: int, issues: list) -> dict:
    """{市区町村名: {item: value}} を返す(岐阜県のみ)。"""
    cands = list(CACHE.glob(f"kenzenka_fy{fy}_gaiyou.*"))
    if not cands:
        issues.append({"fy": fy, "error": "gaiyouファイルが見つからない"})
        return {}
    wb = Workbook(cands[0])
    sheet, nrows, ncols = find_municipal_sheet(wb)
    if sheet is None:
        issues.append({"fy": fy, "error": "市区町村版シートが見つからない", "sheet_names": wb.sheet_names})
        return {}
    header_row, cols = find_header_row_cols(wb, sheet, nrows, ncols)
    if header_row is None or any(v is None for v in cols.values()):
        issues.append({"fy": fy, "sheet": sheet, "error": "見出し検出失敗", "found": cols})
        return {}

    result = {}
    for r in range(header_row + 1, nrows + 1):
        pref = normalize(wb.cell(sheet, r, cols["都道府県名"]))
        if pref != "岐阜県":
            continue
        muni = str(wb.cell(sheet, r, cols["市区町村名"]) or "").strip()
        if not muni:
            continue
        result[muni] = {item: classify(wb.cell(sheet, r, cols[item])) for item in ITEMS}
    return result


def main():
    gifu_master = json.loads(GIFU_MASTER.read_text(encoding="utf-8"))
    gifu_names = {r["市区町村コード"]: r["市区町村名"] for r in gifu_master["data"]}
    assert len(gifu_names) == 42

    issues: list = []
    per_year: dict[int, dict] = {}
    for fy in YEARS:
        per_year[fy] = load_year(fy, issues)
        print(f"FY{fy}: 岐阜{len(per_year[fy])}件抽出")

    data = []
    missing_log: dict[str, list] = {}
    for code, name in sorted(gifu_names.items()):
        rec = {"area_code": code, "市区町村名": name}
        for fy in YEARS:
            year_key = f"fy{fy}"
            row = per_year[fy].get(name)
            if row is None:
                row = per_year[fy].get(bare_muni_name(name))
            if row is None and name in NAME_ALIASES:
                row = per_year[fy].get(NAME_ALIASES[name])
            if row is None:
                rec[year_key] = None
                missing_log.setdefault(year_key, []).append({"area_code": code, "市区町村名": name})
            else:
                rec[year_key] = row
        data.append(rec)

    sources = []
    for fy in YEARS:
        cands = list(CACHE.glob(f"kenzenka_fy{fy}_gaiyou.*"))
        if not cands:
            continue
        p = cands[0]
        h = hashlib.sha256(p.read_bytes()).hexdigest()
        sources.append({
            "fy": fy, "role": "gaiyou",
            "source_url": f"https://www.soumu.go.jp/main_content/{C_GAIYOU_FILE_IDS[fy]}",
            "source_page": SOURCE_PAGE,
            "fetched_at": TODAY,
            "source_file_hash_sha256": h,
            "cache_file": p.name,
        })

    out = {
        "schema_version": "1.0",
        "title": "財政健全化判断比率（市区町村版・多年度）",
        "provider": "総務省 健全化判断比率及び資金不足比率の概要",
        "period": "FY2015〜FY2024",
        "updated": TODAY,
        "unit": "％",
        "fields": ITEMS,
        "missing_model": {
            "present": "数値をそのまま格納",
            "該当なし（ゼロ）": "リテラル文字列 \"-\"。皆無・該当額なし（早期健全化基準に対し実質的に黒字等）",
            "確認できず": "null。概要ファイルに岐阜県の当該市区町村行が見つからない、または見出し検出に失敗した場合",
        },
        "notes": [
            "「基礎数値」ファイル(kiso)は未使用。概要(gaiyou)ファイルのみを一次資料として使用している。"
            "概要ファイル内で岐阜県42市町村が全件揃うかはdata_check_log.missing_codes_by_yearで確認可能。"
            "欠損が生じた年度のみ、追加で基礎数値ファイルを取得して補うことを想定（本バージョンでは未実施）。",
            "市区町村版の健全化判断比率シートは年度によりシート名が変わる"
            "（例: FY2015='1(2)', FY2024='健全化（市区町村）'）ため、"
            "1ファイル内で最も行数が多いシート（市区町村は約1700件超、他の表は数百件以下）を"
            "機械的に選び、見出しテキストで列を検出している（固定シート名・固定列を使っていない）。",
            "都道府県名+市区町村名の文字列一致で岐阜県42市町村を抽出している（団体コード列がこの表に無いため）。"
            "町村はマスタの市区町村名が郡名を冠する表記（例:'羽島郡岐南町'）だが概要表は郡名なし表記（'岐南町'）"
            "のため、郡名を除いた表記でも突合している。飛騨市はFY2015〜2017の概要表で旧字体『飛驒市』"
            "（驒）表記のため別名マッピングで突合している（現行マスタは『飛騨市』＝騨）。",
            "実質赤字比率・連結実質赤字比率の早期健全化基準・財政再生基準等の制度値（統計的定数）はこのファイルに"
            "混在させていない（データと制度値を混ぜない）。制度値の正本はdata/m2_2_finance.json "
            "statutory_criteria_common。",
        ],
        "sources": sources,
        "data": data,
        "data_check_log": {
            "extraction_issues": issues,
            "missing_codes_by_year": missing_log,
        },
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[output] {OUT}")


if __name__ == "__main__":
    main()
