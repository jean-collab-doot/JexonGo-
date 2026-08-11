from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import math
import zipfile

ROOT = Path.cwd()
OUT = ROOT / "output" / "instagram-carousel-fr-v2"
OUT.mkdir(parents=True, exist_ok=True)

W = H = 1080

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

F_LOGO = font(34)
F_HOOK = font(118)
F_NUM = font(185)
F_TITLE = font(78)
F_TITLE_2 = font(64)
F_COPY = font(34)
F_SMALL = font(24)
F_TINY = font(18)

RED = (255, 36, 50)
RED_DARK = (130, 8, 20)
WHITE = (245, 245, 245)
SOFT = (210, 210, 210)
BLACK = (12, 12, 14)
PANEL = (28, 29, 31)
BLUE = (63, 214, 255)
GOLD = (255, 205, 58)

JET = Image.open(ROOT / "assets" / "planes" / "14.png").convert("RGBA")
PLAYER = Image.open(ROOT / "assets" / "planes" / "my-plane.png").convert("RGBA")
ENEMY = Image.open(ROOT / "assets" / "enemies" / "planes" / "f15.png").convert("RGBA")

SLIDES = [
    {
        "num": "5",
        "over": "CHoses à savoir sur",
        "red": "JEXONGO",
        "white": "",
        "copy": "Le jeu de combat aérien qui transforme les maths en mission.",
        "visual": "cover",
    },
    {
        "num": "01",
        "over": "COMBAT AÉRIEN",
        "red": "RÉPONDS",
        "white": "POUR ATTAQUER",
        "copy": "Chaque bonne réponse déclenche ton attaque et rapproche la mission de la victoire.",
        "visual": "combat",
    },
    {
        "num": "02",
        "over": "MATHS ADAPTÉES",
        "red": "GRADES",
        "white": "1 À 6",
        "copy": "Les questions suivent le niveau scolaire du joueur et progressent étape par étape.",
        "visual": "grades",
    },
    {
        "num": "03",
        "over": "CONFIGURATION",
        "red": "CHOISIS",
        "white": "TES OPÉRATIONS",
        "copy": "Addition, soustraction, multiplication ou division: le joueur garde son choix.",
        "visual": "ops",
    },
    {
        "num": "04",
        "over": "RÉCOMPENSES",
        "red": "XP",
        "white": "COINS & AVIONS",
        "copy": "Missions, étoiles, coffres, avions et progression motivent chaque partie.",
        "visual": "rewards",
    },
    {
        "num": "05",
        "over": "PARTOUT",
        "red": "ORDI",
        "white": "TÉLÉPHONE",
        "copy": "Jouable sur ordinateur et mobile, en français ou en anglais.",
        "visual": "devices",
    },
    {
        "num": "BONUS",
        "over": "COMPTE JOUEUR",
        "red": "SAUVE",
        "white": "TA PROGRESSION",
        "copy": "Avec un compte, les niveaux, statistiques, coins, XP et avions restent sauvegardés.",
        "visual": "save",
    },
    {
        "num": "GO",
        "over": "PRÊT AU DÉCOLLAGE ?",
        "red": "JOUE",
        "white": "À JEXONGO",
        "copy": "Découvre un jeu arcade éducatif pensé pour pratiquer les maths avec plaisir.",
        "visual": "cta",
    },
]

def draw_text(draw, xy, text, fnt, fill, anchor="la", stroke=0, stroke_fill=(0, 0, 0)):
    draw.text(xy, text, font=fnt, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=stroke_fill)

def fit_lines(draw, text, fnt, max_width, max_lines=3):
    words = text.split()
    lines, line = [], ""
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

def bg():
    img = Image.new("RGBA", (W, H), BLACK + (255,))
    p = img.load()
    for y in range(H):
        for x in range(W):
            cx = (x - 270) / W
            cy = (y - 790) / H
            glow = max(0, 1 - math.sqrt(cx * cx + cy * cy) * 2.1)
            vignette = max(0, 1 - math.sqrt(((x - W / 2) / W) ** 2 + ((y - H / 2) / H) ** 2) * 1.6)
            r = int(12 + glow * 95 + vignette * 20)
            g = int(12 + glow * 18 + vignette * 12)
            b = int(14 + glow * 22 + vignette * 12)
            p[x, y] = (r, g, b, 255)
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(grid)
    for y in range(0, H, 26):
        d.line((0, y, W, y), fill=(255, 255, 255, 12), width=1)
    for x in range(-W, W, 34):
        d.line((x, 0, x + W, H), fill=(255, 255, 255, 8), width=1)
    return Image.alpha_composite(img, grid)

def paste_asset(base, asset, center, max_size, angle=0, glow=RED):
    im = asset.copy()
    im.thumbnail(max_size, Image.Resampling.LANCZOS)
    if angle:
        im = im.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    x = int(center[0] - im.width / 2)
    y = int(center[1] - im.height / 2)
    if glow:
        mask = im.getchannel("A")
        halo = Image.new("RGBA", im.size, glow + (0,))
        halo.putalpha(mask)
        halo = halo.filter(ImageFilter.GaussianBlur(22))
        base.alpha_composite(halo, (x, y))
    base.alpha_composite(im, (x, y))

def header(draw):
    draw_text(draw, (70, 58), "JEXONGO", F_LOGO, WHITE, stroke=2)
    draw_text(draw, (70, 92), "COMBAT MATHÉMATIQUE AÉRIEN", F_TINY, SOFT)
    draw.rectangle((70, 118, 280, 125), fill=RED)

def footer(draw):
    draw.rectangle((0, 1000, W, H), fill=(6, 6, 7, 235))
    draw_text(draw, (70, 1030), "JEU ÉDUCATIF  •  AVIATION  •  MATHS", F_SMALL, WHITE, stroke=1)
    draw_text(draw, (1010, 1030), "JEXONGO.APP", F_SMALL, RED, anchor="ra", stroke=1)

def number_badge(draw, label):
    if label == "5":
        draw_text(draw, (72, 210), label, F_NUM, RED, stroke=4)
    else:
        draw_text(draw, (1005, 70), label, font(38), WHITE, anchor="ra", stroke=2)

def title_block(draw, slide):
    draw_text(draw, (72, 185), slide["over"].upper(), F_SMALL, SOFT)
    if slide["num"] == "5":
        draw_text(draw, (228, 236), "CHOSES À SAVOIR", F_TITLE_2, WHITE, stroke=3)
        draw_text(draw, (228, 306), "SUR JEXONGO", F_TITLE_2, RED, stroke=3)
        y = 395
    else:
        draw_text(draw, (72, 245), slide["red"], F_TITLE, RED, stroke=4)
        draw_text(draw, (72, 320), slide["white"], F_TITLE_2, WHITE, stroke=4)
        y = 410
    max_width = 455 if slide["visual"] == "rewards" else 520
    for line in fit_lines(draw, slide["copy"], F_COPY, max_width, 3):
        draw_text(draw, (74, y), line, F_COPY, WHITE, stroke=2)
        y += 42

def card(draw, box, outline=RED):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((x1 + 12, y1 + 14, x2 + 12, y2 + 14), radius=20, fill=(0, 0, 0, 145))
    draw.rounded_rectangle(box, radius=20, fill=PANEL + (235,), outline=outline, width=5)
    draw.line((x1 + 20, y1 + 20, x2 - 20, y1 + 20), fill=(255, 255, 255, 70), width=2)

def chip(draw, x, y, label, w=120, h=58, fill=RED):
    draw.rounded_rectangle((x, y, x + w, y + h), radius=12, fill=fill, outline=(255, 255, 255, 120), width=2)
    draw_text(draw, (x + w / 2, y + 16), label, font(25), WHITE, anchor="ma", stroke=1)

def draw_visual(base, draw, slide):
    kind = slide["visual"]
    if kind == "cover":
        paste_asset(base, JET, (690, 650), (520, 690), angle=-25)
        draw.line((365, 830, 630, 710), fill=RED, width=20)
        draw.line((405, 875, 665, 745), fill=(255, 132, 38), width=10)
        for x, y in [(840, 405), (900, 470), (785, 490)]:
            draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=RED)
    elif kind == "combat":
        card(draw, (555, 285, 965, 560), BLUE)
        draw_text(draw, (760, 365), "42 - 18 = ?", font(58), GOLD, anchor="ma", stroke=3)
        for i, ans in enumerate(["24", "18", "26", "32"]):
            chip(draw, 595 + (i % 2) * 165, 425 + (i // 2) * 68, ans, 135, 54)
        paste_asset(base, PLAYER, (335, 705), (290, 200), angle=8, glow=BLUE)
        paste_asset(base, ENEMY.rotate(180, expand=True), (830, 730), (290, 200), angle=-8, glow=RED)
        draw.line((455, 695, 705, 645), fill=GOLD, width=8)
    elif kind == "grades":
        paste_asset(base, JET, (345, 710), (330, 450), angle=-10, glow=BLUE)
        for i in range(6):
            x = 565 + (i % 2) * 170
            y = 310 + (i // 2) * 118
            card(draw, (x, y, x + 135, y + 82))
            draw_text(draw, (x + 67, y + 22), "GRADE", font(18), WHITE, anchor="ma")
            draw_text(draw, (x + 67, y + 44), str(i + 1), font(38), RED, anchor="ma", stroke=1)
    elif kind == "ops":
        paste_asset(base, JET, (350, 705), (330, 440), angle=10, glow=BLUE)
        ops = [("+", RED), ("-", BLUE), ("x", (255, 132, 38)), ("÷", (180, 95, 255))]
        for i, (op, col) in enumerate(ops):
            x = 570 + (i % 2) * 170
            y = 320 + (i // 2) * 150
            card(draw, (x, y, x + 135, y + 105), col)
            draw_text(draw, (x + 67, y + 26), op, font(62), col, anchor="ma", stroke=2)
    elif kind == "rewards":
        paste_asset(base, JET, (285, 745), (285, 400), angle=-16, glow=BLUE)
        card(draw, (585, 300, 975, 660), GOLD)
        draw_text(draw, (780, 370), "MISSION", font(48), WHITE, anchor="ma", stroke=3)
        draw_text(draw, (780, 435), "COMPLETE", font(50), RED, anchor="ma", stroke=3)
        draw_text(draw, (780, 520), "★  ★  ★", font(54), GOLD, anchor="ma", stroke=2)
        chip(draw, 620, 575, "+ XP", 100, 54, RED)
        chip(draw, 740, 575, "COINS", 110, 54, RED)
        chip(draw, 865, 575, "AVION", 90, 54, RED)
    elif kind == "devices":
        paste_asset(base, JET, (315, 720), (330, 450), angle=-8, glow=BLUE)
        card(draw, (540, 315, 780, 525), BLUE)
        draw.rectangle((575, 360, 745, 472), fill=(238, 238, 238), outline=RED, width=5)
        paste_asset(base, PLAYER, (660, 416), (120, 80), glow=None)
        card(draw, (820, 290, 960, 590), RED)
        draw.rounded_rectangle((845, 335, 935, 540), radius=22, fill=(238, 238, 238), outline=RED, width=5)
        paste_asset(base, PLAYER, (890, 440), (70, 48), glow=None)
        chip(draw, 585, 620, "FR", 80, 50, RED)
        chip(draw, 685, 620, "EN", 80, 50, BLUE)
    elif kind == "save":
        paste_asset(base, PLAYER, (305, 720), (290, 210), angle=10, glow=BLUE)
        card(draw, (575, 290, 915, 620), BLUE)
        draw.ellipse((695, 350, 795, 450), fill=RED, outline=WHITE, width=3)
        draw.rounded_rectangle((640, 485, 870, 570), radius=40, fill=(56, 56, 58), outline=RED, width=4)
        for i, lab in enumerate(["NIVEAUX", "XP", "AVIONS"]):
            chip(draw, 585 + i * 112, 665, lab, 98, 50, RED)
    elif kind == "cta":
        paste_asset(base, JET, (700, 580), (560, 720), angle=-24, glow=RED)
        card(draw, (500, 740, 970, 875), GOLD)
        draw_text(draw, (735, 780), "JEXONGO.APP", font(58), WHITE, anchor="ma", stroke=3)
        draw_text(draw, (735, 835), "Décollage immédiat", font(30), RED, anchor="ma", stroke=1)

def make_slide(idx, slide):
    im = bg()
    draw = ImageDraw.Draw(im, "RGBA")
    header(draw)
    footer(draw)
    number_badge(draw, slide["num"])
    title_block(draw, slide)
    draw_visual(im, draw, slide)
    out = OUT / f"jexongo-fr-v2-{idx + 1:02d}.png"
    im.convert("RGB").save(out, quality=95)
    return out

def make_grid(files):
    thumb = 360
    gap = 24
    margin = 40
    cols = 4
    rows = 2
    grid = Image.new("RGB", (cols * thumb + (cols - 1) * gap + margin * 2, rows * thumb + (rows - 1) * gap + margin * 2), (45, 45, 45))
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGB")
        im.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
        x = margin + (i % cols) * (thumb + gap)
        y = margin + (i // cols) * (thumb + gap)
        grid.paste(im, (x, y))
    out = OUT / "jexongo-fr-v2-preview-grid.png"
    grid.save(out, quality=95)
    return out

files = [make_slide(i, slide) for i, slide in enumerate(SLIDES)]
preview = make_grid(files)
zip_path = ROOT / "output" / "jexongo-instagram-carousel-fr-v2.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(f, f.name)
    z.write(preview, preview.name)

print("Created JexonGO French V2 carousel")
for f in files:
    print(f)
print(preview)
print(zip_path)
