# -*- coding: utf-8 -*-
"""議会のすがた「議員定数」市区町村版JSONに全国・類似団体比較(comparison)を追加する。

対象（content-spec-v1.md §7.13 3-2 議員定数・現員 / docs/similar-group-aggregation-design.md）:
  3-2 議員定数（条例定数。岐阜42市区町村・比較値=全国平均・類似団体平均・順位・百分位つき）
  比較対象は条例定数のみ（現員・会派・党派は対象外。components/CouncilSeatsCard.tsx の設計に従う）。

入力（取得済みローカルファイルのみ。ネットワークアクセスをしない）:
  poc/recon-20260828/3-2/001062130_giin_teisuu_r7.txt
    （総務省「議員定数に関する調」令和7年4月1日現在・001062130.pdf を pdftotext -enc UTF-8 -layout で抽出したテキスト。
      全国市区町村1741団体を収録する内訳表。source: https://www.soumu.go.jp/main_content/001062130.pdf）
  poc/recon-20260828/0/ruikei_kubun_r06.xlsx（類似団体区分マスタ・市町村一覧シート・1741団体）

更新（既存ファイルを書き換え・新規ファイルは作らない）:
  data/gikai_assembly.json の各レコード（42件）に comparison フィールドを追加する。
  既存データ（2026-08-28取得・令和5年版基準）とR7版の間で条例定数が食い違っていた3件
  （関市・養老町・揖斐川町）は、運営者裁定によりR7版の値へ更新する（2026-09-26）。
  この3件はいずれもR7版で「定数＝現員（欠員0）」のため、現員数も同時にR7版の値へ更新する
  （定数のみ更新すると現員＞定数という矛盾したデータになるため。会派データとの突合でも矛盾なしを確認済み）。

集計（docs/similar-group-aggregation-design.md §3・§4・§9・§10。m1_2b_daynight_comparison.py と同一の実装パターン）:
  母集団M = 区分マスタ（1741）∩ 議員定数調本文から条例定数を抽出できた団体（全数一致を要求。部分一致は許容しない）。
  束ね写像：政令指定都市・中核市・施行時特例市・特別区 → "大都市"。他は類団区分の生ラベルをそのまま使う。
  順位：降順 competition ranking（同値は同順位、次の順位を飛ばす）。
  percentile = (rank_out_of − rank + 1) / rank_out_of × 100（小数第1位）。
  average_method = "unweighted_mean"（単純算術平均。人口加重等はしない）。

県引数（2026-10-17・D-24 共通化）:
  python scripts/gikai_3_2_teiin_comparison.py --pref 23   # 愛知など
  岐阜以外は data/gikai_assembly.json を書き換えず、条例定数・現員・比較値だけを data/gikai_teiin_{県コード}.json に書く
  （公開しない）。正副議長・会派・議事録公開は各議会サイトの個別調査が要るため、この系統には入れない。
  対象団体と名称は自治体マスタ（scripts/pref_args.py）。

規律:
  - 都道府県名・市区町村名の突合は Unicode NFKC 正規化してから行う（CJK互換漢字対策。例：大阪府貝塚市の「塚」）。
  - ノイズ語での行除外に「定数割れ」を含めない（定数割れが実際に発生した自治体の実データ行にも出現するため）。
  - 母集団は1741団体全件の突合成功を要求する（部分的な不一致がある場合は推測で埋めず中断する）。
  - 既存42件との定数不一致は、運営者裁定済みの3件（212059・213411・214019）以外は想定外として中断する。
  - 評価語・評価色・複合スコアは付けない（中立性・D-4/D-6/D-18）。
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

from pref_args import DEFAULT_PREF, load_master_cities, load_master_pref_name, out_path, parse_pref

ROOT = Path(__file__).resolve().parents[1]

TEIIN_TXT = ROOT / "poc" / "recon-20260828" / "3-2" / "001062130_giin_teisuu_r7.txt"
RUIKEI_SRC = ROOT / "poc" / "recon-20260828" / "0" / "ruikei_kubun_r06.xlsx"
OUT = ROOT / "data" / "gikai_assembly.json"

UPDATED = date.today().isoformat()
PREF = parse_pref(sys.argv[1:])
IS_DEFAULT = PREF == DEFAULT_PREF

DAITOSHI_KUBUN = {1, 2, 8, 9}  # 政令指定都市・特別区・中核市・施行時特例市 → "大都市"（m1_2b_daynight_comparison.py と同一）

# 運営者裁定（2026-09-26）：既存データ（令和5年版基準・2026-08-28取得）とR7版で条例定数が食い違う3件。
# R7版の値を適用する。3件ともR7版で「定数＝現員」のため、現員も同時にR7版の値へ更新する。
KNOWN_UPDATES = {
    "212059": {"name": "関市", "old_teisuu": 23, "old_jissu": 22, "new_teisuu": 22, "new_jissu": 22},
    "213411": {"name": "養老町", "old_teisuu": 13, "old_jissu": 13, "new_teisuu": 11, "new_jissu": 11},
    "214019": {"name": "揖斐川町", "old_teisuu": 15, "old_jissu": 15, "new_teisuu": 13, "new_jissu": 13},
}

# §9実データ検証（similar-group-aggregation-design.md）の岐阜実測アンカー。
# 区分マスタのみに依存する束ね後区分・団体数のため指標に依らず共通（m1_2b_daynight_comparison.py と同一）。
ANCHOR = {
    "gifu_shi_group": "大都市",
    "gifu_shi_group_n": 128,
    "ogaki_shi_group": "Ⅳ－２",
    "ogaki_shi_group_n": 75,
    "takayama_shi_group": "Ⅱ－１",
    "takayama_shi_group_n": 127,
}

SUBTOTAL_LABELS = {"市計", "区計", "町村計", "合計"}
NOISE_WORDS = [
    "都道府県名", "議員定数", "議員実数", "前回調査時回答", "令和7年4月1日現在",
    "令和5年4月1日現在", "単位", "直近の議会議員", "選挙の状況", "無投票又は",
    "執行日", "定数増減",
]
# 注意: "定数割れ" はヘッダーの列見出しにも、定数割れが実際に起きた自治体の行の値にも
# 出現するため、ノイズ語から除外する（ヘッダー行は「無投票又は」で既に検出できる）。

PAT = re.compile(r"^\s*(\S+)?\s+(\S+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(-?[\d,]+)\s+(.*)$")
PAT_DASH = re.compile(r"^\s*(\S+)?\s+(\S+)\s+([\d,]+)\s+－\s+([\d,]+)\s+([\d,]+)\s+(-?[\d,]+)\s+(.*)$")


class Abort(Exception):
    """欠損・単位不一致・アンカー不一致・想定外の差分などで処理を止めるための例外。推測で続行しない。"""


def s(v) -> str:
    """素通しの文字列化（NFKC正規化はしない）。類団区分ラベル（Ⅳ－２等のローマ数字・全角記号を
    意図して含む）や数値のように、字体を変えてはいけない値に使う。"""
    if v is None:
        return ""
    return str(v).strip()


def norm(v) -> str:
    """都道府県名・市区町村名の突合キー専用。NFKC正規化する（CJK互換漢字対策。
    例：大阪府貝塚市の「塚」がPDF側はU+FA10・区分マスタ側はU+585Aで字形が割れる）。
    類団区分ラベル（ローマ数字Ⅳ等）には使わない — s() を使うこと。"""
    return unicodedata.normalize("NFKC", s(v))


# --------------------------------------------------------------------------------------
# 区分マスタ（類似団体区分）：code6 -> group_code、および (pref_norm, name_norm) -> code6
# --------------------------------------------------------------------------------------
def load_ruikei_master() -> tuple[dict[str, dict], dict[tuple[str, str], str]]:
    from openpyxl import load_workbook

    wb = load_workbook(RUIKEI_SRC, read_only=True, data_only=True)

    pref_sheet = next((n for n in wb.sheetnames if "都道府県一覧" in n), None)
    city_sheet = next((n for n in wb.sheetnames if "市町村一覧" in n), None)
    if pref_sheet is None or city_sheet is None:
        raise Abort(f"ruikei: 必要シートが見つからない（実在={wb.sheetnames}）")

    prefix2pref: dict[str, str] = {}
    for row in wb[pref_sheet].iter_rows(values_only=True):
        if not row or not row[0]:
            continue
        code = s(row[0])
        name = norm(row[1]) if len(row) > 1 else ""
        if re.fullmatch(r"\d{6}", code) and name:
            prefix2pref[code[:2]] = name
    if len(prefix2pref) != 47:
        raise Abort(f"ruikei: 都道府県一覧が47件ではない（実測={len(prefix2pref)}）")

    ws = wb[city_sheet]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    hidx = None
    for i, row in enumerate(rows):
        if s(row[0] if row else None) == "団体コード":
            hidx = i
            break
    if hidx is None:
        raise Abort("ruikei: ヘッダ行（1列目='団体コード'）が見つからない")

    by_code: dict[str, dict] = {}
    by_prefname: dict[tuple[str, str], str] = {}
    for row in rows[hidx + 1 :]:
        code = s(row[0]) if len(row) > 0 else ""
        if not re.fullmatch(r"\d{6}", code):
            continue
        name = norm(row[1])
        danntai_kubun_raw = row[2]
        ruikei_raw = s(row[4])
        if not ruikei_raw:
            continue
        try:
            danntai_kubun = int(danntai_kubun_raw)
        except (TypeError, ValueError):
            raise Abort(f"ruikei: {code} の団体区分が数値でない: {danntai_kubun_raw!r}")
        group_code = "大都市" if danntai_kubun in DAITOSHI_KUBUN else ruikei_raw
        by_code[code] = {"name": name, "group_code": group_code}
        pref = prefix2pref.get(code[:2], "")
        by_prefname[(pref, name)] = code
    if len(by_code) != 1741:
        raise Abort(f"ruikei: 市町村一覧の件数が1741ではない（実測={len(by_code)}）")
    print(f"  [ruikei] 市町村一覧 {len(by_code)}件・都道府県 {len(prefix2pref)}件を読み込み")
    return by_code, by_prefname


# --------------------------------------------------------------------------------------
# 議員定数に関する調（R7版・内訳表）
# --------------------------------------------------------------------------------------
def parse_teisuu_r7() -> list[dict]:
    lines = TEIIN_TXT.read_text(encoding="utf-8").splitlines()

    start_idx = None
    for i, l in enumerate(lines):
        if "イ" in l and "内訳表" in l:
            start_idx = i
            break
    if start_idx is None:
        raise Abort("teisuu_r7: 『イ．内訳表』の開始行が見つからない")

    current_pref = None
    records: list[dict] = []
    unrecognized: list[str] = []

    for l in lines[start_idx + 1 :]:
        s = l.rstrip("\n")
        if not s.strip():
            continue
        if any(w in s for w in NOISE_WORDS):
            continue

        m = PAT.match(s)
        if m:
            pref_tok, name_tok, t7, j7, t5, j5, zogen, rest = m.groups()
            name_n = norm(name_tok)
            if name_n in SUBTOTAL_LABELS:
                continue
            if pref_tok:
                current_pref = norm(pref_tok)
            records.append(
                {
                    "pref": current_pref,
                    "name": name_n,
                    "teisuu_r7": int(t7.replace(",", "")),
                    "jissu_r7": int(j7.replace(",", "")),
                }
            )
            continue

        m2 = PAT_DASH.match(s)
        if m2:
            pref_tok, name_tok, t7, t5, j5, zogen, rest = m2.groups()
            name_n = norm(name_tok)
            if pref_tok:
                current_pref = norm(pref_tok)
            records.append(
                {
                    "pref": current_pref,
                    "name": name_n,
                    "teisuu_r7": int(t7.replace(",", "")),
                    "jissu_r7": None,  # 議会解散等により現員「－」
                }
            )
            continue

        if re.search(r"[一-龥ぁ-んァ-ヶ]+", s):
            unrecognized.append(s)

    # 未認識行（小計・「定数割れ」注記単独行等のノイズ）は診断表示のみに留める。
    # 成否は最終的な母集団突合件数（1741件全数一致）で判定する（下記main()参照）。
    print(f"  [teisuu_r7] 内訳表から{len(records)}件を抽出・未認識行{len(unrecognized)}件（小計/注記等のノイズと推定）")
    return records


# --------------------------------------------------------------------------------------
# 集計
# --------------------------------------------------------------------------------------
def ranks_desc(values: list[float]) -> list[int]:
    """降順の competition ranking（同値は同順位、次の順位を飛ばす。1,2,2,4）。"""
    return [1 + sum(1 for w in values if w > v) for v in values]


def write_pref(population, codes, national_average, group_average, ranks, n_total, n_ruikei):
    """岐阜以外：自治体マスタの団体について、条例定数・現員・比較値だけを data/gikai_teiin_{県コード}.json に書く。"""
    cities = load_master_cities(PREF)
    pref_name = load_master_pref_name(PREF)
    print(f"== {pref_name} の書き出し（自治体マスタ {len(cities)} 団体） ==")
    rows = []
    for code6, name in sorted(cities.items()):
        p = population.get(code6)
        if p is None:
            raise Abort(f"{name}（{code6}）が母集団Mに無い。JSONを書かずに中断した。")
        if p["name"] != norm(name):
            raise Abort(f"{code6} の名称が区分マスタと違う: {p['name']!r} / {name!r}")
        rank = ranks[code6]
        pct = round((n_total - rank + 1) / n_total * 100, 1)
        rows.append({
            "area_code": code6,
            "市区町村名": name,
            "議員定数": p["value"],
            "現員数": p["jissu_r7"],
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
                    f"全国{n_total}市区町村中の順位（母集団=類似団体区分マスタ登載団体{n_ruikei}のうち、"
                    "総務省『議員定数に関する調』令和7年4月1日現在で条例定数を確認できた団体）。"
                    "類似団体平均は総務省の類似団体区分（束ね後）の単純算術平均。比較対象は条例定数のみ"
                    "（現員・会派・党派は対象外）。"
                ),
            },
        })
    null_jissu = [r["市区町村名"] for r in rows if r["現員数"] is None]
    payload = {
        "updated": UPDATED,
        "period": "令和7年4月1日現在",
        "notes": [
            f"D-24 の試作（公開しない）。対象は自治体マスタ data/municipality_master_{PREF}.json の{pref_name}内{len(rows)}団体（政令指定都市の区の行は含めない）。",
            "条例定数・現員は総務省『議員定数に関する調』令和7年4月1日現在の内訳表（001062130.pdf）。正副議長・会派・議事録公開は各議会サイトの個別調査が要るため、この系統には含めない。",
            "comparison の定義は岐阜版（data/gikai_assembly.json）と同じ（母集団1741・単純算術平均・競争順位・百分位）。評価語・評価色は付与しない。",
            *([f"現員が『－』（議会解散等）の団体: {null_jissu}。現員数は null。"] if null_jissu else []),
        ],
        "sources": [
            {
                "role": "議員定数・現員（令和7年4月1日現在）",
                "source_url": "https://www.soumu.go.jp/main_content/001062130.pdf",
                "source_page": "https://www.soumu.go.jp/senkyo/senkyo_s/data/syozoku/index.html",
                "fetched_at": "2026-09-26",
            }
        ],
        "data": rows,
    }
    target = out_path("gikai_teiin", PREF)
    with target.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"  wrote {target.relative_to(ROOT)}  ({len(rows)}件・現員『－』{len(null_jissu)}件)")
    for r in sorted(rows, key=lambda r: -r["議員定数"])[:3]:
        c = r["comparison"]
        print(f"  {r['市区町村名']}（{r['area_code']}）: 定数{r['議員定数']} 全国{c['rank']}位/{c['rank_out_of']} 区分={c['group_code']} 区分平均={c['group_average']}")


def main():
    for p in (TEIIN_TXT, RUIKEI_SRC) + ((OUT,) if IS_DEFAULT else ()):
        if not p.exists():
            raise Abort(f"入力ファイルが無い: {p}")

    if IS_DEFAULT:
        print("== 既存JSON読み込み ==")
        payload = json.loads(OUT.read_text(encoding="utf-8"))
        existing = payload["data"]
        if len(existing) != 42:
            raise Abort(f"既存JSONのレコード数が42ではない（実測={len(existing)}）")

    print("== 区分マスタ読み込み ==")
    ruikei_by_code, ruikei_by_prefname = load_ruikei_master()

    print("== R7版 議員定数調 読み込み ==")
    teisuu_records = parse_teisuu_r7()

    print("== 突合（区分マスタ×R7版） ==")
    matched = 0
    unmatched: list[dict] = []
    teisuu_by_code: dict[str, dict] = {}
    for r in teisuu_records:
        code = ruikei_by_prefname.get((r["pref"], r["name"]))
        if code is None:
            unmatched.append(r)
            continue
        matched += 1
        teisuu_by_code[code] = r
    print(f"  matched: {matched} / {len(teisuu_records)}  unmatched: {len(unmatched)}")
    if unmatched:
        raise Abort(f"teisuu_r7: 突合できない行が{len(unmatched)}件ある（先頭5件）: {unmatched[:5]!r}")
    if len(teisuu_by_code) != 1741:
        raise Abort(f"teisuu_r7: 突合成功件数が1741ではない（実測={len(teisuu_by_code)}）。母集団は全数一致を要求する。")

    print("== 母集団Mの構築（区分マスタ1741 ∩ R7版1741 = 1741） ==")
    population: dict[str, dict] = {}
    for code, meta in ruikei_by_code.items():
        t = teisuu_by_code[code]
        population[code] = {
            "value": t["teisuu_r7"],
            "jissu_r7": t["jissu_r7"],
            "group_code": meta["group_code"],
            "name": meta["name"],
        }

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

    print("== アンカー自己検証（§9実データ検証・2026-08-29の区分構成に基づく） ==")

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

    if not IS_DEFAULT:
        write_pref(population, codes, national_average, group_average, ranks, n_total, len(ruikei_by_code))
        return

    print("== 既存42件との整合確認・キー集合の一致 ==")
    gifu_codes = sorted(c for c in codes if c.startswith("21"))
    if len(gifu_codes) != 42:
        raise Abort(f"岐阜県内市区町村が{len(gifu_codes)}件（42件ではない）")
    by_area_code = {r["area_code"]: r for r in existing}
    if set(by_area_code.keys()) != set(gifu_codes):
        raise Abort("既存JSONのarea_codeと母集団Mの岐阜42件のキー集合が一致しない。JSONを書かずに中断した。")

    print("== 定数不一致の検出・適用（運営者裁定済み3件以外は想定外として中断） ==")
    unexpected = []
    applied = []
    already_applied: set[str] = set()
    for rec in existing:
        code = rec["area_code"]
        p = population[code]
        if rec["議員定数"] == p["value"]:
            if code in KNOWN_UPDATES:
                already_applied.add(code)  # 再実行：裁定済みの更新は適用済み（2回目以降は何もしない）
            continue
        upd = KNOWN_UPDATES.get(code)
        if upd is None or upd["new_teisuu"] != p["value"]:
            unexpected.append((rec["市区町村名"], code, rec["議員定数"], p["value"]))
            continue
        rec["議員定数"] = upd["new_teisuu"]
        rec["現員数"] = upd["new_jissu"]
        rec["data_correction_log"].append(
            f"議員定数を{upd['old_teisuu']}→{upd['new_teisuu']}へ更新（総務省『議員定数に関する調』"
            f"令和7年4月1日現在・001062130.pdf。既存値は令和5年版基準だった）。"
            f"R7版では定数＝現員（欠員0）のため、現員数も{upd['old_jissu']}→{upd['new_jissu']}へ同時に更新した"
            "（定数のみ更新すると現員＞定数の矛盾を生じるため。会派データとの突合でも矛盾なしを確認済み。"
            "運営者裁定2026-09-26）。"
        )
        applied.append((rec["市区町村名"], code, upd["old_teisuu"], upd["new_teisuu"]))
    if unexpected:
        raise Abort(f"想定外の定数不一致がある（運営者未裁定）。JSONを書かずに中断した: {unexpected!r}")
    print(f"  適用済み更新: {len(applied)}件 {applied}")
    # 初回は applied、再実行時は already_applied に入る。どちらでもない裁定済み団体があれば異常。
    if {c for _, c, _, _ in applied} | already_applied != set(KNOWN_UPDATES.keys()):
        raise Abort("既知の3件のうち、適用も適用済み確認もできなかったものがある。JSONを書かずに中断した。")

    print("== 既存レコードへ comparison を付与 ==")
    for rec in existing:
        code = rec["area_code"]
        p = population[code]
        if rec["議員定数"] != p["value"]:
            raise Abort(f"{rec['市区町村名']}（{code}）: 更新後もR7版と不一致。JSONを書かずに中断した。")
        rank = ranks[code]
        pct = round((n_total - rank + 1) / n_total * 100, 1)
        rec["comparison"] = {
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
                "総務省『議員定数に関する調』令和7年4月1日現在で条例定数を確認できた団体）。"
                "類似団体平均は総務省の類似団体区分（束ね後）の単純算術平均。比較対象は条例定数のみ"
                "（現員・会派・党派は対象外）。"
            ),
        }

    payload["updated"] = UPDATED
    payload.setdefault("notes", [])
    comparison_note_prefix = "comparison（全国平均・類似団体平均・全国順位・百分位）は"
    payload["notes"] = [n for n in payload["notes"] if not n.startswith(comparison_note_prefix)]
    payload["notes"].append(
        "comparison（全国平均・類似団体平均・全国順位・百分位）は2026-09-26追加（F-5・A-8）。比較対象は条例定数のみ"
        "（現員・会派・党派は対象外。components/CouncilSeatsCard.tsx の設計に従う）。"
        "docs/similar-group-aggregation-design.md §3・§4の集計段の定義に従う。"
        f"母集団M = 区分マスタ（総務省 類似団体区分マスタ・{len(ruikei_by_code)}団体）"
        f"∩ 総務省『議員定数に関する調』令和7年4月1日現在（001062130.pdf）に条例定数がある団体 = {n_total}団体（1741団体全数一致）。"
        "national_average は母集団Mの単純算術平均、group_average は束ね後区分ごとの単純算術平均"
        "（average_method=\"unweighted_mean\"）。束ね写像：政令指定都市・中核市・施行時特例市・特別区は『大都市』"
        "に統合。それ以外は類団区分の原ラベルをそのまま使う。"
        "rank は母集団M内での値の降順順位（1=最大値。同値は同順位・次の順位を飛ばすcompetition ranking）。"
        "percentile = (rank_out_of − rank + 1) / rank_out_of × 100（小数第1位）。"
        "評価語・評価色・複合スコアは付与していない（20260808_decisions.md D-4／D-6／D-18）。"
    )
    known_note_prefix = "関市・養老町・揖斐川町の3件は"
    payload["notes"] = [n for n in payload["notes"] if not n.startswith(known_note_prefix)]
    payload["notes"].append(
        "関市・養老町・揖斐川町の3件は、既存データ（2026-08-28取得・令和5年版基準）とR7版で条例定数が食い違って"
        "いたため、運営者裁定（2026-09-26）によりR7版の値へ更新した（各レコードのdata_correction_log参照）。"
        "R7版では3件とも定数＝現員のため、現員数も同時に更新した。他39件は定数一致。現員数は個別サイト収集"
        "（2026-09-10時点）を正とし、R7版（令和7年4月1日時点）との時点差による現員数のみの差異は本更新の対象外。"
    )

    payload.setdefault("sources", [])
    # 再実行しても同じ出典行が増えないよう、同じ role の行は置き換える
    payload["sources"] = [x for x in payload["sources"] if x.get("role") != "議員定数・現員（R7版へ更新・令和7年4月1日現在）"]
    payload["sources"].append(
        {
            "role": "議員定数・現員（R7版へ更新・令和7年4月1日現在）",
            "source_url": "https://www.soumu.go.jp/main_content/001062130.pdf",
            "source_page": "https://www.soumu.go.jp/senkyo/senkyo_s/data/syozoku/index.html",
            "fetched_at": "2026-09-26",
        }
    )

    print("== 書き出し ==")
    with OUT.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"  wrote {OUT.relative_to(ROOT)}  ({len(existing)}件にcomparison付与・{len(applied)}件の定数更新)")

    print("== 岐阜42件 議員定数順（サニティチェック用） ==")
    ranked = sorted(existing, key=lambda r: -r["comparison"]["value"])
    for r in ranked[:3] + ranked[-3:]:
        c = r["comparison"]
        print(
            f"  {r['市区町村名']}（{r['area_code']}）: 定数{c['value']} "
            f"全国{c['rank']}位/{c['rank_out_of']}（上位{c['percentile']}%） "
            f"区分={c['group_code']} 区分平均={c['group_average']} 全国平均={c['national_average']}"
        )


if __name__ == "__main__":
    try:
        main()
    except Abort as exc:
        print(f"\n!! 中断: {exc}", file=sys.stderr)
        sys.exit(1)
