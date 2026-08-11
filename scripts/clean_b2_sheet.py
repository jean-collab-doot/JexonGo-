from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "hangar" / "B2 animation.png"
OUT = ROOT / "assets" / "ships" / "player" / "b2-animation.png"

COLS = 4
ROWS = 3
FRAME_COUNT = COLS * ROWS
OUT_W = 256
OUT_H = 256
TARGET_W = 222
TARGET_TOP = 18


def flood_background(cell):
    w, h = cell.size
    px = cell.load()
    bg = bytearray(w * h)
    seen = bytearray(w * h)
    q = deque()

    def near_black(x, y):
        r, g, b, a = px[x, y]
        return a == 0 or (r < 18 and g < 18 and b < 18)

    for x in range(w):
        for y in (0, h - 1):
            if near_black(x, y):
                q.append((x, y))
                seen[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and near_black(x, y):
                q.append((x, y))
                seen[y * w + x] = 1

    while q:
        x, y = q.popleft()
        bg[y * w + x] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not seen[i] and near_black(nx, ny):
                    seen[i] = 1
                    q.append((nx, ny))
    return bg


def clean_cell(cell):
    cell = cell.convert("RGBA")
    w, h = cell.size
    px = cell.load()
    bg = flood_background(cell)
    clean = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out = clean.load()

    for y in range(h):
        for x in range(w):
            if not bg[y * w + x]:
                r, g, b, a = px[x, y]
                # Remove faint black matte around the transparent cutout.
                if a and not (r < 8 and g < 8 and b < 8):
                    out[x, y] = (r, g, b, a)

    alpha = clean.getchannel("A")
    mask = bytearray(1 if alpha.getpixel((x, y)) else 0 for y in range(h) for x in range(w))
    filtered = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fp = filtered.load()
    for comp in connected_components(mask, w, h):
        ys = [p[1] for p in comp]
        xs = [p[0] for p in comp]
        min_y, max_y = min(ys), max(ys)
        min_x, max_x = min(xs), max(xs)
        cx = (min_x + max_x) / 2
        is_stray_top_flame = max_y < h * 0.22 and len(comp) < 1400
        is_edge_noise = (cx < w * 0.12 or cx > w * 0.88) and len(comp) < 900
        if is_stray_top_flame or is_edge_noise:
            continue
        for x, y in comp:
            fp[x, y] = clean.getpixel((x, y))
    clean = filtered
    return clean


def alpha_bbox(img):
    return img.getchannel("A").getbbox() or (0, 0, 1, 1)


def connected_components(mask, w, h):
    seen = bytearray(w * h)
    components = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if seen[i] or not mask[i]:
                continue
            q = deque([(x, y)])
            seen[i] = 1
            comp = []
            while q:
                px, py = q.popleft()
                comp.append((px, py))
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        ni = ny * w + nx
                        if not seen[ni] and mask[ni]:
                            seen[ni] = 1
                            q.append((nx, ny))
            components.append(comp)
    return components


def main():
    src = Image.open(SRC).convert("RGBA")
    frame_w = src.width / COLS
    frame_h = src.height / ROWS
    sheet = Image.new("RGBA", (OUT_W * FRAME_COUNT, OUT_H), (0, 0, 0, 0))

    idx = 0
    for row in range(ROWS):
        for col in range(COLS):
            left = round(col * frame_w)
            top = round(row * frame_h)
            right = round((col + 1) * frame_w)
            bottom = round((row + 1) * frame_h)
            cell = clean_cell(src.crop((left, top, right, bottom)))
            bbox = alpha_bbox(cell)
            sprite = cell.crop(bbox)
            scale = TARGET_W / max(1, sprite.width)
            sprite = sprite.resize(
                (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
                Image.Resampling.LANCZOS,
            )

            frame = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))
            x = (OUT_W - sprite.width) // 2
            frame.alpha_composite(sprite, (x, TARGET_TOP))
            sheet.alpha_composite(frame, (idx * OUT_W, 0))
            idx += 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f"wrote {OUT} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
