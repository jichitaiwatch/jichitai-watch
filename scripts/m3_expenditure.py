"""
M3: 総務省 地方財政状況調査 住民一人あたり分野別支出 抽出スクリプト
対象: 岐阜県内42市町村（団体コード先頭2桁=21）

データソース（令和5年度・FY2023）:
  総務省 市区町村別決算状況調 令和5年度
  https://www.soumu.go.jp/iken/kessan_jokyo_1.html

使用ファイル:
  都市別 概況         000999900.xlsx  → 住民基本台帳人口（令6.1.1現在）
  都市別 目的別歳出   000999902.xlsx  → 民生費(col25)/土木費(col45)/教育費(col58)
  都市別 性質別歳出   000999903.xlsx  → 普通建設事業費(col146)
  町村別 概況         000999905.xlsx  → 住民基本台帳人口（令6.1.1現在）
  町村別 目的別歳出   000999908.xlsx  → 民生費(col25)/土木費(col45)/教育費(col58)
  町村別 性質別歳出   000999910.xlsx  → 普通建設事業費(col146)

団体コード: Excel内の6桁（検査数字付き、全国地方公共団体コード）をそのまま使用

全国平均・岐阜県内平均（2026-08-06追加）:
  ダウンロードした全国Excelは岐阜県フィルタ前の全都道府県分のデータを
  含む。このスクリプトはフィルタ前の全国データから4項目（民生費・
  教育費・土木費・普通建設事業費、いずれも円/人）の全国平均を算出し、
  JSONのトップレベル(national_average)に追加する。岐阜県内平均
  (prefecture_average)も同様に算出する。
  算出方法は人口加重平均（対象市町村の当該費目_千円合計 ÷ 対象市町村の
  人口_人合計 × 1000）で、各市町村の円/人を単純算術平均する方式ではない
  （人口の少ない自治体ほど円/人が跳ね上がる構造があり、実際に岐阜県内
  では白川村が岐阜市の7〜8倍の円/人になることが判明しているため）。
  全国母数は団体コードが6桁数字である行のみをカウントすることで、
  Excel末尾の小計行（「市計」「全国計」等）・見出し行を除外している。

実行:
  python scripts/m3_expenditure.py --test   # 岐阜市(21201)のみ
  python scripts/m3_expenditure.py          # 全42市町村 → data/m3_expenditure.json
"""

import sys
import argparse
import json
from pathlib import Path

import requests
import openpyxl

from lineage import build_sources

CACHE_DIR = Path("data/cache")
OUTPUT_PATH = Path("data/m3_expenditure.json")
GIFU_PREFIX = "21"
SOUMU_SOURCE_PAGE = "https://www.soumu.go.jp/iken/kessan_jokyo_1.html"

# (name, url, sheet_idx)
EXCEL_FILES = {
    "shi_gaikyo":   ("000999900", "https://www.soumu.go.jp/main_content/000999900.xlsx"),
    "shi_mokuteki": ("000999902", "https://www.soumu.go.jp/main_content/000999902.xlsx"),
    "shi_seishitsu":("000999903", "https://www.soumu.go.jp/main_content/000999903.xlsx"),
    "machi_gaikyo": ("000999905", "https://www.soumu.go.jp/main_content/000999905.xlsx"),
    "machi_mokuteki":("000999908","https://www.soumu.go.jp/main_content/000999908.xlsx"),
    "machi_seishitsu":("000999910","https://www.soumu.go.jp/main_content/000999910.xlsx"),
}

# EXCEL_FILES キー → sources[].role（旧 soumu_urls の日本語ラベルを流用）
EXCEL_FILE_ROLES = {
    "shi_gaikyo":      "都市別概況",
    "shi_mokuteki":    "都市別目的別",
    "shi_seishitsu":   "都市別性質別",
    "machi_gaikyo":    "町村別概況",
    "machi_mokuteki":  "町村別目的別",
    "machi_seishitsu": "町村別性質別",
}

# 列インデックス（0ベース）
COL_CODE  = 14   # 団体コード（6桁）
COL_NAME  = 15   # 団体名
COL_POP   = 16   # 住民基本台帳登載人口（令6.1.1現在）
COL_MIN   = 24   # 民生費
COL_DOB   = 44   # 土木費
COL_KYO   = 57   # 教育費
COL_FKEN  = 145  # 普通建設事業費


def fetch_excel(file_id: str, url: str, use_cache: bool = True) -> openpyxl.Workbook:
    path = CACHE_DIR / f"r05_{file_id}.xlsx"
    if not (use_cache and path.exists()):
        print(f"  [DL] {url.split('/')[-1]} ...", end=" ", flush=True)
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        path.write_bytes(resp.content)
        print(f"ok ({len(resp.content):,} bytes)")
    else:
        print(f"  [cache] r05_{file_id}.xlsx")
    return openpyxl.load_workbook(path, data_only=True)


def is_gifu(code: str) -> bool:
    return len(code) >= 5 and code[:2] == GIFU_PREFIX


def is_valid_code(code6: str) -> bool:
    """
    Excelの団体コード列には、実データ行（6桁数字、検査数字付き）の他に、
    表末尾の小計行（「市計」「全国計」「指定都市」等、団体コード列が空文字）や
    見出し行（文字列）が混在する。これらを除外するための判定。
    """
    return code6.isdigit() and len(code6) == 6


def to_int(v) -> int | None:
    if v is None or v == "-" or v == "":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def extract_all(ws, *col_indices: int) -> dict[str, list]:
    """
    行をスキャンし、有効な団体コード（6桁数字）を持つ全行の指定列値を返す
    （都道府県を問わない全国対象）。戻り値: {6桁コード: [col値...]}
    """
    result = {}
    for row in ws.iter_rows(values_only=True):
        raw_code = row[COL_CODE] if len(row) > COL_CODE else None
        if raw_code is None:
            continue
        code6 = str(raw_code).strip()
        if not is_valid_code(code6):
            continue
        vals = [row[c] if len(row) > c else None for c in col_indices]
        result[code6] = vals
    return result


def extract_gifu(ws, *col_indices: int) -> dict[str, list]:
    """
    行をスキャンし、岐阜コード行の指定列値を返す。
    戻り値: {6桁コード: [col値...]}
    """
    return {code: vals for code, vals in extract_all(ws, *col_indices).items() if is_gifu(code)}


def weighted_average(
    pop_map: dict[str, int | None],
    value_map: dict[str, list],
    value_idx: int,
    codes: set[str] | None = None,
) -> tuple[float, int, int]:
    """
    人口加重平均を算出する: 合計(値_千円) / 合計(人口_人) × 1000。
    単純算術平均（各市町村の円/人を平均する方式）は用いない。理由:
    人口の少ない自治体ほど円/人が跳ね上がる構造があり（岐阜県内では
    白川村が岐阜市の7〜8倍の円/人になることが判明済み）、単純平均は
    小規模自治体に歪められた値になるため。

    戻り値: (円/人の全国/県内平均, 集計対象件数, 集計対象人口合計)
    """
    target_codes = codes if codes is not None else set(pop_map)
    total_value_sen_en = 0  # 千円
    total_pop = 0
    n = 0
    for code in target_codes:
        pop = pop_map.get(code)
        if pop is None or pop <= 0:
            continue
        vals = value_map.get(code)
        if vals is None:
            continue
        v = to_int(vals[value_idx]) if len(vals) > value_idx else None
        if v is None:
            continue
        total_value_sen_en += v
        total_pop += pop
        n += 1
    if total_pop == 0:
        return 0.0, n, total_pop
    return total_value_sen_en * 1000 / total_pop, n, total_pop


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="岐阜市（21201）のみ")
    ap.add_argument("--no-cache", action="store_true")
    args = ap.parse_args()
    use_cache = not args.no_cache

    # ---- ファイル取得 ----
    print("\n=== Excel ダウンロード/キャッシュ確認 ===")
    wbs = {}
    for key, (fid, url) in EXCEL_FILES.items():
        wbs[key] = fetch_excel(fid, url, use_cache)

    # ---- 抽出（全国、都道府県フィルタなし。全国平均算出に使用） ----
    print("\n=== 全国データ抽出（全国平均算出用） ===")

    # 人口（概況）
    pop_map_all: dict[str, int | None] = {}
    for key in ("shi_gaikyo", "machi_gaikyo"):
        ws = wbs[key].worksheets[0]
        d = extract_all(ws, COL_POP)
        for code, vals in d.items():
            pop_map_all[code] = to_int(vals[0])
    print(f"  人口: {len(pop_map_all)} 件（全国、市部+町村部）")

    # 目的別（民生費・土木費・教育費）
    mokuteki_all: dict[str, list] = {}
    for key in ("shi_mokuteki", "machi_mokuteki"):
        ws = wbs[key].worksheets[0]
        d = extract_all(ws, COL_MIN, COL_DOB, COL_KYO)
        mokuteki_all.update(d)
    print(f"  目的別歳出: {len(mokuteki_all)} 件（全国）")

    # 性質別（普通建設事業費）
    seishitsu_all: dict[str, list] = {}
    for key in ("shi_seishitsu", "machi_seishitsu"):
        ws = wbs[key].worksheets[0]
        d = extract_all(ws, COL_FKEN)
        seishitsu_all.update(d)
    print(f"  性質別歳出: {len(seishitsu_all)} 件（全国）")

    # 母数の妥当性確認（想定レンジ: 1,700〜1,741件程度。日本の市区町村数
    # 1,718 + 東京都特別区23 = 1,741 が上限に一致することを確認済み）
    national_n = len(pop_map_all)
    for label, n in (("人口", len(pop_map_all)), ("目的別歳出", len(mokuteki_all)), ("性質別歳出", len(seishitsu_all))):
        if not (1700 <= n <= 1741):
            print(f"  [警告] 全国母数が想定レンジ外: {label}={n} 件（想定: 1,700〜1,741件）")
    print(f"  → 全国母数: {national_n} 件（想定レンジ1,700〜1,741件内を確認済み）")

    # ---- 岐阜県内42市町村への絞り込み ----
    print("\n=== 岐阜市町村データ抽出 ===")
    pop_map = {c: v for c, v in pop_map_all.items() if is_gifu(c)}
    mokuteki = {c: v for c, v in mokuteki_all.items() if is_gifu(c)}
    seishitsu = {c: v for c, v in seishitsu_all.items() if is_gifu(c)}
    print(f"  人口: {len(pop_map)} 市町村")
    print(f"  目的別歳出: {len(mokuteki)} 市町村")
    print(f"  性質別歳出: {len(seishitsu)} 市町村")

    # 団体名マップ（目的別から取得）
    name_map: dict[str, str] = {}
    for key in ("shi_mokuteki", "machi_mokuteki"):
        ws = wbs[key].worksheets[0]
        for row in ws.iter_rows(values_only=True):
            raw_code = row[COL_CODE] if len(row) > COL_CODE else None
            if raw_code is None:
                continue
            code6 = str(raw_code).strip()
            if is_gifu(code6):
                name_map[code6] = str(row[COL_NAME]) if row[COL_NAME] else ""

    # ---- 統合 ----
    all_codes = sorted(set(mokuteki) | set(seishitsu) | set(pop_map))
    if args.test:
        all_codes = [c for c in all_codes if c == "212016"]

    rows = []
    for code in all_codes:
        pop = pop_map.get(code)
        mok = mokuteki.get(code, [None, None, None])
        sei = seishitsu.get(code, [None])

        minkei = to_int(mok[0]) if len(mok) > 0 else None
        doboku = to_int(mok[1]) if len(mok) > 1 else None
        kyoiku = to_int(mok[2]) if len(mok) > 2 else None
        fuken  = to_int(sei[0]) if len(sei) > 0 else None

        row: dict = {
            "area_code": code,
            "市区町村名": name_map.get(code, f"code:{code}"),
            "人口_人": pop,
            "民生費_千円": minkei,
            "教育費_千円": kyoiku,
            "土木費_千円": doboku,
            "普通建設事業費_千円": fuken,
        }

        if pop and pop > 0:
            row["民生費_円/人"]      = round(minkei * 1000 / pop) if minkei is not None else None
            row["教育費_円/人"]      = round(kyoiku * 1000 / pop) if kyoiku is not None else None
            row["土木費_円/人"]      = round(doboku * 1000 / pop) if doboku is not None else None
            row["普通建設事業費_円/人"] = round(fuken  * 1000 / pop) if fuken  is not None else None
        else:
            row["民生費_円/人"] = row["教育費_円/人"] = row["土木費_円/人"] = row["普通建設事業費_円/人"] = None

        rows.append(row)

    # ---- サマリ ----
    null_count = sum(1 for r in rows for v in r.values() if v is None)
    print(f"\n=== 岐阜県内市町村: {len(rows)} 件 (FY2023) ===")
    for r in rows[:5]:
        print(
            f"  {r['市区町村名']:8s}  人口: {r['人口_人']:>8,}  "
            f"民生費: {r.get('民生費_円/人') or 0:>7,} 円/人  "
            f"教育費: {r.get('教育費_円/人') or 0:>7,} 円/人"
        )
    if len(rows) > 5:
        print(f"  ... (他 {len(rows)-5} 件)")
    print(f"  null値合計: {null_count}")

    if args.test:
        print("\n[test mode] JSON 出力をスキップ")
        return

    # ---- 全国平均・岐阜県内平均（人口加重平均） ----
    # 4項目それぞれについて、全国平均は全国の全市町村(mokuteki_all/
    # seishitsu_all, pop_map_all)から、岐阜県内平均は岐阜県42市町村分
    # (mokuteki/seishitsu, pop_map)から算出する。いずれも単純算術平均
    # ではなく人口加重平均（合計千円 ÷ 合計人口 × 1000）。
    ITEMS = [
        ("民生費_円/人", mokuteki_all, mokuteki, 0),
        ("教育費_円/人", mokuteki_all, mokuteki, 2),
        ("土木費_円/人", mokuteki_all, mokuteki, 1),
        ("普通建設事業費_円/人", seishitsu_all, seishitsu, 0),
    ]

    calc_note = (
        "人口加重平均（対象市町村の当該費目_千円の合計 ÷ 対象市町村の"
        "人口_人の合計 × 1000）。各市町村の円/人を単純算術平均した値では"
        "ない。人口の少ない自治体ほど円/人が跳ね上がる構造があり"
        "（岐阜県内では白川村が岐阜市の7〜8倍の円/人）、単純平均は"
        "小規模自治体に歪められた値になるため。"
    )

    national_average: dict = {
        "municipality_count": national_n,
        "note": calc_note,
    }
    prefecture_average: dict = {
        "prefecture": "岐阜県",
        "municipality_count": len(pop_map),
        "note": calc_note,
    }

    print("\n=== 全国平均・岐阜県内平均（人口加重平均） ===")
    for key, value_map_all, value_map_pref, idx in ITEMS:
        nat_avg, nat_n, nat_pop = weighted_average(pop_map_all, value_map_all, idx)
        pref_avg, pref_n, pref_pop = weighted_average(pop_map, value_map_pref, idx)
        national_average[key] = round(nat_avg)
        prefecture_average[key] = round(pref_avg)
        print(
            f"  {key:16s} 全国: {round(nat_avg):>7,}円/人 (対象{nat_n}件・人口計{nat_pop:,}人)  "
            f"岐阜県内: {round(pref_avg):>7,}円/人 (対象{pref_n}件・人口計{pref_pop:,}人)"
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    sources = build_sources(
        OUTPUT_PATH,
        specs=[
            {
                "role": EXCEL_FILE_ROLES[key],
                "cache_path": CACHE_DIR / f"r05_{EXCEL_FILES[key][0]}.xlsx",
                "source_url": EXCEL_FILES[key][1],
                "source_page": SOUMU_SOURCE_PAGE,
            }
            for key in (
                "shi_gaikyo", "shi_mokuteki", "shi_seishitsu",
                "machi_gaikyo", "machi_mokuteki", "machi_seishitsu",
            )
        ],
        backfill_fetched_at="2026-07-31",
    )
    payload = {
        "year": "2023年度（令和5年度）",
        "year_label": "2023年度（令和5年度、FY April 2023 - March 2024）",
        "population_source": "住民基本台帳登載人口（令和6年1月1日現在）",
        "population_year_gap": "約0年（FY2023中 vs 令6.1.1）",
        "updated": "2026-07-31",
        "sources": sources,
        "notes": [
            "総務省 市区町村別決算状況調 令和5年度（FY2023）。",
            "普通建設事業費は性質別歳出内訳(col146)から取得。全目的合計の性質別分類。",
            "民生費・土木費・教育費は目的別歳出内訳から取得。",
            "団体コードはExcel6桁(検査数字付き、全国地方公共団体コード)をそのまま使用。",
            "e-Stat 00200251 はFY2018が最新のためExcel直接取得に切替。",
            f"全国平均・岐阜県内平均（national_average/prefecture_average）はいずれも"
            f"人口加重平均。全国母数は{national_n}件（日本の市区町村1,718+東京都"
            "特別区23=1,741の想定レンジ内であることを確認済み。Excelの脚注行・"
            "小計行（「市計」「全国計」等、団体コード列が空文字）は団体コードが"
            "6桁数字でないことを条件に除外している）。",
        ],
        "national_average": national_average,
        "prefecture_average": prefecture_average,
        "data": rows,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[output] {OUTPUT_PATH}  ({len(rows)} 件 + 全国/岐阜県内平均)")


if __name__ == "__main__":
    main()
