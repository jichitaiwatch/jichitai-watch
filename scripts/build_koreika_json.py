# -*- coding: utf-8 -*-
"""まちのすがた #3 高齢化率の生値JSONを、市区町村（岐阜42）と都道府県（47＋全国計）で生成する。

入力（取得済みローカル1本のみ・新規ダウンロードなし）:
  総務省ファイルID 000892953 令和8年1月1日住民基本台帳年齢階級別人口（市区町村別）（総計）
  poc/recon-20261012-juki-r8/soumu_000892953_juki_shichoson_age_r8.xlsx / シート「年齢別人口（市区町村別）【総計】」

出力（新規2本。既存JSONは読まない・書き換えない）:
  data/m1_1c_aging_rate.json      （市区町村42件・系譜 source_file_hash）
  data/pref_1c_aging_rate.json    （47都道府県＋全国計・系譜 source_file_hash_sha256）

県引数（2026-10-17・D-24 共通化）:
  python scripts/build_koreika_json.py --pref 23
  愛知など岐阜以外は市町村版 data/m1_1c_aging_rate_{県コード}.json だけを書く（県版は全国分が既にある）。
  対象団体は自治体マスタの市区町村行（scripts/pref_args.py）。団体コードは住基6桁で、マスタの area_code と同じ体系。

規律:
  - 列位置はハードコードせず、年齢階級ラベル・キー列見出しの文字列から同定する。
  - 比較値（全国平均・類団平均・順位）は算出しない（集計段で付与）。
  - アンカー値・件数を自己検証し、不一致なら例外で中断する。
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
sys.path.insert(0, str(ROOT / "scripts"))
from pref_args import DEFAULT_PREF, load_master_cities, load_master_pref_name, load_master_wards, out_path, parse_pref  # noqa: E402

PREF = parse_pref(sys.argv[1:])
IS_DEFAULT = PREF == DEFAULT_PREF
SRC = ROOT / "poc" / "recon-20261012-juki-r8" / "soumu_000892953_juki_shichoson_age_r8.xlsx"
POP_JSON = ROOT / "data" / "pref_1a_population.json"  # 県別の人口（令和8年）。総数の突合に使う
OUT = ROOT / "data"

UPDATED = date.today().isoformat()
NATIONAL_65_DIFF = None  # 全国計行と47都道府県合計の65歳以上人口の差（注記用）
PERIOD = "令和8年1月1日時点（住民基本台帳）"

SOURCE_FILE_ID = "000892953"
STAT_NAME = "住民基本台帳に基づく人口、人口動態及び世帯数"
SOURCE_URL = f"https://www.soumu.go.jp/main_content/{SOURCE_FILE_ID}.xlsx"
SOURCE_PAGE = "https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/jinkou_jinkoudoutai-setaisuu.html"
# 2026-10-12 に運営者が総務省サイトから取得した原本（e-Stat 掲載前）。ハッシュは実ファイルで固定する。
FETCHED_AT = "2026-10-12T21:20:00+09:00"
EXPECTED_SHA256 = "574ea5660baec38991875d032dab299ca7aac772b85760ab4385ae0d7b931491"
TITLE_MUST_HAVE = "令和8年1月1日"


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


def resolve_layout(ws):
    """(キー列行番号, キー列マップ, 総数列, 65歳以上列マップ) を返す。列番号は決め打ちしない。"""
    rows = []
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=20, values_only=True), start=1):
        vals = [s(v) for v in row]
        if vals and vals[0] == "団体コード":
            keycols = {v: c for c, v in enumerate(vals, start=1) if v and v != "人"}
            for lab in ("団体コード", "都道府県名", "市区町村名", "性別"):
                if lab not in keycols:
                    raise Abort(f"キー列 {lab!r} がヘッダに無い（実在={sorted(keycols)}）")
            age = None
            for prev in rows:
                if "総数" in prev and any("歳" in x for x in prev):
                    age = {v: c for c, v in enumerate(prev, start=1) if v}
            if not age:
                raise Abort("年齢階級ラベル行が見つからない")
            total_cols = [c for lab, c in age.items() if lab == "総数"]
            if len(total_cols) != 1:
                raise Abort(f"総数列を1つに確定できない（候補={total_cols}）")
            over65 = {lab: c for lab, c in age.items()
                      if re.match(r"^(6[5-9]|[7-9]\d|1\d\d)歳", lab) or "以上" in lab}
            if len(over65) != 8:
                raise Abort(f"65歳以上の列が {len(over65)} 列（8列ではない）: {sorted(over65)}")
            return i, keycols, total_cols[0], over65
        rows.append(vals)
    raise Abort("キー列行（1列目='団体コード'）が見つからない")


def table_title(ws) -> str:
    for row in ws.iter_rows(min_row=1, max_row=3, values_only=True):
        head = s(row[0] if row else "")
        if "住民基本台帳" in head and "年齢階級別人口" in head and TITLE_MUST_HAVE in head:
            return head
    raise Abort("表題行が見つからない")


def extract():
    wb = load_workbook(SRC, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    sheet_name = wb.sheetnames[0]
    title = table_title(ws)
    key_idx, keycols, c_total, over65 = resolve_layout(ws)
    c_code, c_pref, c_muni, c_sex = (keycols["団体コード"], keycols["都道府県名"],
                                     keycols["市区町村名"], keycols["性別"])
    max_col = max([c_total, *over65.values(), c_code, c_pref, c_muni, c_sex])

    munis, prefs, national = [], [], []
    gun_rows = []
    for row in ws.iter_rows(min_row=key_idx + 1, values_only=True):
        v = [s(x) for x in row]
        if len(v) < max_col:
            continue
        code, pref, muni, sex = v[c_code - 1], v[c_pref - 1], v[c_muni - 1], v[c_sex - 1]
        if sex != "計":  # 本指標は「計」行のみを使う（男・女は格納しない）
            continue
        is_pref_row = muni in ("", "-")
        is_national = code == "-" and pref == "合計"
        # 対象範囲（全国計／47都道府県計／岐阜県内の市区町村）に限って数値化する。
        # 範囲外には実データ上の特異行がある（例 016951_色丹郡色丹村 は総数0）。
        # 範囲内で欠損・0が出た場合は下の num()／総数チェックが中断させる。
        if not (is_national or is_pref_row or code.startswith(PREF)):
            continue
        where = f"{code}_{pref}_{muni}"
        rec = {
            "code": code,
            "pref": pref,
            "muni": muni,
            "総数": num(v[c_total - 1], f"{where} 総数"),
            "65歳以上人口": sum(num(v[c - 1], f"{where} {lab}") for lab, c in sorted(over65.items())),
        }
        if not rec["総数"]:
            raise Abort(f"総数が0または欠損: {where}")
        rec["高齢化率"] = round(rec["65歳以上人口"] / rec["総数"] * 100, 2)

        if is_national:
            national.append(rec)
        elif is_pref_row:
            # 住基6桁の都道府県コードは NN000X（チェックデジット付き）。3〜5桁目が '000'。
            # 『市区町村名が空/-』と『3〜5桁目=000』の2条件が一致することを要求する。
            by_name = True
            by_code = len(code) == 6 and code[2:5] == "000"
            if by_name != by_code:
                raise Abort(f"都道府県行の判別が2条件で食い違う: {where} (code[2:5]={code[2:5]!r})")
            prefs.append(rec)
        elif muni.endswith("郡"):
            gun_rows.append(rec)  # 郡の集計行。市区町村版からは除外する
        else:
            munis.append(rec)
    wb.close()
    return sheet_name, title, munis, prefs, national, gun_rows, c_total, over65


def source_entry(hash_key: str, file_hash: str, title: str):
    return {
        "source_url": SOURCE_URL,
        "source_page": SOURCE_PAGE,
        "stat_name": STAT_NAME,
        "table_title": title,
        "source_file_id": SOURCE_FILE_ID,
        "fetched_at": FETCHED_AT,
        hash_key: file_hash,
    }


def notes_for(kind: str, over65_labels, has_national: bool):
    common = [
        f"高齢化率(％) = 65歳以上人口 ÷ 総数 × 100。小数第2位で丸め。"
        f"65歳以上人口は5歳階級8列（{'／'.join(over65_labels)}）の合算。"
        "原資料に単一の『65歳以上』列は無いため合算した。分子・分母の原数値を併載しているため再計算可能。",
        "性別が『計』の行のみを対象とし、『男』『女』の行は格納していない（本指標では使わない）。",
        "総数・65歳以上人口の単位は人。値は原資料のまま（加工なし）。",
        "本ファイルは生値のみを格納する。比較値（全国平均・類団平均・全国順位）は含めず、集計段で付与する。",
        "対象範囲（岐阜県内42市区町村＋岐阜県計）の65歳以上8列・総数に欠損／非公表セルは無いことを生成前に全件確認済み"
        "（344セル、非数値トークン0件）。原資料には外国人少数団体で5歳階級を非公表とする注記があるが、本対象範囲では該当が出ていない。",
        "団体コードは住民基本台帳の6桁（例 212016=岐阜市、210005=岐阜県）。"
        "data/m1_1a_population_timeseries.json と同一体系で結合できる。"
        "国勢調査系JSON（data/m1_1b_single_household.json 等）の5桁とは別体系であり、先頭5桁での読み替えが必要。",
        "入力は取得済みのローカルファイル1本のみを使用し、本ファイル生成時に再ダウンロードはしていない。",
    ]
    if kind == "machi":
        return [
            "対象は岐阜県内の市区町村42件（団体コード先頭2桁=21）。郡の集計行（市区町村名が『郡』で終わる9行）と"
            "岐阜県計行は除外している。",
            "市区町村名は原資料のまま格納しており、町村には郡名が前置される（例『羽島郡岐南町』）。"
            "国勢調査系JSONの地域名（例『岐南町』）とは表記が異なるため、名称での結合はできない（コードで結合する）。",
            *common,
        ]
    pref_notes = [
        "対象は47都道府県（都道府県計行＝市区町村名が『-』の行。団体コードは NN000X 形式でチェックデジット付き）。"
        "市区町村行・郡集計行は含まない。",
    ]
    if has_national:
        pref_notes.append(
            "全国行の都道府県コードは原表が \"-\"（住基6桁体系に全国コードは存在しないため）。"
            "国勢調査系JSON（data/pref_2a_industry.json 等）の \"00000\" とは別体系であり、コード結合時に混同しないこと。"
            "都道府県名も原表のまま \"合計\" であり、他のpref系JSONの『全国』表記とは異なる。"
            "全国行は後段の全国比較用に同梱したものであり、都道府県の1件として数えない。"
        )
        if NATIONAL_65_DIFF is not None:
            pref_notes.append(
                f"全国行の65歳以上人口は、47都道府県の合計より{NATIONAL_65_DIFF}人多い（総数は一致）。"
                "原資料の全国計行の年齢階級別人口が、都道府県計行の合計と一致しない性質によるもので、"
                "前年版（令和7年）の原資料でも同様に生じている。本JSONは原資料の各行の値をそのまま格納している。"
            )
    return [*pref_notes, *common]


def write_json(path: Path, sources, notes, data, wards=None):
    payload = {
        "sources": sources,
        "period": PERIOD,
        "updated": UPDATED,
        "notes": notes,
        "data": data,
        **({"wards": wards} if wards else {}),
    }
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"  wrote {path.relative_to(ROOT)}  ({len(data)} records)")


def vals(rec):
    return {"総数": rec["総数"], "65歳以上人口": rec["65歳以上人口"], "高齢化率": rec["高齢化率"]}


def main():
    if not SRC.exists():
        raise Abort(f"入力ファイルが無い: {SRC}")
    print("== 抽出 ==")
    sheet, title, munis, prefs, national, gun, c_total, over65 = extract()
    labels = [lab for lab, _ in sorted(over65.items(), key=lambda kv: kv[1])]
    print(f"  シート: {sheet}")
    print(f"  表題  : {title}")
    print(f"  総数列=c{c_total} / 65歳以上列={[f'c{over65[l]}({l})' for l in labels]}")
    print(f"  対象範囲の抽出: 岐阜県内市区町村={len(munis)} 岐阜県内の郡集計行(除外)={len(gun)} "
          f"都道府県計行={len(prefs)} 全国計行={len(national)}")

    cities = load_master_cities(PREF)
    pref_name = load_master_pref_name(PREF)
    gifu = sorted((r for r in munis if r["code"] in cities), key=lambda r: r["code"])
    if set(r["code"] for r in gifu) != set(cities):
        raise Abort(f"{pref_name}の市区町村が原表から {len(gifu)} 件（自治体マスタ{len(cities)}件と一致しない）"
                    f" マスタのみ={sorted(set(cities) - set(r['code'] for r in gifu))[:8]}")
    if IS_DEFAULT and len(gifu) != 42:
        raise Abort(f"岐阜県内市区町村が {len(gifu)} 件（42件ではない）")
    if len(prefs) != 47:
        raise Abort(f"都道府県計行が {len(prefs)} 件（47件ではない）")
    if len(national) > 1:
        raise Abort(f"全国計行が {len(national)} 件（0または1件のはず）")
    has_national = len(national) == 1
    print(f"  → 岐阜42件 OK / 都道府県47件 OK / 全国行 {'あり' if has_national else 'なし'}")

    print("== 内部整合・突合検証（固定アンカーに依らない） ==")
    pref_by_code = {r["code"]: r for r in prefs}
    a = next((r for r in prefs if r["code"].startswith(PREF)), None)
    if a is None:
        raise Abort(f"{pref_name}計行（{PREF}000X）が見つからない")
    # (1) 47都道府県の総数合計 = 全国計行（総数・65歳以上人口）
    if has_national:
        tot = sum(r["総数"] for r in prefs)
        if tot != national[0]["総数"]:
            raise Abort(f"47都道府県の総数合計{tot}が全国計行{national[0]['総数']}と不一致")
        print(f"    OK  47都道府県の総数合計 = 全国計行 = {tot}")
        # 65歳以上は原資料の性質上、全国計行が47都道府県の合計より僅かに大きい（令和7年版の原本でも同様：
        # 各5歳階級で全国計行が県合計より大きく、総数だけが一致する）。
        # 許容は全国計行の0.01%以内とし、差は出力と注記に残す。
        tot65 = sum(r["65歳以上人口"] for r in prefs)
        diff65 = national[0]["65歳以上人口"] - tot65
        if not (0 <= diff65 <= national[0]["65歳以上人口"] * 0.0001):
            raise Abort(f"65歳以上人口: 全国計行 − 47都道府県合計 = {diff65}（許容は0以上かつ全国計の0.01%以内）")
        print(f"    OK  65歳以上人口: 全国計行 − 47都道府県合計 = {diff65}人（許容内。原資料の性質）")
        global NATIONAL_65_DIFF
        NATIONAL_65_DIFF = diff65
    # (2) 岐阜県内42市区町村＋郡集計行を除いた合計は岐阜県計に一致（総数・65歳以上）
    for k in ("総数", "65歳以上人口"):
        tot = sum(r[k] for r in gifu)
        if tot != a[k]:
            raise Abort(f"{pref_name}{len(gifu)}市区町村の{k}合計{tot}が県計{a[k]}と不一致")
        print(f"    OK  {pref_name}{len(gifu)}市区町村の{k}合計 = 県計 = {tot}")
    # (3) 総数が別ファイル（県別人口 data/pref_1a_population.json）の人口と一致
    pop = json.loads(POP_JSON.read_text(encoding="utf-8"))
    pop_rows = pop["data"] if isinstance(pop, dict) else pop
    def pop_total(r):
        for key in ("人口_計", "population_total"):
            if key in r:
                return r[key]
        raise Abort(f"pref_1a_population.json に人口_計が無い: keys={list(r)}")
    def pop_code(r):
        for key in ("都道府県コード", "code", "pref_code"):
            if key in r:
                return str(r[key])
        raise Abort(f"pref_1a_population.json に都道府県コードが無い: keys={list(r)}")
    pop_by = {pop_code(r): pop_total(r) for r in pop_rows}
    mism = [(r["code"], r["総数"], pop_by.get(r["code"])) for r in prefs if pop_by.get(r["code"]) != r["総数"]]
    if mism:
        raise Abort(f"県別人口との総数不一致 {len(mism)}件: {mism[:3]}")
    print("    OK  47都道府県の総数 = data/pref_1a_population.json の人口_計（47件全一致）")

    file_hash = sha256_of(SRC)
    if file_hash != EXPECTED_SHA256:
        raise Abort(f"入力のsha256が想定と不一致\n  実測={file_hash}\n  想定={EXPECTED_SHA256}")
    print("    OK  入力sha256が想定値と一致")

    print("== 書き出し ==")
    machi_notes = notes_for("machi", labels, has_national)
    if not IS_DEFAULT:
        machi_notes = [f"対象は{pref_name}内の市区町村{len(gifu)}件（自治体マスタ data/municipality_master_{PREF}.json の団体。"
                       "郡の集計行・県計行は除く）。D-24 の試作（公開しない）。", *machi_notes[1:]]
    # 政令市の区（試作のみ。マスタに kind="ward" の行がある県）。市の行（data）とは分け、wards に置く
    ward_master = load_master_wards(PREF)
    ward_rows = sorted((r for r in munis if r["code"] in ward_master), key=lambda r: r["code"])
    if ward_master:
        if set(r["code"] for r in ward_rows) != set(ward_master):
            raise Abort(f"区が原表から {len(ward_rows)} 件（マスタ{len(ward_master)}件と一致しない）")
        for pc in sorted({p for _, p in ward_master.values()}):
            kids = [r for r in ward_rows if ward_master[r["code"]][1] == pc]
            parent = next(r for r in gifu if r["code"] == pc)
            for k in ("総数", "65歳以上人口"):
                if sum(r[k] for r in kids) != parent[k]:
                    raise Abort(f"{parent['muni']}の区{len(kids)}件の{k}合計{sum(r[k] for r in kids)}が市の値{parent[k]}と不一致")
            print(f"    OK  {parent['muni']}の区{len(kids)}件の総数・65歳以上人口の合計 = 市の値")
    write_json(
        out_path("m1_1c_aging_rate", PREF),
        [source_entry("source_file_hash", file_hash, title)],
        machi_notes,
        [{**({} if IS_DEFAULT else {"area_code": r["code"]}),
          "市区町村コード": r["code"], "都道府県": r["pref"], "市区町村名": r["muni"], **vals(r)} for r in gifu],
        wards=[{"area_code": r["code"], "市区町村コード": r["code"], "都道府県": r["pref"], "市区町村名": r["muni"],
                "parent_area_code": ward_master[r["code"]][1], **vals(r)} for r in ward_rows],
    )
    if not IS_DEFAULT:
        return  # 県版（pref_*）は全国分が既にある。試作では書かない
    pref_rows = sorted([*national, *prefs], key=lambda r: r["code"])
    write_json(
        OUT / "pref_1c_aging_rate.json",
        [source_entry("source_file_hash_sha256", file_hash, title)],
        notes_for("pref", labels, has_national),
        [{"都道府県コード": r["code"], "都道府県名": r["pref"], **vals(r)} for r in pref_rows],
    )

    print("== アンカー実測値 ==")
    first = gifu[0]
    for label, r in ((f"{first['muni']}({first['code']})", first), (f"{pref_name}計({a['code']})", a),
                     *([("全国(団体コード'-'・都道府県名'合計')", national[0])] if has_national else [])):
        print(f"  {label}: 総数={r['総数']} 65歳以上={r['65歳以上人口']} 高齢化率={r['高齢化率']}%")


if __name__ == "__main__":
    try:
        main()
    except Abort as exc:
        print(f"\n!! 中断: {exc}", file=sys.stderr)
        sys.exit(1)
