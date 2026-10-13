# -*- coding: utf-8 -*-
"""まちのすがた #7「一人あたり課税対象所得」の都道府県版 生値JSONを生成する（経路A・2026-10-12 切替）。

入力（取得済みローカル1本のみ・新規ダウンロードなし）:
  statInfId=000040412525 統計でみる都道府県のすがた2026 D行政基盤
  poc/recon-20261012-pref-sugata2026/estat_000040412525_sugata_pref2026_D_gyosei.xls （OLE .xls。xlrdで読む）
  シート A204 の指標 No.95「課税対象所得（納税義務者１人当たり）」#D02206（単位 千円・年度 2024）

出力（1本）:
  data/pref_1d_taxable_income.json （47都道府県＋全国・系譜 source_file_hash_sha256）

経緯：2026-09-04〜10-08 は経路B（社会生活統計指標－都道府県の指標－2024 の基礎データ C120110／C120120・2022年）を
採っていたが、2026-10-12 の運営者裁定（新しい版は公開前に取り込む）で、より新しい経路A（2024年度）へ切り替えた。
経路Aは既に「納税義務者1人当たり」へ換算済みの値（千円・小数第1位）で、課税対象所得の総額・納税義務者数の原数値は含まない。
このため JSON の 課税対象所得_百万円・納税義務者数_人 は無くなった（経路Bの原数値は旧版の git 履歴にある）。

列位置はハードコードせず、指標コード行・単位行・年度行・「指標値／順位」行のラベルから同定し自己検証する。
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "poc" / "recon-20261012-pref-sugata2026" / "estat_000040412525_sugata_pref2026_D_gyosei.xls"
OUT = ROOT / "data" / "pref_1d_taxable_income.json"

UPDATED = date.today().isoformat()
YEAR = "2024"
PERIOD = "2024年度（納税義務者1人当たり課税対象所得）"

STAT_INF_ID = "000040412525"
STAT_NAME = "社会・人口統計体系（統計でみる都道府県のすがた2026）"
SOURCE_URL = f"https://www.e-stat.go.jp/stat-search/file-download?statInfId={STAT_INF_ID}&fileKind=0"
SOURCE_PAGE = "https://www.e-stat.go.jp/stat-search/files?toukei=00200502&tstat=000001240736"
FETCHED_AT = "2026-10-12T21:47:00+09:00"
# 2026-10-13: 原本の保存者名（Excel の WRITEACCESS 欄）を同じ長さの "(anonymous)" に置換した後のハッシュ（シートの内容は不変）。
# 取得した元ファイルのハッシュ: 93bac6757f806705744c2deddbe5ce39ce3d6e875f6dfcd9379a064ad39be0ae
EXPECTED_SHA256 = "1da8c79ae7b61343550c12eb018a9112c7895eabdb22b31a6d77d39697fef134"

ITEM_CODE = "#D02206"
ITEM_NAME_KW = "課税対象所得"


class Abort(Exception):
    """構造不一致・検証不一致で処理を止めるための例外。推測で続行しない。"""


def s(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    if not SRC.exists():
        raise Abort(f"入力ファイルが無い: {SRC}")
    file_hash = sha256_of(SRC)
    print(f"  入力sha256={file_hash}")
    if EXPECTED_SHA256 and file_hash != EXPECTED_SHA256:
        raise Abort(f"入力のsha256が想定と不一致 実測={file_hash} 想定={EXPECTED_SHA256}")

    wb = xlrd.open_workbook(str(SRC))
    sh = wb.sheet_by_index(0)
    print(f"== 構造確認 == シート={sh.name!r} 行={sh.nrows} 列={sh.ncols}")

    # 指標コード行（#D02206 を含む行）と列
    code_cells = [(r, c) for r in range(0, 20) for c in range(sh.ncols) if s(sh.cell_value(r, c)) == ITEM_CODE]
    if len(code_cells) != 1:
        raise Abort(f"指標コード {ITEM_CODE} のセルが {len(code_cells)} 個（1個に確定できない）")
    r_code, c_val = code_cells[0]
    # 同じ列の上部ラベル行から、指標名・単位・年度・「指標値」を検証
    col_vals = {r: s(sh.cell_value(r, c_val)) for r in range(0, 14)}
    name_row = next((r for r, v in col_vals.items() if ITEM_NAME_KW in v), None)
    if name_row is None:
        raise Abort(f"指標列 c{c_val} の上部に『{ITEM_NAME_KW}』を含む指標名が無い")
    unit_row = next((r for r, v in col_vals.items() if "千円" in v), None)
    if unit_row is None:
        raise Abort("指標列の単位が『千円』ではない（単位を確認できない）")
    year_row = next((r for r, v in col_vals.items() if re.fullmatch(r"\d{4}", v)), None)
    if year_row is None or col_vals[year_row] != YEAR:
        raise Abort(f"年度が {YEAR} ではない（実測={col_vals.get(year_row)!r}）")
    if "指標値" not in col_vals[11] or "Indicator" not in col_vals[11]:
        raise Abort(f"指標列の11行目が『指標値』ではない（実測={col_vals[11]!r}）")
    # 順位列は指標値列の右隣
    rank_hdr = s(sh.cell_value(11, c_val + 1))
    if "順位" not in rank_hdr:
        raise Abort(f"指標値列の右隣が『順位』列ではない（実測={rank_hdr!r}）")
    c_rank = c_val + 1
    # キー列：都道府県コード（2桁）・名称
    c_code, c_name = 7, 8
    if s(sh.cell_value(11, c_name)) not in ("都道府県",) :
        raise Abort(f"都道府県名の列が想定位置にない（実測={s(sh.cell_value(11, c_name))!r}）")
    print(f"  指標列=c{c_val + 1}（{col_vals[name_row].replace(chr(10), ' ')}／{col_vals[unit_row]}／{YEAR}年度）順位列=c{c_rank + 1}")

    rows = []
    for r in range(12, sh.nrows):
        code = s(sh.cell_value(r, c_code))
        if not re.fullmatch(r"\d{2}", code):
            continue
        name = s(sh.cell_value(r, c_name))
        v = sh.cell_value(r, c_val)
        if not isinstance(v, float):
            raise Abort(f"数値でないセル（0に丸めず中断）: {code}_{name} 値={v!r}")
        rk = sh.cell_value(r, c_rank)
        rows.append({"code": code, "name": name, "senyen": v, "rank_in_file": rk})
    if len(rows) != 48 or rows[0]["code"] != "00" or rows[0]["name"] != "全国":
        raise Abort(f"行数/先頭行が想定外: {len(rows)}件 先頭={rows[0] if rows else None}")
    prefs = rows[1:]
    if [p["code"] for p in prefs] != [f"{i:02d}" for i in range(1, 48)]:
        raise Abort("都道府県コードが01〜47の連番でない")

    print("== 検証 ==")
    ok = True
    # (1) 原表の順位列（降順）と、値からの独立再計算が全47件で一致
    bad = 0
    for p in prefs:
        indep = 1 + sum(1 for q in prefs if q["senyen"] > p["senyen"])
        if not isinstance(p["rank_in_file"], float) or int(p["rank_in_file"]) != indep:
            bad += 1
    print(f"  {'OK ' if bad == 0 else 'NG '} 原表の順位列 = 値からの降順順位（不一致 {bad} 件）")
    ok &= bad == 0
    # (2) 全国は47都道府県の範囲内（最小〜最大）に収まる
    lo, hi = min(p["senyen"] for p in prefs), max(p["senyen"] for p in prefs)
    in_range = lo <= rows[0]["senyen"] <= hi
    print(f"  {'OK ' if in_range else 'NG '} 全国{rows[0]['senyen']} が都道府県の範囲 {lo}〜{hi} 内")
    ok &= in_range
    # (3) 旧版（2022年・経路B）との同定：同じ指標なら全県で増加し、増加率が極端でない。
    #     旧版の原数値（総額・納税義務者数）が残っている出力ファイルがある場合のみ実施（切替後の再実行ではスキップ）。
    old_path = ROOT / "data" / "pref_1d_taxable_income.json"
    old = json.loads(old_path.read_text(encoding="utf-8"))
    if "課税対象所得_百万円" in old["data"][1]:
        old_by = {r["都道府県コード"]: r["一人あたり課税対象所得_万円"] for r in old["data"]}
        ratios = {p["code"]: p["senyen"] / 10 / old_by[p["code"]] for p in prefs}
        rmin, rmax = min(ratios.values()), max(ratios.values())
        old_rank = sorted(old_by[c] for c in ratios)
        # 順位相関（スピアマン）
        def rk(d):
            order = sorted(d, key=lambda c: -d[c])
            return {c: i + 1 for i, c in enumerate(order)}
        ra, rb = rk({p["code"]: p["senyen"] for p in prefs}), rk({c: old_by[c] for c in ratios})
        n = 47
        spearman = 1 - 6 * sum((ra[c] - rb[c]) ** 2 for c in ra) / (n * (n * n - 1))
        gentle = 0.95 <= rmin and rmax <= 1.30 and spearman >= 0.9
        print(f"  {'OK ' if gentle else 'NG '} 旧版(2022年)に対する2024年度の比：最小{rmin:.3f}〜最大{rmax:.3f}、順位相関(Spearman)={spearman:.3f}")
        ok &= gentle
    else:
        print("  （旧版の原数値が無いため、2022年版との同定はスキップ）")
    if not ok:
        raise Abort("検証が一致しない。JSONを書かずに中断した。")

    data = [{
        "都道府県コード": p["code"],
        "都道府県名": p["name"],
        "一人あたり課税対象所得_千円": p["senyen"],
        "一人あたり課税対象所得_万円": round(p["senyen"] / 10, 2),
    } for p in rows]

    notes = [
        "経路A（統計でみる都道府県のすがた2026 D行政基盤 No.95 #D02206『課税対象所得（納税義務者１人当たり）』）を採用した（2026-10-12 運営者裁定：新しい版は公開前に取り込む）。旧版は経路B（社会生活統計指標－都道府県の指標－2024 の基礎データ C120110／C120120・2022年）だったが、経路Aの方が2年新しい（2024年度）。",
        "値は原資料に既に『納税義務者1人当たり』へ換算済みで、単位は千円（小数第1位）。一人あたり課税対象所得_千円 は原表の値そのまま、一人あたり課税対象所得_万円 は千円の値を10で割った値（小数第2位まで。丸めによる同順位を避けるため）。",
        "経路Aは換算済みの値のみで、課税対象所得の総額・納税義務者数の原数値は含まない。このため旧版にあった 課税対象所得_百万円・納税義務者数_人 は無い（再計算には使えない）。",
        "年度は2024年度（指標列の年度行の表記）。市区町村版（data/m1_2c_taxable_income.json）の対応年次とは別に確認が必要で、市区町村と都道府県を同一年次として並べてよいかは本ファイルでは判断していない。",
        "原表の順位列（降順）が、値から独立に再計算した降順順位と全47件で一致することを生成時に確認した。旧版（2022年）との比較で、全県の増加率が極端でなく順位の並びが近いこと（同じ指標であること）も確認した。",
        "都道府県コードはSSDS（社会・人口統計体系）独自の2桁体系（00=全国、21=岐阜県）。住民基本台帳の6桁・国勢調査の5桁とは別体系であり、他のpref系JSONとは直接結合できない（先頭2桁での読み替えが必要）。",
        "全国行は原資料が都道府県コード \"00\"・都道府県名『全国』を持つためそのまま格納した。全国行は後段の全国比較用であり、都道府県の1件として数えない。",
        "本ファイルは生値のみを格納する。比較値（全国平均・全国順位）は含めず、集計段で付与する。都道府県レベルには類似団体の概念が無い。",
        "入力は取得済みのローカルファイル1本のみを使用し、本ファイル生成時に再ダウンロードはしていない。原資料はOLE .xls形式のため xlrd で読んでいる。",
    ]
    payload = {
        "sources": [{
            "source_url": SOURCE_URL,
            "source_page": SOURCE_PAGE,
            "stat_name": STAT_NAME,
            "table_title": "D．行政基盤 No.95 課税対象所得（納税義務者１人当たり） #D02206",
            "statInfId": STAT_INF_ID,
            "fetched_at": FETCHED_AT,
            "source_file_hash_sha256": file_hash,
        }],
        "period": PERIOD,
        "updated": UPDATED,
        "notes": notes,
        "data": data,
    }
    with OUT.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"  wrote {OUT.relative_to(ROOT)}  ({len(data)} records)")
    g = next(r for r in data if r["都道府県コード"] == "21")
    print(f"  岐阜県(21): {g['一人あたり課税対象所得_千円']}千円 = {g['一人あたり課税対象所得_万円']}万円 / 全国 {data[0]['一人あたり課税対象所得_万円']}万円")


if __name__ == "__main__":
    try:
        main()
    except Abort as exc:
        print(f"\n!! 中断: {exc}", file=sys.stderr)
        sys.exit(1)
