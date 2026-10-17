# -*- coding: utf-8 -*-
"""data/pref_assembly.json（都道府県版「議会のすがた」・47件）の機械的に作れる部分を再生成・検証する。

作れる部分（このスクリプトが毎回同じ結果を出す）:
  A. 議員定数・現員数 … 総務省「地方自治月報」第62号 議員定数に関する調（令和7年4月1日現在）①都道府県分
       poc/recon-20260828/3-2/001062130_giin_teisuu_r7.pdf を pdftotext -layout で読む（要 poppler）。
       列：議員定数（令和7年4月1日現在）・議員実数（前回調査時回答の列・執行日の列は読まない）。→ 「議員定数」「現員数」
  B. 議会費_total_千円 … data/pref_kessan.json の expenditure_purpose_r6["議会費"]
       （先に scripts/build_pref_kessan.py を実行しておく。元は令和6年度都道府県決算状況調 5-2）
  C. 議事録公開 … recon/pref-gikai-koho-20260905.md の「47件一覧」の表（有／無／確認できず・公開形式・該当URL）

作れない部分（既存 JSON の値をそのまま残す。上書きしない）:
  正副議長・会派 … Grok（探索）→ Composer（独立反証）→ Claude（突合）で集めた調査結果。
    Grok 分は poc/pref-gikai-20260902/chair-kaiha.csv にある。Composer 分の CSV はリポジトリに無い
    （出典_composer・会派一覧_composer として JSON の中にだけ残っている）。手順は docs/succession-runbook.md §3.7。
  status・data_correction_log・sources … 既存のまま。

使い方: python scripts/build_pref_assembly.py          （再生成して書き込み、差分を表示）
        python scripts/build_pref_assembly.py --check  （書き込まず、現行 JSON との一致だけを確認）
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "pref_assembly.json"
KESSAN = ROOT / "data" / "pref_kessan.json"
PDF = ROOT / "poc" / "recon-20260828" / "3-2" / "001062130_giin_teisuu_r7.pdf"
PDF_SHA256 = "73d6a3936a9f6043215f870404f889bd480828a81f6ea4cec57ed369acf7c8e3"  # JSON の sources に記録された値
KOHO_MD = ROOT / "recon" / "pref-gikai-koho-20260905.md"
GROK_CSV = ROOT / "poc" / "pref-gikai-20260902" / "chair-kaiha.csv"

ROW_PAT = re.compile(r"^\s*(\S+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(-?\d+)(?:\s+\S.*)?$")


class Abort(Exception):
    pass


def parse_teisuu() -> dict[str, tuple[int, int]]:
    if hashlib.sha256(PDF.read_bytes()).hexdigest() != PDF_SHA256:
        raise Abort("議員定数調PDFのハッシュが JSON の記録と一致しない")
    text = subprocess.run(["pdftotext", "-layout", str(PDF), "-"], capture_output=True, text=True, check=True).stdout
    lines = text.split("\n")
    start = next(i for i, l in enumerate(lines) if "都道府県名" in l)
    out: dict[str, tuple[int, int]] = {}
    for l in lines[start:]:
        if l.strip().startswith("合計"):  # 都道府県分の終わり（市区町村分の表は読まない）
            break
        m = ROW_PAT.match(l)
        if m:
            out[unicodedata.normalize("NFKC", m.group(1))] = (int(m.group(2).replace(",", "")), int(m.group(3).replace(",", "")))
    if len(out) != 47:
        raise Abort(f"議員定数調PDFから読めた都道府県が47ではない（{len(out)}）")
    return out


def parse_koho() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for l in KOHO_MD.read_text(encoding="utf-8").split("\n"):
        cells = [c.strip() for c in l.strip().strip("|").split("|")]
        if len(cells) >= 5 and cells[0].isdigit() and cells[1].endswith(("都", "道", "府", "県")):
            urls = [u.strip() for u in cells[4].split("／") if u.strip()]
            out[cells[1]] = {
                "status": cells[2],
                "公開形式": cells[3],
                "url": urls[0] if len(urls) == 1 else urls,
                "出典": "recon/pref-gikai-koho-20260905.md",
            }
    if len(out) != 47:
        raise Abort(f"reconの表から読めた都道府県が47ではない（{len(out)}）")
    return out


def main() -> None:
    check_only = "--check" in sys.argv
    payload = json.loads(OUT.read_text(encoding="utf-8"))
    teisuu = parse_teisuu()
    koho = parse_koho()
    kessan = {r["pref_name"]: r["expenditure_purpose_r6"]["議会費"] for r in json.loads(KESSAN.read_text(encoding="utf-8"))["data"]}
    if len(payload["data"]) != 47:
        raise Abort("既存JSONが47件ではない")

    changes = []
    for rec in payload["data"]:
        n = rec["pref_name"]
        new = {"議員定数": teisuu[n][0], "現員数": teisuu[n][1], "議会費_total_千円": kessan[n], "議事録公開": koho[n]}
        for k, v in new.items():
            if rec.get(k) != v:
                changes.append((n, k, rec.get(k), v))
                rec[k] = v

    # 参考確認：Grok の CSV と JSON の会派一覧_grok が一致するか（JSON 側は変更しない）
    with GROK_CSV.open(encoding="utf-8-sig", newline="") as f:
        grok = {r["都道府県名"]: r for r in csv.DictReader(f)}
    kaiha_diff = [r["pref_name"] for r in payload["data"] if grok[r["pref_name"]]["会派一覧(会派名:人数の並び)"] != r["会派"].get("会派一覧_grok")]

    print(f"A/B/C の再生成: 現行JSONとの差 {len(changes)}件")
    for c in changes[:10]:
        print("  ", c)
    print(f"参考: Grok CSV と会派一覧_grok が違う県 {len(kaiha_diff)}件 {kaiha_diff}")
    if check_only:
        print("--check: 書き込まない")
        return
    with OUT.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    try:
        main()
    except Abort as e:
        print(f"!! 中断: {e}", file=sys.stderr)
        sys.exit(1)
