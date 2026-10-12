# -*- coding: utf-8 -*-
"""Build data/pref_governor.json from jichisoken 都道府県 (governor) sheets, 2018-2025.

Mirrors scripts/build_m2_1_chief.py (市区町村 chief) but for the
prefecture-level "知事" sheet of the 都道府県版Excel (separate file series
from the 市区町村版 used for m2_1_chief).

Pipeline:
1. Read each year's 知事 sheet (sheet name varies by year), covering ALL 47
   prefectures (unlike m2_1 which filtered to 岐阜県 only).
2. Group contiguous rows into one election record per (pref row + its
   trailing losing-candidate rows), keyed by the pref code column
   ('コード', 6-digit, first 2 digits = JIS pref code).
3. No 当落 (win/loss) column exists in the 都道府県 sheet in any year
   (confirmed 2018-2025) -> winner = sole candidate, or candidate with max
   得票数 among those with a vote count.
4. Keep, per pref code (2-digit), only the election with the latest
   election date across all 8 years (current officeholder).
5. Cross-check against the canonical 47-prefecture list.

Column-layout notes (verified by direct inspection, not assumed):
- Header row index varies by year (0 for most years; 1 for 2021/2024,
  which have an extra "field code legend" row above the real header).
  Detected programmatically by scanning the first 4 rows for a 'コード' cell.
- 2023 has 2 extra leading label columns (統一, year-number) before コード;
  irrelevant because columns are located by header name, not position.
- The 'コード' column is a 6-digit value; in some years it is stored as
  Python str, in others as int (verified: no leading-zero loss - Hokkaido
  etc. always appear as the zero-padded str form; only prefectures whose
  code doesn't need a leading zero appear as int). Normalized via
  str(v).zfill(6).
- The header label '立候補者数' is a source-file mislabel: this column
  actually holds the candidate NAME (verified against data: contains
  Japanese names like '村井　嘉浩', not a count). Confirmed consistent
  across all 8 years.
- The real election-date column is unnamed (None) in the header and
  immediately follows the '選挙執行日' column (which itself holds only a
  year label such as '2017年', not a usable date). The date cell is
  sometimes an Excel datetime object, sometimes a raw serial number
  (when the cell's number_format wasn't set to a date format) -> handled
  via excel_serial_to_date().
- No 無投票 (uncontested) rows found for governor elections in any of the
  8 years 2018-2025 (checked directly); the 無投票-handling code path is
  kept for defensiveness but has zero coverage in this dataset.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import openpyxl

from manual_patch import apply_manual_patch

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / "poc" / "recon-20260830"  # 原本（raw/・raw_pref/）の置き場
RAW = HERE / "raw_pref"
JST = timezone(timedelta(hours=9))

SHEET_NAMES = {
    "2018": "知事", "2019": "知事2019", "2020": "知事選挙", "2021": "都道府県知事",
    "2022": "都道府県知事", "2023": "都道府県知事", "2024": "都道府県知事", "2025": "都道府県知事",
}

SOURCE_FILE_URLS = {
    "2018": "https://jichisoken.jp/file/jichitaisenkyo/2018%E5%B9%B4%E5%BA%A6%E9%83%BD%E9%81%93%E5%BA%9C%E7%9C%8C.xlsx",
    "2019": "https://jichisoken.jp/file/jichitaisenkyo/2019%E5%B9%B4%E5%BA%A6%E9%83%BD%E9%81%93%E5%BA%9C%E7%9C%8C.xlsx",
    "2020": "https://jichisoken.jp/file/jichitaisenkyo/2020%E5%B9%B4%E5%BA%A6%E9%83%BD%E9%81%93%E5%BA%9C%E7%9C%8C_02.xlsx",
    "2021": "https://jichisoken.jp/file/jichitaisenkyo/2021_todoufuken_20221129.xlsx",
    "2022": "https://jichisoken.jp/file/jichitaisenkyo/2022_todoufuken_20230131.xlsx",
    "2023": "https://jichisoken.jp/file/jichitaisenkyo/2023_todoufuken_20240422.xlsx",
    "2024": "https://jichisoken.jp/file/jichitaisenkyo/2024_todoufuken_20250219.xlsx",
    "2025": "https://jichisoken.jp/file/jichitaisenkyo/2025_todoufuken_20260106.xlsx",
}
SOURCE_FILE_NAMES = {
    "2018": "2018年度都道府県.xlsx",
    "2019": "2019年度都道府県.xlsx",
    "2020": "2020年度都道府県_02.xlsx",
    "2021": "2021_todoufuken_20221129.xlsx",
    "2022": "2022_todoufuken_20230131.xlsx",
    "2023": "2023_todoufuken_20240422.xlsx",
    "2024": "2024_todoufuken_20250219.xlsx",
    "2025": "2025_todoufuken_20260106.xlsx",
}
DOWNLOAD_PAGE_URL = "https://jichisoken.jp/jichitaisenkyo/"
YEAR_INDEX_URLS = {y: f"https://jichisoken.jp/jichitaisenkyo/{y}/" for y in SHEET_NAMES}

# Canonical 47 prefectures (JIS X 0401 2-digit code -> name).
MASTER_47 = {
    "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県", "05": "秋田県",
    "06": "山形県", "07": "福島県", "08": "茨城県", "09": "栃木県", "10": "群馬県",
    "11": "埼玉県", "12": "千葉県", "13": "東京都", "14": "神奈川県", "15": "新潟県",
    "16": "富山県", "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
    "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県", "25": "滋賀県",
    "26": "京都府", "27": "大阪府", "28": "兵庫県", "29": "奈良県", "30": "和歌山県",
    "31": "鳥取県", "32": "島根県", "33": "岡山県", "34": "広島県", "35": "山口県",
    "36": "徳島県", "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
    "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県", "45": "宮崎県",
    "46": "鹿児島県", "47": "沖縄県",
}


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


def find_header_row(rows_all):
    for i, r in enumerate(rows_all[:4]):
        if "コード" in r and "自治体名" in r:
            return i
    raise ValueError("header row not found in first 4 rows")


def get_date_or_none(row, date_col):
    v = row[date_col]
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, (int, float)):
        return excel_serial_to_date(v)
    raise ValueError(f"unparseable election date: {v!r}")


LABEL_YEAR_RE = re.compile(r"(\d+)年")


def correct_year_bug(raw_date, label_value):
    """Correct a verified source-file bug: in a large minority of rows, the
    real-date cell's YEAR is +1 vs. the true election year, while month/day
    are correct. Verified independently against real election results for
    multiple rows across multiple year-files (e.g. Miyagi 2017-10-22 stored
    as 2018-10-22; Tokyo 2024-07-07 stored as 2025-07-07; Hyogo 2024-11-17
    stored as 2025-11-17; Fukushima 2018-10-28 stored as 2019-10-28;
    Shizuoka 2024-05-26 stored as 2025-05-26 -- all confirmed via
    independent web search against vote counts that match exactly).
    Not all rows are affected (e.g. Osaka 2023-04-09 is stored correctly).
    The '選挙執行日' label column (e.g. '2017年') reliably holds the TRUE
    election year in every case checked, so it is used as the correction
    signal: when label year != stored date year, the stored date's year is
    replaced with the label year (month/day kept as-is).
    """
    if raw_date is None or label_value is None:
        return raw_date, False
    m = LABEL_YEAR_RE.match(str(label_value))
    if not m:
        return raw_date, False
    label_year = int(m.group(1))
    if label_year == raw_date.year:
        return raw_date, False
    return raw_date.replace(year=label_year), True


def parse_year(year: str):
    path = RAW / f"{year}_todoufuken.xlsx"
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[SHEET_NAMES[year]]
    rows_all = list(ws.iter_rows(values_only=True))
    hdr_i = find_header_row(rows_all)
    header = [norm_header(h) for h in rows_all[hdr_i]]
    idx = build_colindex(header)

    code_col = idx["コード"][0]
    name_col = idx["自治体名"][0]
    exec_label_col = idx["選挙執行日"][0]
    date_col = exec_label_col + 1  # real date: unnamed column immediately after
    voters_col = idx["当日有権者数"][0]
    turnout_col = idx["投票率"][0]
    mutou_col = idx["無投票"][0]
    # Source-file mislabel: '立候補者数' column actually holds candidate name.
    cand_col = idx["立候補者数"][0]
    votes_col = idx["得票数"][0]
    vshare_col = idx["得票率"][0]
    party_col = idx["党派"][0]
    term_col = idx["回"][0]
    toraku_col = idx["当落"][0] if "当落" in idx else None

    groups = []
    current_group = None
    year_bug_fixes = []
    for r in rows_all[hdr_i + 1:]:
        raw_code = r[code_col]
        raw_code = str(raw_code).strip().zfill(6) if raw_code not in (None, "") else None
        raw_date = get_date_or_none(r, date_col)
        raw_date, was_fixed = correct_year_bug(raw_date, r[exec_label_col])
        if was_fixed:
            year_bug_fixes.append((raw_code, r[name_col], raw_date))

        is_new_group = (
            raw_code is not None
            and (
                current_group is None
                or raw_code != current_group["code6"]
                or (raw_date is not None and raw_date != current_group["election_date"])
            )
        )
        if is_new_group:
            current_group = {
                "year_file": year,
                "code6": raw_code,
                "pref_code": raw_code[:2],
                "pref_name": r[name_col],
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

    return groups, year_bug_fixes


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
    # 無ければ、下の URL から取得して RAW に「{年}_todoufuken.xlsx」の名前で置く（申請不要・出典明記が条件）。
    missing = [y for y in SOURCE_FILE_URLS if not (RAW / f"{y}_todoufuken.xlsx").exists()]
    if missing:
        raise SystemExit("自治総研の原本が無い。次を取得して " + str(RAW) + " に置いてから再実行する:\n"
                         + "\n".join(f"  {y}_todoufuken.xlsx <- {SOURCE_FILE_URLS[y]}" for y in missing))
    all_groups = []
    fetch_log = []
    all_year_bug_fixes = []
    for year in SHEET_NAMES:
        path = RAW / f"{year}_todoufuken.xlsx"
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
        groups, fixes = parse_year(year)
        all_groups.extend(groups)
        all_year_bug_fixes.extend((year, *f) for f in fixes)

    print(f"year-bug corrections applied: {len(all_year_bug_fixes)} rows (see data_correction_log in output)")

    by_pref = {}
    for g in all_groups:
        pc = g["pref_code"]
        if pc not in by_pref or g["election_date"] > by_pref[pc]["election_date"]:
            by_pref[pc] = g

    missing = [name for code, name in MASTER_47.items() if code not in by_pref]
    extra = [pc for pc in by_pref if pc not in MASTER_47]

    now = datetime.now(JST).isoformat(timespec="seconds")
    record_keys = [
        "pref_code", "pref_name", "氏名", "当選回数", "当選年月日", "投票率",
        "得票数", "得票率", "当日有権者数", "絶対得票率", "党派", "無投票", "status",
    ]

    data = []
    for code, name in sorted(MASTER_47.items()):
        g = by_pref.get(code)
        if g is None:
            continue
        w = pick_winner(g)
        is_mutou = bool(w["mutou"])
        turnout_pct = None if is_mutou else (round(w["turnout"] * 100, 2) if w["turnout"] is not None else None)
        votes = None if is_mutou else w["votes"]
        vshare_pct = None if is_mutou else (round(w["vote_share"] * 100, 2) if w["vote_share"] is not None else None)
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
            "pref_code": code,
            "pref_name": name,
            "氏名": candidate_name,
            "当選回数": w["term"],
            "当選年月日": g["election_date"].isoformat(),
            "投票率": turnout_pct,
            "得票数": votes,
            "得票率": vshare_pct,
            "当日有権者数": voters_day,
            "絶対得票率": abs_vote_share,
            "党派": party,
            "無投票": {"is_mutou": is_mutou, "token": "無投票" if is_mutou else None},
            "status": "data",
            "_source_year_file": g["year_file"],
        }
        data.append(rec)

    output = {
        "record_keys": record_keys,
        "unit_note": {
            "投票率": "％（無投票の場合null）",
            "得票率": "％（無投票の場合null。自治総研Excel値をそのまま百分率化）",
            "絶対得票率": "％（得票数÷当日有権者数×100。無投票の場合null）",
            "得票数": "票",
            "当日有権者数": "人",
        },
        "field_definitions": {
            "当選回数": "自治総研Excel「回」列の値をそのまま採用。厳密な『期数』とは一致しない場合がある（市区町村首長データ0-2で美濃加茂市の実例あり、同様のずれが知事データでも起こりうる前提）。",
            "絶対得票率": "得票数÷当日有権者数×100",
            "無投票": "Excel「無投票」列に値がある場合。投票率・得票率・絶対得票率はnullとしtoken='無投票'を立てる（0埋めしない）。2018-2025の8年分で該当事例なし（0件、コード上は保持）。",
            "status": "'data'固定（本データセットは47/47現職を確認済みのため欠損状態は発生しない）。",
        },
        "coverage": {
            "target": 47,
            "matched": len(data),
            "missing_prefectures": missing,
        },
        "sources": {
            "provider": "地方自治総合研究所（自治体選挙結果調査）",
            "dataset": "全国首長名簿（都道府県版・知事シート）",
            "note_scope": "市区町村版（data/m2_1_chief.jsonが使用）とは別ファイル系列。都道府県版Excelの「知事」シートのみを使用（「議会」シートは対象外）。",
            "download_page": DOWNLOAD_PAGE_URL,
            "years_stacked": list(SHEET_NAMES.keys()),
            "files": fetch_log,
            "usage_note_url": "https://jichisoken.jp/using-data-note/",
            "usage_note": "利用申込・承認は不要。ただし成果物に実施機関名（地方自治総合研究所）と「自治体選挙結果調査」に基づく旨の明記が必須。",
            "fetched_at": now,
            "known_coverage_gap_2026": "2025年版（2026-01-06公開）が現時点(2026-09-02)の最新公開版。ただし2025年秋以降〜2026年に行われた知事選（石川2026-03-08・福井2026-01-25・広島2025-11-28任期満了・長崎2026-02-08、和歌山は2025-04死去に伴う2025-06-03就任）は自治総研側が未収録のため本データに反映されない。Wikipedia等一次情報と突合し確認済み（5道県：石川・福井・和歌山・広島・長崎）。次回データ更新時に要再取得。",
        },
        "data_correction_log": {
            "note": "自治総研Excelの実日付セル（'選挙執行日'ラベル列の直後・無名列）に、一部の行で年が+1される既知の不具合を発見（実選挙結果と突合し複数件で確認：宮城2017→誤2018、東京2024→誤2025、兵庫2024→誤2025、福島2018→誤2019、静岡2024→誤2025。一方、大阪2023は誤りなし=不具合は行単位で不定期に発生）。ラベル列の年（テキスト表記、例'2017年'）が正しい選挙年と一致することを確認済みのため、ラベル年とセル年が食い違う行は月日を保持しラベル年で置換して補正した。補正対象行数と対象自治体は下記の通り。",
            "corrected_rows": [
                {"year_file": yf, "code6": c6, "pref_name": pn, "corrected_date": d.isoformat()}
                for yf, c6, pn, d in all_year_bug_fixes
            ],
        },
        "data": data,
    }

    # 手作業で確認した直近の首長交代の補正を当て直す（scripts/patches/pref_governor_manual.json）
    applied, superseded = apply_manual_patch(output, ROOT / "scripts" / "patches" / "pref_governor_manual.json", "pref_code")
    print("手作業補正: 適用", applied, "/ 自治総研が追いついたため不要", superseded)

    out_path = ROOT / "data" / "pref_governor.json"
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    print("matched:", len(data), "/", 47)
    print("missing:", missing)
    print("extra pref_code not in master (ignored):", extra)


if __name__ == "__main__":
    main()
