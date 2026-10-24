"""
県・市区町村の英語の名前を作る（英語版・作業単位7。2026-10-23 運営者裁定）。

出力: i18n/place-names-en.json（手書き禁止。本スクリプトが単一ソース）

決まり（2026-10-23 運営者裁定。i18n/glossary.json の place_names にも同じものを置く）:
  - 名前の部分はローマ字、種類の部分は英語にする。
      県・府 → "○○ Prefecture"（岐阜県 = Gifu Prefecture、大阪府 = Osaka Prefecture）
      都     → "Tokyo Metropolis"
      道     → "Hokkaido"（Prefecture を付けない）
      市     → "○○ City"、町 → "○○ Town"、村 → "○○ Village"
      東京の特別区 → "○○ City"（市と同じ段の地方公共団体のため）
      政令指定都市の区 → "○○ Ward"（市の役所の一部。名前の全体は "Atsuta Ward, Nagoya City"）
  - ローマ字は URL の決まり（docs/frontend-architecture.md §5.4）と同じ作り方：
    総務省「全国地方公共団体コード」のカナ（data/municipality_kana.json）から、ヘボン式・撥音は常に n・
    伸ばす音は単母音に畳む（おう・おお→o、うう→u）・記号（ō など）は付けない・1語にする。先頭だけ大文字。
  - 各自治体が自分で使っている英語名では上書きしない（全国で同じ決まりにそろえる）。

カナから機械で作ると誤る形（2つ）は、止めて人が確かめる:
  (1) 総務省のカナは小さい「ャュョ」を大きい字で書くことがある（例：総社 ｿｳｼﾞﾔ＝そうじゃ）。
      「キヤ・シユ」などの並びは、本当に大きい字（清須 キヨス）か小さい字かをカナだけでは決められない。
  (2) 伸ばす音に見える母音の並びが、漢字の境目をまたぐことがある（例：輪之内 ワノウチ＝wa-no-uchi）。
  この2つに当たる名前は、OVERRIDES（直した英語と根拠）か REVIEWED（機械の結果で正しいと確かめたもの）の
  どちらかに載っていないと、スクリプトが止まる。県を足すときは、止まった名前を確かめて載せる。

対象: 47都道府県すべてと、データのある県（data/municipality_master*.json に載っている県）の市区町村。
確かめ方: 市と政令市の区は、総務省統計局『日本統計年鑑 2026』表2-4（都市別人口）の英語（Gifu-shi など）の
名前の部分と突き合わせた（2026-10-23。食い違いは撥音を m と書くもの〈Tempaku など〉と、下の OVERRIDES だけ）。

  python scripts/gen_place_names_en.py
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KANA_PATH = ROOT / "data" / "municipality_kana.json"
OUTPUT_PATH = ROOT / "i18n" / "place-names-en.json"

# URL の決まり（§5.4）と同じかな→ローマ字の表を使う（表を二重に持たない）
_spec = importlib.util.spec_from_file_location("gmm", ROOT / "scripts" / "gen_municipality_master.py")
_gmm = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_gmm)

# 機械の結果を直したもの：area_code → (名前の部分の英語, 根拠)
OVERRIDES: dict[str, tuple[str, str]] = {
    "213829": ("Wanouchi", "輪之内町＝わのうち（輪・之・内の境目。町の公式サイトのドメイン town.wanouchi.gifu.jp。URL も wanouchi-cho）"),
    "332089": ("Soja", "総社市＝そうじゃ（総務省カナ ｿｳｼﾞﾔ は小さい字を大きく書いたもの。統計年鑑 2026 表2-4：Soja-shi）"),
    "332127": ("Setouchi", "瀬戸内市＝せとうち（瀬戸・内の境目。統計年鑑 2026 表2-4：Setouchi-shi）"),
    "335860": ("Shinjo", "新庄村＝しんじょうそん（総務省カナ ｼﾝｼﾞﾖｳ は小さい字を大きく書いたもの。港区の資料 https://www.city.minato.tokyo.jp/documents/162102/29_shinjo.pdf の読み仮名）"),
}

# 止まる形に当たるが、機械の結果で正しいと確かめたもの：area_code → 確かめた内容
_LONG_IN_ONE_KANJI = "伸ばす音は1つの漢字の読みの中（境目をまたがない）"
_CITY_IN_NENKAN = "統計年鑑 2026 表2-4 の英語と一致"
REVIEWED: dict[str, str] = {
    # 岐阜
    "212024": f"大垣（おお）。{_CITY_IN_NENKAN}（Ogaki-shi）",
    "213411": f"養老（よう・ろう）。{_LONG_IN_ONE_KANJI}",
    "213811": f"神戸（ごう・ど）＝ごうど。{_LONG_IN_ONE_KANJI}",
    "214035": f"大野（おお）。{_LONG_IN_ONE_KANJI}",
    "215040": f"七宗（ひち・そう）。{_LONG_IN_ONE_KANJI}",
    # 愛知
    "231134": f"守山（もり・やま）。ヤは大きい字。{_CITY_IN_NENKAN}（Moriyama-ku）",
    "231151": f"名東（めい・とう）。{_CITY_IN_NENKAN}（Meito-ku）",
    "232033": f"一宮（いち・の・みや）。ヤは大きい字。{_CITY_IN_NENKAN}（Ichinomiya-shi）",
    "232106": f"刈谷（かり・や）。ヤは大きい字。{_CITY_IN_NENKAN}（Kariya-shi）",
    "232149": f"蒲郡（がま・ごおり）。{_CITY_IN_NENKAN}（Gamagori-shi）",
    "232173": f"江南（こう・なん）。{_CITY_IN_NENKAN}（Konan-shi）",
    "232220": f"東海（とう・かい）。{_CITY_IN_NENKAN}（Tokai-shi）",
    "232238": f"大府（おお・ぶ）。{_CITY_IN_NENKAN}（Obu-shi）",
    "232335": f"清須（きよ・す）。ヨは大きい字。{_CITY_IN_NENKAN}（Kiyosu-shi）",
    "232360": f"みよし。ヨは大きい字。{_CITY_IN_NENKAN}（Miyoshi-shi）",
    "233021": f"東郷（とう・ごう）。{_LONG_IN_ONE_KANJI}",
    "233617": f"大口（おお・ぐち）。{_LONG_IN_ONE_KANJI}",
    "233625": f"扶桑（ふ・そう）。{_LONG_IN_ONE_KANJI}",
    "234249": f"大治（おお・はる）。{_LONG_IN_ONE_KANJI}",
    "235016": f"幸田（こう・た）。{_LONG_IN_ONE_KANJI}",
    "235628": f"東栄（とう・えい）。{_LONG_IN_ONE_KANJI}",
    # 三重
    "243248": f"東員（とう・いん）。{_LONG_IN_ONE_KANJI}",
    "244431": f"大台（おお・だい）。{_LONG_IN_ONE_KANJI}",
    "245623": f"紀宝（き・ほう）。{_LONG_IN_ONE_KANJI}",
    # 岡山
    "336220": f"勝央（しょう・おう）＝Shoo。{_LONG_IN_ONE_KANJI}",
    "336815": f"吉備中央（きび・ちゅう・おう）＝Kibichuo。{_LONG_IN_ONE_KANJI}",
    # 広島
    "342092": f"三次（み・よし）。ヨは大きい字。{_CITY_IN_NENKAN}（Miyoshi-shi）",
    "342114": f"大竹（おお・たけ）。{_CITY_IN_NENKAN}（Otake-shi）",
    "343684": f"安芸太田（あき・おお・た）＝Akiota。{_LONG_IN_ONE_KANJI}",
    "344311": f"大崎上島（おお・さき・かみ・じま）＝Osakikamijima。{_LONG_IN_ONE_KANJI}",
    "345458": f"神石高原（じん・せき・こう・げん）＝Jinsekikogen。{_LONG_IN_ONE_KANJI}",
    # 山口
    "352063": f"防府（ほう・ふ）。{_CITY_IN_NENKAN}（Hofu-shi）",
    "352161": f"山陽小野田（さん・よう・お・の・だ）。{_CITY_IN_NENKAN}（Sanyoonoda-shi）",
    "353051": f"周防大島（す・おう・おお・しま）＝Suooshima。{_LONG_IN_ONE_KANJI}",
}

# 止める形
_SMALL_KANA_AMBIGUOUS = re.compile(r"[キシチニヒミリギジビピ][ヤユヨ]")
_VOWEL_PAIR = re.compile(r"[オコソトノホモヨロゴゾドボポ][ウオ]|[ウクスツヌフムユルグズヅブプ]ウ")

PREF_SUFFIX = {"県": "ケン", "府": "フ", "都": "ト", "道": "ドウ"}
MUNI_SUFFIX = {"市": ("シ",), "町": ("チョウ", "マチ"), "村": ("ソン", "ムラ"), "区": ("ク",)}
MUNI_TYPE_EN = {"市": "City", "町": "Town", "村": "Village"}


def romanize(kana: str) -> str:
    """URL の決まり（§5.4）と同じ。ただし促音のあとの伸ばす音も畳む（日光 ニッコウ → nikko。URL の生成側はここを畳まない）。"""
    morae = _gmm.kana_to_morae(kana)
    merged: list[str] = []
    i = 0
    while i < len(morae):
        if morae[i] == "っ":
            if i + 1 < len(morae):
                nxt = morae[i + 1]
                merged.append(("t" if nxt.startswith("ch") else nxt[0]) + nxt)
            i += 2
            continue
        merged.append(morae[i])
        i += 1
    return "".join(_gmm.collapse_long_vowels(merged))


def capitalise(stem: str) -> str:
    return stem[:1].upper() + stem[1:]


def needs_review(kana: str) -> bool:
    return bool(_SMALL_KANA_AMBIGUOUS.search(kana) or _VOWEL_PAIR.search(kana))


USED: set[str] = set()


def stem_of(area_code: str, kana: str) -> str:
    if area_code in OVERRIDES or area_code in REVIEWED:
        USED.add(area_code)
    if area_code in OVERRIDES:
        return OVERRIDES[area_code][0]
    if needs_review(kana) and area_code not in REVIEWED:
        raise SystemExit(
            f"[place-names] 止めた：{area_code} のカナ {kana} は機械では決められない形（小さい字か・漢字の境目か）。"
            " 読みを確かめて OVERRIDES か REVIEWED に載せる"
        )
    return capitalise(romanize(kana))


def strip_kana_suffix(name: str, kana: str, table: dict) -> str:
    for suf_kana in table[name[-1]] if isinstance(table[name[-1]], tuple) else (table[name[-1]],):
        if kana.endswith(suf_kana) and len(kana) > len(suf_kana):
            return kana[: -len(suf_kana)]
    raise SystemExit(f"[place-names] 止めた：{name} のカナ {kana} の末尾が種類（{name[-1]}）の読みと合わない")


def main() -> None:
    rows = json.loads(KANA_PATH.read_text(encoding="utf-8"))["data"]
    scope = set()
    for f in sorted((ROOT / "data").glob("municipality_master*.json")):
        for r in json.loads(f.read_text(encoding="utf-8"))["data"]:
            scope.add(r["area_code"][:2])

    prefectures: dict[str, dict] = {}
    for r in rows:
        if r["level"] != "prefecture":
            continue
        name, kana = r["name"], unicodedata.normalize("NFKC", r["kana"])
        if name == "北海道":
            en = "Hokkaido"
        elif name == "東京都":
            en = "Tokyo Metropolis"
        else:
            stem_kana = strip_kana_suffix(name, kana, PREF_SUFFIX)
            # 県名のカナは小さい字を正しく書いている（例：京都府 ｷｮｳﾄﾌ）。機械の結果は統計年鑑 2026 表2-4 の県名（Gifu-ken など）と、撥音の書き方（群馬＝年鑑は Gumma）を除き全件一致
            en = f"{capitalise(romanize(stem_kana))} Prefecture"
        prefectures[r["pref_code"]] = {"ja": name, "en": en}

    municipalities: dict[str, dict] = {}
    for r in rows:
        if r["level"] != "municipality" or r["pref_code"] not in scope:
            continue
        code, name, kana = r["area_code"], r["name"], unicodedata.normalize("NFKC", r["kana"])
        ward = re.fullmatch(r"(.+市)(.+区)", name)
        if ward:
            parent = next(x for x in rows if x["name"] == ward.group(1) and x["pref_code"] == r["pref_code"])
            parent_kana = unicodedata.normalize("NFKC", parent["kana"])
            if not kana.startswith(parent_kana):
                raise SystemExit(f"[place-names] 止めた：区 {name} のカナが親の市のカナで始まらない")
            ward_kana = strip_kana_suffix("区", kana[len(parent_kana):], MUNI_SUFFIX)
            parent_stem = stem_of(parent["area_code"], strip_kana_suffix("市", parent_kana, MUNI_SUFFIX))
            short = f"{stem_of(code, ward_kana)} Ward"
            municipalities[code] = {"ja": name, "en": f"{short}, {parent_stem} City", "short_en": short}
        else:
            kind = name[-1]
            stem_kana = strip_kana_suffix(name, kana, MUNI_SUFFIX)
            if kind == "区":  # 東京の特別区
                type_en = "City"
            else:
                type_en = MUNI_TYPE_EN[kind]
            municipalities[code] = {"ja": name, "en": f"{stem_of(code, stem_kana)} {type_en}"}

    unused = (set(REVIEWED) | set(OVERRIDES)) - USED
    if unused:
        raise SystemExit(f"[place-names] 止めた：使われていない確認の行がある {sorted(unused)}")

    out = {
        "about": {
            "role": "県・市区町村の英語の名前（画面に出す名前）。scripts/gen_place_names_en.py が作る。手で直さない。",
            "rules": "i18n/glossary.json の place_names（2026-10-23 運営者裁定）",
            "source": "総務省「全国地方公共団体コード」のカナ（data/municipality_kana.json）。直したものの根拠は scripts/gen_place_names_en.py の OVERRIDES",
            "scope": "47都道府県すべてと、データのある県の市区町村",
        },
        "prefectures": prefectures,
        "municipalities": municipalities,
    }
    OUTPUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[place-names] 都道府県 {len(prefectures)}・市区町村 {len(municipalities)}（県 {sorted(scope)}）を書き出した：{OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
