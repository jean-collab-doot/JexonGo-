from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

SHEETS = {
    "t6":   ("T6 animation.png",   ROOT / "assets" / "ships" / "player" / "t6-animation.png"),
    "c130": ("C130 animation.png", ROOT / "assets" / "ships" / "player" / "c130-animation.png"),
    "a10":  ("A10 Animation.png",  ROOT / "assets" / "ships" / "player" / "a10-animation.png"),
    "b2":   ("B2 animation.png",   ROOT / "assets" / "ships" / "player" / "b2-animation.png"),
    "f16":  ("F16 animation.png",  ROOT / "assets" / "ships" / "player" / "f16-animation.png"),
    "f18":  ("F18 animation.png",  ROOT / "assets" / "ships" / "player" / "f18-animation.png"),
    "f22":  ("F22 animation.png",  ROOT / "assets" / "ships" / "player" / "f22-animation.png"),
    "f35":  ("F35 animation.png",  ROOT / "assets" / "ships" / "player" / "f35-animation.png"),
    "sr71": ("SR71 animation.png", ROOT / "assets" / "ships" / "player" / "sr71-animation.png"),
    "f15":  ("F15 Animation.png",  ROOT / "assets" / "enemies" / "planes" / "f15-animation.png"),
    "t38":  (ROOT / "assets" / "enemies" / "planes" / "T38 animation.png", ROOT / "assets" / "enemies" / "planes" / "t38-animation.png"),
}

FIXED_BODY_SHEETS = {
    # The third F-18 row in the source sheet is smaller than the first two rows.
    # Keep one stable body and animate only the flame layer so the player jet
    # does not pulse or change size while flying.
    "a10": 5,
    "f18": 6,
    "sr71": 5,
    "f15": 5,
    "t38": 5,
}

PROPELLER_SHEETS = {
    "t6": {
        "fixed": 5,
        "windows": [(102, 0, 154, 48)],
    },
    "c130": {
        "fixed": 5,
        "windows": [
            (42, 36, 78, 82),
            (78, 36, 114, 82),
            (142, 36, 178, 82),
            (178, 36, 214, 82),
        ],
    },
}

COLS = 4
ROWS = 3
FRAMES = COLS * ROWS
OUT_W = 256
OUT_H = 256
TARGET_W = 222
TARGET_H = 238
TARGET_BODY_TOP = 9
TARGET_BODY_CENTER_X = OUT_W // 2


def is_bg_black(px, x, y):
    r, g, b, a = px[x, y]
    return a == 0 or (r < 16 and g < 16 and b < 16)


def background_mask(cell):
    w, h = cell.size
    px = cell.load()
    bg = bytearray(w * h)
    seen = bytearray(w * h)
    q = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_bg_black(px, x, y):
                q.append((x, y))
                seen[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not seen[i] and is_bg_black(px, x, y):
                q.append((x, y))
                seen[i] = 1

    while q:
        x, y = q.popleft()
        bg[y * w + x] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not seen[i] and is_bg_black(px, nx, ny):
                    seen[i] = 1
                    q.append((nx, ny))
    return bg


def connected_components(mask, w, h):
    seen = bytearray(w * h)
    out = []
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
            out.append(comp)
    return out


def clean_cell(cell):
    cell = cell.convert("RGBA")
    w, h = cell.size
    px = cell.load()
    bg = background_mask(cell)
    mask = bytearray(w * h)

    for y in range(h):
        for x in range(w):
            if bg[y * w + x]:
                continue
            r, g, b, a = px[x, y]
            if a and not (r < 7 and g < 7 and b < 7):
                mask[y * w + x] = 1

    filtered = bytearray(w * h)
    for comp in connected_components(mask, w, h):
        xs = [p[0] for p in comp]
        ys = [p[1] for p in comp]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        area = len(comp)
        cx = (min_x + max_x) / 2
        has_fire = any(px[x, y][0] > 145 and px[x, y][1] > 45 and px[x, y][2] < 75 for x, y in comp)
        edge_noise = (cx < w * 0.18 or cx > w * 0.82) and area < 3600
        side_fragment = (max_x < w * 0.28 or min_x > w * 0.72) and area < 6200
        top_stray_flame = max_y < h * 0.12 and area < 1600 and has_fire
        tiny_noise = area < 80 and not has_fire
        if edge_noise or side_fragment or top_stray_flame or tiny_noise:
            continue
        for x, y in comp:
            filtered[y * w + x] = 1

    clean = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out = clean.load()
    for y in range(h):
        for x in range(w):
            if filtered[y * w + x]:
                out[x, y] = px[x, y]
    return clean


def alpha_bbox(img):
    return img.getchannel("A").getbbox() or (0, 0, 1, 1)


def is_fire_pixel(r, g, b, a):
    if not a:
        return False
    return r > 135 and g > 40 and b < 95 and r > b * 1.6


def body_bbox(img):
    px = img.load()
    w, h = img.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and not is_fire_pixel(r, g, b, a):
                xs.append(x)
                ys.append(y)
    if not xs:
        return alpha_bbox(img)
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)


def split_body_and_fire(frame):
    body = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    fire = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    src = frame.load()
    bp = body.load()
    fp = fire.load()
    w, h = frame.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if not a:
                continue
            if y > h * 0.58 and is_fire_pixel(r, g, b, a):
                fp[x, y] = (r, g, b, a)
            else:
                bp[x, y] = (r, g, b, a)
    return body, fire


def fire_components(img):
    px = img.load()
    w, h = img.size
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if y > h * 0.55 and is_fire_pixel(r, g, b, a):
                mask[y * w + x] = 1

    comps = []
    for comp in connected_components(mask, w, h):
        if len(comp) < 18:
            continue
        xs = [p[0] for p in comp]
        ys = [p[1] for p in comp]
        bbox = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        crop = Image.new("RGBA", (bbox[2] - bbox[0], bbox[3] - bbox[1]), (0, 0, 0, 0))
        cp = crop.load()
        for x, y in comp:
            cp[x - bbox[0], y - bbox[1]] = px[x, y]
        comps.append((bbox, crop))
    comps.sort(key=lambda item: ((item[0][0] + item[0][2]) / 2))
    return comps


def stabilize_fixed_body_frames(frames, fixed_body_idx):
    fixed_body, _ = split_body_and_fire(frames[fixed_body_idx])
    ref_comps = fire_components(frames[fixed_body_idx])
    if not ref_comps:
        return frames

    anchors = []
    for bbox, flame in ref_comps[:3]:
        anchors.append({
            "x": (bbox[0] + bbox[2]) / 2,
            "top": bbox[1],
            "max_h": max(18, min(46, flame.height)),
        })
    stable_frames = []

    for frame in frames:
        comps = fire_components(frame)
        stable = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))
        stable.alpha_composite(fixed_body)
        if len(comps) < len(anchors) and comps:
            comps = comps + [comps[-1]] * (len(anchors) - len(comps))

        for anchor, (_, flame) in zip(anchors, comps):
            if flame.height > anchor["max_h"]:
                scale = anchor["max_h"] / flame.height
                flame = flame.resize(
                    (max(1, round(flame.width * scale)), max(1, round(flame.height * scale))),
                    Image.Resampling.LANCZOS,
                )
            x = round(anchor["x"] - flame.width / 2)
            y = round(anchor["top"])
            stable.alpha_composite(flame, (x, y))
        stable_frames.append(stable)
    return stable_frames


def clear_rect(img, rect):
    px = img.load()
    left, top, right, bottom = rect
    for y in range(max(0, top), min(img.height, bottom)):
        for x in range(max(0, left), min(img.width, right)):
            px[x, y] = (0, 0, 0, 0)


def stabilize_propeller_frames(frames, spec):
    fixed = frames[spec["fixed"]].copy()
    for rect in spec["windows"]:
        clear_rect(fixed, rect)

    stable_frames = []
    for frame in frames:
        stable = fixed.copy()
        for rect in spec["windows"]:
            left, top, right, bottom = rect
            prop_region = frame.crop((left, top, right, bottom))
            stable.alpha_composite(prop_region, (left, top))
        stable_frames.append(stable)
    return stable_frames


def visible_source_bbox(img):
    px = img.load()
    w, h = img.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and not (r < 18 and g < 18 and b < 18):
                xs.append(x)
                ys.append(y)
    if not xs:
        return (0, 0, w, h)
    pad_x = 18
    pad_y = 18
    return (
        max(0, min(xs) - pad_x),
        max(0, min(ys) - pad_y),
        min(w, max(xs) + 1 + pad_x),
        min(h, max(ys) + 1 + pad_y),
    )


def process(src_name, out_path):
    src_path = src_name if isinstance(src_name, Path) else ROOT / "assets" / "hangar" / src_name
    src = Image.open(src_path).convert("RGBA")
    src = src.crop(visible_source_bbox(src))
    frame_w = src.width / COLS
    frame_h = src.height / ROWS
    sheet = Image.new("RGBA", (OUT_W * FRAMES, OUT_H), (0, 0, 0, 0))

    cells = []
    for row in range(ROWS):
        for col in range(COLS):
            left = round(col * frame_w)
            top = round(row * frame_h)
            right = round((col + 1) * frame_w)
            bottom = round((row + 1) * frame_h)
            cell = clean_cell(src.crop((left, top, right, bottom)))
            full = alpha_bbox(cell)
            body = body_bbox(cell)
            cells.append((cell, full, body))

    max_full_h = max(b[3] - b[1] for _, b, _ in cells)
    max_body_w = max(b[2] - b[0] for _, _, b in cells)
    scale = min(
        TARGET_W / max(1, max_body_w),
        TARGET_H / max(1, max_full_h),
        (OUT_H - TARGET_BODY_TOP - 2) / max(1, max_full_h),
    )

    frames = []
    for idx, (cell, full, body) in enumerate(cells):
        sprite = cell.crop(full)
        sprite = sprite.resize(
            (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
            Image.Resampling.LANCZOS,
        )

        body_left = (body[0] - full[0]) * scale
        body_top = (body[1] - full[1]) * scale
        body_center = body_left + ((body[2] - body[0]) * scale) / 2
        x = round(TARGET_BODY_CENTER_X - body_center)
        y = round(TARGET_BODY_TOP - body_top)

        frame = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))
        frame.alpha_composite(sprite, (x, y))
        frames.append(frame)

    sheet_key = out_path.stem.replace("-animation", "")
    prop_spec = PROPELLER_SHEETS.get(sheet_key)
    fixed_body_idx = FIXED_BODY_SHEETS.get(sheet_key)
    if prop_spec is not None:
        frames = stabilize_propeller_frames(frames, prop_spec)
    elif fixed_body_idx is not None and 0 <= fixed_body_idx < len(frames):
        frames = stabilize_fixed_body_frames(frames, fixed_body_idx)

    for idx, frame in enumerate(frames):
        sheet.alpha_composite(frame, (idx * OUT_W, 0))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    return out_path


def main():
    for name, (src, out) in SHEETS.items():
        path = process(src, out)
        print(f"{name}: wrote {path} ({OUT_W * FRAMES}x{OUT_H})")


if __name__ == "__main__":
    main()
