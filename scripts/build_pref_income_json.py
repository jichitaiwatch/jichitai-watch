# -*- coding: utf-8 -*-
"""まちのすがた #7「一人あたり課税対象所得」の都道府県版 生値JSON（経路B）を生成する。

入力（取得済みローカル1本のみ・新規ダウンロードなし）:
  statInfId=000040133617 社会生活統計指標－都道府県の指標－2024 基礎データ 表003 シートC 経済基盤
  handoff/pref-machi-verify/a003.xls （OLE .xls。xlrdで読む）

出力（新規1本。既存JSONは読まない・書き換えない）:
  data/pref_1d_taxable_income.json （47都道府県＋全国・系譜 source_file_hash_sha256）

経路B（項目コード C120110／C120120 の基礎データ）を採用。市区町村版§7.11と同一の項目コード・
同一算出式のため。経路A（統計でみる都道府県のすがた2026 D行政基盤 #D02206・既算出値）は不採用。

列位置はハードコードせず、項目コード行・年次行・単位行のラベルから同定し自己検証する。
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
SRC = ROOT / "handoff" / "pref-machi-verify" / "a003.xls"
OUT = ROOT / "data" / "pref_1d_taxable_income.json"

UPDATED = date.today().isoformat()
PERIOD = "2022年（課税対象所得・納税義務者数の年次）"
YEAR = "2022"

STAT_INF_ID = "000040133617"
STAT_NAME = "社会・人口統計体系（社会生活統計指標－都道府県の指標－2024）"
SOURCE_URL = f"https://www.e-stat.go.jp/stat-search/file-download?statInfId={STAT_INF_ID}&fileKind=0"
SOURCE_PAGE = (
    "https://www.e-stat.go.jp/stat-search/files?page=1&layout=dataset&toukei=00200502"
    "&tstat=000001213101&tclass1=000001213103"
)
# recon/pref-machi-existence-20260904.md §3 の取得記録（bytes 107,520 / sha256）
FETCHED_AT = "2026-09-04"
RECON_SHA256 = "216d9b519fdc363fe50af9c454d10cae59b4c8c0f5e0f6278c55210036697ca5"  # recon が2026-09-04に記録した値
# handoff/pref-machi-verify/a003.xls の現在のハッシュ（2026-10-08）。
# 経緯：e-Stat から取得した原本（recon 記録 216d9b51…）は、運営者の PC で Excel によって一度開いて保存し直されていたと見られる
# （xlrd の user_name に運営者名が入っていた。e-Stat の原本にはない）。バイト数と、ここから読む値は同じ。
# Gate 5 の個人情報除去で、その名前の欄だけを同じ長さの "(anonymous)" に置き換えた（シートの内容は変えていない）。
CURRENT_SHA256 = "f5a44d4718bdcf2b1d1ee01dc24b113149765d01c7a8cc751cdf441868982b6a"

ITEMS = {
    "C120110": {"key": "課税対象所得_百万円", "unit_kw": "百万円"},
    "C120120": {"key": "納税義務者数_人", "unit_kw": "人"},
}
ANCHOR_GIFU = {"code": "21", "課税対象所得_百万円": 3100464, "納税義務者数_人": 945840,
               "一人あたり課税対象所得_万円": 327.8}


class Abort(Exception):
    """アンカー不一致・構造不一致で処理を止めるための例外。推測で続行しない。"""


def s(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


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


def find_row(sh, pred, what: str) -> int:
    for r in range(sh.nrows):
        vals = [s(sh.cell_value(r, c)) for c in range(sh.ncols)]
        if pred(vals):
            return r
    raise Abort(f"{what} の行が見つからない")


def resolve(sh):
    """(項目コード行, 年次行, 項目→使用列, 都道府県コード列, 都道府県名列, 表題) を返す。"""
    code_row = find_row(sh, lambda v: "C120110" in v and "C120120" in v, "項目コード")
    code_vals = [s(sh.cell_value(code_row, c)) for c in range(sh.ncols)]
    # 項目コードが載る列（＝各項目の開始列）を全部拾い、隣の項目の開始列までを当該項目の span とする
    starts = sorted(c for c, v in enumerate(code_vals) if re.fullmatch(r"[A-Z]\d+", v))
    if not starts:
        raise Abort("項目コード列を検出できない")

    year_row = find_row(
        sh,
        lambda v, cr=code_row: sum(1 for x in v if re.fullmatch(r"(19|20)\d{2}", x)) >= 10,
        "年次",
    )
    if year_row <= code_row:
        raise Abort(f"年次行({year_row + 1})が項目コード行({code_row + 1})より上にある")
    year_vals = [s(sh.cell_value(year_row, c)) for c in range(sh.ncols)]

    use = {}
    for item, meta in ITEMS.items():
        try:
            start = next(c for c in starts if code_vals[c] == item)
        except StopIteration as exc:
            raise Abort(f"項目コード {item} が見つからない") from exc
        later = [c for c in starts if c > start]
        end = (later[0] - 1) if later else sh.ncols - 1
        cands = [c for c in range(start, end + 1) if year_vals[c] == YEAR]
        if len(cands) != 1:
            years = {c: year_vals[c] for c in range(start, end + 1)}
            raise Abort(f"{item}: 年次{YEAR}の列を1つに確定できない（span={start + 1}..{end + 1} 年次={years}）")
        col = cands[0]
        # 単位の裏取り：項目コード行の span 内に単位表記があること
        units = [code_vals[c] for c in range(start, end + 1) if "(" in code_vals[c]]
        if not any(meta["unit_kw"] in u for u in units):
            raise Abort(f"{item}: 単位に『{meta['unit_kw']}』が見つからない（span内の単位表記={units}）")
        use[item] = {"col": col, "start": start, "end": end, "unit": units}

    # 都道府県名列：ヘッダに『都道府県』があり、データ行に県名が入る列
    name_row = find_row(sh, lambda v: "都道府県" in v, "都道府県名ヘッダ")
    name_cols = [c for c, v in enumerate([s(sh.cell_value(name_row, c)) for c in range(sh.ncols)])
                 if v == "都道府県"]
    if len(name_cols) != 1:
        raise Abort(f"都道府県名列を1つに確定できない（候補={[c + 1 for c in name_cols]}）")
    c_name = name_cols[0]

    # 都道府県コード列：ラベルが無いため、データ行の値集合が '00'..'47' に一致する列を探して確定する
    want = {f"{i:02d}" for i in range(48)}
    c_code = None
    for c in range(sh.ncols):
        seen = []
        for r in range(sh.nrows):
            v = s(sh.cell_value(r, c))
            if re.fullmatch(r"\d{1,2}", v) and s(sh.cell_value(r, c_name)):
                seen.append(v.zfill(2))
        if set(seen) == want and len(seen) == 48:
            c_code = c
            break
    if c_code is None:
        raise Abort("都道府県コード列（値集合が00〜47の48件）を検出できない")

    title = s(sh.cell_value(find_row(sh, lambda v: any("経済基盤" in x for x in v), "表題"), 0))
    if not title:
        trow = find_row(sh, lambda v: any("経済基盤" in x for x in v), "表題")
        title = next(s(sh.cell_value(trow, c)) for c in range(sh.ncols) if "経済基盤" in s(sh.cell_value(trow, c)))
    return code_row, year_row, use, c_code, c_name, title


def main():
    if not SRC.exists():
        raise Abort(f"入力ファイルが無い: {SRC}")
    wb = xlrd.open_workbook(SRC)
    sheet = wb.sheet_names()[0]
    sh = wb.sheet_by_name(sheet)
    code_row, year_row, use, c_code, c_name, title = resolve(sh)

    print("== 抽出 ==")
    print(f"  シート: {sheet}  rows={sh.nrows} cols={sh.ncols}")
    print(f"  表題  : {title}")
    print(f"  項目コード行=row{code_row + 1} 年次行=row{year_row + 1}")
    print(f"  都道府県コード列=c{c_code + 1} 都道府県名列=c{c_name + 1}")
    for item, m in use.items():
        print(f"  {item}: span=c{m['start'] + 1}..c{m['end'] + 1} 年次{YEAR}列=c{m['col'] + 1} 単位={m['unit']}")

    rows = []
    for r in range(sh.nrows):
        code = s(sh.cell_value(r, c_code))
        name = s(sh.cell_value(r, c_name))
        if not name or not re.fullmatch(r"\d{1,2}", code):
            continue
        code = code.zfill(2)
        where = f"{code}_{name}"
        rec = {"code": code, "name": name}
        for item, m in use.items():
            rec[ITEMS[item]["key"]] = num(sh.cell_value(r, m["col"]), f"{where} {item}")
        if not rec["納税義務者数_人"]:
            raise Abort(f"納税義務者数が0または欠損: {where}")
        rec["一人あたり課税対象所得_万円"] = round(
            rec["課税対象所得_百万円"] * 100 / rec["納税義務者数_人"], 1
        )
        rows.append(rec)

    rows.sort(key=lambda r: r["code"])
    n_pref = sum(1 for r in rows if r["code"] != "00")
    print(f"  抽出件数={len(rows)}（全国1＋都道府県{n_pref}）")
    if len(rows) != 48 or n_pref != 47:
        raise Abort(f"件数が48（全国1＋47）でない: 全体={len(rows)} 都道府県={n_pref}")
    if {r["code"] for r in rows} != {f"{i:02d}" for i in range(48)}:
        raise Abort("都道府県コードが00〜47を網羅していない")

    print("== アンカー自己検証 ==")
    gifu = next((r for r in rows if r["code"] == ANCHOR_GIFU["code"]), None)
    if gifu is None:
        raise Abort("岐阜県(21)の行が見つからない")
    ok = True
    for k in ("課税対象所得_百万円", "納税義務者数_人", "一人あたり課税対象所得_万円"):
        hit = gifu[k] == ANCHOR_GIFU[k]
        ok = ok and hit
        print(f"    {'OK ' if hit else 'NG '} 岐阜県(21) {k}: 実測={gifu[k]} 期待={ANCHOR_GIFU[k]}")
    if gifu["name"] != "岐阜県":
        raise Abort(f"コード21の都道府県名が『岐阜県』でない: {gifu['name']!r}")
    if not ok:
        raise Abort("アンカー値が一致しない。JSONを書かずに中断した。")

    file_hash = sha256_of(SRC)
    if file_hash != CURRENT_SHA256:
        raise Abort(f"入力のsha256が確認済みの値と不一致（別の版を読もうとしている。値を確かめてから CURRENT_SHA256 を更新する）\n  実測={file_hash}\n  確認済み={CURRENT_SHA256}")
    print("    OK  入力sha256が確認済みの値と一致（recon の記録値 216d9b51… とは異なる。ノート参照）")

    notes = [
        "経路B（基礎データの項目コード C120110 課税対象所得／C120120 納税義務者数（所得割））を採用した。"
        "市区町村版（content-spec-v1.md §7.11 の1-2c）と同一の項目コード・同一の算出式であり、突合が成立するため。"
        "経路A（統計でみる都道府県のすがた2026 D行政基盤 #D02206 の既算出値・単位千円）は不採用。",
        f"一人あたり課税対象所得(万円) = 課税対象所得(百万円) × 100 ÷ 納税義務者数(人)。小数第1位で丸め"
        "（市区町村版§7.11と同じ丸め桁）。分子・分母の原数値を併載しているため再計算可能。",
        f"年次は{YEAR}年（課税対象所得・納税義務者数の両項目）。同一ファイル内の2015年・2020年の列は使用していない。"
        "**市区町村版（統計でみる市区町村のすがた2025・statInfId=000040283812）の対応年次は未確認**であり、"
        "市区町村と都道府県を同一年次として並べてよいかは本ファイルでは判断していない。",
        "単位は課税対象所得が百万円、納税義務者数が人。値は原資料のまま（加工なし）。"
        "市区町村版で踏んだ『課税対象所得の単位を千円と誤認して一人あたりが1/1000になった』教訓（§7.11）を踏まえ、"
        "本ファイルでは項目コード行の単位表記（(百万円:million yen)／(人:person)）を生成時に検証している。",
        "都道府県コードはSSDS（社会・人口統計体系）独自の2桁体系（00=全国、21=岐阜県）。"
        "住民基本台帳の6桁（例 210005）・国勢調査の5桁（例 21000）とは別体系であり、"
        "data/pref_1a_population.json・data/pref_1c_aging_rate.json・data/pref_2a_industry.json とは"
        "直接結合できない（先頭2桁での読み替えが必要）。",
        "全国行は原資料が都道府県コード \"00\"・都道府県名『全国』を持つためそのまま格納した"
        "（住基系JSONの合計行がコードを持たず \"-\" であるのとは異なる）。"
        "全国行は後段の全国比較用であり、都道府県の1件として数えない。",
        "本ファイルは生値のみを格納する。比較値（全国平均・類団平均・全国順位）は含めず、集計段で付与する。"
        "都道府県レベルには類似団体の概念が無い点は別レイヤーの論点。",
        "付随記録（採否対象外）：本入力の同一シートには県内総生産額（C1121・億円・2012/2015/2019）も収録されているが、"
        "一人あたりGDPは既存方針により不採用のため本ファイルには含めていない（§7.11で1-3aを却下済み。"
        "1-2cが経済力の代替指標として機能するという判断）。",
        "入力ファイルのsha256は、recon/pref-machi-existence-20260904.md §3 の取得記録（216d9b51…）と一致しない"
        "（2026-10-08確認）。取得後に Excel で開いて保存し直された版と見られ、さらに公開前の個人情報除去で、ファイルに残っていた"
        "保存者名の欄を同じ長さの \"(anonymous)\" に置き換えた。バイト数（107,520）は取得時と同じで、シートの内容は変えていない。"
        "本ファイルの sources には、実際に読んだファイルのハッシュ（f5a44d47…）を記録した。",
        "入力は取得済みのローカルファイル1本のみを使用し、本ファイル生成時に再ダウンロードはしていない。"
        "原資料はOLE .xls形式のため xlrd で読んでいる（openpyxlでは開けない）。",
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
            "課税対象所得_百万円": r["課税対象所得_百万円"],
            "納税義務者数_人": r["納税義務者数_人"],
            "一人あたり課税対象所得_万円": r["一人あたり課税対象所得_万円"],
        } for r in rows],
    }
    print("== 書き出し ==")
    with OUT.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"  wrote {OUT.relative_to(ROOT)}  ({len(payload['data'])} records)")

    print("== アンカー実測値 ==")
    zenkoku = next(r for r in rows if r["code"] == "00")
    for label, r in (("岐阜県(21)", gifu), ("全国(00)", zenkoku)):
        print(f"  {label} {r['name']}: 課税対象所得={r['課税対象所得_百万円']}百万円 "
              f"納税義務者数={r['納税義務者数_人']}人 "
              f"一人あたり={r['一人あたり課税対象所得_万円']}万円")


if __name__ == "__main__":
    try:
        main()
    except Abort as exc:
        print(f"\n!! 中断: {exc}", file=sys.stderr)
        sys.exit(1)
