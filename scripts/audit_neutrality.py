#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/audit_neutrality.py

中立性UI監査(#10)の機械補助。目視10画面だけでは漏れるため、リポジトリ全体を走査して
「評価語」「評価的な信号色」「欠損表示の一貫性」の候補を全件抽出する。
※本スクリプトは候補抽出であり最終判定ではない（法定用語・区別の色は誤検出しうる）。
  出力を人が確認して OK / 要確認 を決める。中立性ルールの正本＝20260808_decisions.md D-4/D-6/D-12/D-18。

出力: scripts/audit_neutrality_result.txt （UTF-8。コンソール貼り付け不要）
"""

import json
import os
import re
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audit_neutrality_result.txt")

# 走査対象（表示に関わるソース）
SRC_GLOBS = ["app/**/*.tsx", "components/**/*.tsx", "lib/**/*.tsx", "lib/**/*.ts"]
DATA_GLOB = "data/*.json"

# ① 評価語（良し悪しを含む語）。法定・定義用語はホワイトリストで除外する。
EVAL_WORDS = [
    "危険", "悪化", "深刻", "優良", "劣", "手厚", "不十分", "負担が重", "負担が軽",
    "注目", "おすすめ", "主要会派", "停滞", "活発", "衰退", "進みすぎ", "良好",
    "望ましい", "問題あり", "健闘", "秀で, ", "ワースト", "ベスト", "勝ち", "負け",
]
WHITELIST = [
    "健全化判断比率", "早期健全化", "財政再生", "健全化計画", "実質公債費比率",
    "将来負担比率", "連結実質赤字", "実質赤字",
]

# ② 評価的な信号色（赤/黄/緑を大小の良し悪しに割り当てる疑い）。区別トークンは除外。
COLOR_PAT = re.compile(
    r"(bg|text|border|fill|stroke)-(red|green|yellow|amber|rose|lime|emerald)-|"
    r"#ff0000|#00ff00|#ffff00|信号色を|traffic",
    re.IGNORECASE,
)
COLOR_ALLOW = ["identity", "current", "national", "prefecture", "similar",
               "threshold", "baseline", "teal", "sector", "male", "female",
               "single", "aging"]

# ③ 欠損表現（データ側）。表示語の一貫性チェック材料。
MISSING_TOKENS = ["未発見", "未確認", "未整備", "対象外", "不明", "収集禁止", "非公開", "無投票"]


def scan_sources():
    hits_word, hits_color = [], []
    files = []
    for g in SRC_GLOBS:
        files += glob.glob(os.path.join(ROOT, g), recursive=True)
    for fp in sorted(set(files)):
        rel = os.path.relpath(fp, ROOT)
        try:
            lines = open(fp, encoding="utf-8").read().splitlines()
        except Exception as e:
            hits_word.append((rel, 0, f"[読取失敗] {e}"))
            continue
        for i, ln in enumerate(lines, 1):
            for w in EVAL_WORDS:
                if w in ln and not any(wl in ln for wl in WHITELIST):
                    hits_word.append((rel, i, ln.strip()[:120]))
                    break
            m = COLOR_PAT.search(ln)
            if m and not any(a in ln.lower() for a in COLOR_ALLOW):
                hits_color.append((rel, i, ln.strip()[:120]))
    return hits_word, hits_color


def scan_data():
    rows = []
    for fp in sorted(glob.glob(os.path.join(ROOT, DATA_GLOB))):
        rel = os.path.relpath(fp, ROOT)
        try:
            d = json.load(open(fp, encoding="utf-8"))
        except Exception as e:
            rows.append((rel, f"[JSON読取失敗] {e}"))
            continue
        data = d.get("data", d) if isinstance(d, dict) else d
        if not isinstance(data, list):
            continue
        null_ct, tok_ct = 0, {}
        for r in data:
            if not isinstance(r, dict):
                continue
            for k, v in r.items():
                if v is None:
                    null_ct += 1
                elif isinstance(v, str):
                    for t in MISSING_TOKENS:
                        if t in v:
                            tok_ct[t] = tok_ct.get(t, 0) + 1
        summary = f"null={null_ct}"
        if tok_ct:
            summary += " / " + ", ".join(f"{k}:{v}" for k, v in sorted(tok_ct.items()))
        rows.append((rel, summary))
    return rows


def main():
    hw, hc = scan_sources()
    dr = scan_data()
    lines = []
    lines.append("# 中立性UI監査 機械走査レポート（候補抽出・最終判定は人）\n")
    lines.append(f"## ① 評価語の候補（{len(hw)}件）— 良し悪しを含む語。法定・定義用語は除外済み")
    lines += [f"  {f}:{n}: {t}" for f, n, t in hw] or ["  （ヒットなし）"]
    lines.append(f"\n## ② 評価的な信号色の候補（{len(hc)}件）— 区別トークンは除外")
    lines += [f"  {f}:{n}: {t}" for f, n, t in hc] or ["  （ヒットなし）"]
    lines.append(f"\n## ③ データ欠損の一覧（{len(dr)}ファイル）— 表示語の一貫性確認材料")
    lines += [f"  {f}: {s}" for f, s in dr]
    lines.append("\n# 判定の指針")
    lines.append("  ①②が0件なら評価語・評価色は無い（中立性の主要リスク解消）。")
    lines.append("  ①②にヒットがあれば、その箇所を目視で『区別/法定用語ならOK・評価ならNG』判定する。")
    lines.append("  ③はnull・欠損トークンを持つファイルの表示画面を、無投票/未整備/対象外の区別表示で見る。")
    open(OUT, "w", encoding="utf-8").write("\n".join(lines))
    print(f"wrote {OUT}")
    print(f"  評価語候補={len(hw)} 信号色候補={len(hc)} データ={len(dr)}ファイル")


if __name__ == "__main__":
    main()
