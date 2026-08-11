from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

ROOT = Path.cwd()
OUT = ROOT / "output" / "jexongo-single-slide"
OUT.mkdir(parents=True, exist_ok=True)

W = H = 1080
NAVY = (5, 8, 22)
NAVY_2 = (8, 20, 48)
ORANGE = (255, 159, 28)
YELLOW = (255, 194, 71)
CYAN = (0, 217, 255)
WHITE = (255, 255, 255)
SILVER = (221, 230, 234)
RED_ORANGE = (255, 74, 28)

def font(size, bold=True):
    candidates = [
        "C:/Windows/Fonts/impact.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

F_LOGO = font(36)
F_HEAD = font(84)
F_HEAD_2 = font(74)
F_SUB = font(34)
F_EQ = font(62)
F_ANS = font(30)
F_SMALL = font(22)

PLANE = Image.open(ROOT / "assets" / "planes" / "14.png").convert("RGBA")
ENEMY = Image.open(ROOT / "assets" / "enemies" / "planes" / "f15.png").convert("RGBA")

def bg():
    img = Image.new("RGBA", (W, H), NAVY + (255,))
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = y / H
            cx = (x - 680) / W
            cy = (y - 570) / H
            glow = max(0, 1 - math.sqrt(cx * cx + cy * cy) * 2.2)
            r = int(NAVY[0] * (1 - t) + NAVY_2[0] * t + glow * 8)
            g = int(NAVY[1] * (1 - t) + NAVY_2[1] * t + glow * 32)
            b = int(NAVY[2] * (1 - t) + NAVY_2[2] * t + glow * 46)
            px[x, y] = (r, g, b, 255)

    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(grid)
    for y in range(0, H, 34):
        d.line((0, y, W, y), fill=(CYAN[0], CYAN[1], CYAN[2], 18), width=1)
    for x in range(-W, W, 38):
        d.line((x, 0, x + W, H), fill=(255, 255, 255, 8), width=1)
    return Image.alpha_composite(img, grid)

def text(draw, xy, value, fnt, fill, anchor="la", stroke=0, stroke_fill=(0, 0, 0)):
    draw.text(xy, value, font=fnt, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=stroke_fill)

def paste_asset(base, asset, center, size, angle=0, glow=CYAN):
    im = asset.copy()
    im.thumbnail(size, Image.Resampling.LANCZOS)
    if angle:
        im = im.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    x = int(center[0] - im.width / 2)
    y = int(center[1] - im.height / 2)
    if glow:
        halo = Image.new("RGBA", im.size, glow + (0,))
        halo.putalpha(im.getchannel("A"))
        halo = halo.filter(ImageFilter.GaussianBlur(24))
        base.alpha_composite(halo, (x, y))
    base.alpha_composite(im, (x, y))

def hud_panel(draw, box, outline=CYAN, fill=(7, 17, 42, 232)):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((x1 + 12, y1 + 14, x2 + 12, y2 + 14), radius=22, fill=(0, 0, 0, 130))
    draw.rounded_rectangle(box, radius=22, fill=fill, outline=outline, width=5)
    draw.line((x1 + 22, y1 + 24, x2 - 22, y1 + 24), fill=(255, 255, 255, 90), width=3)

def chip(draw, x, y, label, fill=ORANGE):
    draw.rounded_rectangle((x, y, x + 116, y + 56), radius=12, fill=fill, outline=WHITE, width=2)
    text(draw, (x + 58, y + 16), label, F_ANS, WHITE, "ma", 1)

img = bg()
draw = ImageDraw.Draw(img, "RGBA")

# Branding and headline
text(draw, (72, 62), "JEXONGO", F_LOGO, WHITE, stroke=2)
text(draw, (72, 100), "COMBAT MATHÉMATIQUE AÉRIEN", F_SMALL, (205, 232, 240), stroke=1)
draw.rectangle((72, 128, 310, 137), fill=ORANGE)

text(draw, (72, 214), "RÉPONDS", F_HEAD, ORANGE, stroke=4)
text(draw, (72, 300), "POUR ATTAQUER", F_HEAD_2, WHITE, stroke=4)
text(draw, (76, 398), "Chaque bonne réponse", F_SUB, WHITE, stroke=2)
text(draw, (76, 440), "déclenche ton attaque.", F_SUB, WHITE, stroke=2)

# Motion trails
for offset, color, width in [(0, CYAN, 12), (36, ORANGE, 14), (72, YELLOW, 8)]:
    draw.line((185 + offset, 880, 530 + offset, 690), fill=color + (205,), width=width)

# Main jet and enemy
paste_asset(img, PLANE, (628, 628), (520, 720), angle=-22, glow=CYAN)
enemy = ENEMY.rotate(180, expand=True)
paste_asset(img, enemy, (885, 330), (170, 120), angle=-12, glow=RED_ORANGE)
draw.line((650, 560, 825, 380), fill=YELLOW + (210,), width=8)
draw.line((672, 586, 848, 405), fill=ORANGE + (160,), width=5)

# Math panel
hud_panel(draw, (600, 735, 980, 945), outline=ORANGE)
text(draw, (790, 806), "42 - 18 = ?", F_EQ, YELLOW, "ma", 3)
chip(draw, 642, 850, "24", CYAN)
chip(draw, 790, 850, "18", ORANGE)
chip(draw, 642, 912, "26", RED_ORANGE)
chip(draw, 790, 912, "32", ORANGE)

# Small UI details
draw.arc((840, 190, 1030, 380), 210, 330, fill=CYAN + (150,), width=5)
draw.arc((822, 172, 1048, 398), 210, 330, fill=ORANGE + (130,), width=3)
for x, y in [(890, 170), (932, 205), (974, 250)]:
    draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=CYAN)

draw.rectangle((0, 1000, W, H), fill=(1, 5, 15, 225))
text(draw, (72, 1032), "AVIATION  •  MATHS  •  MISSION", F_SMALL, WHITE, stroke=1)
text(draw, (1008, 1032), "JEXONGO.APP", F_SMALL, ORANGE, "ra", 1)

out = OUT / "jexongo-reponds-pour-attaquer.png"
img.convert("RGB").save(out, quality=96)
print(out)
