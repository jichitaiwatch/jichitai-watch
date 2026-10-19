# -*- coding: utf-8 -*-
"""まちのすがた「人口・世帯数」市区町村版JSONに全国順位・類似団体比較(comparison)を追加する。

対象（docs/content-spec-v1.md §7.2 / docs/similar-group-aggregation-design.md）:
  1-1a 人口・世帯数（岐阜42市区町村・比較値=全国平均・類似団体平均・全国順位・百分位つき）
  content-spec-v1.md §7.2 の定義：1-1a の主比較は「比較=全国」。ただし2026-09-27運営者裁定により、
  既存実装（1-2b昼夜間人口比率・1-2c課税対象所得）と揃え「全国順位＋類似団体平均」の形で提示する。
  対象は「人口_計」（総人口）と「世帯数」の2指標（人口_男/女はカード非表示のため対象外）。

入力（取得済みローカルファイルのみ。ネットワークアクセスをしない）:
  poc/recon-20261012-juki-r8/soumu_000892952_juki_shichoson_pop_hh_r8.xlsx
    （総務省ファイルID 000892952・令和8年1月1日時点。既存 data/m1_1a_population_timeseries.json の
    r8_2026 生値と同一の全国集約ファイル。2026-10-12取得）
  poc/recon-20260828/0/ruikei_kubun_r06.xlsx（類似団体区分マスタ・市町村一覧シート・1741団体）

更新（既存ファイルを書き換え・新規ファイルは作らない）:
  data/m1_1a_population_timeseries.json の各レコード（42件）の r8_2026 に comparison フィールド
  （人口_計・世帯数の2キー）を追加する。r2_2020〜r7_2025（過去年）へは追加しない
  （全国母集団ファイルは最新の令和8年時点のみ取得済みのため。r7_2025 に付いていた旧 comparison は取り除く）。

集計（docs/similar-group-aggregation-design.md §3・§4・§9・§10。m1_2b_daynight_comparison.py と
  同一の実装パターン。住基は6桁団体コードのため区分マスタと桁数変換なしで直接結合できる §10）:
  母集団M = 区分マスタに載る団体（1741）∩ 全国集約ファイルに値がある団体。
  束ね写像：政令指定都市・中核市・施行時特例市・特別区 → "大都市"。他は類団区分の生ラベルをそのまま使う。
  順位：降順 competition ranking（同値は同順位、次の順位を飛ばす）。値が大きいほど上位＝優劣評価ではない。
  percentile = (rank_out_of − rank + 1) / rank_out_of × 100（小数第1位）。
  average_method = "unweighted_mean"（単純算術平均。人口加重等はしない）。

規律:
  - 列位置はハードコードせず、ヘッダのラベル文字列（団体コード・男・女・計・世帯数）から同定し自己検証する。
  - 表題（住民基本台帳・人口・世帯数・令和8年）をコードでassertしてから使う（推測しない）。
  - 評価語・評価色・複合スコアは付けない（中立性・D-4/D-6/D-18）。
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from pref_args import load_master_cities, out_path, parse_pref  # noqa: E402
from ward_compare import ward_comparison  # noqa: E402

PREF = parse_pref(sys.argv[1:])  # --pref 23 など（D-24 の試作）。既定21＝岐阜
CITIES = load_master_cities(PREF)

POP_SRC = ROOT / "poc" / "recon-20261012-juki-r8" / "soumu_000892952_juki_shichoson_pop_hh_r8.xlsx"
KEY = "r8_2026"  # 比較値を付与する時点キー（令和8年1月1日）
PREV_KEY = "r7_2025"  # 前回まで比較値を付けていた時点（再実行時に取り除く）
RUIKEI_SRC = ROOT / "poc" / "recon-20260828" / "0" / "ruikei_kubun_r06.xlsx"
OUT = out_path("m1_1a_population_timeseries", PREF)

UPDATED = date.today().isoformat()

DAITOSHI_KUBUN = {1, 2, 8, 9}  # 政令指定都市・特別区・中核市・施行時特例市 → "大都市"

# §9実データ検証（similar-group-aggregation-design.md）の岐阜実測アンカー。
# 区分マスタのみに依存する束ね後区分・団体数のため指標に依らず共通（m1_2b/m1_2c と同一）。
ANCHOR = {
    "gifu_shi_group": "大都市",
    "gifu_shi_group_n": 128,
    "ogaki_shi_group": "Ⅳ－２",
    "ogaki_shi_group_n": 75,
    "takayama_shi_group": "Ⅱ－１",
    "takayama_shi_group_n": 127,
}

# 令和7年版にあった岐阜市の固定アンカー（全国平均71413／類団平均508134／順位54）は令和7年値固有のため、
# 令和8年版では使わない。代わりに「母集団Mの件数」「全国平均が母集団の合計/件数と一致」「岐阜市の順位が
# 値の降順で独立に再計算した順位と一致」を内部整合として検証する（下の main 内）。


class Abort(Exception):
    """欠損・単位不一致・アンカー不一致などで処理を止めるための例外。推測で続行しない。"""


def s(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def cell(row: tuple, c: int):
    if row is None or c < 0 or c >= len(row):
        return None
    return row[c]


# --------------------------------------------------------------------------------------
# 区分マスタ（類似団体区分）※m1_2b_daynight_comparison.py と同一実装
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
        if s(row[0] if row else None) == "団体コード":
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
# 全国人口・世帯数（住基「人口、世帯数、人口動態（市区町村別）【総計】」）
# --------------------------------------------------------------------------------------
def resolve_population_columns(ws):
    """(団体コード列, 男列, 女列, 計列, 世帯数列, データ開始行) を返す。列位置は自己同定する。"""
    header_rows = list(ws.iter_rows(min_row=1, max_row=8, values_only=True))

    code_row_idx = None
    for i, row in enumerate(header_rows):
        if s(cell(row, 0)) == "団体コード" and s(cell(row, 1)) == "都道府県名" and s(cell(row, 2)) == "市区町村名":
            code_row_idx = i
            break
    if code_row_idx is None:
        raise Abort("population: ヘッダ行（団体コード/都道府県名/市区町村名）が見つからない")

    if code_row_idx < 2:
        raise Abort("population: ヘッダ行の上に category行・field行が無い（想定した表構造と異なる）")
    field_row = header_rows[code_row_idx - 1]  # 男/女/計/世帯数
    category_row = header_rows[code_row_idx - 2]  # 人口/人口/人口/世帯数

    def col_of(label: str, row):
        for c, v in enumerate(row):
            if s(v) == label:
                return c
        return None

    male_col = col_of("男", field_row)
    female_col = col_of("女", field_row)
    total_col = col_of("計", field_row)
    household_col = col_of("世帯数", field_row)
    if None in (male_col, female_col, total_col, household_col):
        raise Abort(
            f"population: 男/女/計/世帯数の列が見つからない "
            f"male={male_col} female={female_col} total={total_col} household={household_col}"
        )
    # category行との整合確認（男/女/計は「人口」区分・世帯数列は「世帯数」区分）
    if not (s(cell(category_row, male_col)) == "人口" and s(cell(category_row, female_col)) == "人口"
            and s(cell(category_row, total_col)) == "人口" and s(cell(category_row, household_col)) == "世帯数"):
        raise Abort("population: category行（人口/世帯数）とfield行の列対応が一致しない")

    title_texts = " ".join(s(v) for row in header_rows[:1] for v in row if v)
    if "住民基本台帳" not in title_texts or "人口" not in title_texts or "世帯数" not in title_texts or "令和8年" not in title_texts:
        raise Abort(f"population: 表題に想定語を確認できない（実測={title_texts!r}）。推測で続行しない。")
    print(f"  [population] 表題確認: {title_texts[:60]}...")

    data_start = code_row_idx + 1
    return 0, male_col, female_col, total_col, household_col, data_start


def load_population_by_code6() -> dict[str, dict]:
    from openpyxl import load_workbook

    wb = load_workbook(POP_SRC, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    code_col, male_col, female_col, total_col, household_col, data_start = resolve_population_columns(ws)
    print(
        f"  [population] 列: 団体コード列=c{code_col + 1} 男列=c{male_col + 1} 女列=c{female_col + 1} "
        f"計列=c{total_col + 1} 世帯数列=c{household_col + 1} データ開始行=r{data_start + 1}"
    )

    out: dict[str, dict] = {}
    n_scanned = 0
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < data_start:
            continue
        code = s(cell(row, code_col))
        if not re.fullmatch(r"\d{6}", code):
            continue  # 合計行('-')・都道府県小計行・末尾の注記行を除く
        n_scanned += 1
        total_v = cell(row, total_col)
        household_v = cell(row, household_col)
        if not isinstance(total_v, (int, float)) or isinstance(total_v, bool):
            continue  # '-' 等の非該当値
        if not isinstance(household_v, (int, float)) or isinstance(household_v, bool):
            continue
        if code in out:
            raise Abort(f"population: コード{code}が重複している")
        out[code] = {"人口_計": float(total_v), "世帯数": float(household_v)}
    print(f"  [population] 市区町村{n_scanned}行走査・有効値{len(out)}件抽出")
    return out


# --------------------------------------------------------------------------------------
# 集計
# --------------------------------------------------------------------------------------
def ranks_desc(values: list[float]) -> list[int]:
    """降順の competition ranking（同値は同順位、次の順位を飛ばす。1,2,2,4）。"""
    return [1 + sum(1 for w in values if w > v) for v in values]


def build_comparison_for_field(field: str, ruikei: dict, pop_by_code6: dict) -> tuple[dict[str, dict], dict[str, int]]:
    """指定フィールド（人口_計 or 世帯数）について、母集団Mを構築し comparison を算出する。
    戻り値: (code6 -> comparison dict, group_code -> group_n) のタプル。
    """
    population: dict[str, dict] = {}
    for code6, meta in ruikei.items():
        v = pop_by_code6.get(code6)
        if v is None:
            continue
        population[code6] = {"value": v[field], "group_code": meta["group_code"]}

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

    out: dict[str, dict] = {}
    for c in codes:
        p = population[c]
        rank = ranks[c]
        pct = round((n_total - rank + 1) / n_total * 100, 1)
        out[c] = {
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
                "順位は値の大きい順であり、大小の望ましさを含意しない。"
            ),
        }
    return out, group_n


def main():
    for p in (POP_SRC, RUIKEI_SRC, OUT):
        if not p.exists():
            raise Abort(f"入力ファイルが無い: {p}")

    print("== 既存JSON読み込み ==")
    payload = json.loads(OUT.read_text(encoding="utf-8"))
    existing = payload["data"]
    if len(existing) != len(CITIES):
        raise Abort(f"既存JSONのレコード数が{len(CITIES)}（自治体マスタ）ではない（実測={len(existing)}）")

    print("== 区分マスタ読み込み ==")
    ruikei = load_ruikei_master()

    print("== 全国人口・世帯数ファイル読み込み ==")
    pop_by_code6 = load_population_by_code6()

    print("== 母集団Mの構築・集計（人口_計・世帯数の2指標） ==")
    comp_population, group_n = build_comparison_for_field("人口_計", ruikei, pop_by_code6)
    comp_household, group_n_h = build_comparison_for_field("世帯数", ruikei, pop_by_code6)

    print("== アンカー自己検証（§9実データ検証・2026-08-29の区分構成に基づく） ==")

    def check(label, got, want):
        ok = got == want
        print(f"    {'OK ' if ok else 'NG '} {label}: 実測={got!r} 期待={want!r}")
        return ok

    gifu_shi_meta = ruikei.get("212016")
    ogaki_shi_meta = ruikei.get("212024")
    takayama_shi_meta = ruikei.get("212032")
    if not (gifu_shi_meta and ogaki_shi_meta and takayama_shi_meta):
        raise Abort("岐阜市/大垣市/高山市のいずれかが区分マスタに無い")
    results = [
        check("岐阜市 束ね後区分", gifu_shi_meta["group_code"], ANCHOR["gifu_shi_group"]),
        check("岐阜市 束ね後区分の団体数", group_n[gifu_shi_meta["group_code"]], ANCHOR["gifu_shi_group_n"]),
        check("大垣市 束ね後区分", ogaki_shi_meta["group_code"], ANCHOR["ogaki_shi_group"]),
        check("大垣市 束ね後区分の団体数", group_n[ogaki_shi_meta["group_code"]], ANCHOR["ogaki_shi_group_n"]),
        check("高山市 束ね後区分", takayama_shi_meta["group_code"], ANCHOR["takayama_shi_group"]),
        check("高山市 束ね後区分の団体数", group_n[takayama_shi_meta["group_code"]], ANCHOR["takayama_shi_group_n"]),
    ]
    if not all(results):
        raise Abort("区分アンカー値が一致しない。JSONを書かずに中断した。")

    print("== 内部整合検証（令和8年版：固定アンカーに依らず独立再計算で照合） ==")
    gifu_pop = comp_population["212016"]
    vals = sorted((v["人口_計"] for v in pop_by_code6.values() if v is not None and "人口_計" in v), reverse=True)
    n_m = len([c for c in ruikei if c in pop_by_code6])
    independent_rank = 1 + sum(1 for c in ruikei if c in pop_by_code6 and pop_by_code6[c]["人口_計"] > gifu_pop["value"])
    independent_avg = round(sum(pop_by_code6[c]["人口_計"] for c in ruikei if c in pop_by_code6) / n_m, 1)
    pop_checks = [
        n_m == 1741,
        gifu_pop["rank_out_of"] == n_m,
        gifu_pop["rank"] == independent_rank,
        abs(gifu_pop["national_average"] - independent_avg) < 1e-6,
    ]
    print(
        f"    母集団M={n_m}件（期待1741） 岐阜市: 全国平均={gifu_pop['national_average']}（独立再計算={independent_avg}） "
        f"全国順位={gifu_pop['rank']}（独立再計算={independent_rank}） 類団平均={gifu_pop['group_average']}"
    )
    if not all(pop_checks):
        raise Abort("内部整合が一致しない。JSONを書かずに中断した。")

    print(f"== 既存{len(existing)}件との整合確認 ==")
    gifu_codes_pop = sorted(c for c in comp_population if c in CITIES)
    if set(gifu_codes_pop) != set(CITIES):
        raise Abort(f"母集団Mの県内が{len(gifu_codes_pop)}件（自治体マスタ{len(CITIES)}件と一致しない・人口_計）")

    by_area_code = {r["area_code"]: r for r in existing}
    if set(by_area_code.keys()) != set(gifu_codes_pop):
        raise Abort("既存JSONのarea_codeと母集団Mの県内のキー集合が一致しない。JSONを書かずに中断した。")

    print("== 既存レコードのr8_2026へ comparison を付与（生値の再抽出一致も併せて検証） ==")
    for rec in existing:
        code6 = rec["area_code"]
        r7 = rec[KEY]
        rec[PREV_KEY].pop("comparison", None)  # 旧時点に付いていた比較値は取り除く
        cp = comp_population[code6]
        ch = comp_household[code6]
        if abs(r7["人口_計"] - cp["value"]) > 1e-6:
            raise Abort(
                f"{rec['市区町村名']}（{code6}）: 既存r8_2026人口_計{r7['人口_計']}と全国ファイルからの再抽出値"
                f"{cp['value']}が不一致。JSONを書かずに中断した。"
            )
        if abs(r7["世帯数"] - ch["value"]) > 1e-6:
            raise Abort(
                f"{rec['市区町村名']}（{code6}）: 既存r8_2026世帯数{r7['世帯数']}と全国ファイルからの再抽出値"
                f"{ch['value']}が不一致。JSONを書かずに中断した。"
            )
        r7["comparison"] = {"人口_計": cp, "世帯数": ch}

    # 政令市の区（試作のみ）：区の値を母集団Mに当てはめた相当順位・親の市の区分の平均
    for w in payload.get("wards", []):
        wr = w[KEY]
        w[PREV_KEY].pop("comparison", None)
        wr["comparison"] = {
            f: ward_comparison(ruikei, {c: v[f] for c, v in pop_by_code6.items()}, wr[f], w["parent_area_code"])
            for f in ("人口_計", "世帯数")
        }
    if payload.get("wards"):
        print(f"  区{len(payload['wards'])}件に相当順位つきcomparisonを付与")

    payload["updated"] = UPDATED
    payload.setdefault("notes", [])
    comparison_note_prefix = "comparison（全国平均・類似団体平均・全国順位・百分位）は"
    payload["notes"] = [n for n in payload["notes"] if not n.startswith(comparison_note_prefix)]
    payload["notes"].append(
        "comparison（全国平均・類似団体平均・全国順位・百分位）は2026-09-28追加（F-5）・2026-10-12に令和8年版へ更新。r8_2026のみに付与"
        "（全国母集団ファイルは令和8年時点のみ取得済みのため、過去年r2_2020〜r7_2025へは付与しない。令和8年版への更新に伴い旧r7_2025の比較値は取り除いた）。"
        "docs/similar-group-aggregation-design.md §3・§4の集計段の定義に従う。"
        f"母集団M = 区分マスタ（総務省 類似団体別市町村財政指数表・{len(ruikei)}団体）"
        "∩ 全国集約ファイル（本ファイルsourcesのr8_2026と同一の総務省ファイルID000892952）に数値がある団体。"
        "national_average は母集団Mの単純算術平均、group_average は束ね後区分ごとの単純算術平均"
        "（average_method=\"unweighted_mean\"）。束ね写像：政令指定都市・中核市・施行時特例市・特別区は『大都市』"
        "に統合。それ以外は類団区分の原ラベルをそのまま使う。"
        "content-spec-v1.md §7.2の定義上の主比較は「比較=全国」だが、2026-09-27運営者裁定により"
        "既存実装（1-2b・1-2c）と揃え「全国順位＋類似団体平均」の形で提示する。対象は人口_計・世帯数の2指標"
        "（人口_男/女はカード非表示のため対象外）。"
        "rank は母集団M内での値の降順順位（1=最大値。同値は同順位・次の順位を飛ばすcompetition ranking。"
        "値が大きいほど上位＝優劣評価ではない）。"
        "percentile = (rank_out_of − rank + 1) / rank_out_of × 100（小数第1位）。"
        "評価語・評価色・複合スコアは付与していない（20260808_decisions.md D-4／D-6／D-18）。"
    )

    print("== 書き出し ==")
    with OUT.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"  wrote {OUT.relative_to(ROOT)}  ({len(existing)}件のr8_2026にcomparison付与)")

    print(f"== 県コード{PREF}の{len(existing)}件 人口_計順（サニティチェック用） ==")
    ranked = sorted(existing, key=lambda r: -r[KEY]["comparison"]["人口_計"]["value"])
    for r in ranked[:3] + ranked[-3:]:
        c = r[KEY]["comparison"]["人口_計"]
        print(
            f"  {r['市区町村名']}（{r['area_code']}）: {int(c['value'])}人 "
            f"全国{c['rank']}位/{c['rank_out_of']}（上位{c['percentile']}%） "
            f"区分={c['group_code']} 区分平均={c['group_average']} 全国平均={c['national_average']}"
        )


if __name__ == "__main__":
    try:
        main()
    except Abort as exc:
        print(f"\n!! 中断: {exc}", file=sys.stderr)
        sys.exit(1)
