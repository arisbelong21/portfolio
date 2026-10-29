"""Crop + grade tangkapan layar proyek menjadi WebP untuk galeri panel.

Sumber: screenshot asli pemilik (bukan gambar AI, bukan dari internet).
Jalankan dari akar proyek:  python scripts/enhance-shots.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SRC = Path(
    r"C:/Users/ASROCK B650M PRO/.qoder/tmp/"
    r"C--Users-ASROCK-B650M-PRO-Downloads-portfolio-3D/images/"
    r"56a4efa4-052a-49a1-a983-ba959bdac061"
)
OUT = Path("public/shots")

# crop = (kiri, atas, kanan, bawah) pada gambar asli
JOBS = [
    {
        "name": "racuninaja-storefront",
        "src": "c7e78099-9b35-42bf-85e1-efc43002e803.png",
        "crop": (800, 110, 2640, 1230),
        "mode": "light",
        "vignette": 46,
    },
    {
        "name": "racuninaja-shelves",
        "src": "600d5bb3-1e5f-4954-aa70-037b28936363.png",
        "crop": (1020, 262, 2420, 1253),
        "mode": "light",
        "vignette": 44,
    },
    {
        "name": "chopsterin-download",
        "src": "f375af6c-0fa5-4bc7-8005-e2ff2b2da795.png",
        "crop": (1020, 110, 2330, 1010),
        "mode": "dark",
        "vignette": 64,
    },
    {
        "name": "gabutstream-catalogue",
        "src": "32733b7a-c4f9-4fa3-97ef-97004d02c18a.png",
        "crop": (0, 0, 1229, 790),
        "mode": "light",
        "vignette": 40,
    },
    {
        "name": "gabutstream-film",
        "src": "8882c6e6-a95b-41b0-a61e-cc654cd44dcc.png",
        "crop": (0, 370, 845, 1045),
        "mode": "light",
        "vignette": 40,
    },
    {
        "name": "kamoeta-uga-profile",
        "src": "a4714fa8-77c8-433b-85d8-5f5cbb7460b9.png",
        "crop": (0, 0, 1677, 1252),
        "mode": "dark",
        "vignette": 46,
    },
]


def grade(im: Image.Image, mode: str) -> Image.Image:
    """Grade ringan supaya UI terang tidak menyilaukan di atas kanvas gelap."""
    if mode == "light":
        im = ImageEnhance.Brightness(im).enhance(0.975)
        im = ImageEnhance.Contrast(im).enhance(1.055)
        im = ImageEnhance.Color(im).enhance(1.05)
        r, g, b = im.split()
        r = r.point(lambda v: int(v * 0.986))
        b = b.point(lambda v: min(255, int(v * 1.014)))
        im = Image.merge("RGB", (r, g, b))
    else:
        im = ImageEnhance.Brightness(im).enhance(1.01)
        im = ImageEnhance.Contrast(im).enhance(1.07)
        im = ImageEnhance.Color(im).enhance(1.06)
        r, g, b = im.split()
        b = b.point(lambda v: min(255, int(v * 1.02)))
        im = Image.merge("RGB", (r, g, b))
    return im


def vignette(im: Image.Image, strength: int) -> Image.Image:
    w, h = im.size
    mask = Image.radial_gradient("L").resize((w, h), Image.BICUBIC)
    mask = mask.point(lambda v: int(v * strength / 255))
    edge = Image.new("RGB", (w, h), (3, 6, 11))
    return Image.composite(edge, im, mask)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for job in JOBS:
        im = Image.open(SRC / job["src"]).convert("RGB")
        im = im.crop(job["crop"])
        im.thumbnail((1600, 1600), Image.LANCZOS)
        im = grade(im, job["mode"])
        im = im.filter(ImageFilter.UnsharpMask(radius=1.1, percent=55, threshold=2))
        im = vignette(im, job["vignette"])
        path = OUT / f"{job['name']}.webp"
        im.save(path, "WEBP", quality=86, method=6)
        print(f"{path}  {im.width}x{im.height}  ratio {im.width / im.height:.3f}  {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
