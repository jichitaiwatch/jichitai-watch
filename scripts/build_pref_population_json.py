# -*- coding: utf-8 -*-
"""まちのすがた #1「人口・男女数・世帯数」の都道府県版 生値JSON（単年）を生成する。

入力（取得済みローカル1本のみ・新規ダウンロードなし）:
  総務省「住民基本台帳に基づく人口、人口動態及び世帯数」令和8年1月1日現在
  【総計】都道府県別 人口・世帯数、人口動態（2026-10-12 に令和7年版から更新・launch-backlog.md E-9）
  poc/recon-20261012-juki-r8/soumu_000892948_juki_pref_pop_hh_r8.xlsx / シート「人口、世帯数、人口動態（都道府県別）【総計】」
  ※令和7年版（handoff/pref-machi-verify/2501stjin.xlsx）は build_pref_population_timeseries.py が経年の1点として使う。

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
SRC = ROOT / "poc" / "recon-20261012-juki-r8" / "soumu_000892948_juki_pref_pop_hh_r8.xlsx"
OUT = ROOT / "data" / "pref_1a_population.json"

UPDATED = date.today().isoformat()
PERIOD = "令和8年1月1日時点（住民基本台帳）"

SOURCE_FILE_ID = "000892948"   # 総務省 main_content/NNNNNNNNN.xlsx の番号（e-Stat の統計表IDではない）
STAT_NAME = "住民基本台帳に基づく人口、人口動態及び世帯数"
SOURCE_URL = f"https://www.soumu.go.jp/main_content/{SOURCE_FILE_ID}.xlsx"
SOURCE_PAGE = "https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/jinkou_jinkoudoutai-setaisuu.html"
# 2026-10-12 に運営者が総務省のページから取得（取得時刻は保存時の記録）。ハッシュは取得したファイルの値
FETCHED_AT = "2026-10-12T21:20:00+09:00"
EXPECTED_SHA256 = "90c20e8d2514501aa73a9833a7496ab57c0ef4e65e6c031735a8c0a2ada43933"
TITLE_MUST_HAVE = "令和8年1月1日"   # 表題に無ければ止める（別の年のファイルを読まないため）
GIFU_PREF_CODE = "210005"


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

    print("== 自己検証（年ごとの固定値ではなく、表の内部の整合で確かめる） ==")
    gifu = next((r for r in prefs if r["code"] == GIFU_PREF_CODE), None)
    if gifu is None:
        raise Abort(f"岐阜県行({GIFU_PREF_CODE})が見つからない")
    tot = totals[0]
    if TITLE_MUST_HAVE not in title:
        raise Abort(f"表題に「{TITLE_MUST_HAVE}」が無い（別の年のファイルの可能性）: {title!r}")
    print(f"    OK  表題に「{TITLE_MUST_HAVE}」を確認")
    ok = True
    for k in ("人口_男", "人口_女", "人口_計", "世帯数"):
        got, want = sum(r[k] for r in prefs), tot[k]
        hit = got == want
        ok = ok and hit
        print(f"    {'OK ' if hit else 'NG '} 47都道府県の{k}の合計 = 合計行: {got} / {want}")
    if not ok:
        raise Abort("47都道府県の合計が合計行と一致しない。JSONを書かずに中断した。")

    file_hash = sha256_of(SRC)
    if file_hash != EXPECTED_SHA256:
        raise Abort(f"入力のsha256が取得時の記録と不一致\n  実測={file_hash}\n  記録={EXPECTED_SHA256}")
    print("    OK  入力sha256が取得時の記録と一致")

    # 原資料 注2 の影響：男＋女≠計 になる行を全件洗い出す（合算で計を作らないことの根拠）
    gaps = [(r["code"], r["name"], r["人口_計"] - (r["人口_男"] + r["人口_女"])) for r in rows]
    nonzero = [g for g in gaps if g[2] != 0]
    print(f"  男＋女＝計 が成立しない行 {len(nonzero)}/{len(rows)} 件（原資料 注2 による）:")
    for code, name, d in nonzero:
        print(f"    {code} {name}: 計 −(男+女) = {d}")

    gap_text = "、".join(
        f"{('合計' if code == '-' else name)}({code if code != '-' else '合計行'}) {d:+d}" for code, name, d in nonzero
    )
    prefs_gap_sum = sum(d for code, name, d in nonzero if code != "-")
    total_gap = next((d for code, name, d in nonzero if code == "-"), 0)
    notes = [
        f"本ファイルは{PERIOD.split('時点')[0]}の単年のみを収録する。1-1a情報カード本体は単年で足り、"
        "5年時系列が必要なのは入口サマリー0-1の『5年間の増減人数』・経年画面であって、そちらは市区町村版"
        "（data/m1_1a_population_timeseries.json）と都道府県版の経年（data/pref_1a_population_timeseries.json）で"
        "対応済みのため、このファイルは単年とした。",
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
        f"計 −(男+女) が0にならない行が{len(rows)}行中{len(nonzero)}行ある（このファイルでの実測）：{gap_text}"
        f"（都道府県分の合計 {prefs_gap_sum:+d} は合計行の {total_gap:+d} と{'一致' if prefs_gap_sum == total_gap else '一致しない'}）。"
        "男女合算で計を作り直さないこと。",
        "単位は人口が人、世帯数が世帯。値は原資料のまま（加工なし）。",
        "本ファイルは生値のみを格納する。比較値（全国平均・全国順位）は含めず、集計段で付与する。",
        "原資料 c7以降の人口動態（前年1月1日〜12月31日計上の転入・転出・出生・死亡・増減率等）は本ファイルに含めていない。",
        "入力は取得済みのローカルファイル1本のみを使用し、本ファイル生成時に再ダウンロードはしていない。",
    ]
    payload = {
        "sources": [{
            "source_url": SOURCE_URL,
            "source_page": SOURCE_PAGE,
            "stat_name": STAT_NAME,
            "table_title": title,
            "source_file_id": SOURCE_FILE_ID,
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
