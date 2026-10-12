# -*- coding: utf-8 -*-
"""都道府県版まちの比較値（集計段）を生成する。

入力：都道府県版の生値JSON6本（読み取りのみ。編集しない）。
出力：data/pref_comparison_*.json 6本（新規）。

設計根拠は docs/similar-group-aggregation-design.md §3（集計式・加重の扱い）・§4（出力スキーマ）。
同§8は「都道府県ページでの集計」をV2送りとしていたが、content-spec-v1.md §7.16（2026-09-03）が
県ページのV1構築を決定したことにより本件は上書き・破棄する。

母集団は各入力の47都道府県レコードのみ（N=47固定）。全国/合計行は母集団に含めず、
その値は national_official として転記するだけで平均計算には使わない。
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
GENERATED_AT = date.today().isoformat()

N = 47
NATIONAL_CODES = {"-", "00000", "00"}
AVG_DP = 2          # national_average_unweighted の丸め桁
PCT_DP = 1          # percentile の丸め桁
TOLERANCE = N * 0.5 * 10 ** -AVG_DP  # 平均×47 と合計の許容差（47×0.005＝0.235）

BASE_NOTE = ("都道府県に類似団体区分は存在しない。"
             "順位は値の大きい順であり、大小の望ましさを含意しない。")
# national_official の性質はフィールドの種類で異なる。UIが合計値を平均と誤って並べないよう
# source_note にも明示する（設計書§4：source_note は母集団と時点の注記＝正直ラベル用）。
NOTE_TOTAL = ("national_official は原資料の全国行が持つ全国合計（総数）であって平均ではない。"
              "47都道府県の平均と同じ軸で並べないこと。")
NOTE_RATIO = ("national_official は原資料の全国行が持つ公式値（国全体の実数から算出された比率）であり、"
              "47都道府県の単純平均とは一致しない。")

KIND_TOTAL = {"人口_計", "人口_男", "人口_女", "世帯数", "産業計"}

JOBS = [
    ("data/pref_1a_population.json", "data/pref_comparison_1a_population.json",
     ["人口_計", "人口_男", "人口_女", "世帯数"], "住民基本台帳の6桁"),
    ("data/pref_1b_single_household.json", "data/pref_comparison_1b_single_household.json",
     ["単身世帯割合"], "国勢調査の5桁"),
    ("data/pref_1c_aging_rate.json", "data/pref_comparison_1c_aging_rate.json",
     ["高齢化率"], "住民基本台帳の6桁"),
    ("data/pref_2a_industry.json", "data/pref_comparison_2a_industry.json",
     ["産業計", "第1次構成比", "第2次構成比", "第3次構成比"], "国勢調査の5桁"),
    ("data/pref_2b_daynight.json", "data/pref_comparison_2b_daynight.json",
     ["昼夜間人口比率"], "国勢調査の5桁"),
    ("data/pref_1d_taxable_income.json", "data/pref_comparison_1d_taxable_income.json",
     ["一人あたり課税対象所得_万円"], "SSDS（社会・人口統計体系）の2桁"),
]


class Abort(Exception):
    """母集団・アンカー・検算の破綻。JSONを書かずに止める。"""


def load(rel: str) -> tuple[list[dict], dict, str]:
    """(47都道府県レコード, 全国/合計行, 入力のperiod) を返す。入力は読むだけ。"""
    d = json.loads((ROOT / rel).read_text(encoding="utf-8"))
    rows = d["data"]
    nat = [r for r in rows if str(r["都道府県コード"]) in NATIONAL_CODES]
    pref = [r for r in rows if str(r["都道府県コード"]) not in NATIONAL_CODES]
    if len(nat) != 1:
        raise Abort(f"{rel}: 全国/合計行が {len(nat)} 件（1件ではない）")
    if len(pref) != N:
        raise Abort(f"{rel}: 都道府県レコードが {len(pref)} 件（{N}件ではない）")
    return pref, nat[0], d.get("period", "")


def ranks_desc(values: list[float]) -> list[int]:
    """降順の competition ranking（同値は同順位、次の順位を飛ばす。1,2,2,4）。"""
    return [1 + sum(1 for w in values if w > v) for v in values]


def build(src_rel: str, out_rel: str, fields: list[str], code_desc: str) -> dict:
    pref, nat, period = load(src_rel)
    print("=" * 78)
    print(f"[{out_rel}]")
    print(f"  参照元: {src_rel}  （{period}）")
    print(f"  母集団: {len(pref)}件（全国/合計行 {nat['都道府県コード']!r}={nat['都道府県名']!r} は母集団外）")

    stats, tie_report, official_gap = {}, [], []
    for f in fields:
        vals = []
        for r in pref:
            v = r.get(f)
            if not isinstance(v, (int, float)) or isinstance(v, bool):
                raise Abort(f"{src_rel}: {r['都道府県コード']} の {f} が数値でない: {v!r}")
            vals.append(v)
        total = sum(vals)
        mean_raw = total / N
        mean = round(mean_raw, AVG_DP)
        if abs(mean * N - total) > TOLERANCE + 1e-9:
            raise Abort(f"{f}: 平均×{N} と合計の差が許容 {TOLERANCE} を超える "
                        f"（平均={mean} 合計={total} 差={mean * N - total}）")
        rk = ranks_desc(vals)
        if f not in nat:
            raise Abort(f"{src_rel}: 全国/合計行が {f} を持たない")
        stats[f] = {"mean": mean, "mean_raw": mean_raw, "total": total,
                    "official": nat[f], "ranks": dict(zip([r["都道府県コード"] for r in pref], rk))}

        ties = {}
        for v, r in zip(vals, rk):
            ties.setdefault(r, []).append(v)
        dup = {r: len(v) for r, v in ties.items() if len(v) > 1}
        if dup:
            tie_report.append(f"{f}: {dup}")
        # 順位の整合（同順位を考慮した検証）
        if sorted(rk) != sorted(1 + sum(1 for w in vals if w > v) for v in vals):
            raise Abort(f"{f}: 順位の再計算が一致しない")
        if not dup and sorted(rk) != list(range(1, N + 1)):
            raise Abort(f"{f}: 同値が無いのに順位が1〜{N}の重複なし配列でない")
        if min(rk) != 1 or max(rk) > N:
            raise Abort(f"{f}: 順位の範囲が不正（min={min(rk)} max={max(rk)}）")

        kind = "合計（総数）" if f in KIND_TOTAL else "公式比率・公式値"
        diff = nat[f] - mean
        official_gap.append(f"{f}: 単純平均={mean} / 全国行={nat[f]}（{kind}）差={round(diff, 4)}")
        print(f"  {f}: 単純平均={mean}（無丸め={mean_raw!r}） 全国行={nat[f]}（{kind}） "
              f"検算 |平均×{N}−合計|={abs(mean * N - total):.6f} ≤ {TOLERANCE}")
        if dup:
            print(f"    同順位あり: {dup}")

    rows = []
    for r in pref:
        rec = {"都道府県コード": r["都道府県コード"], "都道府県名": r["都道府県名"]}
        for f in fields:
            st = stats[f]
            rank = st["ranks"][r["都道府県コード"]]
            rec[f] = {
                "value": r[f],
                "national_average_unweighted": st["mean"],
                "national_official": st["official"],
                "group_code": None,
                "group_average": None,
                "rank": rank,
                "rank_out_of": N,
                "percentile": round((N - rank + 1) / N * 100, PCT_DP),
                "average_method": "unweighted_mean",
                "source_note": BASE_NOTE + " " + (NOTE_TOTAL if f in KIND_TOTAL else NOTE_RATIO),
            }
        rows.append(rec)
    rows.sort(key=lambda r: str(r["都道府県コード"]))

    notes = [
        f"母集団は参照元 {src_rel} の47都道府県レコードのみ（N=47固定）。"
        f"全国/合計行（都道府県コード {sorted(NATIONAL_CODES)} のいずれか。本ファイルの参照元では "
        f"{nat['都道府県コード']!r}={nat['都道府県名']!r}）は母集団に含めず、平均・順位・百分位の計算に使っていない。",
        f"national_average_unweighted = 47都道府県の値の単純算術平均（小数第{AVG_DP}位で丸め）。"
        f"average_method=\"unweighted_mean\"。"
        f"docs/similar-group-aggregation-design.md §3「加重の扱い」の原則（平均は原則単純算術平均。"
        f"人口加重等はどの重みを選ぶかに価値判断が入りうるため既定にしない）に従う。",
        "national_official は参照元の全国/合計行の同名フィールドを**そのまま転記**したもので、本ファイルでは"
        "算出していない。これは average_method=\"official\" に相当する値を別フィールドで保持したものであり、"
        "national_average_unweighted と同一の量ではない。混同しないこと。実測の差は次のとおり： "
        + "／".join(official_gap) + "。",
        "national_official の性質はフィールドにより異なる。実数系（"
        + "・".join(f for f in fields if f in KIND_TOTAL) + "）は**全国合計（総数）であって平均ではない**ため、"
        "47都道府県の平均と同じ軸に並べてはならない。率・比率系（"
        + "・".join(f for f in fields if f not in KIND_TOTAL) + "）は国全体の実数から算出された公式値であり、"
        "47都道府県の単純平均とは一致しない（分母が都道府県ごとに異なるため）。"
        "同じ区別を各フィールドの source_note にも書いてある。"
        if any(f in KIND_TOTAL for f in fields) and any(f not in KIND_TOTAL for f in fields) else
        ("national_official は参照元の全国/合計行の値で、"
         + ("**全国合計（総数）であって平均ではない**。47都道府県の平均と同じ軸に並べてはならない。"
            if fields[0] in KIND_TOTAL else
            "国全体の実数から算出された公式比率である。47都道府県の単純平均とは一致しない"
            "（分母が都道府県ごとに異なるため）。")
         + "同じ内容を各フィールドの source_note にも書いてある。"),
        f"rank は47都道府県内での値の降順順位（1=最大値）。rank(i) = 1 + #{{j : value(j) > value(i)}} で機械的に"
        f"算出しており、**同値は同順位とし、次の順位をその分だけ飛ばす**方式（competition ranking。"
        f"例 1,2,2,4）を採用した。本ファイルでの同順位の発生： "
        + ("なし（全フィールドで順位は1〜47の重複なし）" if not tie_report else "／".join(tie_report)) + "。",
        f"percentile = (rank_out_of − rank + 1) / rank_out_of × 100 = ({N} − rank + 1) / {N} × 100"
        f"（小数第{PCT_DP}位で丸め）。1位={round(100 / N * N, PCT_DP)}、47位={round(1 / N * 100, PCT_DP)}。"
        f"同順位の都道府県は同じ percentile を持つ。",
        "group_code・group_average は全フィールドで null。都道府県には類似団体区分が存在しないため"
        "（区分マスタ ruikei_kubun_r06 は市町村1741団体のみを収録し、都道府県を持たない）。"
        "値が未収集・未算出なのではなく、概念そのものが無いことによる null である。",
        "順位・百分位は事実として出すだけで、大小の望ましさを含意しない。"
        "評価語・評価色（信号色）・複合スコアは付与していない"
        "（docs/20260808_decisions.md D-4／D-6 ランキング非生成／D-18、および設計書§6）。",
        f"都道府県コードは参照元の体系（{code_desc}）をそのまま使っている。"
        "都道府県版の指標JSONはコード体系が3系統に分かれる（住基6桁＝例 210005／国勢5桁＝例 21000／"
        "SSDS2桁＝例 21）。比較値ファイル同士・生値ファイル同士をコードで結合する際は桁を揃える必要がある。",
        f"検算：national_average_unweighted × 47 と47都道府県値の合計の差が、丸め許容範囲 "
        f"47 × 0.5 × 10^-{AVG_DP} = {TOLERANCE:g} 以内であることを全フィールドで生成時に検証済み"
        f"（平均を小数第{AVG_DP}位に丸めているため厳密一致はしない）。",
        f"value は参照元の値をそのまま転記しており、本ファイルで再丸め・単位換算はしていない。"
        f"参照元の時点は「{period}」。参照元 {src_rel} は本作業で編集していない。",
        "設計根拠は docs/similar-group-aggregation-design.md §3（集計式）・§4（出力スキーマ）。"
        "同§8は「都道府県ページでの集計」をV2送りとしていたが、content-spec-v1.md §7.16（2026-09-03）が"
        "県ページのV1構築を決定したことにより、その V2送り記述は上書き・破棄されている。"
        "また設計書§4の population_basis（一人あたり系の分母時点）は本ファイルでは使用していない"
        "（参照元が既に算出済みの値を転記しているため）。",
    ]

    payload = {
        "source_data_file": src_rel,
        "generated_at": GENERATED_AT,
        "fields": fields,
        "notes": notes,
        "data": rows,
    }
    out = ROOT / out_rel
    with out.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"  wrote {out_rel}  ({len(rows)} records / {len(fields)} fields)")
    return {"out": out_rel, "src": src_rel, "fields": fields, "rows": rows, "stats": stats}


def main() -> None:
    built = [build(*job) for job in JOBS]

    print("=" * 78)
    print("[アンカー自己検証]")
    ok = True
    for b in built:
        raw = {r["都道府県コード"]: r for r in json.loads((ROOT / b["src"]).read_text(encoding="utf-8"))["data"]}
        gifu = next((r for r in b["rows"] if r["都道府県名"] == "岐阜県"), None)
        if gifu is None:
            raise Abort(f"{b['out']}: 岐阜県のレコードが無い")
        for f in b["fields"]:
            got, want = gifu[f]["value"], raw[gifu["都道府県コード"]][f]
            hit = got == want
            ok = ok and hit
            print(f"  {'OK ' if hit else 'NG '} {b['out']} 岐阜県 {f}.value: 実測={got} 生値={want}")
        if len(b["rows"]) != N:
            raise Abort(f"{b['out']}: {len(b['rows'])}件（{N}件ではない）")
        codes = [r["都道府県コード"] for r in b["rows"]]
        if len(set(codes)) != N:
            raise Abort(f"{b['out']}: 都道府県コードに重複がある")
        for f in b["fields"]:
            rk = sorted(r[f]["rank"] for r in b["rows"])
            uniq = rk == list(range(1, N + 1))
            print(f"      rank検証 {f}: min={rk[0]} max={rk[-1]} 件数={len(rk)} "
                  f"1〜{N}の重複なし={'はい' if uniq else 'いいえ（同順位あり）'}")
    if not ok:
        raise Abort("岐阜県のvalueが生値と一致しない。")

    print("[報告：岐阜県の実測値]")
    for b in built:
        gifu = next(r for r in b["rows"] if r["都道府県名"] == "岐阜県")
        print(f"  {b['out']}  （{gifu['都道府県コード']} 岐阜県 / {len(b['rows'])}件）")
        for f in b["fields"]:
            c = gifu[f]
            print(f"    {f}: value={c['value']} "
                  f"national_average_unweighted={c['national_average_unweighted']} "
                  f"national_official={c['national_official']} "
                  f"rank={c['rank']}/{c['rank_out_of']} percentile={c['percentile']}")


if __name__ == "__main__":
    try:
        main()
    except Abort as exc:
        print(f"\n!! 中断: {exc}", file=sys.stderr)
        sys.exit(1)
