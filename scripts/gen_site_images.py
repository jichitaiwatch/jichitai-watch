#!/usr/bin/env python3
"""サイトのアイコンと共有用画像を、正式ロゴから生成する（launch-backlog.md D-1）。

正式ロゴの原本: design/brand/logo-official.png（運営者提供・2026-10-04。紺の円に白の「[自]」とオレンジの点）
  原本は背景の市松模様が「透明」ではなく絵として描き込まれている（RGB・透過なし）。
  そのため円の外側を切り抜いて透明にしてから使う（円の中心・半径は原本を実測した値）。

生成物（コミット済み。Next.js のファイル規約で各ページの <head> に自動で載る）:
  app/favicon.ico          16/32/48px  … ブラウザのタブ（/favicon.ico）
  app/icon.png             512px       … <link rel="icon">（透過）
  app/apple-icon.png       180px       … iPhone のホーム画面（白地。iOS が角丸に切る）
  app/opengraph-image.png  1200x630px  … SNS等で共有したときの画像（og:image）
  public/brand-logo.png    132px       … ページ上部・下部のロゴ（components/SiteFooter.tsx の Brand。表示44pxの3倍）

共有画像の文言は、サイト名・トップページの既存の説明文（app/page.tsx の description）・ドメインだけ。
新しい主張は加えない。

再生成するときだけ実行する（通常のビルドでは不要）。日本語フォント Noto Sans CJK JP と Pillow・numpy が必要。
  python3 scripts/gen_site_images.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
LOGO_SRC = ROOT / "design" / "brand" / "logo-official.png"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"   # index 0 = JP
FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

# 原本の実測値（1254x1254px）。紺の範囲 x36〜1217・y26〜1219 → 中心(626.5, 622.5)・半径約593.5。
# 円周は角度により±3.5px ほど揺らぐため、市松模様が縁に残らないよう 5px 内側で切る。
LOGO_CX, LOGO_CY, LOGO_R = 626.5, 622.5, 593.5 - 5

LOGO_NAVY = "#123458"  # 原本の紺（実測の中央値）
TEAL = "#008f89"       # サイトの強調色（app/page.tsx）
INK_MUTED = "#41577d"  # サイトの補足文字（app/page.tsx）
WHITE = "#ffffff"

SITE_NAME = "自治体Watch"
DOMAIN = "jichitaiwatch.jp"
TAGLINE = ["岐阜県内の市町村の財政や暮らしの制度を、", "市町村ごとに整理して見られます。"]


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size, index=0)


def logo_circle() -> Image.Image:
    """原本から円だけを切り抜き、外側を透明にした正方形画像を返す（縁は4倍で描いた円で滑らかにする）。"""
    src = Image.open(LOGO_SRC).convert("RGBA")
    ss = 4
    W, H = src.size
    mask = Image.new("L", (W * ss, H * ss), 0)
    ImageDraw.Draw(mask).ellipse(
        [(LOGO_CX - LOGO_R) * ss, (LOGO_CY - LOGO_R) * ss, (LOGO_CX + LOGO_R) * ss, (LOGO_CY + LOGO_R) * ss],
        fill=255,
    )
    mask = mask.resize((W, H), Image.LANCZOS)
    out = src.copy()
    out.putalpha(mask)
    box = (
        int(LOGO_CX - LOGO_R) - 1,
        int(LOGO_CY - LOGO_R) - 1,
        int(np.ceil(LOGO_CX + LOGO_R)) + 1,
        int(np.ceil(LOGO_CY + LOGO_R)) + 1,
    )
    return out.crop(box)


def logo(size: int) -> Image.Image:
    return LOGO.resize((size, size), Image.LANCZOS)


def write_icons() -> None:
    logo(512).save(APP / "icon.png", optimize=True)
    a = Image.new("RGBA", (180, 180), WHITE)
    a.alpha_composite(logo(180))
    a.convert("RGB").save(APP / "apple-icon.png")
    logo(256).save(APP / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


def write_web_logo() -> None:
    out = ROOT / "public"
    out.mkdir(exist_ok=True)
    logo(132).save(out / "brand-logo.png", optimize=True)


def write_og() -> None:
    W, H = 1200, 630
    im = Image.new("RGBA", (W, H), WHITE)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 14], fill=TEAL)
    mark = 184
    x0, y0 = 96, 140
    im.alpha_composite(logo(mark), (x0, y0))
    tx = x0 + mark + 44
    d.text((tx, y0 + mark / 2), SITE_NAME, font=font(FONT_BOLD, 96), fill=LOGO_NAVY, anchor="lm")
    ty = y0 + mark + 60
    f = font(FONT_REG, 40)
    for i, line in enumerate(TAGLINE):
        d.text((x0, ty + i * 62), line, font=f, fill=INK_MUTED, anchor="la")
    d.text((W - 72, H - 56), DOMAIN, font=font(FONT_BOLD, 32), fill=TEAL, anchor="rs")
    im.convert("RGB").save(APP / "opengraph-image.png", optimize=True)


LOGO = logo_circle()

if __name__ == "__main__":
    write_icons()
    write_og()
    write_web_logo()
    for p in [APP / n for n in ["favicon.ico", "icon.png", "apple-icon.png", "opengraph-image.png"]] + [
        ROOT / "public" / "brand-logo.png"
    ]:
        print(f"{p.relative_to(ROOT)}  {p.stat().st_size:,} bytes")
