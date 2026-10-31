"""Generate BeeJunior brand assets from the original logo.

Run: python3 web/scripts/generate-brand.py [path/to/beejunior-logo.png]
Needs Pillow only. The original (solid light background) is never modified;
the source copy lives in web/public/brand/beejunior-logo-source.png.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

WEB = Path(__file__).resolve().parent.parent
BRAND = WEB / "public" / "brand"
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else BRAND / "beejunior-logo-source.png"
INK = (0x29, 0x1E, 0x1C)
YELLOW = (0xFF, 0xC0, 0x01)
SKY = (0x10, 0xB7, 0xEB)
CREAM = (0xFF, 0xFD, 0xF5)

def wordmark_mask(alpha: Image.Image) -> Image.Image:
    """Mask of the wordmark letters (incl. the i dot) via connected components.

    Letters are the components reaching the baseline (bottom row of the logo);
    the i dot is the only other component in the right-hand third that sits
    directly above the i stem.
    """
    a = alpha.point(lambda v: 255 if v > 100 else 0)
    w, h = a.size
    px = a.load()
    seen = bytearray(w * h)
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if px[x0, y0] and not seen[y0 * w + x0]:
                stack = [(x0, y0)]
                seen[y0 * w + x0] = 1
                pts = []
                while stack:
                    x, y = stack.pop()
                    pts.append((x, y))
                    for X, Y in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= X < w and 0 <= Y < h and px[X, Y] and not seen[Y * w + X]:
                            seen[Y * w + X] = 1
                            stack.append((X, Y))
                comps.append(pts)
    baseline = max(max(y for _, y in pts) for pts in comps if len(pts) > 5000)
    letters = [c for c in comps if len(c) > 5000 and max(y for _, y in c) > baseline - 40]
    stems = [(min(x for x, _ in c), max(x for x, _ in c), min(y for _, y in c)) for c in letters]
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    chosen = list(letters)
    for c in comps:
        if c in letters or len(c) < 1500:
            continue
        cx0, cx1 = min(x for x, _ in c), max(x for x, _ in c)
        cy1 = max(y for _, y in c)
        if any(cx0 >= s0 - 5 and cx1 <= s1 + 5 and cy1 < s2 + 5 and s2 - cy1 < 80 for s0, s1, s2 in stems):
            chosen.append(c)  # the i dot
    for c in chosen:
        for x, y in c:
            mp[x, y] = 255
    return mask.filter(ImageFilter.MaxFilter(9))


def transparent_logo(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    r, g, b = img.split()
    lightness = ImageChops.darker(ImageChops.darker(r, g), b)
    content = lightness.point(lambda v: 255 if v < 225 else 0)
    box = content.getbbox()
    pad = 12
    box = (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad)
    img = img.crop(box)
    light = lightness.crop(box).point(lambda v: 255 if v >= 225 else 0)
    flood = light.copy()
    ImageDraw.floodfill(flood, (0, 0), 128)
    bg = flood.point(lambda v: 255 if v == 128 else 0)  # only border-connected light area
    fringe = bg.filter(ImageFilter.MaxFilter(5))
    fringe = ImageChops.subtract(fringe, bg)
    alpha = ImageChops.invert(bg)
    # soften antialiased edge pixels that still carry some background colour
    ramp = ImageChops.darker(r.crop(box), ImageChops.darker(g.crop(box), b.crop(box))).point(
        lambda v: max(0, min(255, int((255 - v) * 255 / 70)))
    )
    alpha = Image.composite(ImageChops.darker(alpha, ramp), alpha, fringe)
    out = img.convert("RGBA")
    out.putalpha(alpha)
    return out, box


def trim(img: Image.Image, pad: int = 0) -> Image.Image:
    box = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    img = img.crop(box)
    if pad:
        canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
        canvas.paste(img, (pad, pad))
        img = canvas
    return img


def save(img: Image.Image, name: str, size: tuple[int, int] | None = None, quality: int = 86, dest: Path = BRAND):
    if size:
        img = img.resize(size, Image.LANCZOS)
    if name.endswith(".webp"):
        img.save(dest / name, "WEBP", quality=quality, method=6)
    else:
        img.save(dest / name, optimize=True)
    print(name, img.size, (dest / name).stat().st_size, "bytes")


def main():
    BRAND.mkdir(parents=True, exist_ok=True)
    if SRC.resolve() != (BRAND / "beejunior-logo-source.png").resolve():
        (BRAND / "beejunior-logo-source.png").write_bytes(SRC.read_bytes())
    raw, box = transparent_logo(SRC)
    full = trim(raw)
    save(full, "logo-full.webp", (800, round(800 * full.height / full.width)))

    # Mascot/wordmark split measured on the original: bee belly ends y~1150 just above
    # the "J"; the "i" dot (x>1330) starts y~1145, sparkles end y~1135.
    alpha = raw.getchannel("A")
    word_only = wordmark_mask(alpha)
    mascot_mask = ImageChops.invert(word_only)
    mascot = raw.copy()
    mascot.putalpha(ImageChops.multiply(alpha, mascot_mask))
    mascot = trim(mascot, 6)
    save(mascot, "mascot.webp", (512, round(512 * mascot.height / mascot.width)))

    word_mask = ImageChops.invert(mascot_mask)
    word = raw.copy()
    word.putalpha(ImageChops.multiply(alpha, word_mask))
    word = trim(word, 2)

    # Header lockup: mascot + wordmark side by side, small file (<20KB)
    mh = 44
    m = mascot.resize((round(mascot.width * mh / mascot.height), mh), Image.LANCZOS)
    wh = 26
    wd = word.resize((round(word.width * wh / word.height), wh), Image.LANCZOS)
    lock = Image.new("RGBA", (m.width + 8 + wd.width, mh), (0, 0, 0, 0))
    lock.paste(m, (0, 0), m)
    lock.paste(wd, (m.width + 8, (mh - wh) // 2 + 2), wd)
    scale = 2
    lock2 = Image.new("RGBA", (lock.width * scale, mh * scale), (0, 0, 0, 0))
    m2 = mascot.resize((m.width * scale, mh * scale), Image.LANCZOS)
    w2 = word.resize((wd.width * scale, wh * scale), Image.LANCZOS)
    lock2.paste(m2, (0, 0), m2)
    lock2.paste(w2, ((m.width + 8) * scale, ((mh - wh) // 2 + 2) * scale), w2)
    save(lock2, "logo-lockup.webp", None, quality=82)

    # Favicons from the mascot, on a sky-blue rounded tile for legibility at 16px
    def tile(size: int, inset: float, rounded: bool, bg=SKY) -> Image.Image:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        dd = ImageDraw.Draw(canvas)
        if rounded:
            dd.rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 5, fill=bg + (255,))
        else:
            dd.rectangle((0, 0, size, size), fill=bg + (255,))
        inner = int(size * inset)
        mm = mascot.copy()
        mm.thumbnail((inner, inner), Image.LANCZOS)
        canvas.paste(mm, ((size - mm.width) // 2, (size - mm.height) // 2), mm)
        return canvas

    def face(size: int) -> Image.Image:
        return tile(size * 4, 0.92, True).resize((size, size), Image.LANCZOS)

    save(face(32), "icon.png", dest=WEB / "app")
    ico_imgs = [face(s) for s in (16, 32, 48)]
    ico_imgs[2].save(WEB / "app" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico_imgs[:2])
    save(tile(192 * 4, 0.92, True).resize((192, 192), Image.LANCZOS), "icon-192.png", dest=WEB / "public")
    save(tile(512 * 4, 0.92, True).resize((512, 512), Image.LANCZOS), "icon-512.png", dest=WEB / "public")
    # Maskable: full-bleed background, mascot inside the central 80% safe zone
    for s in (192, 512):
        big = tile(s * 2, 0.62, False).resize((s, s), Image.LANCZOS)
        save(big.convert("RGB"), f"icon-maskable-{s}.png", dest=WEB / "public")
    apple = tile(720, 0.74, False, bg=SKY).resize((180, 180), Image.LANCZOS).convert("RGB")
    save(apple, "apple-icon.png", dest=WEB / "app")

    # OG image 1200x630: cream background, full logo centred, yellow/sky bands
    og = Image.new("RGB", (1200, 630), CREAM)
    dd = ImageDraw.Draw(og)
    dd.rectangle((0, 0, 1200, 14), fill=YELLOW)
    dd.rectangle((0, 616, 1200, 630), fill=SKY)
    logo = full.copy()
    logo.thumbnail((860, 440), Image.LANCZOS)
    og.paste(logo, ((1200 - logo.width) // 2, 60), logo)

    og.save(BRAND / "og-image.png", optimize=True)
    print("og-image", og.size, (BRAND / "og-image.png").stat().st_size)


if __name__ == "__main__":
    main()
