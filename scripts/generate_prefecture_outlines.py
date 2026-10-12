#!/usr/bin/env python3
"""
generate_prefecture_outlines.py

全47都道府県の輪郭SVGパスを、公開GeoJSON（dataofjapan/land）から機械生成する。
出力：design/prefecture-outlines/prefecture-outlines.json

背景（A-17・2026-09-27）：
トップ画面・県入口画面（app/page.tsx・app/gifu-pref/page.tsx）の「現在公開中の地域」
アイコンで使っていたモックのSVGパスが、岐阜県の実輪郭ではなく仮ポリゴンだったことが
判明し、岐阜県分は本スクリプトと同じ手法で実輪郭ベースへ差し替え済み（launch-backlog.md
A-17参照）。他46都道府県は「他県展開」（project-status.yaml deferred・V1スコープ外）に
備えた先行資産としてまとめて生成したもので、現時点ではどのページからも参照していない
（D-17＝拡張未決の規律に抵触しないよう、app/側のコードは一切変更していない）。

データソース：
  https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson
  取得日：2026-09-27時点のmasterブランチ（コミットSHA固定は今回未実施。将来再生成する
  場合は取得日を本コメントに書き足すこと）。47都道府県分の境界ポリゴン（GeoJSON
  Polygon/MultiPolygon、内側の穴＝湖等は今回の用途では無視して構わない：出力側アイコンは
  fill="none"のアウトライン表示を前提とするため）。

手法（岐阜県の輪郭修正〔A-17〕で実施した検証済み手法を全県へ一般化）：
  1. 各都道府県の外環リングを抽出。
  2. 面積シェア1%未満のリング（無人島片等のノイズ）を除外。
  3. 残ったリングのうち、最大リング（本土）の外接矩形対角線の1.8倍を超えて離れた
     リングを「遠隔離島」として除外する（東京都の小笠原諸島、沖縄県の宮古・八重山、
     鹿児島県の奄美群島などがここで除外される。長崎県の対馬・壱岐・五島や新潟県の
     佐渡、兵庫県の淡路島、島根県の隠岐等、本土から相対的に近い離島は残る）。
     この閾値は実際の距離比を計算して手動較正したもの（1.4以下と2.1以上に明確な
     ギャップがあった。詳細は当時の調査ログ参照）。
  4. 残ったリング全体で、Ramer-Douglas-Peucker法により頂点数が55〜130の帯に収まる
     ようepsilonを二分探索（アイコン表示サイズ（50〜80px程度）に対して過剰な精度を
     避けつつ、県ごとの形状の特徴を保持する）。
  5. 緯度補正付き等距円筒図法（x = lon * cos(平均緯度), y = -lat）で投影。
  6. viewBox "0 0 100 110"（既存のGifu実装・app/page.tsx等と同じ規格）に、余白14%で
     アスペクト比を保ったまま収まるようスケール・オフセット。
  7. 複数リングが残った県は、サブパス（M...Z）を連結した1つのdへ結合。

妥当性検証（2026-09-27実施）：
  同じGeoJSONから岐阜県の隣接7県（富山・石川・福井・滋賀・三重・愛知・長野）を同一手法で
  投影し合成図を作成、方位・隣接関係が実際の地理と一致することを確認。加えて47県全件の
  コンタクトシート（design/prefecture-outlines/contact-sheet.png）を目視QAし、東京都・
  沖縄県・鹿児島県で遠隔離島が外接矩形を支配し本土形状が判読不能になる問題を検出、
  手順3の距離フィルタで解消した。愛媛県の佐田岬半島・千葉県の房総半島・京都府の丹後半島
  方面等、代表的な細い半島地形がRDP簡略化後も判読可能な形で残っていることも個別確認済み。

岐阜県のみ、本番反映済み（A-17・運営者実機確認OK 2026-09-27）の確定パスに固定して
上書きしている（本スクリプトの通常生成結果とは頂点数が若干異なる＝76頂点固定）。

実行方法：
  python3 scripts/generate_prefecture_outlines.py
  （標準ライブラリのみで完結。追加パッケージ不要）
"""
import json
import math
import urllib.request
from pathlib import Path

GEOJSON_URL = "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "design" / "prefecture-outlines" / "prefecture-outlines.json"

# 岐阜県のみ、A-17で本番反映済みの確定パスに固定する（app/page.tsx・app/gifu-pref/page.tsxと同一）
GIFU_APPROVED_PATH = (
    "M65.2 15.4L67 15.7L66.8 17.8L70.5 15.7L73.2 18.5L76.4 17.9L83.1 23.6L82.9 25.9L79.4 30L80.4 32.8"
    "L78.5 34.7L78.3 36.5L81.3 38.5L80.4 42.3L74.7 49.4L70.1 49.5L67.4 54L73.9 57.3L78 63.9L76.5 66.4"
    "L79.3 67.8L79.4 70.2L82.2 72.3L82.2 74.6L80.3 76L82.3 78.8L79.5 78.8L80.8 82.6L78.6 84.1L78.8 85.7"
    "L72.4 89.3L66.6 85.2L60.7 87.5L59.7 85.7L55.6 85.2L54 80.8L50.6 78.5L51.3 77.3L43.7 81.4L40.6 80.6"
    "L36.1 88.2L35.7 94.6L34.6 92.7L34.6 93.9L33.2 93.7L29.2 87.3L24.8 89.6L22.4 88.9L23.3 80.6L24.9 79.4"
    "L22.1 73.5L22.8 71L21.4 69.3L18.8 70L19 65.9L16.9 64.7L19.3 56.4L21.7 55.2L27.8 57.9L28.7 55.7"
    "L41.5 55L43.6 51.5L43.1 49.2L38.5 43.3L38.8 40.1L40.3 39L40.4 33.5L44.5 28.3L41.7 25.3L43.6 24.8"
    "L45.5 21.2L45.7 22.7L49.1 22.5L50.5 26.7L59.5 15.9L61.7 17.6Z"
)

VB_W, VB_H, MARGIN = 100.0, 110.0, 0.14
TARGET_MIN, TARGET_MAX = 55, 130
AREA_SHARE_THRESHOLD = 0.01
DIST_RATIO_THRESHOLD = 1.8


def ring_area(ring):
    s = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def bbox(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), max(xs), min(ys), max(ys)


def bbox_diag(ring):
    minx, maxx, miny, maxy = bbox(ring)
    return math.hypot(maxx - minx, maxy - miny)


def bbox_center(ring):
    minx, maxx, miny, maxy = bbox(ring)
    return (minx + maxx) / 2, (miny + maxy) / 2


def rdp(points, epsilon):
    if len(points) < 3:
        return points

    def perp_dist(pt, start, end):
        (x, y), (x1, y1), (x2, y2) = pt, start, end
        dx, dy = x2 - x1, y2 - y1
        if dx == 0 and dy == 0:
            return math.hypot(x - x1, y - y1)
        t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
        px, py = x1 + t * dx, y1 + t * dy
        return math.hypot(x - px, y - py)

    dmax, index = 0.0, 0
    for i in range(1, len(points) - 1):
        d = perp_dist(points[i], points[0], points[-1])
        if d > dmax:
            index, dmax = i, d
    if dmax > epsilon:
        left = rdp(points[: index + 1], epsilon)
        right = rdp(points[index:], epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]


def simplify_ring(ring, epsilon):
    # 閉多角形は最北端で開始点を回転させてからRDP（始点/終点を結ぶ直線が形状を横断して
    # 大きく削られるのを防ぐ）
    max_lat_idx = max(range(len(ring)), key=lambda i: ring[i][1])
    rotated = ring[max_lat_idx:] + ring[:max_lat_idx]
    closed = rotated + [rotated[0]]
    return rdp(closed, epsilon)[:-1]


def fmt(n):
    s = f"{n:.1f}"
    return s[:-2] if s.endswith(".0") else s


def generate():
    with urllib.request.urlopen(GEOJSON_URL, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    out = {}
    for feat in data["features"]:
        name_ja = feat["properties"]["nam_ja"]
        pid = feat["properties"]["id"]
        geom = feat["geometry"]
        polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        rings = []
        for poly in polys:
            ext = poly[0]
            if ext[0] == ext[-1]:
                ext = ext[:-1]
            if len(ext) >= 3:
                rings.append(ext)

        areas = [ring_area(r) for r in rings]
        total_area = sum(areas)
        by_area = [(r, a) for r, a in zip(rings, areas) if a / total_area >= AREA_SHARE_THRESHOLD]
        by_area.sort(key=lambda t: t[1], reverse=True)

        main_ring = by_area[0][0]
        main_diag = bbox_diag(main_ring)
        main_c = bbox_center(main_ring)
        kept, dropped_remote = [], 0
        for r, a in by_area:
            c = bbox_center(r)
            dist = math.hypot(c[0] - main_c[0], c[1] - main_c[1])
            ratio = dist / main_diag if main_diag > 0 else 0
            if r is main_ring or ratio <= DIST_RATIO_THRESHOLD:
                kept.append(r)
            else:
                dropped_remote += 1

        lo, hi, best = 0.0005, 0.5, None
        for _ in range(40):
            mid = (lo + hi) / 2
            simplified = [simplify_ring(r, mid) for r in kept]
            total_pts = sum(len(s) for s in simplified)
            if total_pts > TARGET_MAX:
                lo = mid
            elif total_pts < TARGET_MIN:
                hi = mid
            else:
                best = simplified
                break
            best = simplified
        simplified = best

        all_pts = [p for ring in simplified for p in ring]
        mean_lat_rad = math.radians(sum(p[1] for p in all_pts) / len(all_pts))
        proj_rings = [[(lon * math.cos(mean_lat_rad), -lat) for lon, lat in ring] for ring in simplified]

        xs = [x for ring in proj_rings for x, y in ring]
        ys = [y for ring in proj_rings for x, y in ring]
        minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
        w, h = maxx - minx, maxy - miny
        target_w, target_h = VB_W * (1 - 2 * MARGIN), VB_H * (1 - 2 * MARGIN)
        scale = min(target_w / w, target_h / h) if w > 0 and h > 0 else 1
        off_x = (VB_W - w * scale) / 2
        off_y = (VB_H - h * scale) / 2

        subpaths = []
        for ring in proj_rings:
            pts = [((x - minx) * scale + off_x, (y - miny) * scale + off_y) for x, y in ring]
            cmds = [f"M{fmt(pts[0][0])} {fmt(pts[0][1])}"]
            for x, y in pts[1:]:
                cmds.append(f"L{fmt(x)} {fmt(y)}")
            cmds.append("Z")
            subpaths.append("".join(cmds))

        out[name_ja] = {
            "id": pid,
            "viewBox": f"0 0 {int(VB_W)} {int(VB_H)}",
            "path": "".join(subpaths),
            "ringCount": len(kept),
            "vertexCount": sum(len(s) for s in simplified),
            "droppedRemoteIslands": dropped_remote,
        }

    out["岐阜県"] = {
        "id": out["岐阜県"]["id"],
        "viewBox": "0 0 100 110",
        "path": GIFU_APPROVED_PATH,
        "ringCount": 1,
        "vertexCount": 76,
        "droppedRemoteIslands": 0,
        "note": "A-17で本番反映・運営者実機確認OK(2026-09-27)済みの確定パスと同一（本スクリプトの通常生成結果を上書き）",
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"wrote {len(out)} prefectures to {OUTPUT_PATH}")


if __name__ == "__main__":
    generate()
