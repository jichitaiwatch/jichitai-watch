"""更新カレンダーの確認日（update_calendar.yaml の checks）を任期満了日から機械で作る。

規則（2026-10-20 運営者了承・L-14）:
  - 確認は毎月1日に1回。対象は「前月中までに任期満了日を迎え、まだ反映していないもの」。
  - 確認日 = 任期満了日の翌日以降で最初の「月の1日」。新しい首長・議員は任期の開始から務めるため、
    任期満了日より前に結果を反映する必要はない。
  - 議会は「議員・会派」と「正副議長」を別の対象にする（正副議長は任期開始後の臨時会で決まるため、
    1回目の確認で決まっていなければ翌月の1日に持ち越す）。
  - 反映済みの対象は data/term_end_NN.json の reflected に書く。過ぎた日付で未反映のものは、
    次の月の1日（今日以降）に持ち越して出す。
  - 日付を手で書かない。任期満了日の一覧（data/term_end_NN.json）を直して、このスクリプトを再実行する。

使い方: python scripts/gen_calendar_checks.py [--pref 21] [--today YYYY-MM-DD]
出力: update_calendar.yaml の「# >>> generated:<key>」〜「# <<< generated:<key>」の間と、その行の next_check。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAL = ROOT / "update_calendar.yaml"
CHECK_DAY = 1


def next_cycle(after: dt.date) -> dt.date:
    """after の翌日以降で最初の月の CHECK_DAY 日。"""
    d = after + dt.timedelta(days=1)
    if d.day <= CHECK_DAY:
        return d.replace(day=CHECK_DAY)
    y, m = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    return dt.date(y, m, CHECK_DAY)


def first_cycle_on_or_after(day: dt.date) -> dt.date:
    return day if day.day == CHECK_DAY else next_cycle(day)


def build(items: list[tuple[str, str, str | None]], reflected: set[tuple[str, str]], today: dt.date):
    """items = (対象, 任期満了日, 注記)。戻り値 = {確認日: [(対象, 注記)]}"""
    out: dict[dt.date, list[tuple[str, str | None]]] = defaultdict(list)
    for target, term_end, note in items:
        te = dt.date.fromisoformat(term_end)
        if (target, term_end) in reflected:
            continue
        due = next_cycle(te)
        if due < today:  # 過ぎて未反映 → 持ち越し
            due = first_cycle_on_or_after(today)
            note = (note + "。" if note else "") + f"任期満了 {term_end}・未反映の持ち越し"
        out[due].append((target, note))
    return out


def render(key: str, groups) -> list[str]:
    lines = [f"  # >>> generated:{key}（scripts/gen_calendar_checks.py が作る。手で直さない）", "  checks:"]
    for due in sorted(groups):
        names = ", ".join(f'"{t}"' for t, _ in groups[due])
        notes = [f"{t}：{n}" for t, n in groups[due] if n]
        extra = f', note: "{" ／ ".join(notes)}"' if notes else ""
        lines.append(f'    - {{date: "{due.isoformat()}", targets: [{names}]{extra}}}')
    lines.append(f"  # <<< generated:{key}")
    return lines


def replace_block(text: str, source_prefix: str, key: str, block: list[str], next_check: str) -> str:
    lines = text.split("\n")
    start = next(i for i, l in enumerate(lines) if l.startswith(f'- source: "{source_prefix}'))
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("- source:")), len(lines))
    row = lines[start:end]
    # 既存の checks（手書き版または生成版）を除く
    cleaned, skip = [], False
    for l in row:
        if l.startswith(f"  # >>> generated:{key}") or l.startswith("  checks:"):
            skip = True
            continue
        if skip:
            if l.startswith("    - ") or l.startswith(f"  # <<< generated:{key}"):
                continue
            skip = False
        cleaned.append(l)
    cleaned = [re.sub(r'^  next_check: ".*"$', f'  next_check: "{next_check}"', l) for l in cleaned]
    # status 行の直後に入れる
    pos = next(i for i, l in enumerate(cleaned) if l.startswith("  status:")) + 1
    cleaned[pos:pos] = block
    return "\n".join(lines[:start] + cleaned + lines[end:])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pref", default="21")
    ap.add_argument("--today", default=dt.date.today().isoformat())
    a = ap.parse_args()
    today = dt.date.fromisoformat(a.today)
    src = json.loads((ROOT / "data" / f"term_end_{a.pref}.json").read_text(encoding="utf-8"))
    prov = src.get("provisional", {})
    reflected = {(r["target"], r["term_end"]) for r in src.get("reflected", [])}

    chief = [(f"{m}長", d, prov.get(m)) for m, d in src["chief"].items()]
    if src.get("governor"):
        chief.append(("県知事", src["governor"], None))
    council = []
    for m, d in src["council"].items():
        council.append((f"{m}議会（議員・会派）", d, None))
        council.append((f"{m}議会（正副議長）", d, None))
    if src.get("pref_assembly"):
        council.append(("県議会（議員・会派）", src["pref_assembly"], None))
        council.append(("県議会（正副議長）", src["pref_assembly"], None))

    text = CAL.read_text(encoding="utf-8")
    for prefix, key, items in (
        ("岐阜県選挙管理委員会", f"chief_{a.pref}", chief),
        ("議会の個別情報", f"council_{a.pref}", council),
    ):
        g = build(items, reflected, today)
        nc = min(g).isoformat() if g else "null"
        text = replace_block(text, prefix, key, render(key, g), nc)
        print(key, "next_check", nc, "groups", len(g), "targets", sum(len(v) for v in g.values()))
    CAL.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
