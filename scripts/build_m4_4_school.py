import json
import hashlib
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "poc" / "m4_4_school_src"  # 原本（eyx*.xlsx）の置き場
OUT = ROOT / "data" / "m4_4_school.json"

FILES = {
    "shogaku_gakkosu": ("eyx37_shogaku_gakkosu.xlsx", "eyx-37"),
    "shogaku_jido": ("eyx42_shogaku_jido.xlsx", "eyx-42"),
    "chugaku_gakkosu": ("eyx66_chugaku_gakkosu.xlsx", "eyx-66"),
    "chugaku_seito": ("eyx71_chugaku_seito.xlsx", "eyx-71"),
}


def sha256(path):
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def extract_gifu_totals(fname):
    """Return dict: municipality_code(str, 5digit) -> (name, total_value)."""
    path = SRC / fname
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = None
    for sheet in wb.worksheets:
        if "岐阜" in sheet.title:
            ws = sheet
            break
    if ws is None:
        raise RuntimeError(f"岐阜県シートが見つかりません: {fname}")

    result = {}
    for row in ws.iter_rows(values_only=True):
        code = row[0]
        name = row[1]
        total = row[2]
        if code is None or name is None:
            continue
        code_str = str(code).strip()
        if not code_str.isdigit():
            continue
        if code_str == "計":
            continue
        full_code = "21" + code_str.zfill(3)
        result[full_code] = (name, total)
    return result


def main():
    hashes = {}
    parsed = {}
    for key, (fname, table_no) in FILES.items():
        path = SRC / fname
        hashes[key] = {"file": fname, "table_no": table_no, "sha256": sha256(path)}
        parsed[key] = extract_gifu_totals(fname)

    shogaku_gakkosu = parsed["shogaku_gakkosu"]
    shogaku_jido = parsed["shogaku_jido"]
    chugaku_gakkosu = parsed["chugaku_gakkosu"]
    chugaku_seito = parsed["chugaku_seito"]

    codes = set(shogaku_gakkosu) | set(shogaku_jido) | set(chugaku_gakkosu) | set(chugaku_seito)
    missing = {
        "shogaku_gakkosu": codes - set(shogaku_gakkosu),
        "shogaku_jido": codes - set(shogaku_jido),
        "chugaku_gakkosu": codes - set(chugaku_gakkosu),
        "chugaku_seito": codes - set(chugaku_seito),
    }
    for k, v in missing.items():
        if v:
            print(f"WARNING: {k} に欠落コードあり: {sorted(v)}")

    print(f"抽出団体数: {len(codes)}（42期待）")
    if len(codes) != 42:
        print("WARNING: 42/42になっていません。以下のコード一覧:")
        print(sorted(codes))

    records = []
    for code in sorted(codes):
        name = (
            shogaku_gakkosu.get(code, (None,))[0]
            or shogaku_jido.get(code, (None,))[0]
            or chugaku_gakkosu.get(code, (None,))[0]
            or chugaku_seito.get(code, (None,))[0]
        )
        records.append({
            "市区町村コード": code,
            "都道府県": "岐阜県",
            "市区町村名": name,
            "小学校数": shogaku_gakkosu.get(code, (None, None))[1],
            "小学校児童数": shogaku_jido.get(code, (None, None))[1],
            "中学校数": chugaku_gakkosu.get(code, (None, None))[1],
            "中学校生徒数": chugaku_seito.get(code, (None, None))[1],
        })

    out = {
        "sources": [
            {
                "name": "学校基本調査 令和6年度 eyx-37 市町村別学校数（小学校）",
                "source_page": "https://www.e-stat.go.jp/stat-search/files?tclass=000001223597&cycle=0",
                "source_url": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040231127&fileKind=0",
                "fetched_at": "2026-08-30",
                "source_file_hash": hashes["shogaku_gakkosu"]["sha256"],
            },
            {
                "name": "学校基本調査 令和6年度 eyx-42 市町村別学年別児童数 計（小学校）",
                "source_page": "https://www.e-stat.go.jp/stat-search/files?tclass=000001223597&cycle=0",
                "source_url": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040231132&fileKind=0",
                "fetched_at": "2026-08-30",
                "source_file_hash": hashes["shogaku_jido"]["sha256"],
            },
            {
                "name": "学校基本調査 令和6年度 eyx-66 市町村別学校数（中学校）",
                "source_page": "https://www.e-stat.go.jp/stat-search/files?toukei=00400001&tstat=000001011528&tclass1=000001223980&tclass2=000001223998&cycle=0&tclass3=000001223999&tclass4=000001224004",
                "source_url": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040231156&fileKind=0",
                "fetched_at": "2026-08-30",
                "source_file_hash": hashes["chugaku_gakkosu"]["sha256"],
            },
            {
                "name": "学校基本調査 令和6年度 eyx-71 市町村別学年別生徒数 計（中学校）",
                "source_page": "https://www.e-stat.go.jp/stat-search/files?toukei=00400001&tstat=000001011528&tclass1=000001223980&tclass2=000001223998&cycle=0&tclass3=000001223999&tclass4=000001224004",
                "source_url": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040231161&fileKind=0",
                "fetched_at": "2026-08-30",
                "source_file_hash": hashes["chugaku_seito"]["sha256"],
            },
        ],
        "period": "令和6年5月1日現在",
        "notes": [
            "次版先行取得・V1未組込：content-spec-v1.md §7.14で4-4「学校数・生徒数」はV1見送りと確定済み。本ファイルはV1のどのカードにも組み込まず、UIにも表示しない。",
            "単位：学校数=校、児童数・生徒数=人。",
            "小学校数・中学校数は「計」列（本校＋分校の合計、国公私立合計）。",
            "小学校児童数・中学校生徒数は学年別の「計」列合計（男女計）。",
            "市区町村コードは総務省コード表準拠（岐阜県=21、5桁）。",
        ],
        "data": records,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"書き出し完了: {OUT}")


if __name__ == "__main__":
    main()
