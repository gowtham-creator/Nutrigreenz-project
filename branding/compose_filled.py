import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

prev = "/Users/gowthamreddy/nutrigreenz project/branding/previews"

# product -> (label name, top fill colour, bottom fill colour, fill-line fraction)
PRESETS = {
    "honey": ("honey", (232, 170, 64), (150, 92, 20), 0.24),
    "ghee":  ("ghee",  (242, 214, 130), (196, 150, 54), 0.20),
    "oil":   ("oil",   (232, 200, 110), (198, 150, 48), 0.16),
}
key = sys.argv[1] if len(sys.argv) > 1 else "honey"
label_name, c_top, c_bot, fill_frac = PRESETS[key]

cut = Image.open(f"{prev}/jar-cutout.png").convert("RGBA")
W, H = cut.size
arr = np.asarray(cut).astype(np.float32)
alpha = arr[..., 3] / 255.0
bbox = cut.split()[3].getbbox()
jx0, jy0, jx1, jy1 = bbox
jw, jh = jx1 - jx0, jy1 - jy0
fill_top = int(jy0 + fill_frac * jh)

# ---- honey gradient (top->bottom) ----
ys = np.arange(H).reshape(H, 1)
t = np.clip((ys - fill_top) / max(1, (jy1 - fill_top)), 0, 1)  # 0 at surface, 1 at base
honey = np.zeros((H, W, 3), np.float32)
for i in range(3):
    honey[..., i] = c_top[i] + (c_bot[i] - c_top[i]) * t  # broadcast over W

# keep glass reflections: modulate honey by the glass luminance
luma = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2])
m = np.clip(0.60 + (luma / 255.0) * 0.85, 0.55, 1.5)[..., None]
honey_shaded = np.clip(honey * m, 0, 255)

# fill only the body (below the fill line), within the jar silhouette
rowmask = (ys >= fill_top).astype(np.float32)
fill_a = (alpha * rowmask * 0.90)[..., None]
rgb = arr[..., :3] * (1 - fill_a) + honey_shaded * fill_a
filled = np.dstack([rgb, arr[..., 3]]).astype(np.uint8)
jar = Image.fromarray(filled, "RGBA")

# meniscus: a soft bright line at the honey surface
md = ImageDraw.Draw(jar)
surf = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(surf)
cx = (jx0 + jx1) // 2
sd.ellipse([jx0 + jw*0.10, fill_top - 8, jx1 - jw*0.10, fill_top + 12],
           fill=(255, 240, 200, 90))
surf = surf.filter(ImageFilter.GaussianBlur(3))
surf.putalpha(ImageChops.multiply(surf.split()[3], jar.split()[3]))
jar.alpha_composite(surf)

# ---- white plate + contact shadow ----
plate = Image.new("RGBA", (W, H), (255, 255, 255, 255))
sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(sh).ellipse([cx - jw*0.46, jy1 - jh*0.05, cx + jw*0.46, jy1 + jh*0.06],
                           fill=(40, 30, 15, 120))
plate.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22)))
plate.alpha_composite(jar)

# ---- label ----
label = Image.open(f"{prev}/front-{label_name}.png").convert("RGBA")
target_w = int(jw * 0.78)
label = label.resize((target_w, int(label.height * target_w / label.width)), Image.LANCZOS)
tw, th = label.size
max_h = int(jh * 0.50)
if th > max_h:
    label = label.resize((int(tw * max_h / th), max_h), Image.LANCZOS)
    tw, th = label.size

# cylinder edge shading
shade = Image.new("L", (tw, 1), 255)
for x in range(tw):
    edge = min(x, tw - 1 - x) / (tw / 2)
    shade.putpixel((x, 0), min(int(185 + 70 * min(edge / 0.32, 1.0)), 255))
shade = Image.merge("RGB", [shade.resize((tw, th))] * 3)
lab_rgb = ImageChops.multiply(label.convert("RGB"), shade)
label = Image.merge("RGBA", (*lab_rgb.split(), label.split()[3]))

px = cx - tw // 2
py = jy0 + int(jh * 0.32)
# label shadow
ls = Image.new("RGBA", (tw + 16, th + 16), (0, 0, 0, 0))
ImageDraw.Draw(ls).rounded_rectangle([8, 8, tw + 8, th + 8], radius=14, fill=(0, 0, 0, 70))
sl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sl.alpha_composite(ls.filter(ImageFilter.GaussianBlur(7)), (px - 8, py - 4))
plate.alpha_composite(sl)
plate.alpha_composite(label, (px, py))

plate.convert("RGB").save(f"{prev}/mockup-final-{key}.png", quality=95)
print(f"saved mockup-final-{key}.png · fill_top={fill_top} label@{(px,py)} size={(tw,th)}")
