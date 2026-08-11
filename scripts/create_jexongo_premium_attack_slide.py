# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import math

ROOT = Path.cwd()
OUT = ROOT / "output" / "jexongo-premium-attack-slide"
OUT.mkdir(parents=True, exist_ok=True)

W = H = 1080

BLACK = (6, 6, 8)
CHARCOAL = (18, 19, 23)
PANEL = (10, 13, 22)
ORANGE = (255, 122, 18)
ORANGE_2 = (255, 169, 38)
RED = (255, 44, 38)
CYAN = (0, 219, 255)
WHITE = (255, 255, 255)
SOFT = (222, 228, 232)
SILVER = (198, 211, 218)

PLANE = Image.open(ROOT / "assets" / "planes" / "14.png").convert("RGBA")
ENEMY = Image.open(ROOT / "assets" / "enemies" / "planes" / "f15.png").convert("RGBA")
LOGO_SRC = Path("C:/Users/Jean/Pictures/JEXONGO.png")
if not LOGO_SRC.exists():
    LOGO_SRC = ROOT / "JEXONGO.png"


def font(size, bold=True):
    names = [
        "C:/Windows/Fonts/impact.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for name in names:
        p = Path(name)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


F_HEAD = font(96)
F_HEAD_2 = font(86)
F_SUB = font(34, False)
F_SMALL = font(20, False)
F_EQ = font(62)
F_ANS = font(29)


def text(draw, xy, value, fnt, fill, anchor="la", stroke=0, stroke_fill=(0, 0, 0)):
    draw.text(xy, value, font=fnt, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=stroke_fill)


def background():
    img = Image.new("RGBA", (W, H), BLACK + (255,))
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = y / H
            cx1 = (x - 720) / W
            cy1 = (y - 610) / H
            orange_glow = max(0, 1 - math.sqrt(cx1 * cx1 + cy1 * cy1) * 1.9)
            cx2 = (x - 270) / W
            cy2 = (y - 770) / H
            cyan_glow = max(0, 1 - math.sqrt(cx2 * cx2 + cy2 * cy2) * 2.4)
            r = int(8 + t * 13 + orange_glow * 60 + cyan_glow * 3)
            g = int(8 + t * 10 + orange_glow * 18 + cyan_glow * 24)
            b = int(10 + t * 16 + orange_glow * 4 + cyan_glow * 38)
            px[x, y] = (r, g, b, 255)

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")

    for y in range(0, H, 32):
        d.line((0, y, W, y), fill=(255, 255, 255, 12), width=1)
    for x in range(-W, W, 44):
        d.line((x, 0, x + W, H), fill=(255, 122, 18, 10), width=1)

    d.rounded_rectangle((30, 30, 1050, 1050), radius=30, outline=(255, 255, 255, 22), width=2)
    d.ellipse((575, -95, 1240, 555), fill=(255, 122, 18, 20))
    d.ellipse((-180, 650, 390, 1210), fill=(0, 219, 255, 16))
    d.arc((710, 80, 1170, 540), 120, 260, fill=ORANGE + (155,), width=8)
    d.arc((747, 116, 1135, 505), 120, 260, fill=CYAN + (90,), width=3)

    for y in range(0, H, 4):
        d.line((0, y, W, y), fill=(255, 255, 255, 7), width=1)
    return Image.alpha_composite(img, layer)


def crop_logo():
    logo = Image.open(LOGO_SRC).convert("RGBA")
    px = logo.load()
    min_x, min_y = logo.width, logo.height
    max_x, max_y = 0, 0
    for y in range(logo.height):
        for x in range(logo.width):
            r, g, b, a = px[x, y]
            if a > 0 and not (r > 242 and g > 242 and b > 242):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    logo = logo.crop((min_x, min_y, max_x + 1, max_y + 1))
    # Remove the white source background so the logo sits naturally on black.
    data = []
    for r, g, b, a in logo.getdata():
        if r > 238 and g > 238 and b > 238:
            data.append((255, 255, 255, 0))
        else:
            data.append((r, g, b, a))
    logo.putdata(data)
    logo.thumbnail((220, 95), Image.Resampling.LANCZOS)
    return logo


def paste_asset(base, asset, center, max_size, angle=0, glow=ORANGE, glow_size=28):
    im = asset.copy()
    im.thumbnail(max_size, Image.Resampling.LANCZOS)
    if angle:
        im = im.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    x = int(center[0] - im.width / 2)
    y = int(center[1] - im.height / 2)
    if glow:
        halo = Image.new("RGBA", im.size, glow + (0,))
        halo.putalpha(im.getchannel("A"))
        halo = halo.filter(ImageFilter.GaussianBlur(glow_size))
        base.alpha_composite(halo, (x, y))
    base.alpha_composite(im, (x, y))


def panel(draw, box, outline=ORANGE, fill=(8, 11, 22, 238), radius=26):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((x1 + 15, y1 + 18, x2 + 15, y2 + 18), radius=radius, fill=(0, 0, 0, 110))
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=4)
    draw.line((x1 + 24, y1 + 24, x2 - 24, y1 + 24), fill=(255, 255, 255, 54), width=2)


def chip(draw, x, y, label, active=False):
    fill = (22, 24, 31, 245)
    outline = ORANGE_2 if active else (74, 78, 90)
    draw.rounded_rectangle((x, y, x + 128, y + 56), radius=12, fill=fill, outline=outline, width=3)
    text(draw, (x + 64, y + 14), label, F_ANS, WHITE, anchor="ma", stroke=1)


img = background()
draw = ImageDraw.Draw(img, "RGBA")

# Logo and small campaign metadata.
logo = crop_logo()
img.alpha_composite(logo, (64, 54))
text(draw, (910, 66), "01/08", font(26), ORANGE_2, anchor="ra", stroke=1)
draw.rounded_rectangle((64, 144, 260, 178), radius=15, fill=(255, 122, 18, 235))
text(draw, (162, 151), "MISSION MATHS", font(19), WHITE, anchor="ma", stroke=1)

# Headline.
text(draw, (64, 228), "RÉPONDS", F_HEAD, ORANGE, stroke=4)
text(draw, (64, 324), "POUR ATTAQUER", F_HEAD_2, WHITE, stroke=4)
draw.rectangle((66, 422, 388, 430), fill=ORANGE)
text(draw, (66, 458), "Chaque bonne réponse", F_SUB, SOFT, stroke=1)
text(draw, (66, 500), "déclenche ton attaque.", F_SUB, SOFT, stroke=1)

# Motion and laser trails.
for i, (color, width) in enumerate([(ORANGE, 22), (RED, 13), (CYAN, 7), (ORANGE_2, 5)]):
    off = i * 18
    draw.line((110 + off, 960, 440 + off, 742, 690 + off, 575), fill=color + (190,), width=width)
draw.line((566, 600, 880, 352), fill=ORANGE_2 + (235,), width=9)
draw.line((594, 626, 910, 378), fill=RED + (155,), width=5)

# Central hero object and distant threat.
enemy = ENEMY.rotate(180, expand=True)
enemy = ImageEnhance.Contrast(enemy).enhance(1.15)
paste_asset(img, enemy, (865, 310), (190, 135), angle=-14, glow=RED, glow_size=20)
plane = ImageEnhance.Contrast(PLANE).enhance(1.07)
paste_asset(img, plane, (555, 690), (610, 790), angle=-22, glow=CYAN, glow_size=30)

# Equation HUD.
panel(draw, (580, 660, 996, 918), outline=ORANGE)
text(draw, (787, 714), "42 - 18 = ?", F_EQ, ORANGE_2, anchor="ma", stroke=3)
chip(draw, 628, 785, "24", True)
chip(draw, 790, 785, "18")
chip(draw, 628, 855, "26")
chip(draw, 790, 855, "32")

# Futuristic UI details.
for x, y in [(790, 235), (825, 274), (900, 235), (948, 300)]:
    draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=CYAN)
draw.arc((740, 165, 1015, 440), 205, 335, fill=CYAN + (140,), width=4)
draw.arc((704, 132, 1050, 476), 205, 335, fill=ORANGE + (150,), width=5)

# Footer.
draw.rounded_rectangle((64, 994, 446, 1040), radius=18, fill=(0, 0, 0, 150), outline=ORANGE, width=2)
text(draw, (88, 1007), "AVIATION  •  MATHS  •  COMBAT", F_SMALL, SOFT)
draw.rounded_rectangle((788, 994, 1016, 1040), radius=18, fill=ORANGE, outline=ORANGE_2, width=2)
text(draw, (902, 1006), "JEXONGO.APP", font(25), WHITE, anchor="ma", stroke=1)

out = OUT / "jexongo-reponds-pour-attaquer-premium.png"
img.convert("RGB").save(out, quality=96)
print(out)
