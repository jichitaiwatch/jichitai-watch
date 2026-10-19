"""政令指定都市の区の「相当順位」つき comparison を作る共通部品（D-24 試作・名古屋市16区。運営者裁定 2026-10-17）。

区は全国1,741市区町村（類似団体区分マスタ）に含まれない。そこで、市区町村と同じ式で、
  順位（相当順位）= 母集団M（1,741団体）の中で、区の値より大きい値の団体数 + 1（降順 competition ranking）
  rank_out_of     = 母集団Mの団体数（区を足さない。区同士の順位も作らない）
  百分位          = (rank_out_of − 順位 + 1) / rank_out_of × 100（小数第1位）
  全国平均        = 母集団Mの単純算術平均（市区町村と同じ値）
  類似団体平均    = 親の市（名古屋市）の束ね後区分（大都市）の単純算術平均
を出す。市区町村の build_comparison と同じ値の定義（呼び出し側が母集団の値を渡す）。
"""
from __future__ import annotations

def ward_note(n: int, group: str) -> str:
    return (
        f"区は全国{n:,}市区町村に含まれないため、順位は区の値を{n:,}団体の値と並べたときの位置"
        f"（区の値より大きい値の団体数+1）。類似団体平均は親の市の区分（{group}）の単純算術平均。"
        "順位は値の大きい順であり、大小の望ましさを含意しない。"
    )


def ward_comparison(
    ruikei: dict, value_by_code6: dict[str, float], ward_value: float, parent_code6: str, digits: int = 1
) -> dict:
    """ruikei: {code6: {"group_code":…}}（区分マスタ）。value_by_code6: 母集団の値（区の行を含んでいてもよい。ruikei にある団体だけ使う）。"""
    pop = {c: (m["group_code"], value_by_code6[c]) for c, m in ruikei.items() if c in value_by_code6}
    n = len(pop)
    vals = [v for _, v in pop.values()]
    parent = ruikei.get(parent_code6)
    if parent is None:
        raise ValueError(f"親の市 {parent_code6} が区分マスタに無い")
    g = parent["group_code"]
    gv = [v for gc, v in pop.values() if gc == g]
    rank = 1 + sum(1 for v in vals if v > ward_value)
    return {
        "value": ward_value,
        "national_average": round(sum(vals) / n, digits),
        "group_code": g,
        "group_average": round(sum(gv) / len(gv), digits),
        "rank": rank,
        "rank_out_of": n,
        "percentile": round((n - rank + 1) / n * 100, 1),
        "average_method": "unweighted_mean",
        "is_ward": True,
        "source_note": ward_note(n, g),
    }
