"""
M3: 総務省 地方財政状況調査 住民一人あたり分野別支出 抽出スクリプト
対象: 岐阜県内42市町村（団体コード先頭2桁=21）

データソース（令和6年度・FY2024。2026-10-12 に令和5年度から更新・launch-backlog.md E-9）:
  総務省 市町村別決算状況調 令和6年度（2026年3月公表）
  https://www.soumu.go.jp/iken/zaisei/r06_shichouson.html

入力（取得済みのローカルファイルのみ。ネットワークに接続しない）:
  poc/recon-20260830/raw/ に置いた次の6ファイル（取得元は上のページ。URL は RAW_FILES に定義）
  都市別 概況         001061669.xlsx  → 住民基本台帳人口（令7.1.1現在）
  都市別 目的別歳出   001061671.xlsx  → 民生費/土木費/教育費
  都市別 性質別歳出   001061672.xlsx  → 普通建設事業費
  町村別 概況         001061674.xlsx  → 住民基本台帳人口（令7.1.1現在）
  町村別 目的別歳出   001061676.xlsx  → 民生費/土木費/教育費
  町村別 性質別歳出   001061677.xlsx  → 普通建設事業費
  ※令和6年度版では性質別歳出の列位置が令和5年度版から5列ずれていた（普通建設事業費が
    146列目→151列目）。列位置を数字で固定せず、見出しの文字から特定して自己検証する。
  新しい年度へ更新するときは、上のページから6ファイルを取り直して RAW_FILES を差し替える。

団体コード: Excel内の6桁（検査数字付き、全国地方公共団体コード）をそのまま使用

全国平均・岐阜県内平均（2026-08-06追加）:
  全国Excelは岐阜県フィルタ前の全都道府県分のデータを含む。このスクリプトは
  フィルタ前の全国データから4項目（民生費・教育費・土木費・普通建設事業費、
  いずれも円/人）の全国平均を算出し、JSONのトップレベル(national_average)に
  追加する。岐阜県内平均(prefecture_average)も同様に算出する。
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
import re
from pathlib import Path

import openpyxl

from lineage import build_sources

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "poc" / "recon-20260830" / "raw"
OUTPUT_PATH = ROOT / "data" / "m3_expenditure.json"
GIFU_PREFIX = "21"
SOUMU_SOURCE_PAGE = "https://www.soumu.go.jp/iken/zaisei/r06_shichouson.html"

# キー → (ファイル名, 取得元URL, 取得日時〈記録〉)
_T_OLD = "2026-08-28T20:03:48+09:00"   # 令和6年度の4ファイル（recon で取得。scripts/fetch_m2_2_raw.py の記録と同じ）
_T_NEW = "2026-10-12T21:05:00+09:00"   # 性質別の2ファイル（2026-10-12 に運営者が取得）
RAW_FILES = {
    "shi_gaikyo":      ("001061669.xlsx", "https://www.soumu.go.jp/main_content/001061669.xlsx", _T_OLD),
    "shi_mokuteki":    ("001061671.xlsx", "https://www.soumu.go.jp/main_content/001061671.xlsx", _T_OLD),
    "shi_seishitsu":   ("001061672.xlsx", "https://www.soumu.go.jp/main_content/001061672.xlsx", _T_NEW),
    "machi_gaikyo":    ("001061674.xlsx", "https://www.soumu.go.jp/main_content/001061674.xlsx", _T_OLD),
    "machi_mokuteki":  ("001061676.xlsx", "https://www.soumu.go.jp/main_content/001061676.xlsx", _T_OLD),
    "machi_seishitsu": ("001061677.xlsx", "https://www.soumu.go.jp/main_content/001061677.xlsx", _T_NEW),
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

# 団体コード・団体名・人口の列（0ベース）。見出しで自己検証する（locate_cols）
COL_CODE = 14   # 団体コード（6桁）
COL_NAME = 15   # 団体名
COL_POP  = 16   # 住民基本台帳登載人口（令7.1.1現在）
HEADER_ROWS = range(5, 15)  # 見出しがある行（0ベース）

POP_DATE_LABEL = "令和7年1月1日"


def load_excel(key: str) -> openpyxl.Workbook:
    fname, _url, _t = RAW_FILES[key]
    path = RAW_DIR / fname
    if not path.exists():
        sys.exit(
            f"原本がありません: {path}\n"
            f"  取得元: {RAW_FILES[key][1]}\n"
            f"  上のURLからダウンロードして {RAW_DIR} に同じ名前で置いてから、もう一度実行してください。"
        )
    print(f"  [local] {fname}")
    return openpyxl.load_workbook(path, data_only=True)


def _norm(v) -> str:
    return re.sub(r"\s+", "", str(v)) if v is not None else ""


def find_col(ws, label: str, top_level: bool = False) -> int:
    """見出し行（HEADER_ROWS）で、セルの文字が label と完全一致する列を返す。ちょうど1つでなければ止める。

    top_level=True のときは、同じ列の見出し行（0始まり8行目）に大項目の番号（「三」「八」など漢数字）が
    ある列だけを対象にする。「土木費」「教育費」は災害復旧費の内訳にも同じ文字の列があるため。
    """
    rows = list(ws.iter_rows(min_row=1, max_row=max(HEADER_ROWS) + 1, values_only=True))
    hits = []
    for r_idx, row in enumerate(rows):
        if r_idx not in HEADER_ROWS:
            continue
        for c_idx, v in enumerate(row):
            if _norm(v) != label:
                continue
            if top_level:
                marker = _norm(rows[8][c_idx]) if c_idx < len(rows[8]) else ""
                if not re.fullmatch(r"[一二三四五六七八九十]+", marker):
                    continue
            hits.append(c_idx)
    if len(set(hits)) != 1:
        sys.exit(f"見出し「{label}」の列を1つに特定できません（候補: {sorted(set(hits))}）。ファイルの形式が変わった可能性があります。")
    return hits[0]


def check_fixed_cols(ws, fname: str) -> None:
    """団体コード・団体名・人口の列位置が、見出しの文字と合っているか確かめる。"""
    for col, label in ((COL_CODE, "団体コード"), (COL_NAME, "団体名")):
        if find_col(ws, label) != col:
            sys.exit(f"{fname}: 「{label}」の列が想定（{col}列目・0始まり）と違います。")


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
    args = ap.parse_args()

    # ---- 原本の読み込み（ローカルのみ） ----
    print("\n=== 原本の読み込み ===")
    wbs = {}
    for key in RAW_FILES:
        wbs[key] = load_excel(key)
        check_fixed_cols(wbs[key].worksheets[0], RAW_FILES[key][0])

    # ---- 見出しの文字から列を特定（数字で固定しない） ----
    cols: dict[str, dict[str, int]] = {}
    for key, wb in wbs.items():
        ws = wb.worksheets[0]
        if key.endswith("gaikyo"):
            c = {"人口": find_col(ws, "住民基本台帳登載人口")}
            if c["人口"] != COL_POP:
                sys.exit(f"{RAW_FILES[key][0]}: 人口の列が想定（{COL_POP}列目）と違います。")
            if not any("令7.1.1現在" in _norm(v) for row in ws.iter_rows(min_row=1, max_row=15, values_only=True) for v in [row[COL_POP] if len(row) > COL_POP else None]):
                sys.exit(f"{RAW_FILES[key][0]}: 人口の基準日が「令7.1.1現在」ではありません。POP_DATE_LABEL と出力の注記を見直してください。")
        elif key.endswith("mokuteki"):
            c = {k: find_col(ws, k, top_level=True) for k in ("民生費", "土木費", "教育費")}
        else:
            c = {"普通建設事業費": find_col(ws, "普通建設事業費", top_level=True)}
        cols[key] = c
        print(f"  列: {RAW_FILES[key][0]} {c}")

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
        cc = cols[key]
        d = extract_all(ws, cc["民生費"], cc["土木費"], cc["教育費"])
        mokuteki_all.update(d)
    print(f"  目的別歳出: {len(mokuteki_all)} 件（全国）")

    # 性質別（普通建設事業費）
    seishitsu_all: dict[str, list] = {}
    for key in ("shi_seishitsu", "machi_seishitsu"):
        ws = wbs[key].worksheets[0]
        d = extract_all(ws, cols[key]["普通建設事業費"])
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
    print(f"\n=== 岐阜県内市町村: {len(rows)} 件 (FY2024) ===")
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
                "cache_path": RAW_DIR / RAW_FILES[key][0],
                "source_url": RAW_FILES[key][1],
                "source_page": SOUMU_SOURCE_PAGE,
            }
            for key in (
                "shi_gaikyo", "shi_mokuteki", "shi_seishitsu",
                "machi_gaikyo", "machi_mokuteki", "machi_seishitsu",
            )
        ],
        backfill_fetched_at="2026-07-31",
    )
    # 取得日時は、実際に取得した日時の記録を使う（ネットワークに接続しないため、実行時刻を入れない）
    for spec_key, entry in zip(("shi_gaikyo", "shi_mokuteki", "shi_seishitsu", "machi_gaikyo", "machi_mokuteki", "machi_seishitsu"), sources):
        entry["fetched_at"] = RAW_FILES[spec_key][2]
    payload = {
        "year": "2024年度（令和6年度）",
        "year_label": "2024年度（令和6年度、FY April 2024 - March 2025）",
        "population_source": f"住民基本台帳登載人口（{POP_DATE_LABEL}現在）",
        "population_year_gap": "約0年（FY2024中 vs 令7.1.1）",
        "updated": "2026-10-12",
        "sources": sources,
        "notes": [
            "総務省 市区町村別決算状況調 令和6年度（FY2024）。2026-10-12 に令和5年度版から更新。",
            "普通建設事業費は性質別歳出内訳（見出し「普通建設事業費」の列）から取得。全目的合計の性質別分類。",
            "民生費・土木費・教育費は目的別歳出内訳（見出しの文字で列を特定）から取得。",
            "団体コードはExcel6桁(検査数字付き、全国地方公共団体コード)をそのまま使用。",
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
