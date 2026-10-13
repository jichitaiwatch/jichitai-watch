# -*- coding: utf-8 -*-
"""まちのすがた7枚目カード「一人あたり課税対象所得」の市区町村版JSONを生成する。

対象（content-spec-v1.md §7.11 / docs/similar-group-aggregation-design.md）:
  1-2c 一人あたり課税対象所得（岐阜42市区町村・比較値=全国平均・類似団体平均・順位・百分位つき）

入力（取得済みローカルファイルのみ。ネットワークアクセスをしない）:
  poc/recon-20261012-sugata-city2026/estat_000040463586_ssds2026_C_keizai.xlsx
    （statInfId=000040463586「統計でみる市区町村のすがた2026」C経済基盤。2026-10-12 に2025年版〔000040283812〕から更新。拡張子は.xlsxだが
      実体はOLE .xls形式のため xlrd で読む。openpyxlを先に試し、失敗したらxlrdへ切り替える）
  poc/recon-20260828/0/ruikei_kubun_r06.xlsx（類似団体区分マスタ・市町村一覧シート・1741団体）
    （こちらは実xlsxのためopenpyxlで読む）

出力（新規1本）:
  data/m1_2c_taxable_income.json

算出式:
  一人あたり課税対象所得_万円 = 課税対象所得_百万円（C120110） × 100 ÷ 納税義務者数_人（C120120）

集計（docs/similar-group-aggregation-design.md §3・§4・§9・§10）:
  母集団M = 区分マスタに載る団体（1741）∩ 本ファイルに値がある団体（'...'等の抑匿値を除く）。
  束ね写像：政令指定都市・中核市・施行時特例市・特別区 → "大都市"。他は類団区分の生ラベルをそのまま使う
  （§9実証済みの前例どおり、一般市と町村で同じラベル文字列を持つ区分は同一グループとして束ねる。
  例：Ⅳ－２は一般市16団体＋町村59団体＝75団体として扱う。§9の岐阜実測値と一致することを本スクリプトでも検証する）。
  順位：降順 competition ranking（同値は同順位、次の順位を飛ばす）。
  percentile = (rank_out_of − rank + 1) / rank_out_of × 100（小数第1位）。
  average_method = "unweighted_mean"（単純算術平均。人口加重等はしない）。

規律:
  - 列位置はハードコードせず、ヘッダのラベル文字列（項目コード・単位・年次）から同定し自己検証する。
  - 単位が「百万円」「人」であることをコードでassertしてから計算する（推測しない）。
  - 評価語・評価色・複合スコアは付けない（中立性・D-4/D-6/D-18）。
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from lineage import build_sources  # noqa: E402

INCOME_SRC = ROOT / "poc" / "recon-20261012-sugata-city2026" / "estat_000040463586_ssds2026_C_keizai.xlsx"
RUIKEI_SRC = ROOT / "poc" / "recon-20260828" / "0" / "ruikei_kubun_r06.xlsx"
OUT = ROOT / "data" / "m1_2c_taxable_income.json"

UPDATED = date.today().isoformat()
SOURCE_URL = "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040463586&fileKind=0"
# 2026-10-12 に運営者が e-Stat から取得（cmd の curl。dir の更新時刻 21:51）。lineage.build_sources は
# ハッシュが前回と異なるとき取得時刻を「今」にするが、実際の取得時刻はこちらなので上書きする。
FETCHED_AT_2026 = "2026-10-12T21:51:00+09:00"
BACKFILL_FETCHED_AT = FETCHED_AT_2026

DAITOSHI_KUBUN = {1, 2, 8, 9}  # 政令指定都市・特別区・中核市・施行時特例市 → "大都市"

# §9実データ検証（similar-group-aggregation-design.md）の岐阜実測アンカー。一致しなければ中断する。
ANCHOR = {
    "gifu_shi_group": "大都市",
    "gifu_shi_group_n": 128,
    "ogaki_shi_group": "Ⅳ－２",
    "ogaki_shi_group_n": 75,
    "takayama_shi_group": "Ⅱ－１",
    "takayama_shi_group_n": 127,
}


class Abort(Exception):
    """欠損・単位不一致・アンカー不一致などで処理を止めるための例外。推測で続行しない。"""


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def s(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def load_matrix(path: Path) -> tuple[list[list], str]:
    """(行列, 読めたエンジン名) を返す。openpyxlを先に試し、失敗したらxlrdへ切り替える。"""
    try:
        from openpyxl import load_workbook

        wb = load_workbook(path, read_only=True, data_only=True)
        ws = wb[wb.sheetnames[0]]
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        return rows, "openpyxl"
    except Exception as e_openpyxl:
        try:
            import xlrd

            wb = xlrd.open_workbook(path)
            sh = wb.sheet_by_index(0)
            rows = [sh.row_values(r) for r in range(sh.nrows)]
            return rows, "xlrd"
        except Exception as e_xlrd:
            raise Abort(
                f"{path}: openpyxlでもxlrdでも開けない openpyxl={e_openpyxl!r} xlrd={e_xlrd!r}"
            )


def cell(rows: list[list], r: int, c: int):
    if r < 0 or r >= len(rows):
        return None
    row = rows[r]
    if c < 0 or c >= len(row):
        return None
    return row[c]


# --------------------------------------------------------------------------------------
# 区分マスタ（类似団体区分）
# --------------------------------------------------------------------------------------
def load_ruikei_master() -> dict[str, dict]:
    from openpyxl import load_workbook

    wb = load_workbook(RUIKEI_SRC, read_only=True, data_only=True)
    sheet_name = next((n for n in wb.sheetnames if "市町村一覧" in n), None)
    if sheet_name is None:
        raise Abort(f"ruikei: シート『市町村一覧』が見つからない（実在={wb.sheetnames}）")
    ws = wb[sheet_name]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    print(f"  [ruikei] engine=openpyxl sheet={sheet_name!r}")
    hidx = None
    for i, row in enumerate(rows):
        if s(cell(rows, i, 0)) == "団体コード":
            hidx = i
            break
    if hidx is None:
        raise Abort("ruikei: ヘッダ行（1列目='団体コード'）が見つからない")

    out: dict[str, dict] = {}
    for row in rows[hidx + 1 :]:
        code = s(row[0]) if len(row) > 0 else ""
        if not re.fullmatch(r"\d{6}", code):
            continue
        name = s(row[1])
        danntai_kubun_raw = row[2]
        ruikei_raw = s(row[4])
        if not ruikei_raw:
            continue
        try:
            danntai_kubun = int(danntai_kubun_raw)
        except (TypeError, ValueError):
            raise Abort(f"ruikei: {code} の団体区分が数値でない: {danntai_kubun_raw!r}")
        group_code = "大都市" if danntai_kubun in DAITOSHI_KUBUN else ruikei_raw
        out[code] = {"name": name, "danntai_kubun": danntai_kubun, "ruikei_raw": ruikei_raw, "group_code": group_code}
    if len(out) != 1741:
        raise Abort(f"ruikei: 市町村一覧の件数が1741ではない（実測={len(out)}）")
    print(f"  [ruikei] 市町村一覧 {len(out)}件を読み込み")
    return out


# --------------------------------------------------------------------------------------
# C経済基盤（課税対象所得・納税義務者数）
# --------------------------------------------------------------------------------------
def resolve_income_columns(rows: list[list]):
    """(項目コード行, 課税対象所得列, 納税義務者数列, 名称列, コード列, 年次) を返す。"""
    code_row = None
    c_income = c_taxpayers = None
    for i, row in enumerate(rows):
        for c, v in enumerate(row):
            if s(v) == "C120110":
                code_row = i
                c_income = c
            if s(v) == "C120120":
                c_taxpayers = c
        if code_row is not None and c_taxpayers is not None:
            break
    if code_row is None or c_income is None:
        raise Abort("C120110（課税対象所得）の列が見つからない")
    if c_taxpayers is None:
        raise Abort("C120120（納税義務者数）の列が見つからない")

    unit_row = code_row + 1
    year_row = code_row + 2
    unit_income = s(cell(rows, unit_row, c_income))
    unit_taxpayers = s(cell(rows, unit_row, c_taxpayers))
    if "百万円" not in unit_income:
        raise Abort(f"課税対象所得の単位が『百万円』ではない（実測={unit_income!r}）。推測で続行しない。")
    if "人" not in unit_taxpayers:
        raise Abort(f"納税義務者数の単位が『人』ではない（実測={unit_taxpayers!r}）。推測で続行しない。")
    print(f"  [income] 単位確認: 課税対象所得={unit_income!r} 納税義務者数={unit_taxpayers!r}")

    year_income = s(cell(rows, year_row, c_income))
    year_taxpayers = s(cell(rows, year_row, c_taxpayers))
    if not re.fullmatch(r"(19|20)\d{2}", year_income):
        raise Abort(f"課税対象所得の年次が4桁年でない（実測={year_income!r}）")
    if year_income != year_taxpayers:
        raise Abort(f"課税対象所得と納税義務者数の年次が異なる（{year_income} / {year_taxpayers}）")
    print(f"  [income] 年次確認: {year_income}年（両項目共通）")

    # 名称列・コード列（ヘッダ上部のラベルから同定。code_row より上の行群を探索）
    name_col = code_col = None
    for i in range(0, code_row):
        for c, v in enumerate(rows[i]):
            label = s(v)
            if label == "市区町村":
                name_col = c
            if ("コード" in label or "ｺｰﾄﾞ" in label) and ("市区" in label or "町村" in label):
                code_col = c
    if name_col is None:
        raise Abort("市区町村名列（ラベル='市区町村'）が見つからない")
    if code_col is None:
        raise Abort("市区町村コード列（ラベルに『市区』『町村』『コード』を含む）が見つからない")

    return code_row, c_income, c_taxpayers, name_col, code_col, year_income


def load_income_by_code5(rows: list[list], c_income: int, c_taxpayers: int, name_col: int, code_col: int, data_start: int):
    """5桁コード -> {income_million_yen, taxpayers, name} （'...'等の抑匿値は None を格納）。"""
    out: dict[str, dict] = {}
    for r in range(data_start, len(rows)):
        code_raw = s(cell(rows, r, code_col))
        if not re.fullmatch(r"\d{5}", code_raw):
            continue
        name_raw = s(cell(rows, r, name_col))
        income_v = cell(rows, r, c_income)
        taxpayers_v = cell(rows, r, c_taxpayers)
        def to_num(v):
            if not isinstance(v, (int, float)) or isinstance(v, bool):
                return None
            return int(v) if float(v).is_integer() else v

        income = to_num(income_v)
        taxpayers = to_num(taxpayers_v)
        if code_raw in out:
            raise Abort(f"income: コード {code_raw} が重複している")
        out[code_raw] = {"income_million_yen": income, "taxpayers": taxpayers, "name": name_raw}
    return out


# --------------------------------------------------------------------------------------
# 集計
# --------------------------------------------------------------------------------------
def ranks_desc(values: list[float]) -> list[int]:
    """降順の competition ranking（同値は同順位、次の順位を飛ばす。1,2,2,4）。"""
    return [1 + sum(1 for w in values if w > v) for v in values]


def main():
    for p in (INCOME_SRC, RUIKEI_SRC):
        if not p.exists():
            raise Abort(f"入力ファイルが無い: {p}")

    print("== 区分マスタ読み込み ==")
    ruikei = load_ruikei_master()

    print("== 課税対象所得ファイル読み込み ==")
    income_rows, engine = load_matrix(INCOME_SRC)
    print(f"  [income] engine={engine}  rows={len(income_rows)}")
    code_row, c_income, c_taxpayers, name_col, code_col, year = resolve_income_columns(income_rows)
    print(
        f"  [income] 列: 項目コード行=r{code_row + 1} 課税対象所得列=c{c_income + 1} "
        f"納税義務者数列=c{c_taxpayers + 1} 市区町村名列=c{name_col + 1} コード列=c{code_col + 1}"
    )
    data_start = code_row + 3  # 項目コード行→単位行→年次行の直後からデータ行
    income_by_code5 = load_income_by_code5(income_rows, c_income, c_taxpayers, name_col, code_col, data_start)
    print(f"  [income] コード付きデータ行 {len(income_by_code5)}件")

    print("== 母集団Mの構築・一人あたり値の算出 ==")
    population: dict[str, dict] = {}  # code6 -> {value, group_code}
    skipped_no_income_file = []
    skipped_suppressed = []
    for code6, meta in ruikei.items():
        code5 = code6[:5]
        rec = income_by_code5.get(code5)
        if rec is None:
            skipped_no_income_file.append(code6)
            continue
        if rec["income_million_yen"] is None or rec["taxpayers"] is None or not rec["taxpayers"]:
            skipped_suppressed.append(code6)
            continue
        value = round(rec["income_million_yen"] * 100 / rec["taxpayers"], 1)
        population[code6] = {
            "value": value,
            "group_code": meta["group_code"],
            "income_million_yen": rec["income_million_yen"],
            "taxpayers": rec["taxpayers"],
            "name": rec["name"],
        }
    print(f"  母集団M = {len(population)}件（区分マスタ1741 − 本ファイルに無い{len(skipped_no_income_file)}件 − 抑匿{len(skipped_suppressed)}件）")
    if skipped_suppressed:
        print(f"  抑匿等で母集団外: {skipped_suppressed[:10]}{'...' if len(skipped_suppressed) > 10 else ''}")

    codes = list(population.keys())
    values = [population[c]["value"] for c in codes]
    n_total = len(codes)
    national_average = round(sum(values) / n_total, 1)

    group_values: dict[str, list[float]] = {}
    for c in codes:
        group_values.setdefault(population[c]["group_code"], []).append(population[c]["value"])
    group_average = {g: round(sum(vs) / len(vs), 1) for g, vs in group_values.items()}
    group_n = {g: len(vs) for g, vs in group_values.items()}

    ranks = dict(zip(codes, ranks_desc(values)))

    print("== アンカー自己検証（§9実データ検証・2026-08-29） ==")

    def check(label, got, want):
        ok = got == want
        print(f"    {'OK ' if ok else 'NG '} {label}: 実測={got!r} 期待={want!r}")
        return ok

    gifu_shi = population.get("212016")
    ogaki_shi = population.get("212024")
    takayama_shi = population.get("212032")
    if not (gifu_shi and ogaki_shi and takayama_shi):
        raise Abort("岐阜市/大垣市/高山市のいずれかが母集団Mに無い")
    results = [
        check("岐阜市 束ね後区分", gifu_shi["group_code"], ANCHOR["gifu_shi_group"]),
        check("岐阜市 束ね後区分の団体数", group_n[gifu_shi["group_code"]], ANCHOR["gifu_shi_group_n"]),
        check("大垣市 束ね後区分", ogaki_shi["group_code"], ANCHOR["ogaki_shi_group"]),
        check("大垣市 束ね後区分の団体数", group_n[ogaki_shi["group_code"]], ANCHOR["ogaki_shi_group_n"]),
        check("高山市 束ね後区分", takayama_shi["group_code"], ANCHOR["takayama_shi_group"]),
        check("高山市 束ね後区分の団体数", group_n[takayama_shi["group_code"]], ANCHOR["takayama_shi_group_n"]),
    ]
    if not all(results):
        raise Abort("アンカー値が一致しない。JSONを書かずに中断した。")

    print("== 県版との突合（同じ原表の岐阜県行 21000 と、県版 pref_1d の岐阜県） ==")
    # 県の行は、市区町村コード列（c21）ではなく先頭側のコード列（2列目）に '21000' と入っている
    g_row = [r for r in income_rows if len(r) > 11 and s(r[1]) == "21000" and s(r[8]).startswith("岐阜県")]
    if len(g_row) != 1:
        raise Abort(f"原表の岐阜県行（2列目='21000'・名称='岐阜県'）が {len(g_row)} 行（1行に確定できない）")
    g_pref = {"income_million_yen": g_row[0][c_income], "taxpayers": g_row[0][c_taxpayers]}
    if not isinstance(g_pref["income_million_yen"], float) or not g_pref["taxpayers"]:
        raise Abort("岐阜県行の値が数値でない")
    g_pref_val = round(g_pref["income_million_yen"] * 100 / g_pref["taxpayers"], 1)
    pref_json = ROOT / "data" / "pref_1d_taxable_income.json"
    if pref_json.exists():
        pj = json.loads(pref_json.read_text(encoding="utf-8"))
        pg = next(r for r in pj["data"] if r["都道府県コード"] == "21")
        want = round(pg["一人あたり課税対象所得_万円"], 1)
        if not check("岐阜県 一人あたり課税対象所得(万円)：市区町村のすがた2026の県行 = 県版(すがた2026 #D02206)", g_pref_val, want):
            raise Abort("市区町村版の原表の岐阜県行と県版の値が一致しない。JSONを書かずに中断した。")
    # 岐阜42市町村の合計 = 岐阜県行（課税対象所得・納税義務者数）
    gifu5 = [c5 for c5 in income_by_code5 if c5.startswith("21") and not c5.endswith("000")]
    gi = sum(income_by_code5[c]["income_million_yen"] or 0 for c in gifu5)
    gt = sum(income_by_code5[c]["taxpayers"] or 0 for c in gifu5)
    # 課税対象所得は百万円単位に丸めて掲載されているため、42件の合計と県行の差は最大 42×0.5=21 百万円まで許容する。
    # 納税義務者数（人）は丸めがないので完全一致を要求する。
    d_income = abs(gi - g_pref["income_million_yen"])
    print(f"    {'OK ' if d_income <= 21 else 'NG '} 岐阜42市町村の課税対象所得合計と岐阜県行の差: {d_income}百万円（丸め由来の許容 21 以内）")
    ok_t = check("岐阜42市町村の納税義務者数合計 = 岐阜県行", gt, g_pref["taxpayers"])
    if not (d_income <= 21 and ok_t):
        raise Abort("岐阜42市町村の合計が岐阜県行と一致しない。JSONを書かずに中断した。")

    print("== 岐阜42市区町村の抽出 ==")
    gifu_codes = sorted(c for c in codes if c.startswith("21"))
    if len(gifu_codes) != 42:
        raise Abort(f"岐阜県内市区町村が{len(gifu_codes)}件（42件ではない）")

    data = []
    for code6 in gifu_codes:
        p = population[code6]
        rank = ranks[code6]
        pct = round((n_total - rank + 1) / n_total * 100, 1)
        data.append(
            {
                "area_code": code6,
                "市区町村名": p["name"],
                "課税対象所得_百万円": p["income_million_yen"],
                "納税義務者数_人": p["taxpayers"],
                "一人あたり課税対象所得_万円": p["value"],
                "comparison": {
                    "value": p["value"],
                    "national_average": national_average,
                    "group_code": p["group_code"],
                    "group_average": group_average[p["group_code"]],
                    "rank": rank,
                    "rank_out_of": n_total,
                    "percentile": pct,
                    "average_method": "unweighted_mean",
                    "source_note": (
                        f"全国{n_total}市区町村中の順位（母集団=類似団体区分マスタ登載団体1741のうち、"
                        "本統計に数値がある団体）。類似団体平均は総務省の類似団体区分（束ね後）の単純算術平均。"
                    ),
                },
            }
        )
    data.sort(key=lambda r: r["area_code"])

    file_hash = sha256_of(INCOME_SRC)
    sources = build_sources(
        OUT,
        [
            {
                "role": None,
                "cache_path": INCOME_SRC,
                "source_url": SOURCE_URL,
                "source_page": None,
            }
        ],
        backfill_fetched_at=BACKFILL_FETCHED_AT,
    )
    sources[0]["fetched_at"] = FETCHED_AT_2026
    sources[0].pop("_provenance_note", None)

    notes = [
        "一人あたり課税対象所得(万円) = 課税対象所得(百万円) × 100 ÷ 納税義務者数(人)。小数第1位で丸め。"
        "分子・分母の原数値を併載しているため再計算可能。都道府県版（data/pref_1d_taxable_income.json）と同一の算出式。",
        f"対象年次は{year}年（課税対象所得・納税義務者数の両項目共通。統計でみる市区町村のすがた2026 C経済基盤・令和8年6月刊行。2026-10-12 に2025年版〔2023年の値〕から更新）。"
        "都道府県版（data/pref_1d_taxable_income.json）は統計でみる都道府県のすがた2026の2024年度で、年次がそろっている。"
        "生成時に、この原表の岐阜県行から計算した値が県版の岐阜県の値と一致すること、岐阜42市町村の合計が岐阜県行と一致することを確認した。",
        "単位は課税対象所得が百万円、納税義務者数が人。生成時に項目コード行直下の単位表記から実測し、"
        "『百万円』『人』であることをコードでassertしてから計算した（単位誤認による1/1000ズレの既知教訓・content-spec-v1.md §7.11）。",
        "比較値（comparison）は docs/similar-group-aggregation-design.md §3・§4 の集計段の定義に従う。"
        f"母集団M = 区分マスタ（総務省 類似団体別市町村財政指数表・{len(ruikei)}団体）"
        f"∩ 本ファイルに数値がある団体 = {n_total}団体。"
        "national_average は母集団Mの単純算術平均、group_average は束ね後区分ごとの単純算術平均"
        "（average_method=\"unweighted_mean\"）。",
        "束ね写像：政令指定都市・中核市・施行時特例市・特別区は『大都市』に統合。それ以外は類団区分の原ラベル"
        "（Ⅰ－０〜Ⅴ－２）をそのまま使う。原ラベルは一般市・町村の双方で再利用されているため、"
        "同一ラベルの一般市と町村は同一グループとして束ねられる（設計書§9の実データ検証で確認済みの前例に従う。"
        "本スクリプトでも岐阜市=大都市128団体／大垣市=Ⅳ－２75団体／高山市=Ⅱ－１127団体をアンカーとして自己検証している）。",
        "rank は母集団M内での値の降順順位（1=最大値）。rank(i) = 1 + #{j : value(j) > value(i)} で機械的に算出し、"
        "同値は同順位・次の順位を飛ばす方式（competition ranking）を採用。"
        "percentile = (rank_out_of − rank + 1) / rank_out_of × 100（小数第1位）。",
        "順位・百分位・平均との差は事実として出すだけで、大小の望ましさを含意しない。"
        "評価語・評価色（信号色）・複合スコアは付与していない（20260808_decisions.md D-4／D-6／D-18）。",
        "'...'（e-Stat原典の秘匿・非該当）が課税対象所得または納税義務者数にある団体は母集団Mから除外した"
        "（0に丸めていない。「確認できず」と「無」を区別する既存規律に従う）。",
        "入力は取得済みのローカルファイル（poc/recon-20261012-sugata-city2026/）のみを使用し、本ファイル生成時に再ダウンロードはしていない。"
        "統計でみる市区町村のすがた2026 の該当ファイルは拡張子.xlsxだが実体はOLE .xls形式のため xlrd で読んでいる"
        "（openpyxlでは開けない。都道府県版と同じ事情）。",
    ]

    payload = {
        "sources": sources,
        "period": f"令和{int(year) - 2018}年({year})",
        "updated": UPDATED,
        "notes": notes,
        "data": data,
    }
    print("== 書き出し ==")
    with OUT.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"  wrote {OUT.relative_to(ROOT)}  ({len(data)} records)")

    print("== 岐阜42件 一人あたり課税対象所得（万円）順（サニティチェック用） ==")
    ranked = sorted(data, key=lambda r: -r["一人あたり課税対象所得_万円"])
    for r in ranked[:3] + ranked[-3:]:
        c = r["comparison"]
        print(
            f"  {r['市区町村名']}（{r['area_code']}）: {r['一人あたり課税対象所得_万円']}万円 "
            f"全国{c['rank']}位/{c['rank_out_of']}（上位{c['percentile']}%） "
            f"区分={c['group_code']} 区分平均={c['group_average']}万円 全国平均={c['national_average']}万円"
        )


if __name__ == "__main__":
    try:
        main()
    except Abort as exc:
        print(f"\n!! 中断: {exc}", file=sys.stderr)
        sys.exit(1)
