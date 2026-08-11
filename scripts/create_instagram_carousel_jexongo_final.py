# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import zipfile

ROOT = Path.cwd()
OUT = ROOT / "output" / "instagram-carousel-jexongo-final"
OUT.mkdir(parents=True, exist_ok=True)

W = H = 1080

NAVY = (5, 13, 34)
NAVY_2 = (10, 31, 66)
INK = (7, 14, 30)
SKY = (92, 186, 239)
SKY_2 = (214, 244, 255)
ORANGE = (255, 142, 0)
YELLOW = (255, 196, 66)
CYAN = (0, 218, 255)
WHITE = (255, 255, 255)
SOFT = (222, 236, 242)
SILVER = (205, 222, 231)
LIGHT = (238, 243, 246)
RED_ORANGE = (255, 83, 28)

PLANE = Image.open(ROOT / "assets" / "planes" / "14.png").convert("RGBA")
ENEMY = Image.open(ROOT / "assets" / "enemies" / "planes" / "f15.png").convert("RGBA")


def font(size, bold=True):
    candidates = [
        "C:/Windows/Fonts/impact.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for name in candidates:
        p = Path(name)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


F_LOGO = font(44)
F_TAG = font(16)
F_COUNTER = font(24)
F_HEAD = font(76)
F_HEAD_SMALL = font(66)
F_SUB = font(31, False)
F_HILITE = font(30)
F_BODY = font(24, False)
F_BIG = font(94)
F_EQ = font(54)
F_BTN = font(38)


SLIDES = [
    {
        "theme": "dark",
        "headline": "LES MATHS DEVIENNENT\nUNE MISSION",
        "highlight": "JEXONGO",
        "subtitle": "Pilote ton avion et réponds pour attaquer.",
        "visual": "hero",
    },
    {
        "theme": "dark",
        "headline": "RÉPONDS JUSTE.\nTIRE PLUS FORT.",
        "highlight": "Chaque réponse compte",
        "subtitle": "Une bonne réponse déclenche ton attaque.",
        "visual": "attack",
    },
    {
        "theme": "light",
        "headline": "DU GRADE 1\nAU GRADE 6",
        "highlight": "Adapté au niveau",
        "subtitle": "Des questions raisonnables pour chaque joueur.",
        "visual": "grades",
    },
    {
        "theme": "light",
        "headline": "CHOISIS TES\nOPÉRATIONS",
        "highlight": "+  −  ×  ÷",
        "subtitle": "Addition, soustraction, multiplication ou division.",
        "visual": "ops",
    },
    {
        "theme": "dark",
        "headline": "GAGNE XP, COINS\nET AVIONS",
        "highlight": "Récompenses",
        "subtitle": "Progresse en terminant tes missions.",
        "visual": "rewards",
    },
    {
        "theme": "light",
        "headline": "JOUE SUR ORDINATEUR\nOU TÉLÉPHONE",
        "highlight": "Partout",
        "subtitle": "Interface adaptée et langues FR / EN.",
        "visual": "devices",
    },
    {
        "theme": "light",
        "headline": "SAUVEGARDE TA\nPROGRESSION",
        "highlight": "Compte joueur",
        "subtitle": "Niveaux, stats, XP, coins et avions restent sauvegardés.",
        "visual": "save",
    },
    {
        "theme": "dark",
        "headline": "PRÊT AU\nDÉCOLLAGE ?",
        "highlight": "Joue maintenant",
        "subtitle": "JEXONGO.APP",
        "visual": "cta",
    },
]


def text(draw, xy, value, fnt, fill, anchor="la", stroke=0, stroke_fill=None):
    if stroke_fill is None:
        stroke_fill = (0, 0, 0)
    draw.text(xy, value, font=fnt, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=stroke_fill)


def fit_font_for_line(value, start_size, max_width):
    size = start_size
    while size > 34:
        f = font(size)
        dummy = Image.new("RGB", (1, 1))
        d = ImageDraw.Draw(dummy)
        if d.textlength(value, font=f) <= max_width:
            return f
        size -= 3
    return font(size)


def wrap_lines(draw, value, fnt, max_width, max_lines=3):
    words = value.split()
    lines = []
    line = ""
    for word in words:
        test = f"{line} {word}".strip()
        if line and draw.textlength(test, font=fnt) > max_width:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines[:max_lines]


def rounded_panel(draw, box, fill, outline, radius=28, width=4, shadow=True):
    x1, y1, x2, y2 = box
    if shadow:
        draw.rounded_rectangle((x1 + 16, y1 + 20, x2 + 16, y2 + 20), radius=radius, fill=(0, 0, 0, 92))
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def dark_background():
    img = Image.new("RGBA", (W, H), NAVY + (255,))
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = y / H
            cx = (x - 700) / W
            cy = (y - 600) / H
            glow = max(0, 1 - math.sqrt(cx * cx + cy * cy) * 2.2)
            r = int(NAVY[0] * (1 - t) + NAVY_2[0] * t + glow * 12)
            g = int(NAVY[1] * (1 - t) + NAVY_2[1] * t + glow * 38)
            b = int(NAVY[2] * (1 - t) + NAVY_2[2] * t + glow * 52)
            px[x, y] = (r, g, b, 255)

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for y in range(0, H, 31):
        d.line((0, y, W, y), fill=(255, 255, 255, 14), width=1)
    for x in range(-W, W, 45):
        d.line((x, 0, x + W, H), fill=(CYAN[0], CYAN[1], CYAN[2], 8), width=1)
    d.ellipse((680, 40, 1240, 580), fill=(CYAN[0], CYAN[1], CYAN[2], 23))
    d.ellipse((-180, 690, 340, 1210), fill=(ORANGE[0], ORANGE[1], ORANGE[2], 28))
    return Image.alpha_composite(img, overlay)


def light_background():
    img = Image.new("RGBA", (W, H), SKY_2 + (255,))
    px = img.load()
    for y in range(H):
        t = y / H
        for x in range(W):
            r = int(SKY_2[0] * (1 - t) + SKY[0] * t)
            g = int(SKY_2[1] * (1 - t) + SKY[1] * t)
            b = int(SKY_2[2] * (1 - t) + SKY[2] * t)
            px[x, y] = (r, g, b, 255)

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for cx, cy, s, a in [
        (170, 215, 150, 130), (325, 190, 190, 120), (850, 250, 180, 105),
        (940, 820, 240, 95), (130, 880, 240, 90), (560, 980, 230, 80),
    ]:
        draw_cloud(d, cx, cy, s, a)
    for y in range(0, H, 25):
        d.line((0, y, W, y), fill=(9, 35, 72, 18), width=1)
    d.arc((-120, 160, 250, 530), 280, 85, fill=ORANGE + (170,), width=18)
    d.arc((-85, 205, 200, 490), 280, 85, fill=YELLOW + (110,), width=10)
    d.rectangle((0, 0, W, H), outline=(255, 255, 255, 60), width=8)
    return Image.alpha_composite(img, layer)


def draw_cloud(draw, cx, cy, s, alpha=105):
    color = (255, 255, 255, alpha)
    draw.ellipse((cx - s * .60, cy - s * .20, cx - s * .15, cy + s * .22), fill=color)
    draw.ellipse((cx - s * .30, cy - s * .40, cx + s * .25, cy + s * .18), fill=color)
    draw.ellipse((cx + s * .10, cy - s * .24, cx + s * .62, cy + s * .22), fill=color)
    draw.rounded_rectangle((cx - s * .68, cy, cx + s * .70, cy + s * .26), radius=int(s * .13), fill=color)


def add_brand(draw, theme, idx):
    dark = theme == "dark"
    y = 52
    shadow = (40, 42, 44) if not dark else (0, 0, 0)
    text(draw, (57, y + 3), "JEXON", F_LOGO, shadow, stroke=1, stroke_fill=shadow)
    text(draw, (57, y), "JEXON", F_LOGO, YELLOW, stroke=1, stroke_fill=(80, 58, 28))
    x_go = 57 + int(draw.textlength("JEXON", font=F_LOGO))
    text(draw, (x_go + 2, y + 3), "GO", F_LOGO, shadow, stroke=1, stroke_fill=shadow)
    text(draw, (x_go + 2, y), "GO", F_LOGO, ORANGE, stroke=1, stroke_fill=(95, 52, 18))
    tag_color = SOFT if dark else (29, 55, 86)
    text(draw, (59, 95), "COMBAT MATHÉMATIQUE AÉRIEN", F_TAG, tag_color, stroke=0)
    draw.rounded_rectangle((905, 44, 1018, 84), radius=18, fill=(0, 0, 0, 85) if dark else (255, 255, 255, 170), outline=ORANGE, width=2)
    text(draw, (962, 53), f"{idx:02d}/08", F_COUNTER, ORANGE if dark else INK, anchor="ma", stroke=0)


def add_footer(draw, theme):
    dark = theme == "dark"
    fill = (1, 7, 20, 215) if dark else (255, 255, 255, 120)
    draw.rounded_rectangle((58, 1000, 515, 1045), radius=18, fill=fill, outline=(ORANGE + (185,)), width=2)
    text(draw, (86, 1011), "AVIATION  •  MATHS  •  MISSION", font(19), SOFT if dark else INK)


def headline_block(draw, slide):
    dark = slide["theme"] == "dark"
    title_color = WHITE if dark else INK
    sub_color = SOFT if dark else (32, 59, 89)
    y = 158
    for line in slide["headline"].split("\n"):
        fnt = fit_font_for_line(line, 76, 770)
        text(draw, (62, y), line, fnt, title_color, stroke=2 if dark else 0, stroke_fill=(0, 0, 0))
        y += 82
    label_w = int(draw.textlength(slide["highlight"], font=F_HILITE)) + 58
    draw.rounded_rectangle((62, y + 10, 62 + label_w, y + 64), radius=20, fill=ORANGE, outline=YELLOW, width=2)
    text(draw, (91, y + 22), slide["highlight"], F_HILITE, WHITE, stroke=1)
    sy = y + 88
    for line in wrap_lines(draw, slide["subtitle"], F_SUB, 510, 2):
        text(draw, (64, sy), line, F_SUB, sub_color, stroke=1 if dark else 0, stroke_fill=(0, 0, 0))
        sy += 38


def paste_asset(base, asset, center, max_size, angle=0, glow=CYAN, glow_size=24, opacity=255):
    im = asset.copy()
    im.thumbnail(max_size, Image.Resampling.LANCZOS)
    if angle:
        im = im.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    if opacity < 255:
        a = im.getchannel("A").point(lambda p: int(p * opacity / 255))
        im.putalpha(a)
    x = int(center[0] - im.width / 2)
    y = int(center[1] - im.height / 2)
    if glow:
        halo = Image.new("RGBA", im.size, glow + (0,))
        halo.putalpha(im.getchannel("A"))
        halo = halo.filter(ImageFilter.GaussianBlur(glow_size))
        base.alpha_composite(halo, (x, y))
    base.alpha_composite(im, (x, y))


def trails(draw, pts, colors):
    for i, color in enumerate(colors):
        off = i * 18
        draw.line([(x - off, y + off) for x, y in pts], fill=color + (185,), width=max(5, 18 - i * 5))


def math_button(draw, box, symbol, label, fill, dark=True):
    rounded_panel(draw, box, (8, 24, 52, 236) if dark else (255, 255, 255, 205), fill, radius=26, width=4)
    x1, y1, x2, y2 = box
    text(draw, ((x1 + x2) / 2, y1 + 27), symbol, font(78), fill, anchor="ma", stroke=1)
    text(draw, ((x1 + x2) / 2, y2 - 48), label, font(28), WHITE if dark else INK, anchor="ma", stroke=1 if dark else 0)


def coin(draw, cx, cy, r):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=YELLOW, outline=ORANGE, width=5)
    text(draw, (cx, cy - r * .43), "$", font(int(r * 1.2)), (122, 73, 0), anchor="ma", stroke=0)


def star(draw, cx, cy, r, fill=YELLOW):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * .42
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    draw.polygon(pts, fill=fill, outline=ORANGE)


def visual(base, draw, slide):
    kind = slide["visual"]
    dark = slide["theme"] == "dark"
    if kind == "hero":
        trails(draw, [(245, 940), (535, 750), (690, 595)], [CYAN, ORANGE, YELLOW])
        paste_asset(base, PLANE, (693, 640), (560, 760), angle=-21, glow=CYAN, glow_size=28)
        rounded_panel(draw, (632, 790, 1000, 900), (5, 17, 42, 205), CYAN, radius=24, width=3)
        text(draw, (662, 814), "MISSION ACTIVE", font(30), ORANGE, stroke=1)
        text(draw, (662, 855), "Réponds. Attaque. Progresse.", font(24, False), WHITE)
    elif kind == "attack":
        rounded_panel(draw, (555, 445, 996, 705), (5, 17, 42, 235), ORANGE, radius=26, width=4)
        text(draw, (776, 502), "42 - 18 = ?", F_EQ, YELLOW, anchor="ma", stroke=2)
        for i, ans in enumerate(["24", "18", "26", "32"]):
            x = 610 + (i % 2) * 170
            y = 575 + (i // 2) * 70
            draw.rounded_rectangle((x, y, x + 130, y + 52), radius=12, fill=(3, 9, 25, 235), outline=CYAN if ans == "24" else (60, 82, 112), width=3)
            text(draw, (x + 65, y + 13), ans, font(28), WHITE, anchor="ma", stroke=1)
        paste_asset(base, PLANE, (395, 730), (370, 490), angle=-16, glow=CYAN)
        paste_asset(base, ENEMY.rotate(180, expand=True), (850, 350), (185, 140), angle=-13, glow=RED_ORANGE)
        draw.line((560, 625, 780, 400), fill=YELLOW + (210,), width=9)
        draw.line((580, 648, 805, 423), fill=ORANGE + (160,), width=5)
    elif kind == "grades":
        paste_asset(base, PLANE, (800, 655), (400, 540), angle=-18, glow=CYAN, opacity=225)
        for i, grade in enumerate(["G1", "G2", "G3", "G4", "G5", "G6"]):
            x = 90 + (i % 3) * 170
            y = 585 + (i // 3) * 135
            rounded_panel(draw, (x, y, x + 130, y + 92), (7, 20, 47, 230), ORANGE if i % 2 else CYAN, radius=22, width=4)
            text(draw, (x + 65, y + 23), grade, font(42), WHITE, anchor="ma", stroke=1)
            text(draw, (x + 65, y + 66), "niveau", font(18, False), SOFT, anchor="ma")
    elif kind == "ops":
        ops = [("+", "ADDITION", CYAN), ("−", "SOUSTRACTION", ORANGE), ("×", "MULTIPLICATION", YELLOW), ("÷", "DIVISION", (144, 94, 255))]
        for i, (sym, label, color) in enumerate(ops):
            x = 120 + (i % 2) * 390
            y = 540 + (i // 2) * 185
            math_button(draw, (x, y, x + 320, y + 135), sym, label, color, dark=False)
    elif kind == "rewards":
        rounded_panel(draw, (575, 420, 990, 755), (6, 19, 48, 240), ORANGE, radius=28, width=5)
        text(draw, (782, 458), "MISSION COMPLETE", font(38), CYAN, anchor="ma", stroke=1)
        for x in [705, 780, 855]:
            star(draw, x, 535, 38)
        text(draw, (650, 620), "+ 270 XP", font(45), YELLOW, stroke=2)
        coin(draw, 700, 700, 34)
        text(draw, (750, 679), "+ 60", font(42), WHITE, stroke=2)
        paste_asset(base, PLANE, (315, 705), (390, 530), angle=-20, glow=CYAN)
        draw.rounded_rectangle((132, 816, 430, 886), radius=20, fill=(255, 142, 0, 230), outline=YELLOW, width=3)
        text(draw, (281, 837), "AVION DÉBLOQUÉ", font(28), WHITE, anchor="ma", stroke=1)
    elif kind == "devices":
        rounded_panel(draw, (105, 510, 565, 800), (9, 27, 58, 235), INK, radius=22, width=4)
        draw.rectangle((142, 555, 528, 750), fill=(74, 181, 230), outline=CYAN, width=3)
        draw_cloud(draw, 260, 620, 120, 180)
        paste_asset(base, PLANE, (340, 666), (180, 230), angle=-18, glow=CYAN)
        rounded_panel(draw, (660, 440, 935, 845), (8, 24, 52, 240), ORANGE, radius=42, width=5)
        draw.rounded_rectangle((690, 490, 905, 790), radius=28, fill=(88, 186, 238), outline=CYAN, width=3)
        paste_asset(base, PLANE, (795, 655), (130, 180), angle=-18, glow=CYAN)
        draw.rounded_rectangle((723, 814, 875, 850), radius=16, fill=ORANGE)
        text(draw, (799, 819), "FR / EN", font(24), WHITE, anchor="ma", stroke=1)
    elif kind == "save":
        rounded_panel(draw, (565, 430, 975, 820), (7, 20, 49, 238), CYAN, radius=30, width=4)
        draw.ellipse((625, 485, 735, 595), fill=(255, 255, 255, 35), outline=ORANGE, width=4)
        text(draw, (680, 509), "PILOTE", font(29), WHITE, anchor="ma", stroke=1)
        for i, (label, val, col) in enumerate([("XP", .75, CYAN), ("COINS", .62, YELLOW), ("NIVEAU", .47, ORANGE)]):
            y = 635 + i * 58
            text(draw, (615, y - 9), label, font(23), SOFT)
            draw.rounded_rectangle((720, y, 920, y + 18), radius=9, fill=(1, 8, 22), outline=(60, 85, 110), width=2)
            draw.rounded_rectangle((720, y, 720 + int(200 * val), y + 18), radius=9, fill=col)
        paste_asset(base, PLANE, (250, 725), (300, 400), angle=-20, glow=CYAN, opacity=230)
        draw.arc((150, 460, 400, 710), 200, 500, fill=ORANGE + (200,), width=9)
        text(draw, (270, 520), "☁", font(96), WHITE, anchor="ma")
    elif kind == "cta":
        trails(draw, [(265, 960), (515, 790), (705, 620)], [CYAN, ORANGE, YELLOW])
        paste_asset(base, PLANE, (710, 615), (690, 860), angle=-16, glow=CYAN, glow_size=30)
        draw.rounded_rectangle((70, 775, 438, 858), radius=24, fill=ORANGE, outline=YELLOW, width=3)
        text(draw, (254, 795), "JEXONGO.APP", font(40), WHITE, anchor="ma", stroke=2)


def make_slide(slide, idx):
    img = dark_background() if slide["theme"] == "dark" else light_background()
    draw = ImageDraw.Draw(img, "RGBA")
    add_brand(draw, slide["theme"], idx)
    headline_block(draw, slide)
    visual(img, draw, slide)
    add_footer(draw, slide["theme"])
    return img.convert("RGB")


def preview_grid(paths):
    thumb_w = 360
    gap = 18
    grid = Image.new("RGB", (thumb_w * 4 + gap * 5, thumb_w * 2 + gap * 3), (13, 17, 24))
    for i, path in enumerate(paths):
        im = Image.open(path).convert("RGB")
        im.thumbnail((thumb_w, thumb_w), Image.Resampling.LANCZOS)
        x = gap + (i % 4) * (thumb_w + gap)
        y = gap + (i // 4) * (thumb_w + gap)
        grid.paste(im, (x, y))
    out = OUT / "jexongo-final-preview-grid.png"
    grid.save(out, quality=95)
    return out


def main():
    paths = []
    for i, slide in enumerate(SLIDES, 1):
        im = make_slide(slide, i)
        out = OUT / f"jexongo-final-{i:02d}.png"
        im.save(out, quality=96)
        paths.append(out)
        print(out)
    preview = preview_grid(paths)
    print(preview)
    zip_path = ROOT / "output" / "jexongo-instagram-carousel-final.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in paths:
            zf.write(p, p.name)
        zf.write(preview, preview.name)
    print(zip_path)


if __name__ == "__main__":
    main()
