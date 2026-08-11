from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ANIMATIONS = (
    (
        ROOT / "assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/01_Milieu_vers_Droite",
        ROOT / "assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-center-right-24.png",
    ),
    (
        ROOT / "assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/02_Milieu_vers_Gauche_24_images",
        ROOT / "assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-center-left-24.png",
    ),
    (
        ROOT / "assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/03_Gauche_vers_Milieu_24_images",
        ROOT / "assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-left-center-24.png",
    ),
    (
        ROOT / "assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/04_Droite_vers_Milieu",
        ROOT / "assets/enemies/Boss/B52/B52_Tourelle_Avant_4_Animations/b52-turret-right-center-24.png",
    ),
    (
        ROOT / "assets/enemies/Boss/Kawasaki_C2/01_Milieu_vers_Droite",
        ROOT / "assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-center-right-24.png",
    ),
    (
        ROOT / "assets/enemies/Boss/Kawasaki_C2/02_Milieu_vers_Gauche",
        ROOT / "assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-center-left-24.png",
    ),
    (
        ROOT / "assets/enemies/Boss/Kawasaki_C2/03_Gauche_vers_Milieu",
        ROOT / "assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-left-center-24.png",
    ),
    (
        ROOT / "assets/enemies/Boss/Kawasaki_C2/04_Droite_vers_Milieu",
        ROOT / "assets/enemies/Boss/Kawasaki_C2/kawasaki-c2-right-center-24.png",
    ),
)
COLS = 4
ROWS = 6


def build_sheet(source, output):
    paths = [source / f"frame_{index:02d}.png" for index in range(1, 25)]
    frames = [Image.open(path).convert("RGBA") for path in paths]
    width, height = frames[0].size
    if any(frame.size != (width, height) for frame in frames):
        raise ValueError("All turret frames in a sequence must have the same dimensions")

    sheet = Image.new("RGBA", (width * COLS, height * ROWS), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.paste(frame, ((index % COLS) * width, (index // COLS) * height))
    sheet.save(output, optimize=True)
    print(f"Created {output.relative_to(ROOT)} ({sheet.width}x{sheet.height})")


def main():
    for source, output in ANIMATIONS:
        build_sheet(source, output)


if __name__ == "__main__":
    main()
