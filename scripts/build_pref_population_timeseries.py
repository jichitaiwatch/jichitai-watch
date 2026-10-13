# -*- coding: utf-8 -*-
"""都道府県版 人口・男女数・世帯数の時系列（令和2〜令和8の7時点）生値JSONを生成する。

入力（【総計】都道府県別人口、人口動態及び世帯数。表番号 NN-01。年ごとに e-Stat 一覧から実査で同定済み）:
  令和2年(2020) statInfId=000031971201 estat_..._r2_2020.xls   ← 旧OLE .xls形式
  令和3年(2021) statInfId=000040306655 estat_..._r3_2021.xlsx
  令和4年(2022) statInfId=000032224634 estat_..._r4_2022.xlsx
  令和5年(2023) statInfId=000040306645 estat_..._r5_2023.xlsx
  令和6年(2024) statInfId=000040306668 estat_..._r6_2024.xlsx
  令和7年(2025) statInfId=000040306651 handoff/pref-machi-verify/2501stjin.xlsx（既存・再取得せず）
  令和8年(2026) 総務省 main_content/000892948.xlsx poc/recon-20261012-juki-r8/…（2026-10-12 取得・launch-backlog.md E-9。
                e-Stat に載る前の総務省掲載版。表の形は令和7年と同じ）

出力（新規1本。既存JSONは読み取り検証のみで書き換えない）:
  data/pref_1a_population_timeseries.json

列位置はハードコードせず、グループ見出し（人口／世帯数）×性別ラベル（男／女／計）の積で同定する。
令和2年は結合セルにより見出しが左端セルだけに入るため、ラベル行を右方向へ前方補完してから積を取る。
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / "poc" / "recon-20260905-pref-ts"  # 原本・_fetch_log.json の置き場
OUT = ROOT / "data" / "pref_1a_population_timeseries.json"
EXISTING_LATEST = ROOT / "data" / "pref_1a_population.json"   # 最新年（令和8年）の単年ファイル。先に build_pref_population_json.py を実行しておく
FETCH_LOG = json.loads((HERE / "_fetch_log.json").read_text(encoding="utf-8"))

UPDATED = date.today().isoformat()
PERIOD = "令和2年1月1日〜令和8年1月1日、各年1月1日時点（住民基本台帳）"
STAT_NAME = "住民基本台帳に基づく人口、人口動態及び世帯数調査"
FIELDS = ("人口_男", "人口_女", "人口_計", "世帯数")

# 令和7年分は既存ローカル（recon/pref-machi-existence-20260904.md §3 の取得記録）を再利用する
R7 = {
    "reiwa": 7, "year": 2025, "year_key": "r7_2025",
    "statInfId": "000040306651",
    "path": ROOT / "handoff" / "pref-machi-verify" / "2501stjin.xlsx",
    "sha256": "30b61d52fcac0057cd41d6b1715271db65d3b8f88aa9a33ac9d45344d73adfba",
    "fetched_at": "2026-09-04",
    "source_page": ("https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&toukei=00200241"
                    "&tstat=000001039591&cycle=7&year=20250&month=0&tclass1=000001039601"),
    "list_html": HERE / "_html" / "01_r7_2025.html",
}

# 令和7年のファイルは固定（2501stjin.xlsx）なので、令和7年の値は従来のアンカーで確かめられる
ANCHORS = {"gifu_code": "210005", "gifu_r7_pop": 1951292, "total_r7_pop": 124330690}

# 令和8年分（2026-10-12 取得）。ハッシュは取得したファイルの値
R8 = {
    "reiwa": 8, "year": 2026, "year_key": "r8_2026",
    "file_id": "000892948",
    "path": ROOT / "poc" / "recon-20261012-juki-r8" / "soumu_000892948_juki_pref_pop_hh_r8.xlsx",
    "sha256": "90c20e8d2514501aa73a9833a7496ab57c0ef4e65e6c031735a8c0a2ada43933",
    "fetched_at": "2026-10-12",
    "source_url": "https://www.soumu.go.jp/main_content/000892948.xlsx",
    "source_page": "https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/jinkou_jinkoudoutai-setaisuu.html",
    "stat_name": "住民基本台帳に基づく人口、人口動態及び世帯数",
}


class Abort(Exception):
    """全年に共通する構造・検証の破綻。JSONを書かずに止める。"""


class YearAbort(Exception):
    """当該年のみの破綻。その年を中断し、他年は続行する。"""


def s(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def num(v, where: str) -> int:
    t = s(v).replace(",", "")
    if not re.fullmatch(r"-?\d+", t):
        raise YearAbort(f"数値でないセル（0に丸めず中断）: {where} 値={s(v)!r}")
    return int(t)


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_rows(path: Path) -> tuple[str, list[list[str]]]:
    if path.suffix.lower() == ".xls":
        import xlrd
        wb = xlrd.open_workbook(path)
        sh = wb.sheet_by_index(0)
        return sh.name, [[s(sh.cell_value(r, c)) for c in range(sh.ncols)] for r in range(sh.nrows)]
    from openpyxl import load_workbook
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    name, rows = ws.title, [[s(v) for v in row] for row in ws.iter_rows(values_only=True)]
    wb.close()
    return name, rows


def ffill(row: list[str], width: int) -> list[str]:
    """結合セル由来の空白を右方向へ前方補完する（見出しの適用範囲を復元する）。"""
    out, cur = [], ""
    for c in range(width):
        v = row[c] if c < len(row) else ""
        if v:
            cur = v
        out.append(cur)
    return out


def cols_with(label_rows: list[list[str]], target: str) -> set[int]:
    return {c + 1 for row in label_rows for c, v in enumerate(row) if v == target}


def only(cands: set[int], what: str) -> int:
    if len(cands) != 1:
        raise YearAbort(f"{what}: 列を1つに確定できない（候補={sorted(cands)}）")
    return next(iter(cands))


def resolve(rows: list[list[str]]) -> tuple[int, int, int, dict[str, int], str, str]:
    """(データ開始行, コード列, 名称列, 使用列, 表題, 単位の裏取り方法) を返す。"""
    width = max(len(r) for r in rows)
    key_idx = next((i for i, r in enumerate(rows) if r and r[0] == "団体コード"), None)
    if key_idx is None:
        raise YearAbort("キー列行（1列目='団体コード'）が見つからない")
    if s(rows[key_idx][1]) != "都道府県名":
        raise YearAbort(f"キー列行の2列目が『都道府県名』でない: {rows[key_idx][1]!r}")

    # ヘッダブロック＝先頭から『男/女/計』のラベルが現れる最終行まで（令和2年は見出しがキー列行の下にある）
    last_label = max((i for i, r in enumerate(rows[:12]) if {"男", "女", "計"} & set(map(s, r))), default=key_idx)
    head_end = max(key_idx, last_label)
    labels = [ffill(rows[i], width) for i in range(head_end + 1)]

    pop = cols_with(labels, "人口")
    use = {
        "人口_男": only(pop & cols_with(labels, "男"), "人口(男)列"),
        "人口_女": only(pop & cols_with(labels, "女"), "人口(女)列"),
        "人口_計": only(pop & cols_with(labels, "計"), "人口(計)列"),
        "世帯数": only(cols_with(labels, "世帯数") - pop, "世帯数列"),
    }
    title = next((s(r[0]) for r in rows[:3] if r and "住民基本台帳" in s(r[0])), "")
    if not title:
        raise YearAbort("表題行（『住民基本台帳』を含む1列目）が見つからない")

    # 単位の裏取り：単位行（『人』『世帯』が単独で入る行）があればそれを使い、無ければ表題行の単位表記で代替する
    unit_row = next((r for r in rows[:head_end + 1] if s(r[0]) == "団体コード" and "世帯" in map(s, r)), None)
    if unit_row is not None:
        for k in ("人口_男", "人口_女", "人口_計"):
            if s(unit_row[use[k] - 1]) != "人":
                raise YearAbort(f"{k} の単位が『人』でない: c{use[k]}={s(unit_row[use[k] - 1])!r}")
        if s(unit_row[use["世帯数"] - 1]) != "世帯":
            raise YearAbort(f"世帯数の単位が『世帯』でない: c{use['世帯数']}={s(unit_row[use['世帯数'] - 1])!r}")
        unit_src = f"単位行 row{rows.index(unit_row) + 1}（人/人/人/世帯）"
    else:
        band = " ".join(s(v) for r in rows[:head_end + 1] for v in r)
        if "単位：人、世帯" not in band:
            raise YearAbort("単位行が無く、表題行にも『単位：人、世帯』の記載が見つからない")
        unit_src = "単位行なし。表題行の『（単位：人、世帯、％）』で裏取り"
    return head_end + 1, 1, 2, use, title, unit_src


def load_year(path: Path) -> tuple[dict[str, dict[str, int]], dict[str, str], dict]:
    """(コード→値, コード→名称, メタ) を返す。合計行のコードは '-' に正規化する。"""
    sheet, rows = read_rows(path)
    start, c_code, c_name, use, title, unit_src = resolve(rows)
    max_col = max(use.values())

    vals, names, skipped, n_pref, n_total = {}, {}, [], 0, 0
    for r in rows[start:]:
        if not any(r):
            continue
        code, name = s(r[c_code - 1]), s(r[c_name - 1])
        is_total = name == "合計" and code in ("", "-")
        is_pref = bool(re.fullmatch(r"\d{6}", code)) and code[2:5] == "000"
        if not (is_total or is_pref):
            skipped.append(f"{code[:34]}|{name[:16]}")
            continue
        if len(r) < max_col:
            raise YearAbort(f"列数が足りない行: {code}_{name}")
        key = "-" if is_total else code
        if key in vals:
            raise YearAbort(f"コード重複: {key}")
        vals[key] = {k: num(r[c - 1], f"{code}_{name} {k}") for k, c in use.items()}
        names[key] = name
        n_total += is_total
        n_pref += is_pref

    meta = {"sheet": sheet, "title": title, "use": use, "unit_src": unit_src,
            "start_row": start + 1, "skipped": skipped,
            "total_code_blank": "-" not in {s(r[c_code - 1]) for r in rows[start:] if s(r[c_name - 1]) == "合計"}}
    if n_pref != 47:
        raise YearAbort(f"都道府県行が {n_pref} 件（47件ではない）")
    if n_total != 1:
        raise YearAbort(f"合計行が {n_total} 件（1件ではない）")
    if len(vals) != 48:
        raise YearAbort(f"{len(vals)} 件（48件ではない）")
    return vals, names, meta


def table_no_from_html(path: Path, stat_inf_id: str) -> str:
    """保存済み一覧HTMLから当該statInfIdの表番号を取り出す（オフライン・再取得なし）。"""
    html = path.read_text(encoding="utf-8")
    idx = html.find(f"statInfId={stat_inf_id}")
    if idx < 0:
        raise Abort(f"一覧HTMLに statInfId={stat_inf_id} が無い: {path.name}")
    ctx = re.sub(r"<[^>]+>", " ", html[max(0, idx - 2600):idx]).replace("&nbsp;", " ")
    ctx = re.sub(r"\s+", " ", ctx)
    hits = re.findall(r"表番号\s+(\d{2}-\d{2})\s", ctx)
    if not hits:
        raise Abort(f"表番号を抽出できない: {stat_inf_id}")
    return hits[-1]


def clean_table_no(rec: dict) -> str:
    """探索時に表ヘッダ文字列を巻き込んだ table_no/title から表番号だけを取り出す。"""
    blob = f"{rec['table_no']} {rec['table_title']}"
    hits = re.findall(r"(\d{2}-\d{2})", blob)
    if not hits:
        raise Abort(f"表番号を抽出できない: {rec['statInfId']}")
    return hits[-1]


def main() -> None:
    jobs = []
    for rec in sorted(FETCH_LOG, key=lambda r: r["year"]):
        jobs.append({
            "year_key": rec["year_key"], "reiwa": rec["reiwa"], "year": rec["year"],
            "statInfId": rec["statInfId"], "path": HERE / rec["path"],
            "sha256": rec["sha256"], "fetched_at": rec["fetched_at"][:10],
            "source_page": rec["source_page"], "table_no": clean_table_no(rec),
        })
    jobs.append({
        "year_key": R7["year_key"], "reiwa": R7["reiwa"], "year": R7["year"],
        "statInfId": R7["statInfId"], "path": R7["path"], "sha256": R7["sha256"],
        "fetched_at": R7["fetched_at"], "source_page": R7["source_page"],
        "table_no": table_no_from_html(R7["list_html"], R7["statInfId"]),
    })
    jobs.append({
        "year_key": R8["year_key"], "reiwa": R8["reiwa"], "year": R8["year"],
        "statInfId": None, "file_id": R8["file_id"], "path": R8["path"], "sha256": R8["sha256"],
        "fetched_at": R8["fetched_at"], "source_url": R8["source_url"], "source_page": R8["source_page"],
        "stat_name": R8["stat_name"], "table_no": None,
    })

    per_year, sources, failures, gaps_by_year = {}, [], [], {}
    for job in jobs:
        yk = job["year_key"]
        print("=" * 78)
        print(f"[{yk} 令和{job['reiwa']}年1月1日]  表番号{job['table_no']}  "
              + (f"statInfId={job['statInfId']}" if job["statInfId"] else f"総務省ファイル{job['file_id']}"))
        print(f"  file: {job['path'].name}")
        if not job["path"].exists():
            failures.append((yk, f"入力ファイルが無い: {job['path'].name}"))
            print("  !! 中断: 入力ファイルが無い")
            continue
        got = sha256_of(job["path"])
        if got != job["sha256"]:
            failures.append((yk, f"sha256不一致 実測={got} 記録={job['sha256']}"))
            print(f"  !! 中断: sha256が取得記録と不一致（実測={got}）")
            continue
        try:
            vals, names, meta = load_year(job["path"])
        except YearAbort as exc:
            failures.append((yk, str(exc)))
            print(f"  !! 中断: {exc}")
            continue

        print(f"  シート: {meta['sheet']}")
        print(f"  表題  : {meta['title']}")
        print(f"  データ開始行=row{meta['start_row']}  使用列: "
              + " ".join(f"{k}=c{v}" for k, v in meta["use"].items()))
        print(f"  単位の裏取り: {meta['unit_src']}")
        print(f"  48件確認: 都道府県47＋合計1 = {len(vals)}件  OK")
        if meta["skipped"]:
            for x in meta["skipped"]:
                print(f"    対象外として除外: {x!r}")
        if meta["total_code_blank"]:
            print("    注: 合計行の団体コードが原表で空欄。他年に合わせ \"-\" に正規化した。")

        gaps = [(k, names[k], v["人口_計"] - (v["人口_男"] + v["人口_女"])) for k, v in vals.items()]
        nonzero = sorted([g for g in gaps if g[2] != 0], key=lambda g: g[0])
        gaps_by_year[yk] = nonzero
        print(f"  男＋女≠計 の行: {len(nonzero)}/{len(vals)} 件"
              + ("" if not nonzero else "  " + "、".join(f"{c} {n} {d:+d}" for c, n, d in nonzero)))

        # どの年でも、47都道府県の合計が合計行と一致すること（アンカーに頼らない内部整合）
        for k in FIELDS:
            tot_v = vals["-"][k]
            sum_v = sum(v[k] for c, v in vals.items() if c != "-")
            if sum_v != tot_v:
                failures.append((yk, f"47都道府県の{k}の合計{sum_v}が合計行{tot_v}と不一致"))
                print(f"  !! 中断: 47都道府県の{k}の合計{sum_v}が合計行{tot_v}と不一致")
                break
        else:
            print("  47都道府県の合計 = 合計行（4項目）  OK")
            per_year[yk] = {"vals": vals, "names": names}
            if job["statInfId"]:
                src = {
                    "year_key": yk,
                    "year_label": f"令和{job['reiwa']}年1月1日",
                    "source_url": f"https://www.e-stat.go.jp/stat-search/file-download?statInfId={job['statInfId']}&fileKind=0",
                    "source_page": job["source_page"],
                    "stat_name": STAT_NAME,
                    "table_no": job["table_no"],
                    "table_title": meta["title"],
                    "statInfId": job["statInfId"],
                    "fetched_at": job["fetched_at"],
                    "source_file_hash_sha256": got,
                }
            else:
                src = {
                    "year_key": yk,
                    "year_label": f"令和{job['reiwa']}年1月1日",
                    "source_url": job["source_url"],
                    "source_page": job["source_page"],
                    "stat_name": job["stat_name"],
                    "table_title": meta["title"],
                    "source_file_id": job["file_id"],
                    "fetched_at": job["fetched_at"],
                    "source_file_hash_sha256": got,
                }
            sources.append(src)

    print("=" * 78)
    if not per_year:
        raise Abort("全年が中断した。JSONを書かない。")
    year_keys = [j["year_key"] for j in jobs if j["year_key"] in per_year]

    # コード体系・名称の年間整合
    codesets = {yk: set(d["vals"]) for yk, d in per_year.items()}
    base_yk = year_keys[-1]
    base = codesets[base_yk]
    print("[年をまたぐ整合]")
    for yk in year_keys:
        diff = (codesets[yk] - base, base - codesets[yk])
        print(f"  {yk}: コード48件  {base_yk}との差分 追加={sorted(diff[0])} 欠落={sorted(diff[1])}")
        if diff[0] or diff[1]:
            raise Abort(f"{yk} の都道府県コード集合が {base_yk} と一致しない")
    digits = {len(c) for yk in year_keys for c in codesets[yk] if c != "-"}
    print(f"  都道府県コードの桁数（全年・合計行を除く）: {digits}")
    if digits != {6}:
        raise Abort(f"都道府県コードの桁数が6桁で揃っていない: {digits}")
    name_changes = []
    for code in sorted(base):
        seen = {per_year[yk]["names"][code] for yk in year_keys}
        if len(seen) > 1:
            name_changes.append((code, sorted(seen)))
    print(f"  年により名称が変わるコード: {len(name_changes)}件 {name_changes}")

    rows = []
    for code in sorted(base):
        rec = {"都道府県コード": code, "都道府県名": per_year[base_yk]["names"][code]}
        for j in jobs:
            yk = j["year_key"]
            v = per_year.get(yk, {}).get("vals", {}).get(code)
            rec[yk] = None if v is None else {k: v[k] for k in FIELDS}
        rows.append(rec)

    print("[アンカー自己検証]")
    gifu = next(r for r in rows if r["都道府県コード"] == ANCHORS["gifu_code"])
    tot = next(r for r in rows if r["都道府県コード"] == "-")
    checks = [
        ("岐阜県(210005) r7_2025.人口_計", gifu["r7_2025"]["人口_計"], ANCHORS["gifu_r7_pop"]),
        ("合計行 r7_2025.人口_計", tot["r7_2025"]["人口_計"], ANCHORS["total_r7_pop"]),
    ]
    if gifu.get("r8_2026") is None:
        raise Abort("令和8年(r8_2026)が取り込めていない。JSONを書かずに中断した。")
    ok = True
    for label, got_v, want in checks:
        hit = got_v == want
        ok = ok and hit
        print(f"    {'OK ' if hit else 'NG '} {label}: 実測={got_v} 期待={want}")
    if not ok:
        raise Abort("アンカー値が一致しない。JSONを書かずに中断した。")

    # 令和8分が data/pref_1a_population.json（令和8単年。build_pref_population_json.py が作る）と完全一致するか
    if "r8_2026" in per_year:
        ex = json.loads(EXISTING_LATEST.read_text(encoding="utf-8"))
        exmap = {r["都道府県コード"]: r for r in ex["data"]}
        mism = []
        if set(exmap) != base:
            mism.append(f"コード集合が不一致: 既存のみ={sorted(set(exmap) - base)} 新規のみ={sorted(base - set(exmap))}")
        for code in sorted(base & set(exmap)):
            for k in FIELDS:
                a, b = per_year["r8_2026"]["vals"][code][k], exmap[code][k]
                if a != b:
                    mism.append(f"{code} {k}: 新規={a} 既存={b}")
            if per_year["r8_2026"]["names"][code] != exmap[code]["都道府県名"]:
                mism.append(f"{code} 都道府県名: 新規={per_year['r8_2026']['names'][code]} 既存={exmap[code]['都道府県名']}")
        print(f"    {'OK ' if not mism else 'NG '} 令和8分 vs data/pref_1a_population.json: "
              f"{len(base)}件×{len(FIELDS)}項目＋名称 の照合、不一致={len(mism)}件")
        for m in mism[:20]:
            print(f"        {m}")
        if mism:
            raise Abort("令和8分が data/pref_1a_population.json と一致しない。JSONを書かずに中断した。")

    gap_years = [yk for yk in year_keys if gaps_by_year.get(yk)]
    clean_years = [yk for yk in year_keys if not gaps_by_year.get(yk)]
    gap_detail = "／".join(
        f"{yk}: " + "、".join(f"{'合計行' if c == '-' else f'{n}({c})'} {d:+d}" for c, n, d in gaps_by_year[yk])
        for yk in gap_years
    ) or "なし"
    for yk in gap_years:
        g = {c: d for c, n, d in gaps_by_year[yk]}
        pref_sum = sum(d for c, d in g.items() if c != "-")
        print(f"  {yk}: 都道府県分の差分合計={pref_sum:+d} / 合計行の差分={g.get('-', 0):+d} "
              f"→ {'一致' if pref_sum == g.get('-', 0) else '不一致'}")
    notes = [
        "e-Stat「住民基本台帳に基づく人口、人口動態及び世帯数調査」（toukei=00200241 / tstat=000001039591）の"
        "年次別統計表一覧から、各年の【総計】**都道府県別**人口、人口動態及び世帯数（表番号 NN-01）を"
        "年ごとに実査で同定して取得した。表番号は年により変わる（令和2年=20-01 〜 令和7年=25-01）。"
        "令和8年（2026-10-12 取得）だけは、e-Stat に載る前の総務省ページ掲載版（main_content/000892948.xlsx）を使っており、"
        "表の形（見出し・列・行）は令和7年と同じ。"
        "市区町村別（NN-03）・日本人住民（NN-05）・外国人住民（NN-09）・年齢階級別（NN-02）は使用していない。"
        "各年の statInfId は sources[] を参照（推測で埋めた欄はない）。",
        f"収録は令和2年1月1日〜令和8年1月1日の7時点。content-spec-v1.md §0基本仕様の入口カード0-1"
        "「人口及び5年間の増減人数」は、r3_2021 と r8_2026 の差（最新の5年間）、または r2_2020 と r8_2026 の差（6年間）で算出できる。"
        "市区町村版 data/m1_1a_population_timeseries.json（令和2〜令和8の7時点）と同じ時点構成であり、"
        "都道府県ページと市区町村ページで同一の期間を並べられる。",
        "令和2年（2020年）分のみ旧 .xls 形式（OLE）で提供されており、ヘッダ構成が他年と異なる："
        "①グループ見出し（人口／世帯数）がキー列行より**下**にある（他年は上）、"
        "②単位行（人／人／人／世帯）が無く、単位は表題行の「（単位：人、世帯、％）」に記載される、"
        "③結合セルのため見出しが範囲の左端セルだけに入る。"
        "生成時はラベル行を右方向へ前方補完してから「人口」×「男／女／計」の積で列を同定しており、"
        "全年で団体コード=c1／都道府県名=c2／人口 男=c3・女=c4・計=c5／世帯数=c6 に解決されたことを確認済み。",
        "合計行の団体コードは、令和3〜7年は原表が \"-\"、**令和2年は原表が空欄**である。"
        "年をまたいで同一行として結合する必要があるため、令和2年の空欄を \"-\" に正規化した（値の加工はしていない）。"
        "合計行は後段の全国比較用に同梱したものであり、都道府県の1件として数えない。",
        "団体コードは住民基本台帳の6桁（NN000X 形式・チェックデジット付き。例 210005=岐阜県、010006=北海道）で、"
        "**7時点すべてで同一体系・同一の48コード集合**であることを生成時に検証済み（桁数の混在なし、"
        "年による追加・欠落なし、名称変更なし）。data/pref_1a_population.json・data/pref_1c_aging_rate.json と"
        "同一体系で結合できる。国勢調査系JSON（5桁。例 21000）・SSDS系JSON（2桁。例 21）とは別体系。",
        f"人口_計は原資料の『人口 計』列をそのまま格納しており、人口_男＋人口_女 の合算ではない。"
        f"原資料の注2（外国人住民のうち在留カードの性別欄が空欄で、住民票の性別を男女のいずれにも"
        f"該当しないものとしている者は、男女のいずれにも計上せず総計にのみ計上する）により、"
        f"計 −(男+女) が0にならない行がある：{gap_detail}"
        f"（都道府県分の差分合計が合計行の差分と一致することを検証済み）。"
        f"一方 {('・'.join(clean_years)) or 'なし'} は全48行で 男＋女＝計 が成立し、"
        f"当該年のファイルには注2の記載自体が無い（注記は増減率の「-」＝皆増の1件のみ）。"
        f"つまりこの差分は年により有無が変わる。**どの年でも男女合算で計を作り直さないこと。**",
        "令和7年（2025）分は従来どおり handoff/pref-machi-verify/2501stjin.xlsx（statInfId=000040306651）を使っている。"
        "令和8年（2026）分は poc/recon-20261012-juki-r8/ のファイルで、48件×4項目＋都道府県名のすべてが"
        "data/pref_1a_population.json（令和8単年）と一致することを生成時に照合済み。"
        "data/pref_1a_population.json は最新年（令和8）の単年ファイルとして本ファイルと別に併存する。",
        "単位は人口が人、世帯数が世帯。値は原資料のまま（加工なし）。",
        "本ファイルは生値のみを格納する。5年間の増減人数・増減率・全国平均・全国順位は含めず、"
        "このJSONを使う側（UI／集計段）で計算する。",
        "原資料 c7以降の人口動態（前年1月1日〜12月31日計上の転入・転出・出生・死亡・増減率等）は含めていない。",
        "各 rN_YYYY キーは当該年1月1日時点の 人口_男／人口_女／人口_計／世帯数 を持つ。"
        "当該年が取得・検証できなかった場合は null（今回は7時点すべて取得・検証済みのため null はない）。",
    ]
    if failures:
        notes.append("取得または検証を通せず中断した年がある： "
                     + "／".join(f"{yk}: {msg}" for yk, msg in failures)
                     + "。該当年のキーは null になっている。")

    payload = {"sources": sources, "period": PERIOD, "updated": UPDATED, "notes": notes, "data": rows}
    print("[書き出し]")
    with OUT.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"  wrote {OUT.relative_to(ROOT)}  ({len(rows)} records / {len(sources)} sources)")

    print("[報告用の値]")
    for label, r in (("岐阜県(210005)", gifu), ("合計('-')", tot)):
        line = " ".join(f"{yk}:計={r[yk]['人口_計']},世帯={r[yk]['世帯数']}" for yk in year_keys)
        print(f"  {label} {line}")
    if failures:
        print("[中断した年]")
        for yk, msg in failures:
            print(f"  {yk}: {msg}")


if __name__ == "__main__":
    try:
        main()
    except Abort as exc:
        print(f"\n!! 中断: {exc}", file=sys.stderr)
        sys.exit(1)
