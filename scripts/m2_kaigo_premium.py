"""
M2: 厚労省 介護保険料 基準額（第1号・月額）抽出スクリプト
対象: 岐阜県内42市町村
ソース: 第9期 各保険者保険料基準額一覧（xlsx）
        https://www.mhlw.go.jp/content/12303500/001253800.xlsx
公表ページ（第9期集計）:
        https://www.mhlw.go.jp/stf/newpage_40211.html（確認済み 2026-08-01）

列構造（確認済み 2026-07-31、行範囲は2026-08-06に全件検証済み）:
  行01: タイトル「第 ９ 期 第 一 号 保 険 料 (保険者別)」
  行03: 都道府県名 | 保険者名 | 第8期月額（円）| 第9期月額（円）| 伸び率（%）| 要介護認定率
  行05〜1578付近: 実データ（全国 1,573 保険者。openpyxlのmax_rowは1739だが、
              これは末尾の空白セルを含むシート全体のサイズであり保険者数ではない）
  行1579〜1582: 表の脚注（4行、都道府県名列に注記文が入るが保険者名・数値列が
              空のため name/第9期月額 が欠けている行として自動的に除外される）
  行1583〜1739: 完全な空白行

注: 保険者コードはこのExcelに含まれない。
    都道府県名 == '岐阜県' でフィルタする。

要介護認定率の欠損（2026-08-06確認）:
  1,573件のうち3件（大阪府 守口市・門真市・四條畷市）は要介護認定率セルが
  '－'（全角ダッシュ）で、数値が存在しない。これは行1582の脚注に「令和6年4月1日、
  くすのき広域連合の解散に伴い新たに独立した保険者となったため、該当データを
  算出していない」と明記された、厚労省側の意図的な欠損であり、抽出処理の
  パース失敗ではない（保険料基準額・伸び率は3件とも正常に値が存在する）。
  そのため要介護認定率の平均算出時のみ、この3件を対象外とする
  （保険料の平均・保険者数には影響しない）。

全国平均・都道府県内平均（2026-08-06追加）:
  第9期月額基準保険料の全国平均は、厚労省公表ページ
  （https://www.mhlw.go.jp/stf/newpage_40211.html 、令和6年5月14日発表）に
  「全国の介護保険料基準額（月額・全国加重平均）は6,225円」と明記されている
  （各保険者の第1号被保険者数で加重した値。第8期6,014円→第9期6,225円、
  伸び率3.5%）。この公式値を採用し、JSONに出典URL付きで記録する
  （national_average.premium_average_source = "official"）。
  一方、要介護認定率の全国平均・岐阜県内平均、および岐阜県内の保険料平均に
  ついては、上記ページに同一形式の公式集計値が明記されていないため、
  抽出した全保険者データ（全国1,573件・岐阜県36件）の単純算術平均を計算し、
  人口・被保険者数による加重を行っていない旨をJSON内のnoteに明記する
  （premium_average_source / certification_rate_source = "unweighted_mean"）。

実行:
  python scripts/m2_kaigo_premium.py            # 全件抽出 → data/m2_kaigo_premium.json
  python scripts/m2_kaigo_premium.py --inspect  # 列構造のみ表示
  python scripts/m2_kaigo_premium.py --test     # 最初の3件のみ（動作確認用）
"""

import sys
import json
import argparse
from pathlib import Path

import requests
import openpyxl

from lineage import build_sources

XLSX_URL = "https://www.mhlw.go.jp/content/12303500/001253800.xlsx"
TARGET_PREF = "岐阜県"
CACHE_PATH = Path("data/cache/m2_001253800.xlsx")
OUTPUT_PATH = Path("data/m2_kaigo_premium.json")

# 厚労省公表の全国加重平均（公式値）。出典: 令和6年5月14日 報道発表
# 「第９期介護保険事業計画期間における介護保険の第１号保険料及び
#  サービス見込み量等について」
NATIONAL_OFFICIAL_PREMIUM_9TH_YEN = 6225
NATIONAL_OFFICIAL_SOURCE_URL = "https://www.mhlw.go.jp/stf/newpage_40211.html"

# 確認済み列インデックス（1-based, openpyxl）
COL_PREF    = 1   # 都道府県名
COL_NAME    = 2   # 保険者名（市区町村名）
COL_P8      = 3   # 第8期保険料基準額（月額・円）
COL_P9      = 4   # 第9期保険料基準額（月額・円）  ← M2 メイン値
COL_RATE    = 5   # 伸び率（%）
COL_NINTEI  = 6   # 要介護認定率
DATA_START  = 5   # データ開始行（1-based）


# ------------------------------------------------------------------ download

def download_xlsx(url: str, cache: Path) -> Path:
    if cache.exists():
        print(f"[cache] {cache}")
        return cache
    print(f"[download] {url}")
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(resp.content)
    print(f"[saved]    {cache}  ({len(resp.content)//1024} KB)")
    return cache


# ------------------------------------------------------------------ inspect

def inspect_sheet(ws, max_rows: int = 10) -> None:
    lines = [
        f"\nシート: '{ws.title}'   max_row: {ws.max_row}   max_col: {ws.max_column}",
        "=" * 70,
    ]
    for r in range(1, min(max_rows + 1, ws.max_row + 1)):
        cells = []
        for c in range(1, ws.max_column + 1):
            v = ws.cell(r, c).value
            cells.append(f"[{c}]={repr(str(v))[:28]}")
        lines.append(f"  行{r:02d}: {'  '.join(cells)}")
    Path("data/m2_inspect_xlsx.txt").parent.mkdir(parents=True, exist_ok=True)
    Path("data/m2_inspect_xlsx.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:4]))   # コンソールには先頭だけ（文字化け対策）
    print(f"  (詳細は data/m2_inspect_xlsx.txt を参照)")


# ------------------------------------------------------------------ extraction

def _val(ws, row: int, col: int):
    return ws.cell(row, col).value


def _str(ws, row: int, col: int) -> str:
    v = _val(ws, row, col)
    return str(v).strip() if v is not None else ""


def _int(ws, row: int, col: int) -> int | None:
    v = _val(ws, row, col)
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _float(ws, row: int, col: int) -> float | None:
    v = _val(ws, row, col)
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def extract_target(ws, target_pref: str, test: bool) -> list[dict]:
    results: list[dict] = []
    for r in range(DATA_START, ws.max_row + 1):
        pref = _str(ws, r, COL_PREF)
        if not pref:
            continue
        if pref != target_pref:
            continue

        name = _str(ws, r, COL_NAME)
        p8 = _int(ws, r, COL_P8)
        p9 = _int(ws, r, COL_P9)
        rate = _float(ws, r, COL_RATE)
        nintei = _float(ws, r, COL_NINTEI)

        results.append(
            {
                "都道府県": pref,
                "市区町村名": name,
                "第8期月額基準保険料_円": p8,
                "第9期月額基準保険料_円": p9,
                "伸び率": round(rate * 100, 2) if rate is not None else None,
                "要介護認定率": round(nintei * 100, 2) if nintei is not None else None,
            }
        )
        if test and len(results) >= 3:
            break

    return results


def extract_all_records(ws) -> list[dict]:
    """都道府県を問わず全行を抽出する（全国平均算出用）。

    シート末尾（1583行目以降）には表の注記（「※」で始まる説明文）が
    都道府県名列に入っている行があるが、保険者名・第9期月額が空のため、
    name または p9 が欠けている行を除外することで自動的に弾かれる。
    """
    results: list[dict] = []
    for r in range(DATA_START, ws.max_row + 1):
        pref = _str(ws, r, COL_PREF)
        name = _str(ws, r, COL_NAME)
        p9 = _int(ws, r, COL_P9)
        if not pref or not name or p9 is None:
            continue

        p8 = _int(ws, r, COL_P8)
        rate = _float(ws, r, COL_RATE)
        nintei = _float(ws, r, COL_NINTEI)

        results.append(
            {
                "都道府県": pref,
                "市区町村名": name,
                "第8期月額基準保険料_円": p8,
                "第9期月額基準保険料_円": p9,
                "伸び率": round(rate * 100, 2) if rate is not None else None,
                "要介護認定率": round(nintei * 100, 2) if nintei is not None else None,
            }
        )

    return results


def _mean(values: list[float]) -> float:
    return sum(values) / len(values)


def build_national_average(all_records: list[dict]) -> dict:
    """全国平均ブロックを構築する。保険料は厚労省公式の全国加重平均値を
    採用し、要介護認定率は抽出データの単純算術平均とする（公式集計値が
    同一ページに明記されていないため）。
    """
    nintei_values = [
        r["要介護認定率"] for r in all_records if r["要介護認定率"] is not None
    ]
    return {
        "insurer_count": len(all_records),
        "premium_9th_yen": NATIONAL_OFFICIAL_PREMIUM_9TH_YEN,
        "premium_average_source": "official",
        "premium_average_source_url": NATIONAL_OFFICIAL_SOURCE_URL,
        "premium_note": (
            "厚生労働省公表の全国加重平均値（各保険者の第1号被保険者数で加重）。"
            "第8期6,014円→第9期6,225円（伸び率3.5%）。"
            "下記の都道府県内平均（単純平均）とは算出方法が異なる。"
        ),
        "certification_rate_pct": round(_mean(nintei_values), 2),
        "certification_rate_source": "unweighted_mean",
        "certification_rate_note": (
            f"全{len(nintei_values)}保険者（保険料データのある{len(all_records)}保険者中、"
            f"要介護認定率が「－」で非公表の{len(all_records) - len(nintei_values)}保険者"
            "＝令和6年4月のくすのき広域連合解散に伴い新たに独立保険者となった大阪府"
            "守口市・門真市・四條畷市を除く）の要介護認定率（令和5年12月末時点）の"
            "単純算術平均。被保険者数による加重は行っていないため、"
            "人口加重した公式統計値とは異なる可能性がある。"
        ),
    }


def build_prefecture_average(pref_records: list[dict], pref_name: str) -> dict:
    """都道府県内平均ブロックを構築する。保険料・認定率とも、抽出済みの
    都道府県内データの単純算術平均であり、被保険者数による加重は行って
    いない（公式の都道府県別加重平均とは異なりうる）。
    """
    premium_values = [
        r["第9期月額基準保険料_円"]
        for r in pref_records
        if r["第9期月額基準保険料_円"] is not None
    ]
    nintei_values = [
        r["要介護認定率"] for r in pref_records if r["要介護認定率"] is not None
    ]
    return {
        "prefecture": pref_name,
        "insurer_count": len(pref_records),
        "premium_9th_yen": round(_mean(premium_values)),
        "premium_average_source": "unweighted_mean",
        "premium_note": (
            f"{pref_name}内{len(premium_values)}保険者の第9期月額基準保険料の"
            "単純算術平均。被保険者数による加重は行っていない。"
        ),
        "certification_rate_pct": round(_mean(nintei_values), 2),
        "certification_rate_source": "unweighted_mean",
        "certification_rate_note": (
            f"{pref_name}内{len(nintei_values)}保険者の要介護認定率の"
            "単純算術平均。被保険者数による加重は行っていない。"
        ),
    }


# ------------------------------------------------------------------ main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", action="store_true", help="列構造確認のみ（抽出しない）")
    ap.add_argument("--test", action="store_true", help="最初の3件のみ抽出して動作確認")
    args = ap.parse_args()

    cache = download_xlsx(XLSX_URL, CACHE_PATH)

    wb = openpyxl.load_workbook(cache, data_only=True, read_only=True)
    ws = wb.active

    if args.inspect:
        inspect_sheet(ws, max_rows=12)
        sys.exit(0)

    inspect_sheet(ws, max_rows=6)

    results = extract_target(ws, TARGET_PREF, test=args.test)

    print(f"\n{'='*55}")
    print(f"{TARGET_PREF} 抽出結果: {len(results)} 件")
    print(f"{'='*55}")
    for row in results[:5]:
        p9 = row["第9期月額基準保険料_円"]
        p8 = row["第8期月額基準保険料_円"]
        chg = row["伸び率"]
        print(
            f"  {row['市区町村名']:8s}  第9期: {p9:,}円/月  第8期: {p8:,}円/月  伸び率: {chg:+.1f}%"
        )
    if len(results) > 5:
        print(f"  ... (他 {len(results)-5} 件)")

    if args.test:
        print("\n[test mode] JSON 出力をスキップ")
        return

    all_records = extract_all_records(ws)
    national_average = build_national_average(all_records)
    prefecture_average = build_prefecture_average(results, TARGET_PREF)

    print(f"\n{'='*55}")
    print(f"全国 抽出結果: {len(all_records)} 件（都道府県フィルタなし）")
    print(
        f"  全国平均（第9期・公式加重平均）: {national_average['premium_9th_yen']:,}円/月"
    )
    print(
        f"  全国平均（要介護認定率・単純平均）: {national_average['certification_rate_pct']:.2f}%"
    )
    print(
        f"  {TARGET_PREF}内平均（第9期・単純平均）: {prefecture_average['premium_9th_yen']:,}円/月"
    )
    print(
        f"  {TARGET_PREF}内平均（要介護認定率・単純平均）: {prefecture_average['certification_rate_pct']:.2f}%"
    )
    print(f"{'='*55}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    sources = build_sources(
        OUTPUT_PATH,
        specs=[{
            "role": None,
            "cache_path": CACHE_PATH,
            "source_url": XLSX_URL,
            "source_page": NATIONAL_OFFICIAL_SOURCE_URL,
        }],
        backfill_fetched_at="2026-08-06",
    )
    payload = {
        "sources": sources,
        "period": "第9期（2024〜2026年度）",
        "updated": "2026-08-06",
        "note": (
            "保険者コードはExcel非掲載。都道府県名でフィルタ。"
            "伸び率・認定率は小数（例: 0.05 → 5.0%に変換済み）。"
            "第9期開始: 2024年4月。第10期改定: 2027年4月。"
        ),
        "national_average": national_average,
        "prefecture_average": prefecture_average,
        "data": results,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[output] {OUTPUT_PATH}  ({len(results)} 件 + 全国/{TARGET_PREF}平均)")


if __name__ == "__main__":
    main()
