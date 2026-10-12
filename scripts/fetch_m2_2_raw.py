# -*- coding: utf-8 -*-
"""Copy Batch1 files and download missing R5/R6/kenzenka files into raw/."""
from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / "poc" / "recon-20260830"
RAW = HERE / "raw"
RAW.mkdir(parents=True, exist_ok=True)
INSPECT = HERE / "_inspect"
INSPECT.mkdir(parents=True, exist_ok=True)
BATCH1 = ROOT / "poc" / "recon-20260828" / "3-3"
JST = timezone(timedelta(hours=9))
UA = {"User-Agent": "jichitai-watch-recon/batch3 (research; +https://jichitaiwatch.jp)"}

COPY = [
    ("001061668_r06_shichoson_mikata.pdf", "001061668.pdf", "2026-08-28T20:03:48+09:00"),
    ("001061669.xlsx", "001061669.xlsx", "2026-08-28T20:03:48+09:00"),
    ("001061670.xlsx", "001061670.xlsx", "2026-08-28T20:03:48+09:00"),
    ("001061671.xlsx", "001061671.xlsx", "2026-08-28T20:03:48+09:00"),
    ("001061674.xlsx", "001061674.xlsx", "2026-08-28T20:03:48+09:00"),
    ("001061676.xlsx", "001061676.xlsx", "2026-08-28T20:03:48+09:00"),
]

DOWNLOAD = [
    ("001061675.xlsx", "https://www.soumu.go.jp/main_content/001061675.xlsx"),
    ("000999901.xlsx", "https://www.soumu.go.jp/main_content/000999901.xlsx"),
    ("000999906.xlsx", "https://www.soumu.go.jp/main_content/000999906.xlsx"),
    ("000999902.xlsx", "https://www.soumu.go.jp/main_content/000999902.xlsx"),
    ("000999908.xlsx", "https://www.soumu.go.jp/main_content/000999908.xlsx"),
    ("001060123.xlsx", "https://www.soumu.go.jp/main_content/001060123.xlsx"),
]

PAGES = [
    ("shihyo_r06", "https://www.soumu.go.jp/menu_seisaku/toukei/02zaisei07_04000135.html"),
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    log = []
    for src_name, dest_name, fetched_at in COPY:
        src = BATCH1 / src_name
        dest = RAW / dest_name
        shutil.copy2(src, dest)
        rec = {
            "action": "copy_from_batch1",
            "path": dest_name,
            "src": str(src),
            "bytes": dest.stat().st_size,
            "sha256": sha256(dest),
            "fetched_at": fetched_at,
        }
        log.append(rec)
        print("COPY", dest_name, rec["bytes"])

    now = datetime.now(JST).isoformat(timespec="seconds")
    for dest_name, url in DOWNLOAD:
        dest = RAW / dest_name
        print("GET", url)
        resp = requests.get(url, headers=UA, timeout=120)
        dest.write_bytes(resp.content)
        rec = {
            "action": "download",
            "path": dest_name,
            "url": url,
            "status": resp.status_code,
            "bytes": dest.stat().st_size,
            "sha256": sha256(dest),
            "fetched_at": now,
        }
        log.append(rec)
        print("DL", dest_name, rec["status"], rec["bytes"])

    for key, url in PAGES:
        print("GET", url)
        resp = requests.get(url, headers=UA, timeout=60)
        (INSPECT / f"{key}.html").write_text(resp.text, encoding="utf-8", errors="replace")
        log.append({"action": "page", "key": key, "url": url, "status": resp.status_code, "bytes": len(resp.content)})

    (INSPECT / "fetch_raw.json").write_text(
        json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("DONE", len(log))


if __name__ == "__main__":
    main()
