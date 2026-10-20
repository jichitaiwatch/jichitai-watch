#!/usr/bin/env python3
"""森林環境譲与税の使途（令和6年度）: 岡山33・広島34・山口35 の最終データを作る（試作・自動化試行 案2）。

入力: poc/recon-20261019-shinrin-okayama-hiroshima-yamaguchi/ の Grok / Composer の台帳（独立・相互に非参照）
      data/forest_tax_r6_trial.json の総務省の譲与額（jouyo_total_sen）
裁定: 台帳が一致した行はそのまま採用、Composer 単独の行は機械で整合を確認、食い違い・不整合の行は
      公式資料を Claude が確認した結果を OV に持つ（D-25: 推定で埋めない。列の対応が確定できない行は値を空にして備考へ）。
出力: data/forest_tax_use_r6_trial_{33,34,35}.json（市町村）, data/forest_tax_use_r6_trial_pref_{33,34,35}.json（県）
実行: python3 -I scripts/gen_forest_tax_use_33_35.py
"""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, "poc", "recon-20261019-shinrin-okayama-hiroshima-yamaguchi")
UPDATED = "2026-10-19"
PREF_NAMES = {"33": "岡山県", "34": "広島県", "35": "山口県"}
PREF_JOUYO = {"33": 126396000, "34": 134178000, "35": 114373000}  # 総務省PDF 県分

NOTES = (
    "試作（D-24）。公開しない。各自治体の使途公表（令和6年度）を読み取った値。jouyo_yenは総務省PDF。"
    "katsuyo_yenは基金積立を除く事業への充当額（basisが事業費の団体は財源内訳が無い）。"
    "kikin_tsumitate_yenは基金への積立額。check=整合は活用額＋基金積立額が譲与額に一致、不一致は資料の値のまま（推定で直さない）、"
    "確定できないは機械で数値の対応を決められなかったもの（値は空・読み取れた数値を備考に）、未取得は機械で探して到達できなかったもの。"
    "基金残高・未執行額は載せない（L-8裁定）。 main_usesは金額の大きい順に最大3件で、基金への積立も使途として含める（2026-10-17 運営者裁定）。"
    "読み取りは外部AI2系統（Grok・Composer、相互に非参照）で行い、食い違い・不整合の行は公式資料でClaudeが確認した（2026-10-19）。"
)
PREF_NOTES = (
    "都道府県版（県自身が受け取った譲与税）。area_code は都道府県2桁。各県の令和6年度の使途公表を読み取った値。"
    "基金残高・未執行額は載せない。main_usesは金額の大きい順に最大3件で、基金への積立も使途として含める。"
)

BASIS_J = "譲与税充当額"
BASIS_B = "事業費"
# 備考の定型
N_AGREE = "外部AI2系統（Grok・Composer）が一致"
N_COMP = "外部AIのComposerのみが読み取り（Grokは未取得）。使途の合計＝活用額、活用額＋基金積立＝譲与額などの整合は機械で確認済み。公式資料での個別照合は未実施"

# 公式資料でClaudeが確認した行。K=活用額（基金積立を除く事業の合計）、B=基金積立額。
# pick: 'G'/'C' はどちらの台帳の使途一覧を使うか。check は None なら K+B と譲与額から機械で決める。
OV = {
    "332038": dict(K=None, check="未取得", note="公表ページが画面表示後に数値を読み込む作りで、機械では使途の数値に届かなかった（外部AI2系統とも）"),
    "332046": dict(K=5230000, B=None, basis=BASIS_B, pick="C",
                   note="資料は令和6年度の事業（林道支障木伐採委託5,230千円）と基金積立額22,387千円（令和6年度末時点の記載）のみ。22,387千円は年度末の額の書き方で令和6年度の積立額とは確定できないため積立額は空欄。外部AI2系統が一致。公式ページで確認"),
    "332089": dict(K=19883954, B=None, basis=BASIS_B, pick="G",
                   note="ページの事業金額の合計19,883,954円が令和6年度の交付額16,874,000円を上回る。差の扱い（基金取崩など）の説明はない。基金残高は載せない。資料の値のまま。公式ページで確認"),
    "332097": dict(K=87178082, B=0, basis=BASIS_J, pick="C",
                   note="合計行の「うち森林環境譲与税」87,178,082円（総務省の譲与額より大きい）。基金積立は0円（高梁市森づくり基金）。資料の値のまま。公式PDFで確認"),
    "332119": dict(K=3564000, B=9266000, basis=BASIS_B, pick="C",
                   note="資料は事業総額（千円）で、基金積立9,266千円を含め合計12,830千円（総務省の譲与額と差）。財源の内訳列はない。資料の値のまま。公式PDFで確認"),
    "332127": dict(K=500000, B=7652000, basis=BASIS_J, pick="C",
                   note="資料の令和6年度の譲与額は8,152,000円（総務省8,070,000円と差）。ナラ枯れ防除500,000円と基金積立7,652,000円。資料の値のまま。公式PDFで確認"),
    "332143": dict(K=201572000, B=None, basis=BASIS_J, pick="C",
                   note="合計行の譲与税充当額201,572千円（総務省の譲与額より大きい）。項目16の基金取崩19,546千円は積立ではないため使途にも積立額にも含めない。資料の値のまま。公式PDFで確認"),
    "333468": dict(K=None, check="未取得", note="指定ページに令和6年度の使途の数値がない（令和5年度以前まで。外部AI2系統とも）"),
    "334235": dict(K=None, check="未取得", note="指定の公表資料が令和4年度分の表で、令和6年度の数値に届かなかった（Composerの読み取り値は令和4年度のものだったため採用しない）"),
    "336238": dict(K=16024000, B=0, basis=BASIS_J, pick="C",
                   note="資料の令和6年度の活用額16,024,000円（事業費の合計は16,153,900円）、譲与額15,246,000円。基金積立の行は0。資料の値のまま。公式PDFで確認"),
    "336637": dict(K=9000000, B=None, basis=BASIS_J, pick="C",
                   note="合計行の「うち森林環境譲与税」9,000,000円（事業総額9,096,436円）。譲与額の単独記載なし、基金の記載なし。資料の値のまま。公式PDFで確認"),
    "341002": dict(K=248175000, B=None, basis=BASIS_J, pick="C",
                   note="資料の列名は「事業費」と「実績」で、「実績」の合計248,175千円を活用額とした（総務省の譲与額と一致）。基金積立額の記載なし。公式PDFで確認"),
    "342025": dict(K=36180910, B=0, basis=BASIS_J, pick="C",
                   note="資料の活用額36,180,910円（総務省の譲与額より大きい）。基金積立は0円。資料の値のまま。公式PDFで確認"),
    "342033": dict(K=3102280, B=8025319, basis=BASIS_B, pick="C",
                   note="旅費11,280円と森林整備業務3,091,000円を活用額、基金積立8,025,319円。森林集積計画調査等業務は決算0円（6,578,000円は令和7年度へ繰越）。財源の内訳列はない。資料の値のまま。公式PDFで確認"),
    "342084": dict(K=34114386, B=0, basis=BASIS_J, pick="C",
                   note="資料の活用額34,114,386円は総務省の譲与額より大きい（基金繰入4,927,386円で補ったと資料にある）。基金積立は0円。資料の値のまま。公式PDFで確認"),
    "342106": dict(K=102513000, B=None, basis=BASIS_J, pick="C",
                   note="歳出の合計（「充当額」列）102,513,000円。基金積立額の数値は記載なし。原文の表は崩れ、一部の事業名の対応は確定できないが合計は小計と一致。公式PDFで確認"),
    "342114": dict(K=7186700, B=0, basis=BASIS_J, pick="C",
                   note="合計行の「うち森林環境譲与税」7,186,700円（総務省の譲与額5,915千円より大きい）。基金積立は0円。資料の値のまま。公式PDFで確認"),
    "342122": dict(K=53400000, B=None, basis=BASIS_B, pick="C",
                   note="歳出の事業費合計は調整額▲5千円を含め53,400千円。歳入は森林環境譲与税52,051千円と森林環境整備促進基金1,349千円。財源の内訳列はない。資料の値のまま。公式PDFで確認"),
    "342131": dict(K=99420435, B=0, basis=BASIS_B, pick="C",
                   note="歳出（執行額）合計99,420,435円。歳入78,775,000円との差し引き▲20,645,435円は資料に記載のとおり。基金積立は0円。資料の値のまま。公式PDFで確認"),
    "343072": dict(K=None, check="未取得", note="起点ページは旧ドメインで不達、新ドメインのページに令和6年度の使途PDFへのリンクが見つからなかった（外部AI2系統とも）"),
    "343692": dict(K=93913000, B=1137000, basis=BASIS_J, pick="G",
                   note="事業の合計93,913千円＋基金積立1,137千円＝譲与額95,050千円（総務省と一致）。Composerは活用額を譲与額と同額にしていたため、Grokの値を採用。公式ページで確認"),
    "344621": dict(K=25152000, B=None, basis=BASIS_B, pick="C",
                   note="事業5件の合計25,152千円が譲与額25,021千円と131千円差（資料に理由の記載なし）。合計行・基金の記載なし。財源の内訳はない。資料の値のまま。公式ページで確認"),
    "345458": dict(K=36968000, B=23023000, basis=BASIS_J, pick="C",
                   note="事業の合計36,968千円と基金積立23,023千円で計59,991千円（総務省59,994千円と3千円差）。元の表に合計・譲与額の記載はなく計算値。Composerの活用額（28,948千円）は事業の合計と合わないため採らない。公式ページで確認"),
    "352012": dict(K=None, check="未取得", note="使途の明細（事業ごとの金額）に届かなかった。決算書の歳入に森林環境譲与税100,188千円の記載はあるが使途明細ではない（外部AI2系統とも）"),
    "352021": dict(K=16310000, B=21486000, basis=BASIS_J, pick="C",
                   url="https://www.city.ube.yamaguchi.jp/_res/projects/default_project/_page_/001/006/152/jyouyozeishito-r6.pdf",
                   note="資料の執行額合計37,796千円（交付額と同額）のうち基金積立21,486千円、残りが事業。市の一覧ページにはR7のPDFのみ表示のため、R6のPDFを直接確認。公式PDFで確認"),
    "352039": dict(K=130987594, B=63932415, basis=BASIS_J, pick="C",
                   note="「うち森林環境譲与税」の計194,920,009円から森林環境整備基金積立金63,932,415円を除いた額を活用額とした。収入内訳は譲与額180,019,000円と基金取崩14,901,009円。資料の値のまま。公式PDFで確認"),
    "352047": dict(K=74509535, B=32911465, basis=BASIS_J, pick="C",
                   note="使途の合計＋基金積立＝譲与額（総務省と一致）。Composerは活用額を譲与額と同額にしていたため、使途の合計を採用。公式PDFで確認"),
    "352063": dict(K=26840000, B=None, basis=BASIS_J, pick="G",
                   note="事業の「うち森林環境譲与税」の合計26,840千円。表の合計23,846千円（総務省の譲与額と一致）には基金の行（▲2,994千円・見出しは「積立（取崩）」）が含まれる。積立額は確定できないため空欄。公式PDFで確認"),
    "352071": dict(K=11571000, B=10010882, basis=BASIS_J, pick="C",
                   note="事業の合計11,571,000円（総務省の譲与額と一致）。表の合計21,581,882円は基金の行10,010,882円を含む。元資料は基金の行を「積立」と明示していない。資料の値のまま。公式PDFで確認"),
    "352101": dict(K=0, B=13924000, basis=BASIS_J, pick="C", url="https://www.city.hikari.lg.jp/material/files/group/84/r6sinrinkankyouzyouyozeisitokouhyou.pdf",
                   uses=[],
                   note="資料の表（元PDFで列の位置を確認）：事業5件の計14,339千円は「うち基金取崩額」の列で、「うち令和6年度の森林環境譲与税」の列は0。基金積立（光市森林環境基金）13,924千円は譲与税の列。譲与税の合計13,924千円は総務省の譲与額と一致。活用額は譲与税で賄った事業の額（0）とし、基金取崩で賄った事業14,339千円は載せない"),
    "352128": dict(K=7959648, B=7991352, basis=BASIS_J, pick="C", url="https://www.city-yanai.jp/uploaded/attachment/41524.pdf",
                   uses=[("森林経営管理制度調査", 5723300), ("里山再生支援事業", 897600), ("森林施業支援事業", 673151), ("経営管理権集積計画作成等", 355884), ("竹林転換事業", 309713)],
                   note="事業5件の計7,959,648円（資料の「令和6年度の活用額」と一致）と基金積立7,991,352円で、合計は譲与額15,951,000円（総務省と一致）。元PDFで確認（この資料は事業費と譲与税が同額）"),
    "352136": dict(K=84448168, B=9855832, basis=BASIS_J, pick="C",
                   note="資料の合計94,304,000円（交付額と同額）のうち基金積立9,855,832円、残りが事業。Composerは活用額を合計と同額にしていたため、事業の合計を採用。公式PDFで確認"),
    "352152": dict(K=94588000, B=34220000, basis=BASIS_J, pick="G",
                   note="公表PDFの譲与税額128,808千円は総務省128,758千円と差。事業の合計94,588千円と基金積立34,220千円。Composerは活用額を譲与税額の合計と同額にしていたためGrokの値を採用。資料の値のまま"),
    "352161": dict(K=8262000, B=4977000, basis=BASIS_J, pick="C",
                   note="資料の合計13,239千円（交付額と同額）のうち基金積立4,977千円、残りが事業。Composerは活用額を合計と同額にしていたため、事業の合計を採用。公式PDFで確認"),
    "353051": dict(K=2701000, B=6935000, basis=BASIS_J, pick="C",
                   note="事業4件の計2,701千円と基金積立6,935千円で、総務省の譲与額と一致（資料に合計行はない）。Composerは活用額を譲与額と同額にしていたため、事業の合計を採用。公式PDFで確認"),
    "353213": dict(K=1229000, B=None, basis=BASIS_J, pick="C",
                   note="山林調査（森林経営管理制度）1,229千円のみ。譲与額1,358千円との差の扱い・基金積立の記載なし。資料の値のまま。公式PDFで確認"),
    "353418": dict(K=143000, B=1209000, basis=BASIS_J, pick="C", url="https://www.town.kaminoseki.lg.jp/wp-content/uploads/2026/02/R6sinrinzyouyo.pdf",
                   uses=[("上関町バス停ベンチ設置", 143000)],
                   note="バス停ベンチ設置143千円と基金積立1,209千円で合計1,352千円（総務省の譲与額と一致）。元PDFで確認"),
    "353434": dict(K=4342000, B=4229000, basis=BASIS_J, pick="C",
                   note="民有林整備事業の(A)1,337千円と麻里府公民館整備事業の(A)3,005千円が活用額、基金積立4,229千円（譲与税を全額積み立てる旨の記載）。(A)列の計8,571千円は総務省の譲与額4,229千円より大きい。基金取崩の表にデータ行なし。資料の値のまま。公式PDFで確認"),
    "353442": dict(K=3630000, B=None, basis=BASIS_J, pick="C",
                   note="事業費5,067,000円のうち譲与税充当3,630,000円（合計行）。不足分は基金の充当で対応と資料に記載（取崩にあたり積立ではない）。使途一覧の金額は事業費。公式ページで確認"),
    "355020": dict(K=11533902, B=3788098, basis=BASIS_J, pick="G",
                   note="事業の合計11,533,902円＋基金積立3,788,098円＝交付額15,322,000円（総務省と一致）。Composerは活用額を交付額と同額にしていたためGrokの値を採用"),
}


def load(name):
    with open(os.path.join(LEDGER, name), encoding="utf-8") as f:
        return {r["area_code"]: r for r in csv.DictReader(f)}


def num(v):
    v = (v or "").strip()
    return int(v) if v.isdigit() else None


def uses_of(row):
    out = []
    for m in (row.get("使途一覧") or "").split("；"):
        if ":" not in m:
            continue
        name, amt = m.rsplit(":", 1)
        if amt.isdigit() and int(amt) > 0:
            out.append({"name": name, "yen": int(amt)})
    return out


def main_uses(uses, kikin):
    xs = list(uses)
    if kikin:
        xs.append({"name": "基金への積立", "yen": kikin})
    xs.sort(key=lambda x: -x["yen"])
    return xs[:3]


def build(code, jouyo, g, c, kind):
    """kind: 'city' | 'pref'"""
    gr, cr = g.get(code), c.get(code)
    ov = OV.get(code)
    name = (cr or gr)["団体名"]
    url = (cr or gr)["出典URL"]
    if ov and ov.get("K") is None and "check" in ov:
        return dict(area_code=code, city_name=name, jouyo_yen=jouyo, katsuyo_yen=None, katsuyo_basis=None,
                    kikin_tsumitate_yen=None, main_uses=[], source_url=ov.get("url") or url,
                    check=ov["check"], note=ov["note"])
    if ov:
        K, B, basis = ov["K"], ov["B"], ov["basis"]
        src = (gr if ov["pick"] == "G" else cr) or cr or gr
        url = ov.get("url") or src["出典URL"] or url
        uses = ([{"name": n, "yen": y} for n, y in ov["uses"]] if "uses" in ov
                else uses_of(src) or uses_of(cr or {}) or uses_of(gr or {}))
        note = ov["note"]
    else:
        gK, cK = num((gr or {}).get("活用額_円")), num((cr or {}).get("活用額_円"))
        gB, cB = num((gr or {}).get("基金積立額_円")), num((cr or {}).get("基金積立額_円"))
        if gr and cr and gK is not None and gK == cK and gB == cB:
            K, B, note = gK, gB, N_AGREE
            basis = gr["活用額の根拠区分"] or cr["活用額の根拠区分"]
            src = gr
        elif cr and cK is not None:
            K, B, note = cK, cB, N_COMP
            basis = cr["活用額の根拠区分"]
            src = cr
        elif gr and gK is not None:
            K, B, note, basis, src = gK, gB, "外部AIのGrokのみが読み取り（Composerは未取得）", gr["活用額の根拠区分"], gr
        else:
            raise SystemExit(f"未処理: {code} {name}")
        uses = uses_of(src) or uses_of(gr or {}) or uses_of(cr or {})
        url = src["出典URL"] or url
        if K == 0 and not B:
            raise SystemExit(f"要確認: {code} {name}")
    if kind == "pref":
        note = N_AGREE + "。資料の使途一覧の計（千円表記）。基金積立額の記載なし"
    total = K + (B or 0)
    check = "整合" if total == jouyo else "不一致（資料の値のまま）"
    return dict(area_code=code, city_name=name, jouyo_yen=jouyo, katsuyo_yen=K, katsuyo_basis=basis,
                kikin_tsumitate_yen=B, main_uses=main_uses(uses, B), source_url=url, check=check, note=note)


def main():
    g, c = load("shinrin-grok.csv"), load("shinrin-composer.csv")
    with open(os.path.join(ROOT, "data", "forest_tax_r6_trial.json"), encoding="utf-8") as f:
        sou = json.load(f)["data"]
    jouyo = {r["area_code"]: r["jouyo_total_sen"] * 1000 for r in sou}
    for pc in ("33", "34", "35"):
        rows = [build(code, jouyo[code], g, c, "city")
                for code in sorted(c) if len(code) == 6 and code[:2] == pc]
        prow = [build(pc, PREF_JOUYO[pc], g, c, "pref")]
        prow[0]["city_name"] = PREF_NAMES[pc]
        for kind, data, notes in (("", rows, NOTES), ("pref_", prow, PREF_NOTES)):
            ds = {"updated": UPDATED, "fiscal_year": "令和6年度", "unit": "円", "notes": notes, "data": data}
            p = os.path.join(ROOT, "data", f"forest_tax_use_r6_trial_{kind}{pc}.json")
            with open(p, "w", encoding="utf-8") as f:
                json.dump(ds, f, ensure_ascii=False, indent=1)
                f.write("\n")
            from collections import Counter
            print(os.path.basename(p), len(data), dict(Counter(r["check"] for r in data)))


if __name__ == "__main__":
    main()
