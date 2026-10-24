# scripts/i18n_glossary_csv.py
#
# 用語辞書 i18n/glossary.json（正本）を、確認用の CSV に書き出す。
# CSV は見るためだけ。直すときは i18n/glossary.json を直す（CSV を手で直さない）。
# 出力は UTF-8（BOM 付き・Excel でそのまま開ける）。出力先は .gitignore 済み。
# 書き出す前に、id の重複と文型の差し込み位置（ja と en の一致）を確かめ、誤りがあれば止まる。
# 使い方（作業リポジトリのルートで）：python scripts/i18n_glossary_csv.py
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "i18n" / "glossary.json"
DEST = ROOT / "i18n" / "_glossary_view.csv"


SLOT = re.compile(r"\{([a-z]+)\}")


def check(data: dict) -> None:
    """辞書の形を確かめる。id の重複、文型（kind=pattern）の差し込み位置が ja と en で違うものがあれば止める。"""
    errors = []
    seen = set()
    for t in data["terms"]:
        if t["id"] in seen:
            errors.append(f"id の重複：{t['id']}")
        seen.add(t["id"])
        if t["kind"] == "pattern" and t["en"]:
            ja, en = set(SLOT.findall(t["ja"])), set(SLOT.findall(t["en"]))
            if ja != en:
                errors.append(f"差し込み位置が ja と en で違う：{t['id']}（ja={sorted(ja)} en={sorted(en)}）")
    if errors:
        print("[i18n] 辞書の誤り：\n  " + "\n  ".join(errors), file=sys.stderr)
        sys.exit(1)


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    check(data)
    cols = list(data["fields"].keys())
    with DEST.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for t in data["terms"]:
            w.writerow(["" if t.get(c) is None else t.get(c) for c in cols])
    print(f"[i18n] {len(data['terms'])} 語を書き出した：{DEST.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
