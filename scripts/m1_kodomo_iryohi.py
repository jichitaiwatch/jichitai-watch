"""
M1: こども家庭庁 こども医療費に対する助成の実施状況調査 抽出スクリプト
対象: 岐阜県内42市町村

ソース（令和7年4月1日時点・別紙3。2026-10-07 令和6年版から更新）:
  公表ページ: https://www.cfa.go.jp/policies/boshihoken/kodomoiryouhityousa-r7
  PDF直URL:   https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/
              6a9b8926-411c-4044-81aa-d8c26b21aaf5/12ae0d40/20251224policies-boshihoken-kodomoiryouhityousa-r7-03.pdf
              （全国1,741市区町村収録。原本は poc/recon-20261007-kodomo-r7/ に保存）

抽出方法（令和7年版から `pdftotext -layout` の行単位に変更・2026-10-07）:
  1行＝1市区町村。正規表現で「都道府県名 番号 市区町村名 通院年齢 入院年齢 所得制限(通/入) 自己負担(通/入)」を取る。
  全国1,741行が取れることを実行時に検証する（満たさなければ中断）。名前末尾の「※」は
  「18歳年度末以降は学生医療（大学等に通う者のみ・一定の所得制限あり）」の注記で、名前から除き 学生医療=true とする。

旧方法（令和6年版・2026-08-03確認。令和7年版では1トークン1行の並びが崩れ、9の倍数にならなかったため不使用）:
  pdftotext -enc UTF-8（Poppler）でテキスト化 → 1行1トークンで出力される。
  ヘッダー行（"対象年齢"「市区町村名」等の繰り返し）を除去した後、
  先頭から9トークンずつ区切ると1市区町村分のレコードになる:
    1.都道府県名 2.番号 3.市区町村名 4.対象年齢通院 5.対象年齢入院
    6.所得制限通院 7.所得制限入院 8.一部自己負担通院 9.一部自己負担入院
  pdfplumber・PyMuPDFはMS-PGothic CIDフォント非対応で文字化けするため不使用。

県引数（2026-10-17・D-24 共通化）:
  python scripts/m1_kodomo_iryohi.py --pref 23   # 愛知など。data/m1_kodomo_iryohi_23.json に書く（公開しない）
  対象団体と area_code は自治体マスタ（scripts/pref_args.py）から。原本PDFは全国分。
  data/cache/ に無ければ poc/recon-20261007-kodomo-r7/ の保存済み原本を使う。

実行:
  python scripts/m1_kodomo_iryohi.py --test   # 岐阜市のみ
  python scripts/m1_kodomo_iryohi.py          # 岐阜県42市町村 → data/m1_kodomo_iryohi.json
"""

import os
import sys
import json
import shutil
import argparse
import re
import subprocess
from pathlib import Path

import requests

from lineage import build_sources
from pref_args import DEFAULT_PREF, load_master_cities, load_master_pref_name, out_path, parse_pref

PDF_URL = (
    "https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/"
    "6a9b8926-411c-4044-81aa-d8c26b21aaf5/12ae0d40/"
    "20251224policies-boshihoken-kodomoiryouhityousa-r7-03.pdf"
)
TARGET_PREF = "岐阜県"
CACHE_PDF = Path("data/cache/m1_kodomoiryohi_r7.pdf")
CACHE_TXT = Path("data/cache/m1_kodomoiryohi_r7.txt")
SAVED_PDF = Path("poc/recon-20261007-kodomo-r7/cfa_kodomoiryohi_r7_bessi3.pdf")  # リポジトリに保存済みの原本
PREF = parse_pref(sys.argv[1:])
IS_DEFAULT = PREF == DEFAULT_PREF
OUTPUT_PATH = Path("data") / out_path("m1_kodomo_iryohi", PREF).name

# pdftotext(Poppler) の探索順: PATH → 環境変数 PDFTOTEXT_PATH → Winget既定の配置。
# ローカル絶対パスをソースに直書きしない（運営者のユーザー名が実名を含むため。
# security-model.md §7-1「本文書自体のPII方針」）。
POPPLER_ENV_VAR = "PDFTOTEXT_PATH"
POPPLER_WINGET_GLOB = (
    r"AppData\Local\Microsoft\WinGet\Packages"
    r"\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe"
    r"\poppler-*\Library\bin\pdftotext.exe"
)

HEADER_TOKENS = {
    "別紙３",
    "こども医療費に対する助成の実施状況調査（市区町村用）（令和７年４月１日時点）",
    "対象年齢",
    "市区町村名",
    "都道府県名",
    "所得制限",
    "一部自己負担",
    "通 院",
    "入 院",
    "通院",
    "入院",
}


# ------------------------------------------------------------------ download

def download_pdf(url: str, cache: Path) -> Path:
    if cache.exists():
        print(f"[cache] {cache}")
        return cache
    print(f"[download] {url}")
    resp = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(resp.content)
    print(f"[saved]    {cache}  ({len(resp.content)//1024} KB)")
    return cache


def find_pdftotext() -> str:
    exe = shutil.which("pdftotext")
    if exe:
        return exe

    env_path = os.environ.get(POPPLER_ENV_VAR)
    if env_path and Path(env_path).exists():
        return env_path

    # Wingetでインストールした場合の既定の配置をユーザーホームから探す（バージョン番号はglobで吸収）
    for candidate in sorted(Path.home().glob(POPPLER_WINGET_GLOB), reverse=True):
        if candidate.exists():
            return str(candidate)

    raise FileNotFoundError(
        "pdftotext (Poppler) が見つかりません。\n"
        "対処: (1) Popplerをインストールし PATH を通す、"
        f"または (2) 環境変数 {POPPLER_ENV_VAR} に pdftotext の絶対パスを設定してください。\n"
        "Windows: winget install oschwartz10612.Poppler"
    )


def pdf_to_text(pdf_path: Path, txt_path: Path) -> Path:
    if txt_path.exists():
        print(f"[cache] {txt_path}")
        return txt_path
    pdftotext = find_pdftotext()
    txt_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([pdftotext, "-layout", "-enc", "UTF-8", str(pdf_path), str(txt_path)], check=True)
    print(f"[saved]    {txt_path}")
    return txt_path


# ------------------------------------------------------------------ parsing

def load_tokens(txt_path: Path) -> list[str]:
    raw = txt_path.read_text(encoding="utf-8")
    tokens = []
    for line in raw.split("\n"):
        line = line.strip("\r").strip()
        if not line:
            continue
        if line in HEADER_TOKENS:
            continue
        tokens.append(line)
    return tokens


def parse_records(tokens: list[str]) -> list[dict]:
    if len(tokens) % 9 != 0:
        print(
            f"[warn] トークン数 {len(tokens)} は9の倍数ではありません。"
            "ヘッダー除去漏れの可能性があります。",
            file=sys.stderr,
        )
    records = []
    for i in range(0, len(tokens) - 8, 9):
        chunk = tokens[i : i + 9]
        records.append(
            {
                "都道府県": chunk[0],
                "番号": chunk[1],
                "市区町村名": chunk[2],
                "対象年齢_通院": chunk[3],
                "対象年齢_入院": chunk[4],
                "所得制限_通院": chunk[5],
                "所得制限_入院": chunk[6],
                "一部自己負担_通院": chunk[7],
                "一部自己負担_入院": chunk[8],
            }
        )
    return records


ROW_RE = re.compile(
    r"^\s*(\S+[都道府県])\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*$"
)
EXPECTED_ALL = 1741


def parse_layout(txt_path: Path) -> list[dict]:
    records = []
    for line in txt_path.read_text(encoding="utf-8").split("\n"):
        m = ROW_RE.match(line)
        if not m:
            continue
        g = m.groups()
        name = g[2]
        gakusei = name.endswith("※")
        records.append(
            {
                "都道府県": g[0],
                "番号": g[1],
                "市区町村名": name.rstrip("※"),
                "対象年齢_通院": g[3],
                "対象年齢_入院": g[4],
                "所得制限_通院": g[5],
                "所得制限_入院": g[6],
                "一部自己負担_通院": g[7],
                "一部自己負担_入院": g[8],
                "学生医療": gakusei,
            }
        )
    if len(records) != EXPECTED_ALL:
        raise SystemExit(f"全国 {len(records)} 件（期待 {EXPECTED_ALL}）。抽出に漏れ・重複の疑い。中断します。")
    return records


def national_summary(records: list[dict]) -> dict:
    """全国1,741市区町村の分布（件数のみ。評価・順位は付けない）。"""
    from collections import Counter

    def cnt(key):
        return dict(Counter(r[key] for r in records).most_common())

    return {
        "母集団": len(records),
        "対象年齢_通院": cnt("対象年齢_通院"),
        "対象年齢_入院": cnt("対象年齢_入院"),
        "所得制限_通院": cnt("所得制限_通院"),
        "所得制限_入院": cnt("所得制限_入院"),
        "一部自己負担_通院": cnt("一部自己負担_通院"),
        "一部自己負担_入院": cnt("一部自己負担_入院"),
        "学生医療（※）": sum(1 for r in records if r["学生医療"]),
    }


# ------------------------------------------------------------------ main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="岐阜市のみ抽出して動作確認")
    ap.add_argument("--pref", default=DEFAULT_PREF, help="県コード2桁（既定21＝岐阜。それ以外は試作）")
    args = ap.parse_args()

    if not CACHE_PDF.exists() and SAVED_PDF.exists():
        pdf_path = SAVED_PDF
        print(f"[saved-original] {SAVED_PDF}")
    else:
        pdf_path = download_pdf(PDF_URL, CACHE_PDF)
    txt_path = pdf_to_text(pdf_path, CACHE_TXT)

    all_records = parse_layout(txt_path)
    print(f"[parse] 全国 {len(all_records)} 件")

    pref_name = load_master_pref_name(PREF)
    results = [dict(r) for r in all_records if r["都道府県"] == pref_name]
    if IS_DEFAULT:
        assert not any(r["学生医療"] for r in results), "岐阜県に※付き団体が現れた：出力形の見直しが必要"
    else:
        gakusei = [r["市区町村名"] for r in results if r["学生医療"]]
        print(f"[info] ※付き（学生医療あり）の団体: {gakusei}")
    # area_code は既存出力（令和6年版の整備時に付与済み）の名称→コード対応を引き継ぐ。
    # 名称が一致しない団体があれば中断（合併・改称の見落とし防止。D-17 area_code キー優先）。
    if IS_DEFAULT:
        code_by_name = {
            r["市区町村名"]: r["area_code"]
            for r in json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))["data"]
        }
    else:
        # 他県は自治体マスタの市区町村行（政令市の区は無い）から名称→コードを作る
        code_by_name = {name: code for code, name in load_master_cities(PREF).items()}
    missing = [r["市区町村名"] for r in results if r["市区町村名"] not in code_by_name]
    if missing or len(code_by_name) != len(results):
        raise SystemExit(f"area_code を引き継げない団体: {missing}（既存{len(code_by_name)}件／今回{len(results)}件）")
    results = [
        {
            "area_code": code_by_name[r["市区町村名"]],
            **{k: v for k, v in r.items() if k != "学生医療"},
            # 名前末尾の※（18歳年度末以降は学生医療）。岐阜には無いので従来の出力には現れない
            **({"学生医療": True} if r["学生医療"] else {}),
        }
        for r in results
    ]

    if args.test:
        results = [r for r in results if r["市区町村名"] == "岐阜市"]

    print(f"\n{'='*55}")
    print(f"{pref_name} 抽出結果: {len(results)} 件")
    print(f"{'='*55}")
    for row in results[:5]:
        print(
            f"  {row['市区町村名']:8s}  通院:{row['対象年齢_通院']:8s} 入院:{row['対象年齢_入院']:8s}  "
            f"所得制限(通/入):{row['所得制限_通院']}/{row['所得制限_入院']}  "
            f"自己負担(通/入):{row['一部自己負担_通院']}/{row['一部自己負担_入院']}"
        )
    if len(results) > 5:
        print(f"  ... (他 {len(results)-5} 件)")

    null_count = sum(1 for r in results for v in r.values() if not v)
    print(f"  空値合計: {null_count}")

    if args.test:
        print("\n[test mode] JSON 出力をスキップ")
        return

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    sources = build_sources(
        OUTPUT_PATH,
        specs=[{
            "role": None,
            "cache_path": pdf_path,
            "source_url": PDF_URL,
            "source_page": "https://www.cfa.go.jp/policies/boshihoken/kodomoiryouhityousa-r7",
        }],
        backfill_fetched_at="2026-10-07",
    )
    payload = {
        "sources": sources,
        "period": "令和7年4月1日時点",
        "updated": "2026-10-07",
        "notes": ([] if IS_DEFAULT else [
            f"D-24 の試作（公開しない）。都道府県名='{pref_name}'でフィルタし、自治体マスタ data/municipality_master_{PREF}.json の団体と名称で突き合わせた（政令指定都市の区の行は含めない）。",
        ]) + [
            "全国1,741市区町村収録PDF（別紙3）より都道府県名='岐阜県'でフィルタ。" if IS_DEFAULT else "全国1,741市区町村収録PDF（別紙3）より都道府県名でフィルタ。",
            *([
                "令和7年版では岐阜県42市町村は全件が所得制限『無』・一部自己負担『無』（令和6年版と同じ）。"
                "対象年齢は令和6年版から変わった団体がある（岐阜市は15歳→18歳年度末など）。",
            ] if IS_DEFAULT else [
                "名前末尾の『※』の団体は、行に『学生医療: true』を付けた（PDFの注記：18歳年度末以降は学生医療として実施しており、対象は大学等に通う者に限る。一定の所得制限あり）。",
            ]),
            "全国の分布は national に件数で収録（全国1,741市区町村。※付き＝学生医療ありの団体を含む）。",
        ],
        "national": national_summary(all_records),
        "data": results,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[output] {OUTPUT_PATH}  ({len(results)} 件)")


if __name__ == "__main__":
    main()
