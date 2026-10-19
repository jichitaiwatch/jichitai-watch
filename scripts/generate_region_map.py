#!/usr/bin/env python3
"""
generate_region_map.py

トップ画面「地域から探す」（components/RegionPicker.tsx）の日本地図（8地方）を、公開GeoJSON
（dataofjapan/land）から機械生成する。出力：lib/region-map.ts（生成物。手で直さない）。

出典：国土地理院「地球地図日本」（dataofjapan/land 経由）。県の輪郭アイコン（scripts/generate_prefecture_outlines.py）と
同じ出典・同じ扱い（docs/licenses.md「県の輪郭アイコン」）。加工物であることは /data に掲示する。

手法：
  1. 都道府県を lib/regions.ts の地方区分でまとめ、地方ごとに境界ポリゴンを結合（shapely.unary_union）。
  2. 本土から遠い島（沖縄・小笠原・奄美など。緯度30度未満）と、面積の小さい島（地図の縮尺で見えない）を除く。
     ※沖縄県は地図に描かれない（九州・沖縄タブの県一覧には出る）。
  3. 地方ごとに形を簡略化（Douglas-Peucker）。
  4. 緯度補正付き等距円筒図法（x = lon * cos(37度), y = -lat）で投影し、viewBox 幅400に収める。
  5. 各地方の印の位置（最大のポリゴンの代表点）も出す。

使い方（取得は GitHub のみ。通常のビルドでは不要）:
  python3 scripts/generate_region_map.py [japan.geojson のパス]   # 省略時は取得する
"""
from __future__ import annotations

import json
import math
import re
import sys
import urllib.request
from pathlib import Path

from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
SRC_URL = "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"
OUT = ROOT / "lib" / "region-map.ts"
LAT_MIN = 30.0          # これより南の島は描かない
MIN_AREA = 0.02         # 平方度。これ未満の島は描かない（四国・淡路・佐渡・対馬などは残る）
SIMPLIFY = 0.035        # 度
VIEW_W = 400.0


def regions_from_ts() -> list[tuple[str, list[str]]]:
    s = (ROOT / "lib" / "regions.ts").read_text(encoding="utf-8")
    out = []
    for m in re.finditer(r'id: "(\w+)".*?prefectures: \[([^\]]*)\]', s, re.S):
        out.append((m.group(1), re.findall(r'"([^"]+)"', m.group(2))))
    return out


def main() -> None:
    if len(sys.argv) > 1:
        data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    else:
        with urllib.request.urlopen(SRC_URL, timeout=60) as r:  # noqa: S310
            data = json.loads(r.read().decode("utf-8"))
    by_name = {f["properties"]["nam_ja"]: shape(f["geometry"]) for f in data["features"]}
    regions = regions_from_ts()
    assert sum(len(p) for _, p in regions) == 47 and all(n in by_name for _, ps in regions for n in ps)

    k = math.cos(math.radians(37))
    shapes: dict[str, MultiPolygon] = {}
    for rid, prefs in regions:
        polys: list[Polygon] = []
        for n in prefs:
            g = by_name[n]
            for p in (g.geoms if hasattr(g, "geoms") else [g]):
                if p.representative_point().y < LAT_MIN or p.area < MIN_AREA:
                    continue
                polys.append(Polygon(p.exterior))  # 内側の穴（湖など）は描かない
        u = unary_union(polys).simplify(SIMPLIFY, preserve_topology=True)
        shapes[rid] = u if isinstance(u, MultiPolygon) else MultiPolygon([u])

    xs = [x * k for g in shapes.values() for p in g.geoms for x, _ in p.exterior.coords]
    ys = [-y for g in shapes.values() for p in g.geoms for _, y in p.exterior.coords]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    scale = VIEW_W / (x1 - x0)
    H = (y1 - y0) * scale

    def pt(lon: float, lat: float) -> tuple[float, float]:
        return (round((lon * k - x0) * scale, 1), round((-lat - y0) * scale, 1))

    out = {}
    for rid, g in shapes.items():
        parts = []
        for p in g.geoms:
            c = [pt(x, y) for x, y in p.exterior.coords]
            parts.append("M" + "L".join(f"{x:g} {y:g}" for x, y in c[:-1]) + "Z")
        big = max(g.geoms, key=lambda p: p.area).representative_point()
        out[rid] = {"d": "".join(parts), "anchor": pt(big.x, big.y)}

    lines = [
        "// lib/region-map.ts — 生成物。手で直さない（scripts/generate_region_map.py）。",
        "// 出典：国土地理院「地球地図日本」（dataofjapan/land 経由）を、自治体Watchが地方ごとに結合・簡略化・投影し直した加工物。",
        "// 沖縄県と遠方の小島は描かない。",
        f"export const REGION_MAP_VIEWBOX = {{ width: {VIEW_W:g}, height: {round(H, 1):g} }};",
        "export const REGION_MAP: Record<string, { d: string; anchor: [number, number] }> = {",
    ]
    for rid, v in out.items():
        lines.append(f'  {rid}: {{ d: "{v["d"]}", anchor: [{v["anchor"][0]:g}, {v["anchor"][1]:g}] }},')
    lines.append("};")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[write] {OUT}  viewBox={VIEW_W:g}x{H:.1f}  size={OUT.stat().st_size:,}B")
    for rid, v in out.items():
        print(f"  {rid}: anchor={v['anchor']}  d={len(v['d']):,}字")


main()
