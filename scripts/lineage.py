"""
データ系譜メタ（sources[]）構築ヘルパー。
仕様の正本: docs/data-schema.md 5節。運用ルール: docs/operations-runbook.md 6節。
"""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def build_sources(
    output_path: Path,
    specs: list[dict],
    backfill_fetched_at: str | None = None,
) -> list[dict]:
    """既存出力JSONの sources[] を読み、ハッシュ一致なら fetched_at を引き継ぐ。

    specs の各要素: {"role": str | None, "cache_path": Path,
                      "source_url": str, "source_page": str | None}
    """
    old_sources: list[dict] = []
    if output_path.exists():
        try:
            old_payload = json.loads(output_path.read_text(encoding="utf-8"))
            old_sources = old_payload.get("sources", [])
        except json.JSONDecodeError:
            old_sources = []

    is_migration = len(old_sources) == 0

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    result: list[dict] = []
    for spec in specs:
        role = spec["role"]
        cache_path: Path = spec["cache_path"]
        source_url = spec["source_url"]
        source_page = spec.get("source_page")

        current_hash = hashlib.sha256(cache_path.read_bytes()).hexdigest()

        old_entry = None
        if role is None:
            if len(old_sources) == 1:
                old_entry = old_sources[0]
        else:
            for entry in old_sources:
                if entry.get("role") == role:
                    old_entry = entry
                    break

        if old_entry is not None and old_entry.get("source_file_hash") == current_hash:
            fetched_at = old_entry["fetched_at"]
        elif is_migration and backfill_fetched_at is not None:
            fetched_at = backfill_fetched_at
        else:
            fetched_at = now_iso

        out_entry: dict = {}
        if role is not None:
            out_entry["role"] = role
        out_entry["source_url"] = source_url
        if source_page is not None:
            out_entry["source_page"] = source_page
        out_entry["fetched_at"] = fetched_at
        out_entry["source_file_hash"] = current_hash

        result.append(out_entry)

    return result
