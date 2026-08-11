from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

ROOT = Path.cwd()
OUT = ROOT / "output" / "instagram-carousel"
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

F_BIG = font(82)
F_TITLE = font(58)
F_TITLE_SMALL = font(48)
F_SUB = font(30)
F_BODY = font(26)
F_KICK = font(32)
F_CHIP = font(28)

def load_asset(rel):
    im = Image.open(ROOT / rel).convert("RGBA")
    return im

LOGO = load_asset("assets/menu/JEXONGO.png")
JET = load_asset("assets/planes/14.png")
PLAYER = load_asset("assets/planes/my-plane.png")
ENEMY = load_asset("assets/enemies/planes/f15.png")

slides = [
    ("NOUVEAU JEU", "JEXONGO", "Combat mathematique aerien", ["Pilote ton avion.", "Reponds aux equations.", "Gagne la mission."], "hero", "jexongo.app"),
    ("APPRENDRE EN JOUANT", "Les maths deviennent une mission", "Chaque bonne reponse attaque les ennemis.", ["Addition", "Soustraction", "Multiplication", "Division"], "question", None),
    ("ECOLE", "Pour les grades 1 a 6", "La difficulte suit le niveau du joueur.", ["Debutant", "Progression", "Challenge"], "grades", None),
    ("CONFIGURATION", "Choisis tes operations", "Le joueur garde ses symboles pendant toute sa progression.", ["+", "-", "x", "÷"], "ops", None),
    ("RECOMPENSES", "XP, coins et avions", "Complete les missions pour debloquer plus.", ["Mission complete", "+ XP", "+ Coins", "Chests"], "rewards", None),
    ("PARTOUT", "Ordinateur et telephone", "Joue en francais ou en anglais, sur tous les appareils.", ["Mobile", "Desktop", "FR / EN"], "devices", None),
    ("PROGRESSION", "Suis tes statistiques", "Temps de jeu, niveau, missions et progression sauvegardee.", ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"], "stats", None),
    ("PRET AU DECOLLAGE ?", "Joue a JexonGO", "Un jeu de maths arcade, rapide et motivant.", ["Combat", "Maths", "Progression"], "cta", "jexongo.app"),
]

def gradient_bg():
    img = Image.new("RGB", (W, H))
    px = img.load()
    top = (13, 116, 218)
    mid = (52, 197, 255)
    bot = (215, 243, 255)
    for y in range(H):
        t = y / (H - 1)
        if t < 0.58:
            k = t / 0.58
            c = tuple(int(top[i] * (1-k) + mid[i] * k) for i in range(3))
        else:
            k = (t - 0.58) / 0.42
            c = tuple(int(mid[i] * (1-k) + bot[i] * k) for i in range(3))
        for x in range(W):
            px[x, y] = c
    return img.convert("RGBA")

def add_cloud(draw, x, y, scale=1, alpha=220):
    fill = (255, 255, 255, alpha)
    for dx, dy, rx, ry in [
        (0, 25, 90, 32), (70, 12, 80, 38), (145, 27, 110, 35), (210, 20, 75, 30)
    ]:
        draw.ellipse((x+dx*scale-rx*scale, y+dy*scale-ry*scale, x+dx*scale+rx*scale, y+dy*scale+ry*scale), fill=fill)

def add_scanlines(img):
    overlay = Image.new("RGBA", img.size, (0,0,0,0))
    d = ImageDraw.Draw(overlay)
    for y in range(0, H, 8):
        d.rectangle((0, y, W, y+1), fill=(6, 22, 51, 38))
    return Image.alpha_composite(img, overlay)

def shadowed_panel(draw, box, fill=(6, 22, 51), outline=(245, 164, 0), radius=18):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((x1+10, y1+10, x2+10, y2+10), radius=radius, fill=(2, 8, 23, 180))
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=6)
    draw.rounded_rectangle((x1+18, y1+18, x2-18, y2-18), radius=max(4, radius-8), outline=(115,217,255,140), width=3)

def draw_text_center(draw, text, y, fnt, fill=(255,255,255), max_width=900, line_gap=8):
    words = text.split()
    lines, line = [], ""
    for word in words:
        test = (line + " " + word).strip()
        if draw.textlength(test, font=fnt) > max_width and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    total = len(lines) * fnt.size + (len(lines)-1) * line_gap
    yy = y - total // 2
    for l in lines:
        w = draw.textlength(l, font=fnt)
        draw.text(((W-w)/2+4, yy+4), l, font=fnt, fill=(3,20,47))
        draw.text(((W-w)/2, yy), l, font=fnt, fill=fill)
        yy += fnt.size + line_gap

def paste_fit(base, asset, box, angle=0):
    x1, y1, x2, y2 = box
    im = asset.copy()
    im.thumbnail((x2-x1, y2-y1), Image.Resampling.LANCZOS)
    if angle:
        im = im.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    x = int((x1+x2-im.width)/2)
    y = int((y1+y2-im.height)/2)
    base.alpha_composite(im, (x, y))

def chip(draw, x, y, text, color, w=132, h=70):
    draw.rounded_rectangle((x+6, y+7, x+w+6, y+h+7), radius=12, fill=(2,8,23,180))
    draw.rounded_rectangle((x, y, x+w, y+h), radius=12, fill=(6,22,51), outline=color, width=5)
    tw = draw.textlength(text, font=F_CHIP)
    draw.text((x+(w-tw)/2+2, y+22+2), text, font=F_CHIP, fill=(3,20,47))
    draw.text((x+(w-tw)/2, y+22), text, font=F_CHIP, fill=(255,255,255))

def make_slide(idx, slide):
    kicker, title, subtitle, body, kind, cta = slide
    img = gradient_bg()
    d = ImageDraw.Draw(img, "RGBA")
    add_cloud(d, 130, 170, 1.0)
    add_cloud(d, 760, 145, 1.15)
    add_cloud(d, 680, 710, 1.35, 155)
    img = add_scanlines(img)
    d = ImageDraw.Draw(img, "RGBA")

    shadowed_panel(d, (46, 42, 1034, 138))
    d.text((82+3, 76+3), kicker, font=F_KICK, fill=(3,20,47))
    d.text((82, 76), kicker, font=F_KICK, fill=(255,226,74))
    count = f"{idx+1:02d}/08"
    cw = d.textlength(count, font=F_BODY)
    d.text((998-cw, 82), count, font=F_BODY, fill=(115,217,255))

    if kind == "hero":
        draw_text_center(d, "JEXONGO", 215, font(92), fill=(255, 244, 225), max_width=850)
        draw_text_center(d, "V2", 292, font(36), fill=(255, 226, 74), max_width=850)
        paste_fit(img, JET, (310, 330, 770, 720), -8)
    elif kind == "question":
        shadowed_panel(d, (125, 190, 955, 440), fill=(6, 23, 51), outline=(24,217,255))
        draw_text_center(d, "24 + 18 = ?", 310, font(70), fill=(255,226,74))
        paste_fit(img, PLAYER, (170, 515, 410, 680))
        paste_fit(img, ENEMY.rotate(180, expand=True), (715, 455, 970, 630))
        d.line((410, 585, 720, 515), fill=(255,223,77), width=10)
    elif kind == "grades":
        for g in range(1, 7):
            col = (g-1) % 3
            row = (g-1) // 3
            x, y = 190 + col*235, 250 + row*170
            shadowed_panel(d, (x, y, x+170, y+120), fill=(7,53,99), outline=(40,224,112) if g == 3 else (245,164,0))
            draw_text_center(d, "GRADE", y+48, F_BODY, max_width=160)
            draw_text_center(d, str(g), y+92, font(54), fill=(255,226,74), max_width=160)
    elif kind == "ops":
        colors = [(0,232,75), (96,165,250), (255,140,0), (168,85,247)]
        for i, op in enumerate(body):
            chip(d, 170+i*150, 330, op, colors[i])
        paste_fit(img, JET, (380, 480, 700, 760))
    elif kind == "rewards":
        shadowed_panel(d, (155, 225, 925, 665), outline=(255,226,74))
        draw_text_center(d, "MISSION COMPLETE", 315, font(50), fill=(40,224,112))
        draw_text_center(d, "* * *", 420, font(86), fill=(255,226,74))
        for i, label in enumerate(["+270 XP", "+60 COINS", "CHEST"]):
            chip(d, 235+i*205, 505, label, [(33,212,253), (245,164,0), (168,85,247)][i], 170, 70)
    elif kind == "devices":
        d.rounded_rectangle((145,230,505,475), radius=18, fill=(6,22,51), outline=(115,217,255), width=6)
        d.rounded_rectangle((185,270,465,435), radius=8, fill=(14,139,216))
        paste_fit(img, PLAYER, (240, 300, 420, 415))
        d.rounded_rectangle((610,205,840,615), radius=36, fill=(6,22,51), outline=(245,164,0), width=8)
        d.rounded_rectangle((635,255,815,540), radius=14, fill=(14,139,216))
        paste_fit(img, PLAYER, (650, 340, 800, 455))
        chip(d, 365, 680, "FR", (24,217,255))
        chip(d, 515, 680, "EN", (245,164,0))
    elif kind == "stats":
        shadowed_panel(d, (125, 210, 955, 680), outline=(24,217,255))
        draw_text_center(d, "TEMPS DE JEU", 305, font(40), fill=(255,226,74))
        heights = [90, 135, 70, 180, 155, 110, 60]
        for i, day in enumerate(body):
            x, h = 190 + i*100, heights[i]
            d.rounded_rectangle((x,570-h,x+58,570), radius=8, fill=(245,164,0) if i == 3 else (33,212,253))
            tw = d.textlength(day, font=font(20))
            d.text((x+29-tw/2, 620), day, font=font(20), fill=(255,255,255))
    elif kind == "cta":
        paste_fit(img, JET, (270, 150, 810, 670), -8)
        d.line((250, 650, 830, 650), fill=(255, 226, 74), width=10)
        d.line((330, 680, 750, 680), fill=(115, 217, 255), width=7)

    title_y = 835 if idx in (0, 7) else 790
    panel_h = 198 if idx in (0, 7) else 222
    shadowed_panel(d, (60, title_y-72, 1020, title_y-72+panel_h))
    draw_text_center(d, title, title_y, F_BIG if len(title) < 12 else F_TITLE_SMALL, max_width=850)
    draw_text_center(d, subtitle, title_y+82, F_SUB, fill=(215,243,255), max_width=850)
    if cta:
        draw_text_center(d, cta, title_y+150, F_BODY, fill=(255,226,74), max_width=850)

    out = OUT / f"jexongo-carousel-{idx+1:02d}.png"
    img.convert("RGB").save(out, quality=95)
    return out

created = [make_slide(i, slide) for i, slide in enumerate(slides)]
print("Created PNG carousel slides:")
for p in created:
    print(p)
