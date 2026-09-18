"""
สร้างไอคอนเว็บทั้งชุดจากต้นฉบับ `assets/icon-only.png` (ADR-088 · เฟส 13 ก้อนที่ 26)

รัน:  python scripts/make-icons.py      (ต้องมี Pillow — `pip install pillow`)
แก้รูปต้นฉบับแล้วรันใหม่ได้เลย ไฟล์ใน `public/` ถูกเขียนทับทั้งชุด

- ขนาดเล็ก (favicon.ico 16/32/48) ใช้ **ตัวคิวบ์อย่างเดียว** — วงเล็บน้ำเงิน/แดงรอบนอก
  ย่อเหลือ 16 px แล้วกลายเป็นจุดเลอะ แย่งพื้นที่ตัวคิวบ์
- ขนาดใหญ่ (180/192/512) ใช้ภาพเต็ม
- `apple-touch-icon` กับ `icon-maskable-512` พื้นทึบสี navy — iOS เติมพื้นโปร่งใสเป็นดำ
  และ Android ตัดไอคอน maskable เป็นวงกลม/สี่เหลี่ยมมน ต้องมีพื้นเต็มผืน
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "icon-only.png"
PUBLIC = ROOT / "public"

# สีเดียวกับ <meta name="theme-color"> ใน index.html
NAVY = (10, 21, 36, 255)


def convex_hull(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """monotone chain"""
    points = sorted(set(points))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[int, int]] = []
    upper: list[tuple[int, int]] = []
    for p in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def cube_only(source: Image.Image) -> Image.Image:
    """
    ตัดเฉพาะตัวคิวบ์ — เส้นขอบ/ร่องของคิวบ์เป็นสีเข้มเกือบดำ ส่วนวงเล็บเป็นน้ำเงิน/แดงสด
    → convex hull ของพิกเซลทึบสีเข้ม = รูปหกเหลี่ยมของคิวบ์พอดี แล้วลบทุกอย่างนอกรูปนั้นทิ้ง
    (กรอบสี่เหลี่ยมใช้ไม่ได้ — ปลายวงเล็บยื่นเข้ามาในมุมกรอบ)
    """
    px = source.load()
    dark = [
        (x, y)
        for y in range(0, source.height, 2)
        for x in range(0, source.width, 2)
        if px[x, y][3] > 200 and max(px[x, y][:3]) < 60
    ]
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).polygon(convex_hull(dark), fill=255)
    # ขยายเผื่อขอบ 2–3 px ให้เส้นขอบนอกสุดของคิวบ์ไม่แหว่ง
    mask = mask.filter(ImageFilter.MaxFilter(5))
    alpha = Image.composite(source.getchannel("A"), mask, mask)
    cut = source.copy()
    cut.putalpha(alpha)
    return cut.crop(mask.getbbox())


def fit(image: Image.Image, size: int, content_ratio: float, background=None) -> Image.Image:
    """วางภาพกลางผืนจัตุรัส `size` ให้ด้านยาวกิน `content_ratio` ของผืน"""
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    target = round(size * content_ratio)
    scale = target / max(image.size)
    w, h = max(1, round(image.width * scale)), max(1, round(image.height * scale))
    resized = image.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - w) // 2, (size - h) // 2))
    return canvas


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    full = source.crop(source.getchannel("A").getbbox())
    cube = cube_only(source)
    PUBLIC.mkdir(exist_ok=True)

    # แท็บเบราว์เซอร์ — ตัวคิวบ์เต็มผืน ไม่เว้นขอบ (16 px ทุกพิกเซลมีค่า)
    ico_base = fit(cube, 256, 1.0)
    ico_base.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    # หน้าจอหลัก
    fit(full, 180, 0.84, NAVY).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)
    fit(full, 192, 0.96).save(PUBLIC / "icon-192.png", optimize=True)
    fit(full, 512, 0.96).save(PUBLIC / "icon-512.png", optimize=True)
    # maskable: เนื้อหาต้องอยู่ในวงกลมรัศมี 40% ของผืน (safe zone) → ภาพกว้าง ~70%
    fit(full, 512, 0.70, NAVY).convert("RGB").save(PUBLIC / "icon-maskable-512.png", optimize=True)

    for name in sorted(p.name for p in PUBLIC.iterdir()):
        print(f"{name:26} {(PUBLIC / name).stat().st_size / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
