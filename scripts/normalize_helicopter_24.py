from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "enemies" / "planes" / "helicopter_24_frames"
OUTPUT = ROOT / "assets" / "enemies" / "planes" / "enemy-helicopter-clean-24-v4.png"
CELL_W, CELL_H = 210, 245


def largest_component(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    width, height = rgba.size
    visible = bytearray(1 if value > 16 else 0 for value in alpha.getdata())
    visited = bytearray(width * height)
    largest: list[int] = []

    for start in range(width * height):
        if not visible[start] or visited[start]:
            continue
        visited[start] = 1
        queue = deque([start])
        component: list[int] = []
        while queue:
            index = queue.popleft()
            component.append(index)
            x, y = index % width, index // width
            for nx, ny in (
                (x - 1, y - 1), (x, y - 1), (x + 1, y - 1),
                (x - 1, y),                     (x + 1, y),
                (x - 1, y + 1), (x, y + 1), (x + 1, y + 1),
            ):
                if 0 <= nx < width and 0 <= ny < height:
                    neighbour = ny * width + nx
                    if visible[neighbour] and not visited[neighbour]:
                        visited[neighbour] = 1
                        queue.append(neighbour)
        if len(component) > len(largest):
            largest = component

    keep = bytearray(width * height)
    for index in largest:
        keep[index] = 255
    mask = Image.frombytes("L", (width, height), bytes(keep))
    cleaned = Image.new("RGBA", rgba.size)
    cleaned.paste(rgba, mask=mask)
    bbox = cleaned.getbbox()
    return cleaned.crop(bbox) if bbox else cleaned


frames: list[Image.Image] = []
for number in range(24):
    frame = largest_component(Image.open(SOURCE / f"frame_{number:02d}.png"))
    cell = Image.new("RGBA", (CELL_W, CELL_H))
    x = (CELL_W - frame.width) // 2
    y = (CELL_H - frame.height) // 2
    cell.alpha_composite(frame, (x, y))
    frames.append(cell)

# The generated source changes the fuselage shape in a few frames. Hold the
# central aircraft body from frame zero while retaining each frame's rotor.
body_left, body_right = CELL_W // 2 - 27, CELL_W // 2 + 27
reference_body = frames[0].crop((body_left, 0, body_right, CELL_H))
for index, frame in enumerate(frames):
    if index == 0:
        continue
    frame.paste((0, 0, 0, 0), (body_left, 0, body_right, CELL_H))
    frame.alpha_composite(reference_body, (body_left, 0))

sheet = Image.new("RGBA", (CELL_W * 4, CELL_H * 6))
for index, frame in enumerate(frames):
    sheet.alpha_composite(frame, ((index % 4) * CELL_W, (index // 4) * CELL_H))

sheet.save(OUTPUT, optimize=True)
print(OUTPUT)
