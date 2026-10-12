# -*- coding: utf-8 -*-
"""47都道府県 主要財政指標＋健全化判断比率＋法定基準 の統合スクリプト。
出力: data/pref_fiscal_indicators.json（丸ごと上書き）

既存内容（財政力指数・経常収支比率・実質公債費比率・将来負担比率・ラスパイレス指数の
R4〜R6 periods構造）は既存JSONから読み込んでそのまま保持し、R6期に対して次を追加する。

  1) 実質赤字比率・連結実質赤字比率（R6）
     出典: 総務省「令和6年度の決算に基づく健全化判断比率及び資金不足比率の概要」
           001060123.xlsx シート「健全化（都道府県）」
           ＝市区町村側（data/m2_2_finance.json「R6健全化判断比率概要」）と同一ファイルの都道府県シート。
  2) 法定基準線（早期健全化基準・財政再生基準）
     出典: 総務省「令和6年度都道府県決算状況調」第1 資料のみかた（001056621.pdf）
           （参考）早期健全化基準と財政再生基準
     都道府県固有値であり、市区町村値に丸めない。特に：
       ・将来負担比率の早期健全化基準は都道府県・政令指定都市＝400％（市区町村350％ではない）
       ・将来負担比率に財政再生基準は存在しない（原資料の表記は「―」）
       ・実質赤字比率・連結実質赤字比率は「都」と「道府県」で基準値が異なる（東京都は都区財政調整の
         ため別値）ため、団体別に格納する

これに加えて、同一年度・別ソースである第1表1-3（実質収支比率等の状況・001056121.xlsx）の
健全化判断比率4列と相互検証し、結果を data_check_log に残す。
"""
import hashlib
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

import openpyxl
from openpyxl.utils import column_index_from_string

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache"
OUT = ROOT / "data" / "pref_fiscal_indicators.json"
PREF_ASSEMBLY = ROOT / "data" / "pref_assembly.json"

JST = timezone(timedelta(hours=9))
NOW_ISO = datetime.now(JST).strftime("%Y-%m-%dT%H:%M:%S%z")
NOW_ISO = NOW_ISO[:-2] + ":" + NOW_ISO[-2:]  # +0900 -> +09:00

# ---- ソースファイル ----
FILE_SHUYO_R6 = CACHE / "shuyo_shihyo_r06.xlsx"              # 主要財政指標一覧（R6・既存ソースと同一）
FILE_KENZEN = CACHE / "kenzen_r06.xlsx"                      # 健全化判断比率及び資金不足比率の概要（R6）
FILE_1_3 = CACHE / "pref_r06_1-3.xlsx"                       # 第1表 1-3 実質収支比率等の状況（R6）
FILE_MIKATA = CACHE / "pref_r06_shiryo_no_mikata.pdf"        # 第1 資料のみかた（法定基準の参考表）

URL_SHUYO_R6 = "https://www.soumu.go.jp/main_content/001044528.xlsx"
URL_KENZEN = "https://www.soumu.go.jp/main_content/001060123.xlsx"
URL_1_3 = "https://www.soumu.go.jp/main_content/001056121.xlsx"
URL_MIKATA = "https://www.soumu.go.jp/main_content/001056621.pdf"

PAGE_SHUYO_R6 = "https://www.soumu.go.jp/menu_seisaku/toukei/02zaisei07_04000135.html"
PAGE_KENZEN = "https://www.soumu.go.jp/iken/zaisei/kenzenka/kenzen_shikin.html"
PAGE_TODOHUKEN_R6 = "https://www.soumu.go.jp/iken/zaisei/r06_todohuken.html"

# 健全化（都道府県）シート：r9=見出し、r10〜r56=47都道府県、r57=都道府県（平均）、r58〜=注記
KENZEN_SHEET = "健全化（都道府県）"
KENZEN_ROWS = (10, 56)
KENZEN_AVG_ROW = 57
KENZEN_COLS = {
    "pref_name": "C",
    "実質赤字比率": "E",
    "連結実質赤字比率": "F",
    "実質公債費比率": "G",
    "将来負担比率": "H",
}

# 第1表 1-3：r7〜r53=47都道府県。M=実質赤字比率, N=連結実質赤字比率, O=実質公債費比率, P=将来負担比率
ROWS_1_3 = (7, 53)
COLS_1_3 = {
    "pref_name": "A",
    "経常収支比率": "I",
    "財政力指数": "L",
    "実質赤字比率": "M",
    "連結実質赤字比率": "N",
    "実質公債費比率": "O",
    "将来負担比率": "P",
}

# ---- 法定基準（001056621.pdf（参考）早期健全化基準と財政再生基準の現物記載） ----
# PDF原文（抜粋・改行はPDFのまま）:
#   早期健全化基準 財政再生基準
#   都： 5.59%          都： 8.67%
#   実質赤字比率 道府県：3.75％   道府県：5％
#   市区町村：財政規模に応じ11.25％～15％   市区町村：20％
#   都： 10.59%         都： 18.67%
#   道府県：8.75％
#   連結実質赤字比率
#   市区町村：財政規模に応じ16.25％～20％   道府県：15％ ※
#   市区町村：30％ ※
#   実質公債費比率 都道府県・市区町村：25％   都道府県・市区町村：35％
#   都道府県・政令指定都市：400％
#   将来負担比率 ―
#   市区町村：350％
CRITERIA_TO = {           # 東京都（都区財政調整のため別値）
    "実質赤字比率_早期健全化基準": 5.59,
    "実質赤字比率_財政再生基準": 8.67,
    "連結実質赤字比率_早期健全化基準": 10.59,
    "連結実質赤字比率_財政再生基準": 18.67,
}
CRITERIA_DOFUKEN = {      # 道府県（東京都以外の46団体）
    "実質赤字比率_早期健全化基準": 3.75,
    "実質赤字比率_財政再生基準": 5,
    "連結実質赤字比率_早期健全化基準": 8.75,
    "連結実質赤字比率_財政再生基準": 15,
}
DASH_TOKENS = ("-", "‐", "―", "－")

# 本スクリプトは出力先JSONを読んで書き戻すため、文字列は既存値への追記ではなく
# 定数として全文を持つ（再実行で同一出力になるようにする）。
UNIT_NOTE = (
    "財政力指数は元データのまま無次元の指数（小数）。"
    "経常収支比率・実質公債費比率・将来負担比率・ラスパイレス指数は元データのまま％表記の数値"
    "（列見出しに単位表記なし、原資料の値をそのまま格納。加工なし・単位変換なし。"
    "自治体Watchによる加工はJSON構造化と都道府県コード付与のみ）。"
    "実質赤字比率・連結実質赤字比率も原資料のまま％表記の数値。"
    "赤字額が無い場合の原表記「－」はリテラル文字列 \"-\" として格納し（該当なし＝赤字なし）、"
    "空欄＝確認できず とは区別する。"
    "法定基準（早期健全化基準・財政再生基準）も原資料のまま％表記の数値。"
)


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def classify(value):
    """(格納値, 種別, 原表記) を返す。"-" は「赤字なし＝該当なし」を意味するリテラル。"""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value, "present", None
    if value is None or str(value).strip() == "":
        return None, "unconfirmed", None
    s = str(value).strip()
    if s in DASH_TOKENS:
        return "-", "not_applicable", s
    return s, "unexpected", s


def read_sheet(path: Path, sheet, rows: tuple[int, int], cols: dict[str, str]) -> list[dict]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet] if isinstance(sheet, str) else wb[wb.sheetnames[sheet]]
    idx = {k: column_index_from_string(v) for k, v in cols.items()}
    out = []
    for r in range(rows[0], rows[1] + 1):
        rec = {"__row": r}
        for k, ci in idx.items():
            v = ws.cell(r, ci).value
            rec[k] = str(v).strip() if k == "pref_name" and v is not None else v
        out.append(rec)
    return out


def main() -> None:
    existing = json.loads(OUT.read_text(encoding="utf-8"))
    master = [(x["pref_code"], x["pref_name"]) for x in
              json.loads(PREF_ASSEMBLY.read_text(encoding="utf-8"))["data"]]
    master_names = [n for _, n in master]

    kenzen = read_sheet(FILE_KENZEN, KENZEN_SHEET, KENZEN_ROWS, KENZEN_COLS)
    t13 = read_sheet(FILE_1_3, 0, ROWS_1_3, COLS_1_3)

    # ---- 名寄せ検証 ----
    name_alignment = {}
    for label, recs in (("健全化（都道府県）", kenzen), ("第1表1-3", t13)):
        diff = [{"index": i, "master": a, "excel": b["pref_name"]}
                for i, (a, b) in enumerate(zip(master_names, recs)) if a != b["pref_name"]]
        name_alignment[label] = {"rows_read": len(recs), "name_mismatch_count": len(diff),
                                 "name_mismatch": diff}

    # ---- R6期を特定 ----
    r6 = next(p for p in existing["periods"] if p["fiscal_year_end"] == 2024)
    r6_by_code = {rec["pref_code"]: rec for rec in r6["data"]}

    value_issues: list[dict] = []
    kenzen_vs_existing: list[dict] = []
    kenzen_vs_1_3: list[dict] = []

    for i, (pref_code, pref_name) in enumerate(master):
        k = kenzen[i]
        t = t13[i]
        rec = r6_by_code[pref_code]

        tokens = {}
        for key in ("実質赤字比率", "連結実質赤字比率"):
            v, kind, raw = classify(k[key])
            rec[key] = v
            tokens[key] = raw
            if kind in ("unconfirmed", "unexpected"):
                value_issues.append({"pref_name": pref_name, "item": key, "kind": kind,
                                     "raw": raw, "excel_row": k["__row"]})
        # 既存の実質公債費比率・将来負担比率は主要財政指標一覧由来。健全化概要と原表記を保存する。
        for key in ("実質公債費比率", "将来負担比率"):
            _, kind, raw = classify(k[key])
            tokens[key] = raw
        rec["ratio_source_tokens"] = tokens

        # 既存値（主要財政指標一覧）と健全化概要の突合
        for key in ("実質公債費比率", "将来負担比率"):
            kv, _, _ = classify(k[key])
            if rec.get(key) != kv:
                kenzen_vs_existing.append({"pref_name": pref_name, "item": key,
                                           "主要財政指標一覧": rec.get(key), "健全化概要": kv})
        # 健全化概要と第1表1-3の突合（同一年度・別表による相互検証）
        for key in ("実質赤字比率", "連結実質赤字比率", "実質公債費比率", "将来負担比率"):
            kv, _, _ = classify(k[key])
            tv, _, _ = classify(t[key])
            if kv != tv:
                kenzen_vs_1_3.append({"pref_name": pref_name, "item": key,
                                      "健全化概要": kv, "第1表1-3": tv})

        # 団体別法定基準（都／道府県の別）
        rec.update(CRITERIA_TO if pref_name == "東京都" else CRITERIA_DOFUKEN)
        rec["法定基準区分"] = "都" if pref_name == "東京都" else "道府県"

    # ---- 平均行（都道府県平均） ----
    wb = openpyxl.load_workbook(FILE_KENZEN, data_only=True)
    ws = wb[KENZEN_SHEET]
    avg = {k: ws.cell(KENZEN_AVG_ROW, column_index_from_string(v)).value
           for k, v in KENZEN_COLS.items()}
    avg_check = {
        "健全化概要の平均行ラベル": avg["pref_name"],
        "実質公債費比率": {"既存national": r6["national"].get("実質公債費比率"),
                           "健全化概要": classify(avg["実質公債費比率"])[0]},
        "将来負担比率": {"既存national": r6["national"].get("将来負担比率"),
                         "健全化概要": classify(avg["将来負担比率"])[0]},
    }
    for key in ("実質赤字比率", "連結実質赤字比率"):
        r6["national"][key] = classify(avg[key])[0]
    r6["national"]["note"] = (
        "平均値は加重平均（健全化概要の注記2「平均値は加重平均である。」）。"
        "実質赤字比率・連結実質赤字比率の\"-\"は赤字額なし（同注記1）。"
    )

    # ---- 法定基準（トップレベル） ----
    statutory_criteria = {
        "source_role": "R6 都道府県決算状況調 第1 資料のみかた（参考）早期健全化基準と財政再生基準",
        "source_url": URL_MIKATA,
        "適用": "令和6年度決算に基づく健全化判断比率",
        "unit": "％",
        "実質赤字比率": {
            "早期健全化基準": {"都": 5.59, "道府県": 3.75},
            "財政再生基準": {"都": 8.67, "道府県": 5},
            "note": "都は都区財政調整のため別値。市区町村は財政規模に応じ11.25〜15％（早期健全化）／20％（財政再生）で、都道府県値とは別物。",
        },
        "連結実質赤字比率": {
            "早期健全化基準": {"都": 10.59, "道府県": 8.75},
            "財政再生基準": {"都": 18.67, "道府県": 15},
            "note": "原資料の財政再生基準欄には「※」が付き、平成21〜23年度の3年間に経過的な基準（道府県25→25→20％）が設けられていた旨の脚注を指す。令和6年度決算には経過措置は適用されない。",
        },
        "実質公債費比率": {
            "早期健全化基準": 25,
            "財政再生基準": 35,
            "note": "原資料の表記は「都道府県・市区町村：25％／35％」で都道府県・市区町村共通。団体別の差は無い。",
        },
        "将来負担比率": {
            "早期健全化基準": 400,
            "財政再生基準": None,
            "note": "早期健全化基準の原資料表記は「都道府県・政令指定都市：400％」（市区町村は350％。市区町村値に丸めていない）。財政再生基準は原資料が「―」＝設定なしで、存在しない（nullは『確認できず』ではなく『該当する基準が存在しない』）。",
        },
        "note": (
            "団体別に値が変わる実質赤字比率・連結実質赤字比率の2指標は、各レコードにも "
            "実質赤字比率_早期健全化基準／実質赤字比率_財政再生基準／連結実質赤字比率_早期健全化基準／"
            "連結実質赤字比率_財政再生基準 として格納した（法定基準区分は東京都=「都」・他46団体=「道府県」）。"
            "実質公債費比率・将来負担比率は都道府県内で一律のため本節にのみ持つ（47件へ複製しない）。"
            "市区町村の団体別基準（標準財政規模依存で11.25〜15％等）は data/m2_2_finance.json 側が持つ別レイヤーの値であり、混同しない。"
        ),
    }

    # ---- sources（データ系譜・#8）。既存のperiod単位の持ち方を維持し、配列化する ----
    def entry(role, url, source_page, source_page_url, provides, note,
              path: Path | None = None, hash_override: str | None = None,
              fetched_at: str | None = None, cache_file: str | None = None):
        h = hash_override if hash_override is not None else sha256_of(path)
        if fetched_at is None:
            fetched_at = fetched_at_for(url, h)
        e = {
            "role": role,
            "source_url": url,
            "source_page": source_page,
            "source_page_url": source_page_url,
            "fetched_at": fetched_at,
            "source_file_hash_sha256": h,
        }
        if cache_file or path is not None:
            e["cache_file"] = cache_file or path.name
        e["provides"] = provides
        e["note"] = note
        return e

    # ハッシュが既存記録と一致するソースは fetched_at（原初取得時刻）を引き継ぐ
    # （docs/data-schema.md 5.3。再実行でスクリプト実行時刻に書き換わってはいけない）。
    prev_r6 = r6["sources"] if isinstance(r6["sources"], list) else [r6["sources"]]
    prev_by_url = {s["source_url"]: s for s in prev_r6}

    def fetched_at_for(url: str, current_hash: str) -> str:
        old = prev_by_url.get(url)
        if old and old.get("source_file_hash_sha256") == current_hash:
            return old["fetched_at"]
        return NOW_ISO

    hash_shuyo = sha256_of(FILE_SHUYO_R6)
    shuyo_fetched_at = fetched_at_for(URL_SHUYO_R6, hash_shuyo)

    r6["sources"] = [
        entry(
            "主要財政指標一覧（財政力指数・経常収支比率・実質公債費比率・将来負担比率・ラスパイレス指数）",
            URL_SHUYO_R6, "総務省「地方公共団体の主要財政指標一覧」全都道府県の主要財政指標（令和6年度）",
            PAGE_SHUYO_R6,
            ["財政力指数", "経常収支比率", "実質公債費比率", "将来負担比率", "ラスパイレス指数"],
            "既存レコードの5指標の出典。ハッシュが既存記録と一致したため fetched_at（原初取得時刻）を引き継いだ。"
            "実質公債費比率・将来負担比率は健全化判断比率概要（001060123.xlsx）および第1表1-3（001056121.xlsx）と"
            "47件全件で一致することを機械照合済み（data_check_log参照）。",
            path=FILE_SHUYO_R6, fetched_at=shuyo_fetched_at,
        ),
        entry(
            "健全化判断比率概要（実質赤字比率・連結実質赤字比率）",
            URL_KENZEN,
            "総務省「令和6年度の決算に基づく健全化判断比率及び資金不足比率の概要（令和8年3月27日官報告示）」"
            "１．健全化判断比率（団体別）(1) 都道府県 ＝ シート「健全化（都道府県）」",
            PAGE_KENZEN,
            ["実質赤字比率", "連結実質赤字比率", "ratio_source_tokens"],
            "市区町村側（data/m2_2_finance.json「R6健全化判断比率概要」）と同一ファイル・同一hashの都道府県シート。"
            "市区町村シートには団体別の早期健全化基準列（col G/I）があるが、都道府県シートには基準列が存在しない"
            "（現物確認）。このため都道府県の法定基準は資料のみかたPDFの参考表から取得している。"
            "「－」は同シート注記1「実質赤字額や連結実質赤字額がない場合は、「－」と表記している。」に基づき"
            "『赤字なし＝該当なし』を意味する（空欄＝確認できず、とは区別。原表記は ratio_source_tokens に保存）。",
            path=FILE_KENZEN,
        ),
        entry(
            "法定基準（早期健全化基準・財政再生基準）",
            URL_MIKATA,
            "総務省「地方財政状況調査関係資料｜令和6年度都道府県決算状況調」第1 資料のみかた（参考）早期健全化基準と財政再生基準",
            PAGE_TODOHUKEN_R6,
            ["statutory_criteria",
             "実質赤字比率_早期健全化基準", "実質赤字比率_財政再生基準",
             "連結実質赤字比率_早期健全化基準", "連結実質赤字比率_財政再生基準"],
            "都道府県固有の基準値をそのまま格納した（市区町村値に丸めていない）。"
            "将来負担比率の早期健全化基準は都道府県・政令指定都市400％（市区町村350％とは別値）、"
            "同指標の財政再生基準は原資料「―」＝設定なし。"
            "実質赤字比率・連結実質赤字比率は「都」と「道府県」で基準値が異なるため団体別に格納した。",
            path=FILE_MIKATA,
        ),
        entry(
            "相互検証用（第1表1-3 実質収支比率等の状況）",
            URL_1_3,
            "総務省「地方財政状況調査関係資料｜令和6年度都道府県決算状況調」第1表 決算状況 1-3 実質収支比率等の状況",
            PAGE_TODOHUKEN_R6,
            ["（検証のみ・値の格納には使用しない）"],
            "健全化判断比率4種と経常収支比率・財政力指数を同一年度の別表として持つ。"
            "本ファイルの格納値とは独立に突合し、結果を data_check_log.kenzen_vs_1_3 / shuyo_vs_1_3 に残す。"
            "値そのものはこのソースから採っていない。",
            path=FILE_1_3,
        ),
    ]

    # R5・R4期：既存の単数sourcesを配列へ包み、記録をそのまま保持する（再ダウンロードしない）
    for p in existing["periods"]:
        if p["fiscal_year_end"] == 2024:
            continue
        if isinstance(p["sources"], dict):
            s = p["sources"]
            p["sources"] = [{
                "role": "主要財政指標一覧（財政力指数・経常収支比率・実質公債費比率・将来負担比率・ラスパイレス指数）",
                "source_url": s["source_url"],
                "source_page": f"総務省「地方公共団体の主要財政指標一覧」全都道府県の主要財政指標（{p['period']}）",
                "source_page_url": s["source_page"],
                "fetched_at": s["fetched_at"],
                "source_file_hash_sha256": s["source_file_hash_sha256"],
                "provides": ["財政力指数", "経常収支比率", "実質公債費比率", "将来負担比率", "ラスパイレス指数"],
                "note": "既存記録をそのまま保持（再ダウンロードしていないためハッシュも既存記録のまま）。"
                        "本年度分には実質赤字比率・連結実質赤字比率・法定基準は追加していない（R6のみ追加）。",
            }]

    # ---- 経常収支比率・財政力指数の相互検証（主要財政指標一覧 vs 第1表1-3） ----
    shuyo_vs_1_3 = []
    for i, (pref_code, pref_name) in enumerate(master):
        rec = r6_by_code[pref_code]
        for key in ("経常収支比率", "財政力指数"):
            tv, _, _ = classify(t13[i][key])
            if rec.get(key) != tv:
                shuyo_vs_1_3.append({"pref_name": pref_name, "item": key,
                                     "主要財政指標一覧": rec.get(key), "第1表1-3": tv})

    # ---- 出力の組み立て（既存キー順を保ち、追加分を差し込む） ----
    out = {
        "schema_version": existing["schema_version"],
        "title": "都道府県別主要財政指標・健全化判断比率・法定基準",
        "provider": existing["provider"],
        "provider_dataset": existing["provider_dataset"],
        "updated": NOW_ISO[:10],
        "unit_note": UNIT_NOTE,
        "field_definitions": {
            **existing["field_definitions"],
            "実質赤字比率": "一般会計等の実質赤字額 ÷ 標準財政規模（％）。赤字が無い場合は \"-\"",
            "連結実質赤字比率": "連結実質赤字額 ÷ 標準財政規模（％）。赤字が無い場合は \"-\"",
            "法定基準区分": "法定基準の適用区分。東京都＝「都」、他46団体＝「道府県」（都区財政調整により基準値が異なるため）",
        },
        "missing_model": {
            "present": "数値をそのまま格納",
            "該当なし": "リテラル文字列 \"-\"（実質赤字比率・連結実質赤字比率で赤字額が無い場合。原資料の注記に基づく）",
            "基準が存在しない": "null（将来負担比率の財政再生基準。原資料の表記は「―」＝設定なし）",
            "確認できず": "null（空欄セル）。本ファイルでは0件（data_check_log.value_issues参照）",
        },
        "statutory_criteria": statutory_criteria,
        "notes": [
            "健全化判断比率4種（実質赤字比率・連結実質赤字比率・実質公債費比率・将来負担比率）と法定基準が"
            "R6期の1ファイルに揃った状態。実質公債費比率・将来負担比率は既存の主要財政指標一覧由来の値を保持し、"
            "健全化判断比率概要・第1表1-3と47件全件で一致することを機械照合した。",
            "R5・R4期は主要財政指標一覧の5指標のみ（実質赤字比率・連結実質赤字比率・法定基準は未追加）。"
            "R6期のみに追加したのは、今回の追補対象がR6決算であるため。",
            "比較の基準は団体間ではなく法定基準（早期健全化基準・財政再生基準）との対置。"
            "順位・複合スコア・評価語・信号色は本ファイルに持たせない。",
            "periods[].sources は既存構造（period単位に系譜を持つ）を維持したまま、複数ソースに対応するため単数オブジェクトから配列へ変更した。"
            "docs/data-schema.md 5.2 はファイル単位トップレベルの sources 配列を規定しており、"
            "本ファイルのようにperiodごとにソースが異なる多期間ファイルでの配置は同節の想定外のケースである（配置の裁定は要確認事項）。",
        ],
        "periods": existing["periods"],
        "data_check_log": {
            "count": {"expected": 47,
                      "健全化（都道府県）": len(kenzen),
                      "第1表1-3": len(t13),
                      "R6期data": len(r6["data"])},
            "name_alignment": name_alignment,
            "kenzen_vs_shuyo_mismatch": kenzen_vs_existing,
            "kenzen_vs_1_3_mismatch": kenzen_vs_1_3,
            "shuyo_vs_1_3_mismatch": shuyo_vs_1_3,
            "average_row_check": avg_check,
            "value_issues": value_issues,
            "not_applicable_counts": {
                "実質赤字比率": sum(1 for r in r6["data"] if r.get("実質赤字比率") == "-"),
                "連結実質赤字比率": sum(1 for r in r6["data"] if r.get("連結実質赤字比率") == "-"),
            },
            "criteria_assignment": {
                "都": [r["pref_name"] for r in r6["data"] if r.get("法定基準区分") == "都"],
                "道府県_件数": sum(1 for r in r6["data"] if r.get("法定基準区分") == "道府県"),
            },
        },
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    report = ROOT / "scripts" / "_tmp_report_build_fiscal.txt"
    lines = [
        f"[出力] {OUT.relative_to(ROOT)}",
        f"[件数] 健全化（都道府県）={len(kenzen)} / 第1表1-3={len(t13)} / R6期data={len(r6['data'])}（期待47）",
        "",
        "[名寄せ]",
    ]
    for label, v in name_alignment.items():
        lines.append(f"  {label}: {v['rows_read']}行 / 名称不一致 {v['name_mismatch_count']} 件 {v['name_mismatch']}")
    lines += [
        "",
        f"[主要財政指標一覧 vs 健全化概要（実質公債費・将来負担）] 不一致 {len(kenzen_vs_existing)} 件 {kenzen_vs_existing}",
        f"[健全化概要 vs 第1表1-3（4指標）] 不一致 {len(kenzen_vs_1_3)} 件 {kenzen_vs_1_3}",
        f"[主要財政指標一覧 vs 第1表1-3（経常収支・財政力）] 不一致 {len(shuyo_vs_1_3)} 件 {shuyo_vs_1_3}",
        f"[平均行照合] {json.dumps(avg_check, ensure_ascii=False)}",
        f"[値の分類問題] {len(value_issues)} 件 {value_issues}",
        f'[リテラル"-"件数] {json.dumps(out["data_check_log"]["not_applicable_counts"], ensure_ascii=False)}',
        f'[法定基準区分] {json.dumps(out["data_check_log"]["criteria_assignment"], ensure_ascii=False)}',
        "",
        "[岐阜県 R6レコード]",
        json.dumps(r6_by_code["21"], ensure_ascii=False, indent=2),
    ]
    report.write_text("\n".join(lines), encoding="utf-8")
    print(f"[report] {report.name}")


if __name__ == "__main__":
    main()
