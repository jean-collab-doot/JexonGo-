from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import math
import zipfile

ROOT = Path.cwd()
OUT = ROOT / "output" / "instagram-carousel-fr"
OUT.mkdir(parents=True, exist_ok=True)

W = H = 1080

def font(size, bold=True):
    candidates = [
        Path("C:/Windows/Fonts/impact.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf") if bold else Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf") if bold else Path("C:/Windows/Fonts/segoeui.ttf"),
    ]
    for p in candidates:
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()

F_HUGE = font(126)
F_TITLE = font(70)
F_TITLE_SM = font(58)
F_SUB = font(30)
F_SMALL = font(23)
F_TINY = font(18)

JET = Image.open(ROOT / "assets" / "planes" / "14.png").convert("RGBA")
PLAYER = Image.open(ROOT / "assets" / "planes" / "my-plane.png").convert("RGBA")
ENEMY = Image.open(ROOT / "assets" / "enemies" / "planes" / "f15.png").convert("RGBA")

SLIDES = [
    {
        "kicker": "JEXONGO",
        "title_red": "APPRENDS",
        "title_white": "LES MATHS",
        "subtitle": "Un jeu de combat aerien ou chaque bonne reponse fait avancer la mission.",
        "visual": "rocket",
        "number": "01",
    },
    {
        "kicker": "COMMENT JOUER",
        "title_red": "REPONDS",
        "title_white": "POUR ATTAQUER",
        "subtitle": "Choisis la bonne reponse, tire sur les ennemis et protege ton avion.",
        "visual": "question",
        "number": "02",
    },
    {
        "kicker": "NIVEAU SCOLAIRE",
        "title_red": "GRADES",
        "title_white": "1 A 6",
        "subtitle": "Les questions restent raisonnables pour le niveau choisi et deviennent plus fortes avec la progression.",
        "visual": "grades",
        "number": "03",
    },
    {
        "kicker": "CONFIGURATION",
        "title_red": "TES",
        "title_white": "OPERATIONS",
        "subtitle": "Addition, soustraction, multiplication ou division: le joueur garde ses symboles pendant le jeu.",
        "visual": "ops",
        "number": "04",
    },
    {
        "kicker": "PROGRESSION",
        "title_red": "XP",
        "title_white": "COINS & RECOMPENSES",
        "subtitle": "Gagne des etoiles, de l'XP, des coins, des coffres et de nouveaux avions.",
        "visual": "rewards",
        "number": "05",
    },
    {
        "kicker": "COMPTE JOUEUR",
        "title_red": "SAUVEGARDE",
        "title_white": "TON PROFIL",
        "subtitle": "Avec un compte, la progression reste sauvegardee: niveaux, statistiques, avions et missions.",
        "visual": "profile",
        "number": "06",
    },
    {
        "kicker": "MULTI-APPAREILS",
        "title_red": "JOUE",
        "title_white": "PARTOUT",
        "subtitle": "Sur ordinateur ou telephone. Interface adaptee, francais et anglais disponibles.",
        "visual": "devices",
        "number": "07",
    },
    {
        "kicker": "PRET AU DECOLLAGE",
        "title_red": "JEXONGO",
        "title_white": "EST EN LIGNE",
        "subtitle": "Un jeu arcade educatif pour pratiquer les maths avec plaisir.",
        "visual": "cta",
        "number": "08",
    },
]

def draw_text(draw, xy, text, fnt, fill, anchor="la", stroke=0, stroke_fill=(0,0,0)):
    draw.text(xy, text, font=fnt, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=stroke_fill)

def text_width(draw, text, fnt):
    return draw.textlength(text, font=fnt)

def wrap(draw, text, fnt, max_width):
    words = text.split()
    lines, line = [], ""
    for word in words:
        test = f"{line} {word}".strip()
        if line and text_width(draw, test, fnt) > max_width:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines

def dark_bg():
    img = Image.new("RGBA", (W, H), (18, 18, 18, 255))
    px = img.load()
    for y in range(H):
        for x in range(W):
            dx = (x - W * 0.55) / W
            dy = (y - H * 0.46) / H
            glow = max(0, 1 - math.sqrt(dx*dx + dy*dy) * 2.2)
            red = int(24 + glow * 70)
            grey = int(18 + glow * 44)
            px[x, y] = (red, grey, grey, 255)
    overlay = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(overlay)
    for y in range(0, H, 5):
        d.line((0, y, W, y), fill=(255,255,255,10), width=1)
    for x in range(-W, W, 42):
        d.line((x, 0, x + W, H), fill=(255,255,255,9), width=1)
    return Image.alpha_composite(img, overlay)

def red_glow(img, cx=230, cy=775):
    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    for r, a in [(430, 34), (300, 52), (180, 72)]:
        d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(255, 26, 38, a))
    return Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(28)))

def add_header(draw, slide):
    draw_text(draw, (72, 48), "JEXONGO", font(24), (255,255,255), stroke=2)
    draw_text(draw, (72, 75), "COMBAT MATHEMATIQUE AERIEN", font(13), (220,220,220))
    draw_text(draw, (1010, 52), slide["number"] + "/08", font(24), (230,230,230), anchor="ra")
    draw.line((72, 105, 240, 105), fill=(255, 31, 45), width=5)

def add_title(draw, slide, y=155):
    draw_text(draw, (72, y), slide["title_red"], F_TITLE, (255, 31, 45), stroke=2)
    draw_text(draw, (72, y + 68), slide["title_white"], F_TITLE_SM if len(slide["title_white"]) > 12 else F_TITLE, (255,255,255), stroke=2)
    yy = y + 150
    for line in wrap(draw, slide["subtitle"], F_SMALL, 520):
        draw_text(draw, (74, yy), line, F_SMALL, (235,235,235))
        yy += 30
    return yy

def paste_asset(base, asset, center, max_size, angle=0, glow=True, alpha=255):
    im = asset.copy()
    im.thumbnail(max_size, Image.Resampling.LANCZOS)
    if angle:
        im = im.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    if alpha < 255:
        a = im.getchannel("A").point(lambda p: int(p * alpha / 255))
        im.putalpha(a)
    x = int(center[0] - im.width / 2)
    y = int(center[1] - im.height / 2)
    if glow:
        shadow = Image.new("RGBA", im.size, (255, 31, 45, 0))
        shadow.putalpha(im.getchannel("A"))
        shadow = shadow.filter(ImageFilter.GaussianBlur(18))
        base.alpha_composite(shadow, (x, y))
    base.alpha_composite(im, (x, y))

def red_panel(draw, box, alpha=210):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((x1+10, y1+10, x2+10, y2+10), radius=12, fill=(0,0,0,110))
    draw.rounded_rectangle(box, radius=12, fill=(32,32,32,alpha), outline=(255,31,45,235), width=4)
    draw.line((x1+18, y1+18, x2-18, y1+18), fill=(255,255,255,60), width=2)

def draw_chip(draw, x, y, label, w=132):
    draw.rounded_rectangle((x, y, x+w, y+52), radius=8, fill=(255,31,45), outline=(255,255,255,80), width=2)
    draw_text(draw, (x+w/2, y+16), label, font(23), (255,255,255), anchor="ma", stroke=1)

def visual(base, draw, slide):
    kind = slide["visual"]
    if kind == "rocket":
        paste_asset(base, JET, (705, 620), (500, 650), angle=-28)
        draw.line((355, 835, 645, 690), fill=(255,31,45,180), width=18)
        draw.line((395, 870, 675, 725), fill=(255,142,65,160), width=10)
    elif kind == "question":
        red_panel(draw, (535, 290, 965, 515))
        draw_text(draw, (750, 382), "36 + 27 = ?", font(58), (255,255,255), anchor="ma", stroke=2)
        for i, ans in enumerate(["63", "54", "72", "61"]):
            x = 580 + (i % 2) * 180
            y = 425 + (i // 2) * 62
            draw_chip(draw, x, y, ans, 145)
        paste_asset(base, PLAYER, (345, 695), (300, 210), angle=6)
        paste_asset(base, ENEMY.rotate(180, expand=True), (825, 705), (300, 210), angle=-8)
    elif kind == "grades":
        for idx, g in enumerate(range(1, 7)):
            x = 555 + (idx % 2) * 170
            y = 310 + (idx // 2) * 120
            red_panel(draw, (x, y, x+138, y+86), alpha=225)
            draw_text(draw, (x+69, y+22), "GRADE", font(19), (255,255,255), anchor="ma")
            draw_text(draw, (x+69, y+45), str(g), font(42), (255,31,45), anchor="ma", stroke=1)
        paste_asset(base, JET, (330, 705), (310, 420), angle=-10)
    elif kind == "ops":
        labels = ["+", "-", "x", "÷"]
        for i, lab in enumerate(labels):
            x = 555 + (i % 2) * 180
            y = 300 + (i // 2) * 155
            red_panel(draw, (x, y, x+150, y+110), alpha=230)
            draw_text(draw, (x+75, y+28), lab, font(64), (255,31,45), anchor="ma", stroke=2)
        paste_asset(base, JET, (355, 690), (320, 430), angle=8)
    elif kind == "rewards":
        red_panel(draw, (520, 285, 960, 610), alpha=225)
        draw_text(draw, (740, 350), "MISSION", font(50), (255,255,255), anchor="ma", stroke=2)
        draw_text(draw, (740, 418), "COMPLETE", font(52), (255,31,45), anchor="ma", stroke=2)
        draw_text(draw, (740, 500), "*  *  *", font(70), (255,220,68), anchor="ma", stroke=2)
        for i, label in enumerate(["XP", "COINS", "AVIONS"]):
            draw_chip(draw, 545 + i*135, 545, label, 118)
        paste_asset(base, JET, (320, 720), (330, 450), angle=-16)
    elif kind == "profile":
        red_panel(draw, (545, 275, 940, 660), alpha=225)
        draw.ellipse((682, 315, 802, 435), fill=(255,31,45), outline=(255,255,255,130), width=3)
        draw.rounded_rectangle((610, 465, 875, 590), radius=50, fill=(75,75,75), outline=(255,31,45), width=4)
        for y, label in [(705, "Sauvegarde cloud"), (755, "Statistiques"), (805, "Missions")]:
            draw_chip(draw, 560, y, label, 245)
        paste_asset(base, PLAYER, (290, 625), (300, 220), angle=10)
    elif kind == "devices":
        red_panel(draw, (535, 290, 805, 500), alpha=225)
        draw.rectangle((565, 330, 775, 455), fill=(245,245,245), outline=(255,31,45), width=5)
        paste_asset(base, PLAYER, (670, 392), (155, 95), angle=0, glow=False)
        red_panel(draw, (830, 270, 970, 565), alpha=225)
        draw.rounded_rectangle((855, 315, 945, 520), radius=18, fill=(240,240,240), outline=(255,31,45), width=4)
        paste_asset(base, PLAYER, (900, 415), (92, 60), glow=False)
        for i, lab in enumerate(["FR", "EN"]):
            draw_chip(draw, 565+i*120, 620, lab, 92)
        paste_asset(base, JET, (300, 705), (330, 450), angle=-8)
    elif kind == "cta":
        paste_asset(base, JET, (705, 525), (530, 680), angle=-25)
        red_panel(draw, (500, 715, 970, 845), alpha=230)
        draw_text(draw, (735, 760), "JEXONGO.APP", font(52), (255,255,255), anchor="ma", stroke=2)
        draw_text(draw, (735, 815), "Decolle maintenant", font(28), (255,31,45), anchor="ma", stroke=1)

def add_footer(draw):
    draw.rectangle((0, 980, W, H), fill=(10,10,10,220))
    draw_text(draw, (72, 1018), "JEU EDUCATIF  •  AVIATION  •  MATHS", font(23), (255,255,255), stroke=1)
    draw_text(draw, (1010, 1018), "JEXONGO.APP", font(23), (255,31,45), anchor="ra", stroke=1)

def make_slide(i, slide):
    img = red_glow(dark_bg())
    draw = ImageDraw.Draw(img, "RGBA")
    add_header(draw, slide)
    add_title(draw, slide)
    visual(img, draw, slide)
    add_footer(draw)
    out = OUT / f"jexongo-fr-{i+1:02d}.png"
    img.convert("RGB").save(out, quality=95)
    return out

def make_preview(files):
    cols, rows = 4, 2
    thumb = 360
    gap = 28
    margin = 44
    preview = Image.new("RGB", (cols*thumb + (cols-1)*gap + margin*2, rows*thumb + (rows-1)*gap + margin*2), (48,48,48))
    for idx, file in enumerate(files):
        im = Image.open(file).convert("RGB")
        im.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
        x = margin + (idx % cols) * (thumb + gap)
        y = margin + (idx // cols) * (thumb + gap)
        preview.paste(im, (x, y))
    out = OUT / "jexongo-fr-preview-grid.png"
    preview.save(out, quality=95)
    return out

files = [make_slide(i, slide) for i, slide in enumerate(SLIDES)]
preview = make_preview(files)
zip_path = ROOT / "output" / "jexongo-instagram-carousel-fr.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for file in files:
        z.write(file, file.name)
    z.write(preview, preview.name)

print("Created French dark carousel:")
for file in files:
    print(file)
print(preview)
print(zip_path)
