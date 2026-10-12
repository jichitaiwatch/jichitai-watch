# -*- coding: utf-8 -*-
"""まちのすがた #1「人口・男女数・世帯数」の都道府県版 生値JSON（単年）を生成する。

入力（取得済みローカル1本のみ・新規ダウンロードなし）:
  statInfId=000040306651 表25-01【総計】都道府県別人口、人口動態及び世帯数（令和7年1月1日）
  handoff/pref-machi-verify/2501stjin.xlsx / シート「人口、世帯数、人口動態（都道府県別）【総計】」

出力（新規1本。既存JSONは読まない・書き換えない）:
  data/pref_1a_population.json （47都道府県＋合計行・系譜 source_file_hash_sha256）

使用列は c1〜c6 相当（団体コード／都道府県名／人口 男・女・計／世帯数）のみ。
c7以降の人口動態（令和6年計上）は本タスクでは使用しない。
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "handoff" / "pref-machi-verify" / "2501stjin.xlsx"
OUT = ROOT / "data" / "pref_1a_population.json"

UPDATED = date.today().isoformat()
PERIOD = "令和7年1月1日時点（住民基本台帳）"

STAT_INF_ID = "000040306651"
STAT_NAME = "住民基本台帳に基づく人口、人口動態及び世帯数調査"
SOURCE_URL = f"https://www.e-stat.go.jp/stat-search/file-download?statInfId={STAT_INF_ID}&fileKind=0"
SOURCE_PAGE = (
    "https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&toukei=00200241"
    "&tstat=000001039591&cycle=7&year=20250&month=0&tclass1=000001039601"
)
# recon/pref-machi-existence-20260904.md §3 の取得記録（bytes 32,051 / sha256）
FETCHED_AT = "2026-09-04"
RECON_SHA256 = "30b61d52fcac0057cd41d6b1715271db65d3b8f88aa9a33ac9d45344d73adfba"

ANCHORS = {
    "gifu": {"code": "210005", "人口_計": 1951292},
    "total": {"人口_男": 60663248, "人口_女": 63667433, "人口_計": 124330690, "世帯数": 61287994},
}


class Abort(Exception):
    """アンカー不一致・構造不一致で処理を止めるための例外。推測で続行しない。"""


def s(v) -> str:
    return "" if v is None else str(v).strip()


def num(v, where: str) -> int:
    t = s(v).replace(",", "")
    if not re.fullmatch(r"-?\d+", t):
        raise Abort(f"数値でないセル（0に丸めず中断）: {where} 値={s(v)!r}")
    return int(t)


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def cols_with(label_rows, target: str) -> set[int]:
    got = set()
    for vals in label_rows:
        for c, v in enumerate(vals, start=1):
            if v == target:
                got.add(c)
    return got


def only(cands: set[int], what: str) -> int:
    if len(cands) != 1:
        raise Abort(f"{what}: 列を1つに確定できない（候補={sorted(cands)}）")
    return next(iter(cands))


def resolve(ws):
    """(キー列行, キー列マップ, 使用列マップ, 表題) を返す。列番号は決め打ちしない。"""
    label_rows = []
    title = None
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=20, values_only=True), start=1):
        vals = [s(v) for v in row]
        if title is None and vals and "住民基本台帳" in vals[0]:
            title = vals[0]
        if vals and vals[0] == "団体コード":
            keycols = {v: c for c, v in enumerate(vals, start=1) if v in ("団体コード", "都道府県名")}
            for lab in ("団体コード", "都道府県名"):
                if lab not in keycols:
                    raise Abort(f"キー列 {lab!r} がヘッダに無い")
            # 人口の男/女/計は「グループ見出し='人口'」との積で確定する（動態側の '計（Ａ）' 等と混ざらないため）
            pop = cols_with(label_rows, "人口")
            use = {
                "人口_男": only(pop & cols_with(label_rows, "男"), "人口(男)列"),
                "人口_女": only(pop & cols_with(label_rows, "女"), "人口(女)列"),
                "人口_計": only(pop & cols_with(label_rows, "計"), "人口(計)列"),
                "世帯数": only(cols_with(label_rows, "世帯数"), "世帯数列"),
            }
            # 単位行での裏取り（人口列=人、世帯数列=世帯）
            units = {c: v for c, v in enumerate(vals, start=1)}
            for k in ("人口_男", "人口_女", "人口_計"):
                if units.get(use[k]) != "人":
                    raise Abort(f"{k} の単位が『人』でない: c{use[k]}={units.get(use[k])!r}")
            if units.get(use["世帯数"]) != "世帯":
                raise Abort(f"世帯数の単位が『世帯』でない: c{use['世帯数']}={units.get(use['世帯数'])!r}")
            if title is None:
                raise Abort("表題行が見つからない")
            return i, keycols, use, title
        label_rows.append(vals)
    raise Abort("キー列行（1列目='団体コード'）が見つからない")


def main():
    if not SRC.exists():
        raise Abort(f"入力ファイルが無い: {SRC}")

    wb = load_workbook(SRC, read_only=True, data_only=True)
    sheet = wb.sheetnames[0]
    ws = wb[sheet]
    key_idx, keycols, use, title = resolve(ws)
    c_code, c_name = keycols["団体コード"], keycols["都道府県名"]
    max_col = max(use.values())

    print("== 抽出 ==")
    print(f"  シート: {sheet}")
    print(f"  表題  : {title}")
    print(f"  キー列行={key_idx} / 団体コード=c{c_code} 都道府県名=c{c_name}")
    print("  使用列: " + " ".join(f"{k}=c{v}" for k, v in use.items()))

    prefs, totals, skipped = [], [], []
    for row in ws.iter_rows(min_row=key_idx + 1, values_only=True):
        v = [s(x) for x in row]
        if not any(v):
            continue
        code, name = v[0] if len(v) > c_code - 1 else "", v[1] if len(v) > c_name - 1 else ""
        is_total = code == "-" and name == "合計"
        is_pref = len(code) == 6 and code[2:5] == "000"
        if not (is_total or is_pref):
            skipped.append(code[:40])  # 末尾の注記行など
            continue
        if len(v) < max_col:
            raise Abort(f"列数が足りない行: {code}_{name}")
        rec = {"code": code, "name": name}
        for k, c in use.items():
            rec[k] = num(v[c - 1], f"{code}_{name} {k}")
        (totals if is_total else prefs).append(rec)
    wb.close()

    print(f"  都道府県行={len(prefs)} 合計行={len(totals)} 対象外として除外した行={len(skipped)}")
    for x in skipped:
        print(f"    除外: {x!r}")
    if len(prefs) != 47:
        raise Abort(f"都道府県行が {len(prefs)} 件（47件ではない）")
    if len(totals) != 1:
        raise Abort(f"合計行が {len(totals)} 件（1件ではない）")
    rows = sorted([*totals, *prefs], key=lambda r: r["code"])
    if len(rows) != 48:
        raise Abort(f"合計 {len(rows)} 件（48件ではない）")

    print("== アンカー自己検証 ==")
    gifu = next((r for r in prefs if r["code"] == ANCHORS["gifu"]["code"]), None)
    if gifu is None:
        raise Abort("岐阜県行(210005)が見つからない")
    tot = totals[0]
    checks = [("岐阜県(210005) 人口_計", gifu["人口_計"], ANCHORS["gifu"]["人口_計"])]
    for k, want in ANCHORS["total"].items():
        checks.append((f"合計 {k}", tot[k], want))
    ok = True
    for label, got, want in checks:
        hit = got == want
        ok = ok and hit
        print(f"    {'OK ' if hit else 'NG '} {label}: 実測={got} 期待={want}")
    if not ok:
        raise Abort("アンカー値が一致しない。JSONを書かずに中断した。")

    file_hash = sha256_of(SRC)
    if file_hash != RECON_SHA256:
        raise Abort(f"入力のsha256がrecon記録と不一致\n  実測={file_hash}\n  記録={RECON_SHA256}")
    print("    OK  入力sha256が recon/pref-machi-existence-20260904.md §3 の記録と一致")

    # 原資料 注2 の影響：男＋女≠計 になる行を全件洗い出す（合算で計を作らないことの根拠）
    gaps = [(r["code"], r["name"], r["人口_計"] - (r["人口_男"] + r["人口_女"])) for r in rows]
    nonzero = [g for g in gaps if g[2] != 0]
    print(f"  男＋女＝計 が成立しない行 {len(nonzero)}/{len(rows)} 件（原資料 注2 による）:")
    for code, name, d in nonzero:
        print(f"    {code} {name}: 計 −(男+女) = {d}")

    notes = [
        "本ファイルは令和7年1月1日の単年のみを収録する。§7.11によれば1-1a情報カード本体は令和7.1.1単年で足り、"
        "5年時系列が必要なのは入口サマリー0-1の『5年間の増減人数』・経年画面であって、そちらは市区町村版"
        "（data/m1_1a_population_timeseries.json・令和2〜令和7の6時点）で既に対応済みのため、都道府県版は単年とした。",
        "合計行は原表のまま 団体コード=\"-\"・都道府県名=\"合計\" で格納した（住基6桁体系に全国コードは存在しないため、"
        "コードを捏造していない）。国勢調査系JSON（data/pref_2a_industry.json 等）の \"00000_全国\" とは別体系であり、"
        "コード結合時に混同しないこと。合計行は後段の全国比較用に同梱したものであり、都道府県の1件として数えない。",
        "団体コードは住民基本台帳の6桁で、都道府県は NN000X 形式（チェックデジット付き。例 210005=岐阜県、010006=北海道）。"
        "3〜5桁目が000であることで都道府県行を判別している（末尾3桁は000にならない）。"
        "data/m1_1a_population_timeseries.json・data/pref_1c_aging_rate.json と同一体系で結合できる。"
        "国勢調査系JSON（5桁。例 21000=岐阜県）とは別体系であり、先頭5桁での読み替えが必要。",
        "人口_計は原資料の『人口 計』列をそのまま格納しており、人口_男＋人口_女 の合算ではない。"
        "原資料 注2「外国人住民のうち、在留カードの性別欄が空欄のため、住民票の性別を男女のいずれにも該当しない"
        "ものとしている者については、表の男女のいずれにも計上せず、総計においてのみ計上している。」により、"
        "計 −(男+女) が0にならない行が48行中6行ある：合計 +9、東京都(130001) +3、石川県(170003) +2、"
        "山梨県(190004) +2、長野県(200000) +1、鳥取県(310000) +1（都道府県分の合計が合計行の+9と一致）。"
        "男女合算で計を作り直さないこと。",
        "単位は人口が人、世帯数が世帯。値は原資料のまま（加工なし）。",
        "本ファイルは生値のみを格納する。比較値（全国平均・全国順位）は含めず、集計段で付与する。",
        "原資料 c7以降の人口動態（令和6年1月1日〜12月31日計上の転入・転出・出生・死亡・増減率等）は本ファイルに含めていない。",
        "入力は取得済みのローカルファイル1本のみを使用し、本ファイル生成時に再ダウンロードはしていない。",
    ]
    payload = {
        "sources": [{
            "source_url": SOURCE_URL,
            "source_page": SOURCE_PAGE,
            "stat_name": STAT_NAME,
            "table_title": title,
            "statInfId": STAT_INF_ID,
            "fetched_at": FETCHED_AT,
            "source_file_hash_sha256": file_hash,
        }],
        "period": PERIOD,
        "updated": UPDATED,
        "notes": notes,
        "data": [{
            "都道府県コード": r["code"],
            "都道府県名": r["name"],
            "人口_男": r["人口_男"],
            "人口_女": r["人口_女"],
            "人口_計": r["人口_計"],
            "世帯数": r["世帯数"],
        } for r in rows],
    }
    print("== 書き出し ==")
    with OUT.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"  wrote {OUT.relative_to(ROOT)}  ({len(payload['data'])} records)")

    print("== アンカー実測値 ==")
    for label, r in (("岐阜県(210005)", gifu), ("合計(団体コード'-'・都道府県名'合計')", tot)):
        print(f"  {label}: 人口_男={r['人口_男']} 人口_女={r['人口_女']} "
              f"人口_計={r['人口_計']} 世帯数={r['世帯数']}")


if __name__ == "__main__":
    try:
        main()
    except Abort as exc:
        print(f"\n!! 中断: {exc}", file=sys.stderr)
        sys.exit(1)
