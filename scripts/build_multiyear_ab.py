# -*- coding: utf-8 -*-
"""FY2015-2024 多年度化 A(分野別支出M3)・B(財政規模決算)
出力: data/m3_expenditure_multiyear.json (A) / data/m2_3_finance_scale_multiyear.json (B)

列位置は年度により変わる(現物確認: 普通建設事業費はFY2015=73列/FY2024=151列で
30年で78列ずれていた)。固定インデックスは使わず、見出しテキストで毎年検出する。
"""
import hashlib
import json
import sys
from datetime import date
from pathlib import Path

import openpyxl
import xlrd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pref_args import load_master_cities, out_path, parse_pref  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache"
# --pref NN（既定 21＝岐阜＝従来どおり）。岐阜以外は試作で、出力は _NN 付き（publish/allowlist.txt で公開から除外）
PREF = parse_pref(sys.argv)
OUT_A = out_path("m3_expenditure_multiyear", PREF)
OUT_B = out_path("m2_3_finance_scale_multiyear", PREF)
GIFU_MASTER = ROOT / "data" / "m1_1a_population_timeseries.json"
TODAY = date.today().isoformat()

SOURCE_PAGE = "https://www.soumu.go.jp/iken/kessan_jokyo_1.html"
GIFU_PREFIX = "21"

YEARS = list(range(2015, 2025))
ROLES = ("shi_gaikyo", "shi_mokuteki", "shi_seishitsu", "machi_gaikyo", "machi_mokuteki", "machi_seishitsu")

AB_FILE_IDS = {
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


def normalize(s) -> str:
    if s is None:
        return ""
    return str(s).replace("\n", "").replace("　", "").replace(" ", "").strip()


class Sheet:
    """openpyxl(.xlsx/.xlsm) と xlrd(.xls) を同一インターフェースで扱う薄いラッパ。
    1-indexed の行・列でアクセスする。
    """

    def __init__(self, path: Path):
        self.path = path
        if path.suffix.lower() == ".xls":
            wb = xlrd.open_workbook(path)
            self._ws = wb.sheet_by_index(0)
            self._is_xlrd = True
            self.nrows = self._ws.nrows
            self.ncols = self._ws.ncols
        else:
            wb = openpyxl.load_workbook(path, data_only=True)
            self._ws = wb.worksheets[0]
            self._is_xlrd = False
            self.nrows = self._ws.max_row
            self.ncols = self._ws.max_column

    def cell(self, r1: int, c1: int):
        if self._is_xlrd:
            if r1 - 1 >= self.nrows or c1 - 1 >= self.ncols:
                return None
            v = self._ws.cell_value(r1 - 1, c1 - 1)
            return None if v == "" else v
        return self._ws.cell(r1, c1).value


def find_header_col(sheet: Sheet, label: str, header_rows: int = 15, exact: bool = True) -> int | None:
    """先頭header_rows行を走査し、正規化テキストが一致(exactならば完全一致、
    でなければ部分一致)する最初のセルの列番号(1-indexed)を返す。"""
    target = normalize(label)
    for r in range(1, header_rows + 1):
        for c in range(1, sheet.ncols + 1):
            v = normalize(sheet.cell(r, c))
            if not v:
                continue
            if (exact and v == target) or (not exact and target in v):
                return c
    return None


def extract_all_rows(sheet: Sheet, col_code: int, value_cols: dict[str, int]) -> dict[str, dict]:
    """団体コード(6桁数字)を持つ全行を抽出。戻り値: {code: {label: raw_value}}"""
    result = {}
    for r in range(1, sheet.nrows + 1):
        raw = sheet.cell(r, col_code)
        if raw is None:
            continue
        code6 = str(raw).strip()
        if not (code6.isdigit() and len(code6) == 6):
            continue
        result[code6] = {label: sheet.cell(r, c) for label, c in value_cols.items()}
    return result


def to_num(v):
    if v is None or v == "" or v == "-":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None


def load_year(fy: int, issues: list) -> dict:
    """1年度分を読み込み、{code6: {人口, 民生費_千円, 教育費_千円, 土木費_千円,
    普通建設事業費_千円, 歳入総額_千円, 歳出総額_千円, 団体名}} を返す(全国対象)。"""
    sheets = {}
    for role in ROLES:
        candidates = list(CACHE.glob(f"kessan_fy{fy}_{role}.*"))
        if not candidates:
            issues.append({"fy": fy, "role": role, "error": "ファイルが見つからない"})
            continue
        sheets[role] = Sheet(candidates[0])

    merged: dict[str, dict] = {}

    for prefix in ("shi", "machi"):
        gaikyo = sheets.get(f"{prefix}_gaikyo")
        mokuteki = sheets.get(f"{prefix}_mokuteki")
        seishitsu = sheets.get(f"{prefix}_seishitsu")
        if gaikyo is None or mokuteki is None or seishitsu is None:
            continue

        col_code_g = find_header_col(gaikyo, "団体コード")
        col_name_g = find_header_col(gaikyo, "団体名")
        col_pop = find_header_col(gaikyo, "住民基本台帳登載人口", exact=False)
        col_rev = find_header_col(gaikyo, "歳入総額")
        col_exp = find_header_col(gaikyo, "歳出総額")
        missing = [n for n, v in (("団体コード", col_code_g), ("団体名", col_name_g), ("人口", col_pop),
                                   ("歳入総額", col_rev), ("歳出総額", col_exp)) if v is None]
        if missing:
            issues.append({"fy": fy, "role": f"{prefix}_gaikyo", "missing_headers": missing})
            continue
        g_rows = extract_all_rows(gaikyo, col_code_g, {
            "団体名": col_name_g, "人口_人": col_pop, "歳入総額_千円": col_rev, "歳出総額_千円": col_exp,
        })

        col_code_m = find_header_col(mokuteki, "団体コード")
        col_min = find_header_col(mokuteki, "民生費")
        col_dob = find_header_col(mokuteki, "土木費")
        col_kyo = find_header_col(mokuteki, "教育費")
        missing = [n for n, v in (("団体コード", col_code_m), ("民生費", col_min),
                                   ("土木費", col_dob), ("教育費", col_kyo)) if v is None]
        if missing:
            issues.append({"fy": fy, "role": f"{prefix}_mokuteki", "missing_headers": missing})
            continue
        m_rows = extract_all_rows(mokuteki, col_code_m, {
            "民生費_千円": col_min, "土木費_千円": col_dob, "教育費_千円": col_kyo,
        })

        col_code_s = find_header_col(seishitsu, "団体コード")
        col_fken = find_header_col(seishitsu, "普通建設事業費")
        missing = [n for n, v in (("団体コード", col_code_s), ("普通建設事業費", col_fken)) if v is None]
        if missing:
            issues.append({"fy": fy, "role": f"{prefix}_seishitsu", "missing_headers": missing})
            continue
        s_rows = extract_all_rows(seishitsu, col_code_s, {"普通建設事業費_千円": col_fken})

        for code in set(g_rows) | set(m_rows) | set(s_rows):
            rec = merged.setdefault(code, {})
            rec.update(g_rows.get(code, {}))
            rec.update(m_rows.get(code, {}))
            rec.update(s_rows.get(code, {}))

    return merged


def weighted_average(codes: set[str], data: dict[str, dict], key_value: str, key_pop: str = "人口_人"):
    total_v, total_p, n = 0.0, 0, 0
    for code in codes:
        rec = data.get(code)
        if not rec:
            continue
        pop = to_num(rec.get(key_pop))
        val = to_num(rec.get(key_value))
        if pop is None or pop <= 0 or val is None:
            continue
        total_v += val
        total_p += pop
        n += 1
    if total_p == 0:
        return None, n, total_p
    return total_v * 1000 / total_p, n, total_p


def main():
    if PREF == "21":
        gifu_master = json.loads(GIFU_MASTER.read_text(encoding="utf-8"))
        gifu_codes = sorted({r["市区町村コード"] for r in gifu_master["data"]})
        assert len(gifu_codes) == 42, f"岐阜42市町村マスタが42件でない: {len(gifu_codes)}"
        names = {r["市区町村コード"]: r["市区町村名"] for r in gifu_master["data"]}
    else:
        # 試作：自治体マスタの市区町村（政令市の区は決算状況調に無いので含まない）
        names = load_master_cities(PREF)
        gifu_codes = sorted(names)
    n_pref = len(gifu_codes)

    issues: list = []
    per_year_raw: dict[int, dict] = {}
    for fy in YEARS:
        per_year_raw[fy] = load_year(fy, issues)
        n_gifu = len([c for c in gifu_codes if c in per_year_raw[fy]])
        print(f"FY{fy}: 全国{len(per_year_raw[fy])}件中 県内{n_gifu}/{n_pref}件")

    # ---- A: m3_expenditure_multiyear.json ----
    a_data = []
    a_missing_log: dict[str, list] = {}
    for code in gifu_codes:
        name0 = names[code]
        rec = {"area_code": code, "市区町村名": name0}
        for fy in YEARS:
            raw = per_year_raw[fy].get(code)
            year_key = f"fy{fy}"
            if raw is None:
                rec[year_key] = None
                a_missing_log.setdefault(year_key, []).append(code)
                continue
            pop = to_num(raw.get("人口_人"))
            row = {"人口_人": pop}
            for label_sen, label_percapita in (
                ("民生費_千円", "民生費_円/人"), ("教育費_千円", "教育費_円/人"),
                ("土木費_千円", "土木費_円/人"), ("普通建設事業費_千円", "普通建設事業費_円/人"),
            ):
                v = to_num(raw.get(label_sen))
                row[label_sen] = v
                row[label_percapita] = round(v * 1000 / pop) if (v is not None and pop and pop > 0) else None
            rec[year_key] = row
        a_data.append(rec)

    a_averages = {}
    for fy in YEARS:
        year_key = f"fy{fy}"
        all_codes = set(per_year_raw[fy])
        gifu_codes_present = all_codes & set(gifu_codes)
        entry = {"national": {"municipality_count": len(all_codes)},
                 "prefecture": {"municipality_count": len(gifu_codes_present)}}
        for item in ("民生費_千円", "教育費_千円", "土木費_千円", "普通建設事業費_千円"):
            out_key = item.replace("_千円", "_円/人")
            nat_avg, nat_n, nat_pop = weighted_average(all_codes, per_year_raw[fy], item)
            pref_avg, pref_n, pref_pop = weighted_average(gifu_codes_present, per_year_raw[fy], item)
            entry["national"][out_key] = round(nat_avg) if nat_avg is not None else None
            entry["prefecture"][out_key] = round(pref_avg) if pref_avg is not None else None
        a_averages[year_key] = entry

    a_sources = build_sources_ab(issues)
    a_out = {
        "schema_version": "1.0",
        "title": "住民一人あたり分野別支出（多年度）",
        "provider": "総務省 市区町村別決算状況調",
        "period": "FY2015〜FY2024（各年度10月頃公表の決算統計）",
        "updated": TODAY,
        "unit_amount": "千円",
        "unit_percapita": "円/人",
        "population_source": "住民基本台帳登載人口（各年度概況表・年度により基準日表記が異なる。詳細はsources参照）",
        "fields": ["民生費", "教育費", "土木費", "普通建設事業費"],
        "notes": [
            "列位置は年度により変わる（現物確認：普通建設事業費の列位置はFY2015=73列目・FY2024=151列目）。"
            "固定列インデックスではなく、各年度の見出しテキスト（団体コード/団体名/民生費/教育費/土木費/"
            "普通建設事業費/歳入総額/歳出総額/住民基本台帳登載人口）を毎年検出して抽出している。",
            "national/prefectureは人口加重平均（合計千円÷合計人口×1000）。単純算術平均ではない"
            "（m3_expenditure.pyと同じ方式・理由）。",
            "欠損（ファイルに団体コード自体が見つからない、または見出し検出に失敗した年度）はnullで保持し"
            "missing_codes_by_yearに一覧する。0や前年値で埋めていない。",
        ],
        "sources": a_sources,
        "data": a_data,
        "averages_by_year": a_averages,
        "data_check_log": {
            "extraction_issues": issues,
            "missing_codes_by_year": a_missing_log,
        },
    }
    OUT_A.parent.mkdir(parents=True, exist_ok=True)
    OUT_A.write_text(json.dumps(a_out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[output] {OUT_A}")

    # ---- B: m2_3_finance_scale_multiyear.json ----
    b_data = []
    b_missing_log: dict[str, list] = {}
    for code in gifu_codes:
        name0 = names[code]
        rec = {"area_code": code, "市区町村名": name0}
        for fy in YEARS:
            raw = per_year_raw[fy].get(code)
            year_key = f"fy{fy}"
            if raw is None:
                rec[year_key] = None
                b_missing_log.setdefault(year_key, []).append(code)
                continue
            rec[year_key] = {
                "人口_人": to_num(raw.get("人口_人")),
                "歳入総額_千円": to_num(raw.get("歳入総額_千円")),
                "歳出総額_千円": to_num(raw.get("歳出総額_千円")),
            }
        b_data.append(rec)

    b_totals = {}
    for fy in YEARS:
        year_key = f"fy{fy}"
        all_codes = set(per_year_raw[fy])
        gifu_codes_present = all_codes & set(gifu_codes)

        def sum_of(codes, key):
            vals = [to_num(per_year_raw[fy][c].get(key)) for c in codes if to_num(per_year_raw[fy][c].get(key)) is not None]
            return sum(vals) if vals else None

        b_totals[year_key] = {
            "national": {
                "municipality_count": len(all_codes),
                "歳入総額_合計_千円": sum_of(all_codes, "歳入総額_千円"),
                "歳出総額_合計_千円": sum_of(all_codes, "歳出総額_千円"),
            },
            "prefecture": {
                "municipality_count": len(gifu_codes_present),
                "歳入総額_合計_千円": sum_of(gifu_codes_present, "歳入総額_千円"),
                "歳出総額_合計_千円": sum_of(gifu_codes_present, "歳出総額_千円"),
            },
        }

    b_out = {
        "schema_version": "1.0",
        "title": "財政規模（決算）— 歳入決算額・歳出決算額（多年度）",
        "provider": "総務省 市区町村別決算状況調",
        "period": "FY2015〜FY2024",
        "updated": TODAY,
        "unit_amount": "千円",
        "notes": [
            "歳入総額・歳出総額は総額（実数）であり一人あたり額ではない。市町村規模がまちまちのため、"
            "totals_by_year配下は「平均」ではなく単純合計（歳入総額_合計_千円/歳出総額_合計_千円）として持たせている"
            "（このJSONを使う側で平均・一人あたり換算をする場合は人口_人と組み合わせて算出すること）。",
            "列位置は年度により変わるため、m3_expenditure_multiyear.jsonと同じ見出しテキスト検出方式で抽出している。",
            "欠損はnullで保持し missing_codes_by_year に一覧する。",
        ],
        "sources": a_sources,
        "data": b_data,
        "totals_by_year": b_totals,
        "data_check_log": {
            "extraction_issues": issues,
            "missing_codes_by_year": b_missing_log,
        },
    }
    OUT_B.write_text(json.dumps(b_out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[output] {OUT_B}")


def build_sources_ab(issues: list) -> list:
    sources = []
    for fy in YEARS:
        for role, fid in zip(ROLES, AB_FILE_IDS[fy]):
            candidates = list(CACHE.glob(f"kessan_fy{fy}_{role}.*"))
            if not candidates:
                continue
            p = candidates[0]
            h = hashlib.sha256(p.read_bytes()).hexdigest()
            sources.append({
                "fy": fy, "role": role,
                "source_url": f"https://www.soumu.go.jp/main_content/{fid}",
                "source_page": SOURCE_PAGE,
                "fetched_at": TODAY,
                "source_file_hash_sha256": h,
                "cache_file": p.name,
            })
    return sources


if __name__ == "__main__":
    main()
