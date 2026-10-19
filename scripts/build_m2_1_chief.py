# -*- coding: utf-8 -*-
"""Build data/m2_1_chief.json from 8 years of jichisoken 首長 sheets (2018-2025).

Pipeline:
1. Read each year's 首長 sheet, filter to 岐阜県 rows (prefecture value carries
   down blank rows for losing-candidate continuation rows).
2. Group contiguous rows into one election record per (muni row + its
   trailing candidate rows).
3. Pick the winning candidate per election: 当落=='当' when the column exists
   (2020-2025); otherwise (2018-2019, no 当落 column) the candidate with max
   得票数, or the sole candidate when 無投票.
4. Keep, per municipality (5-digit code), only the election with the latest
   election date across all 8 years (current officeholder).
5. Cross-check against the canonical 42 area_code/name list already verified
   in data/m2_2_finance.json (Batch3).

県引数（2026-10-17・D-24 共通化）:
  python scripts/build_m2_1_chief.py --pref 23   # 愛知など。data/m2_1_chief_23.json に書く（公開しない）
  対象団体は自治体マスタの市区町村行（scripts/pref_args.py）。手作業の直近選挙補正は scripts/patches/m2_1_chief_manual_{県コード}.json
  があるときだけ当てる（岐阜は従来の m2_1_chief_manual.json）。無い県は、自治総研の収録（2025-12-08当選分まで）のまま。
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import openpyxl

from manual_patch import apply_manual_patch
from pref_args import DEFAULT_PREF, load_master_cities, load_master_pref_name, out_path, parse_pref

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / "poc" / "recon-20260830"  # 原本（raw/・raw_pref/）の置き場
RAW = HERE / "raw"
PREF = parse_pref(sys.argv[1:])
IS_DEFAULT = PREF == DEFAULT_PREF
PREF_NAME = load_master_pref_name(PREF)
JST = timezone(timedelta(hours=9))

SHEET_NAMES = {
    "2018": "首長", "2019": "首長", "2020": "C首長", "2021": "首長 ",
    "2022": "首長 ", "2023": "首長", "2024": "首長", "2025": "首長",
}

SOURCE_FILE_URLS = {
    "2018": "https://jichisoken.jp/file/jichitaisenkyo/2018_shikucyouson_20230111.xlsx",
    "2019": "https://jichisoken.jp/file/jichitaisenkyo/2019_shikucyouson_20230206.xlsx",
    "2020": "https://jichisoken.jp/file/jichitaisenkyo/2020%E5%B9%B4%E5%BA%A6%E5%B8%82%E5%8C%BA%E7%94%BA%E6%9D%91_02.xlsx",
    "2021": "https://jichisoken.jp/file/jichitaisenkyo/2021_shikucyouson_20221220.xlsx",
    "2022": "https://jichisoken.jp/file/jichitaisenkyo/2022_shikucyouson_20260514.xlsx",
    "2023": "https://jichisoken.jp/file/jichitaisenkyo/2023_shikucyouson_20240422.xlsx",
    "2024": "https://jichisoken.jp/file/jichitaisenkyo/2024_shikucyouson_20250219.xlsx",
    "2025": "https://jichisoken.jp/file/jichitaisenkyo/2025_shikucyouson_20260106.xlsx",
}
SOURCE_FILE_NAMES = {
    "2018": "2018_shikucyouson_20230111.xlsx",
    "2019": "2019_shikucyouson_20230206.xlsx",
    "2020": "2020年度市区町村_02.xlsx",
    "2021": "2021_shikucyouson_20221220.xlsx",
    "2022": "2022_shikucyouson_20260514.xlsx",
    "2023": "2023_shikucyouson_20240422.xlsx",
    "2024": "2024_shikucyouson_20250219.xlsx",
    "2025": "2025_shikucyouson_20260106.xlsx",
}
DOWNLOAD_PAGE_URL = "https://jichisoken.jp/jichitaisenkyo/"
YEAR_INDEX_URLS = {y: f"https://jichisoken.jp/jichitaisenkyo/{y}/" for y in SHEET_NAMES}

# 対象団体＝自治体マスタの市区町村行。5桁コード（自治総研のキー）＝6桁コードの先頭5桁 → (6桁コード, 名前)
MASTER_42 = {code6[:5]: (code6, name) for code6, name in sorted(load_master_cities(PREF).items())}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def excel_serial_to_date(n: float):
    return (datetime(1899, 12, 30) + timedelta(days=n)).date()


def norm_header(h):
    return h.strip() if isinstance(h, str) else h


def build_colindex(header):
    idx = {}
    for i, h in enumerate(header):
        h = norm_header(h)
        if h is None:
            continue
        idx.setdefault(h, []).append(i)
    return idx


def get_date_or_none(row, idx, year):
    if "選挙執行月日" in idx:
        v = row[idx["選挙執行月日"][0]]
    else:
        # 2018/2019: two "選挙執行日" columns; the 2nd is the actual date.
        cols = idx["選挙執行日"]
        v = row[cols[-1] if len(cols) > 1 else cols[0]]
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        d = v.date()
    elif isinstance(v, (int, float)):
        d = excel_serial_to_date(v)
    else:
        raise ValueError(f"unparseable election date in {year}: {v!r}")
    # 2020年版以降の「選挙執行月日」セルは、年が「その年版のファイルの年」で入っている
    # （例：2023年版の可児市＝2023-10-23）。実際の年は別列「選挙執行年」（例：「2022年」）にある。
    # 両者が食い違うときは「選挙執行年」の年を採る（2026-10-17 修正。K-7）。
    if "選挙執行年" in idx:
        ev = row[idx["選挙執行年"][0]]
        if isinstance(ev, str) and ev.strip().endswith("年") and ev.strip()[:-1].isdigit():
            real_year = int(ev.strip()[:-1])
            if real_year != d.year:
                d = d.replace(year=real_year)
    return d


def parse_year(year: str):
    path = RAW / f"{year}_shikucyouson.xlsx"
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[SHEET_NAMES[year]]
    rows_all = list(ws.iter_rows(values_only=True))
    header = [norm_header(h) for h in rows_all[0]]
    idx = build_colindex(header)

    pref_col = idx["都道府県"][0]
    code5_col = idx["5桁コード"][0]
    code6_col = idx["コード"][0] if "コード" in idx else None
    name_col = idx["自治体名"][0]
    voters_col = idx["当日有権者数"][0]
    turnout_col = idx["投票率"][0]
    mutou_col = idx["無投票"][0]
    cand_col = idx["立候補者名"][0]
    votes_col = idx["得票数"][0]
    vshare_col = idx["得票率"][0]
    party_col = idx["党派"][0]
    term_col = idx["回"][0] if "回" in idx else idx["当選回数"][0]
    toraku_col = idx["当落"][0] if "当落" in idx else None

    groups = []
    current_pref = None
    current_group = None
    for r in rows_all[1:]:
        if r[pref_col] not in (None, ""):
            current_pref = r[pref_col]
        if current_pref != PREF_NAME:
            current_group = None
            continue

        raw_code5 = r[code5_col]
        raw_code5 = str(raw_code5).strip() if raw_code5 not in (None, "") else None
        raw_date = get_date_or_none(r, idx, year)

        is_new_group = (
            raw_code5 is not None
            and (
                current_group is None
                or raw_code5 != current_group["code5"]
                or (raw_date is not None and raw_date != current_group["election_date"])
            )
        )
        if is_new_group:
            current_group = {
                "year_file": year,
                "code5": raw_code5,
                "code6": str(r[code6_col]) if code6_col is not None and r[code6_col] not in (None, "") else None,
                "muni_name": r[name_col],
                "election_date": raw_date,
                "candidates": [],
            }
            groups.append(current_group)
        if current_group is None:
            continue
        cand = {
            "candidate_name": r[cand_col],
            "votes": r[votes_col] if r[votes_col] not in (None, "") else None,
            "vote_share": r[vshare_col] if r[vshare_col] not in (None, "") else None,
            "party": r[party_col] if r[party_col] not in (None, "") else None,
            "term": r[term_col] if r[term_col] not in (None, "") else None,
            "toraku": r[toraku_col] if toraku_col is not None else None,
            "mutou": r[mutou_col] if r[mutou_col] not in (None, "") else None,
            "voters_day": r[voters_col] if r[voters_col] not in (None, "") else None,
            "turnout": r[turnout_col] if r[turnout_col] not in (None, "") else None,
        }
        current_group["candidates"].append(cand)

    return groups


def pick_winner(group):
    cands = group["candidates"]
    winners = [c for c in cands if c["toraku"] == "当"]
    if winners:
        return winners[0]
    if len(cands) == 1:
        return cands[0]
    with_votes = [c for c in cands if c["votes"] is not None]
    if not with_votes:
        return cands[0]
    return max(with_votes, key=lambda c: c["votes"])


def main():
    # 自治総研の年版Excelは再配布の可否が未確認のため、公開用リポジトリには含めていない。
    # 無ければ、下の URL から取得して RAW に「{年}_shikucyouson.xlsx」の名前で置く（申請不要・出典明記が条件）。
    missing = [y for y in SOURCE_FILE_URLS if not (RAW / f"{y}_shikucyouson.xlsx").exists()]
    if missing:
        raise SystemExit("自治総研の原本が無い。次を取得して " + str(RAW) + " に置いてから再実行する:\n"
                         + "\n".join(f"  {y}_shikucyouson.xlsx <- {SOURCE_FILE_URLS[y]}" for y in missing))
    all_groups = []
    fetch_log = []
    for year in SHEET_NAMES:
        path = RAW / f"{year}_shikucyouson.xlsx"
        fetch_log.append({
            "year": year,
            "source_url": SOURCE_FILE_URLS[year],
            "source_page": YEAR_INDEX_URLS[year],
            "download_page": DOWNLOAD_PAGE_URL,
            "file_name": SOURCE_FILE_NAMES[year],
            "sheet": SHEET_NAMES[year],
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
        })
        all_groups.extend(parse_year(year))

    by_code5 = {}
    for g in all_groups:
        c5 = g["code5"]
        if c5 not in by_code5 or g["election_date"] > by_code5[c5]["election_date"]:
            by_code5[c5] = g

    missing = [name for code5, (code6, name) in MASTER_42.items() if code5 not in by_code5]
    extra = [c5 for c5 in by_code5 if c5 not in MASTER_42]

    now = datetime.now(JST).isoformat(timespec="seconds")
    record_keys = [
        "area_code", "市区町村名", "氏名", "当選年月日", "回", "投票率",
        "得票数", "当日有権者数", "絶対得票率", "無投票", "党派",
    ]

    data = []
    for code5, (code6, name) in sorted(MASTER_42.items()):
        g = by_code5.get(code5)
        if g is None:
            continue
        w = pick_winner(g)
        is_mutou = bool(w["mutou"])
        turnout_pct = None if is_mutou else (round(w["turnout"] * 100, 2) if w["turnout"] is not None else None)
        votes = None if is_mutou else w["votes"]
        voters_day = w["voters_day"]
        if is_mutou:
            abs_vote_share = None
        elif votes is not None and voters_day:
            abs_vote_share = round(votes / voters_day * 100, 2)
        else:
            abs_vote_share = None

        candidate_name = w["candidate_name"].strip() if isinstance(w["candidate_name"], str) else w["candidate_name"]
        party = w["party"].strip() if isinstance(w["party"], str) else w["party"]
        rec = {
            "area_code": code6,
            "市区町村名": name,
            "氏名": candidate_name,
            "当選年月日": g["election_date"].isoformat(),
            "回": w["term"],
            "投票率": turnout_pct,
            "得票数": votes,
            "当日有権者数": voters_day,
            "絶対得票率": abs_vote_share,
            "無投票": {"is_mutou": is_mutou, "token": "無投票" if is_mutou else None},
            "党派": party,
            "_source_year_file": g["year_file"],
        }
        data.append(rec)

    output = {
        "record_keys": record_keys,
        "unit": {
            "投票率": "％（無投票の場合null）",
            "絶対得票率": "％（得票数÷当日有権者数×100。無投票の場合null）",
            "得票数": "人",
            "当日有権者数": "人",
        },
        "definition": {
            "絶対得票率": "得票数÷当日有権者数×100",
            "無投票": "Excel「無投票」列に値がある場合。投票率・絶対得票率はnullとしtoken='無投票'を立てる（0埋めしない）",
        },
        "coverage": {
            "target": len(MASTER_42),
            "matched": len(data),
            "missing_municipalities": missing,
        },
        "sources": {
            "provider": "地方自治総合研究所（自治体選挙結果調査）",
            "dataset": "全国首長名簿",
            "sheet": "首長",
            "download_page": DOWNLOAD_PAGE_URL,
            "years_stacked": list(SHEET_NAMES.keys()),
            "files": fetch_log,
            "usage_note_url": "https://jichisoken.jp/using-data-note/",
            "usage_note": "利用申込・承認は不要。ただし成果物に実施機関名（地方自治総合研究所）と「自治体選挙結果調査」に基づく旨の明記が必須。",
            "fetched_at": now,
            "coverage_cutoff_note": "2025年版が現時点(2026-08-30)の最新公開版。収録は2025-12-08当選分まで確認。それ以降（2026年に入ってからの選挙）はjichisoken.jp未公開のため本データに含まれない。",
        },
        "data": data,
    }

    # 手作業で確認した直近選挙の補正を当て直す（scripts/patches/m2_1_chief_manual.json）
    patch_path = ROOT / "scripts" / "patches" / ("m2_1_chief_manual.json" if IS_DEFAULT else f"m2_1_chief_manual_{PREF}.json")
    if patch_path.exists():
        applied, superseded = apply_manual_patch(output, patch_path, "area_code")
        print("手作業補正: 適用", applied, "/ 自治総研が追いついたため不要", superseded)
    else:
        print("手作業補正: なし（自治総研の収録のまま）")
    if not IS_DEFAULT:
        output["trial_note"] = (
            f"D-24 の試作（公開しない）。対象は自治体マスタ data/municipality_master_{PREF}.json の{PREF_NAME}内{len(MASTER_42)}団体。"
            + ("" if patch_path.exists() else "2025-12-08 当選分までの自治総研の収録のまま（直近選挙の個別確認はまだ）。")
        )

    out_path("m2_1_chief", PREF).write_text(
        json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("matched:", len(data), "/", len(MASTER_42))
    print("missing:", missing)
    print("extra code5 not in master (ignored):", extra)


if __name__ == "__main__":
    main()
