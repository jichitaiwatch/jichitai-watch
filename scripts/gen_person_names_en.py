"""
首長・正副議長の英語版の氏名（ローマ字）を作る（英語版・作業単位7。2026-10-23 運営者裁定）。

出力: i18n/person-names-en.json（手書き禁止。本スクリプトが単一ソース）

入力:
  - i18n/person-names/readings-<回名>.csv の「確定」の行（確かめた読み。確認できずの人は載せない＝英語版でも漢字のまま）
  - i18n/person-names/kanji-split.csv（下の「止める形」に当たる姓・名の、漢字ごとの読みの区切り）

決まり（i18n/glossary.json の person_names）:
  - 姓・名の順、先頭だけ大文字（Yamada Haruo）。英語版では後ろに漢字を添える（画面側 lib/person-names.ts）。
  - ローマ字は確かめた読みからヘボン式で機械的に作る。作り方は地名（scripts/gen_place_names_en.py の romanize）と同じ：
    撥音は常に n、伸ばす音は畳む（おう・おお→o、うう→u）、記号（ō など）は付けない。本人が使う綴りでは上書きしない。

機械で作ると誤る形は、止めて人が確かめる（地名と同じ考え方）:
  (1) 伸ばす音に見える母音の並びが、漢字の境目をまたぐことがある（井上＝い・の・うえ＝Inoue。畳むと Inoe になる）。
  (2) 小さい「ゃゅょ」と大きい「やゆよ」の取り違え（清＝きよ）。
  姓・名のどちらかが2字以上で、読みにこの形があるものは、kanji-split.csv に漢字ごとの読みの区切りが無いと止まる。
  区切りがあれば、区切りごとにローマ字にしてつなぐ（伸ばす音は1つの区切りの中だけで畳む）。
  1字の姓・名は、母音の並びが必ずその字の読みの中にあるので、そのまま畳む。

  python scripts/gen_person_names_en.py
"""

from __future__ import annotations

import csv
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "i18n" / "person-names"
SPLIT_PATH = DIR / "kanji-split.csv"
OUTPUT_PATH = ROOT / "i18n" / "person-names-en.json"

# 地名と同じかな→ローマ字（表を二重に持たない）
_spec = importlib.util.spec_from_file_location("gpn", ROOT / "scripts" / "gen_place_names_en.py")
_gpn = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_gpn)

_WS = re.compile(r"[\s　]+")


def to_katakana(s: str) -> str:
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in s)


def load_split() -> dict[tuple[str, str], list[str]]:
    out: dict[tuple[str, str], list[str]] = {}
    with SPLIT_PATH.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            segs = r["漢字ごとの読み"].split("・")
            reading = "".join(segs)
            key = (r["漢字"], reading)
            if key in out:
                raise SystemExit(f"[person-names] 止めた：kanji-split.csv の重複 {key}")
            out[key] = segs
    return out


SPLIT = load_split()
USED: set[tuple[str, str]] = set()


def romanize_part(kanji: str, reading: str, where: str) -> str:
    kanji = _WS.sub("", kanji)
    if not re.fullmatch(r"[ぁ-ゖー]+", reading):
        raise SystemExit(f"[person-names] 止めた：{where} の読み「{reading}」にひらがな以外の字がある")
    key = (kanji, reading)
    if key in SPLIT:
        USED.add(key)
        segs = SPLIT[key]
    elif len(kanji) >= 2 and _gpn.needs_review(to_katakana(reading)):
        raise SystemExit(
            f"[person-names] 止めた：{where} の「{kanji}（{reading}）」は機械では決められない形"
            "（伸ばす音が漢字の境目をまたぐか・小さい字か）。漢字ごとの読みを確かめて kanji-split.csv に載せる"
        )
    else:
        segs = [reading]
    return _gpn.capitalise("".join(_gpn.romanize(to_katakana(s)) for s in segs))


def main() -> None:
    people: dict[str, dict[str, str]] = {}
    files = sorted(DIR.glob("readings-*.csv"))
    if not files:
        raise SystemExit("[person-names] 止めた：readings-*.csv が無い")
    skipped = 0
    for path in files:
        with path.open(encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r["状態"] != "確定":
                    skipped += 1
                    continue
                where = f"{path.name} {r['id']}"
                family_ja, given_ja = _WS.sub("", r["姓"]), _WS.sub("", r["名"])
                name_key = _WS.sub("", r["氏名（データの表記）"])
                if family_ja + given_ja != name_key:
                    raise SystemExit(f"[person-names] 止めた：{where} の姓・名（{family_ja}・{given_ja}）がデータの表記 {name_key} と合わない")
                entry = {
                    "family_ja": family_ja,
                    "given_ja": given_ja,
                    "family_en": romanize_part(family_ja, r["姓の読み"], where),
                    "given_en": romanize_part(given_ja, r["名の読み"], where),
                }
                # 団体コードの先頭5桁（検査数字を除く）＋データの表記（空白を除く）で引く。
                # 都道府県は 210005 → 21000（データの pref_code 21 に "000" を足した形）
                key = f"{r['団体コード'][:5]}|{name_key}"
                if key in people and people[key] != entry:
                    raise SystemExit(f"[person-names] 止めた：同じ人 {key} の読みが回によって違う")
                people[key] = entry
    unused = sorted(set(SPLIT) - USED)
    if unused:
        raise SystemExit(f"[person-names] 止めた：kanji-split.csv に使われていない行がある {unused}")
    out = {
        "about": "首長・正副議長の英語版の氏名。scripts/gen_person_names_en.py が i18n/person-names/ から作る（手で直さない）。"
        "キーは「団体コードの先頭5桁|データの氏名（空白を除く）」。載っていない人は英語版でも漢字のまま（D-25）",
        "people": dict(sorted(people.items())),
    }
    OUTPUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"[person-names] {len(people)} 人を書いた（確認できずで除いた行 {skipped}）→ {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
