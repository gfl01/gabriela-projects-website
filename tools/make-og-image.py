#!/usr/bin/env python3
"""Regenerate the home page's social share image.

When someone pastes gabrielaprojects.com into iMessage, WhatsApp, Instagram,
Facebook or LinkedIn, the preview card shows ONE fixed image, named by the
og:image / twitter:image tags in index.html. It is not picked automatically
from the page, so it goes stale the moment the hero photos change.

This rebuilds that image as a 1200x630 version of the hero: the same three
photos, the same column proportions, the same per-panel crop centres and the
same dark overlay. Everything is read back out of index.html and style.css, so
swapping a hero photo and re-running this is all that is needed.

    python3 tools/make-og-image.py

Writes images/common/og-home.jpg.
"""

import os
import re
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "common", "og-home.jpg")

OG_W, OG_H = 1200, 630          # the size every platform expects
GAP = 4                          # matches .hero-bg gap
WORDMARK = "GABRIELA PROJECTS"
TAGLINE = "Custom Design + Quality Construction \u2014 All in One"

# Cormorant Garamond (the site's heading face) is a webfont and is not
# installed locally, so fall back through the closest system serifs.
FONT_CANDIDATES = [
    "/Library/Fonts/CormorantGaramond-Light.ttf",
    "/System/Library/Fonts/Supplemental/Baskerville.ttc",
    "/System/Library/Fonts/Supplemental/Cochin.ttc",
    "/System/Library/Fonts/Supplemental/Didot.ttc",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
]


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as fh:
        return fh.read()


def hero_images(html):
    block = re.search(r'<div class="hero-bg">(.*?)</div>', html, re.S)
    if not block:
        sys.exit("make-og-image: could not find <div class=\"hero-bg\"> in index.html")
    srcs = re.findall(r'<img[^>]*src="([^"]+)"', block.group(1))
    if len(srcs) != 3:
        sys.exit(f"make-og-image: expected 3 hero images, found {len(srcs)}")
    return srcs


def hero_columns(css):
    m = re.search(r'\.hero-bg\s*{[^}]*grid-template-columns:\s*([^;]+);', css, re.S)
    if not m:
        sys.exit("make-og-image: could not read .hero-bg grid-template-columns")
    return [float(v.replace("fr", "")) for v in m.group(1).split()]


def crop_centres(css):
    """object-position x for each panel, as a 0-1 fraction. Default 0.5."""
    centres = [0.5, 0.5, 0.5]
    for i in (1, 2, 3):
        m = re.search(
            r'\.hero-bg img:nth-child\(%d\)\s*{[^}]*object-position:\s*([0-9.]+)%%' % i,
            css, re.S)
        if m:
            centres[i - 1] = float(m.group(1)) / 100
    return centres


def overlay_alpha(css):
    m = re.search(r'\.hero-overlay\s*{[^}]*rgba\([^)]*?,\s*([0-9.]+)\s*\)', css, re.S)
    return float(m.group(1)) if m else 0.35


def panel(src, w, h, pos_x):
    """Crop one photo the way object-fit: cover + object-position would."""
    im = Image.open(os.path.join(ROOT, src)).convert("RGB")
    scale = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - w) * pos_x
    top = (im.height - h) / 2
    return im.crop((round(left), round(top), round(left) + w, round(top) + h))


def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size), os.path.basename(path)
            except OSError:
                continue
    return ImageFont.load_default(), "default"


def main():
    html = read("index.html")
    css = read("css/style.css")

    srcs = hero_images(html)
    cols = hero_columns(css)
    centres = crop_centres(css)
    alpha = overlay_alpha(css)

    avail = OG_W - GAP * 2
    total = sum(cols)
    widths = [round(avail * c / total) for c in cols]
    widths[-1] = avail - widths[0] - widths[1]      # absorb rounding

    card = Image.new("RGB", (OG_W, OG_H), "white")
    x = 0
    for src, w, pos in zip(srcs, widths, centres):
        card.paste(panel(src, w, OG_H, pos), (x, 0))
        x += w + GAP

    card = Image.blend(card, Image.new("RGB", (OG_W, OG_H), (0, 0, 0)), alpha)

    # Wordmark and tagline, letter-spaced like the site's h1. Drawn onto their
    # own layer so a blurred copy can sit behind them as a soft shadow -- the
    # middle panel can be very bright, and plain white text disappears on it.
    font, font_used = load_font(54)
    sub_font, _ = load_font(20)

    text_layer = Image.new("L", (OG_W, OG_H), 0)
    td = ImageDraw.Draw(text_layer)

    tracking = 9
    advances = [td.textlength(ch, font=font) + tracking for ch in WORDMARK]
    title_y = OG_H / 2 - 52
    cx = (OG_W - (sum(advances) - tracking)) / 2
    for ch, adv in zip(WORDMARK, advances):
        td.text((cx, title_y), ch, font=font, fill=255)
        cx += adv

    sub_tracking = 2
    sub_adv = [td.textlength(ch, font=sub_font) + sub_tracking for ch in TAGLINE]
    sx = (OG_W - (sum(sub_adv) - sub_tracking)) / 2
    for ch, adv in zip(TAGLINE, sub_adv):
        td.text((sx, title_y + 82), ch, font=sub_font, fill=235
                )
        sx += adv

    shadow = text_layer.filter(ImageFilter.GaussianBlur(9)).point(lambda v: min(255, int(v * 2.2)))
    card.paste(Image.new("RGB", (OG_W, OG_H), (0, 0, 0)), (0, 0), shadow)
    card.paste(Image.new("RGB", (OG_W, OG_H), (255, 255, 255)), (0, 0), text_layer)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    card.save(OUT, "JPEG", quality=88, optimize=True, progressive=True)

    print(f"panels     : {', '.join(os.path.basename(s) for s in srcs)}")
    print(f"columns    : {cols}  ->  {widths} px")
    print(f"crop x     : {[round(c, 3) for c in centres]}")
    print(f"overlay    : {alpha}")
    print(f"font       : {font_used}")
    print(f"wrote      : {os.path.relpath(OUT, ROOT)}  "
          f"({os.path.getsize(OUT) / 1024:.0f} KB, {OG_W}x{OG_H})")


if __name__ == "__main__":
    main()
