"""
Photoreal label compositing without Photoshop.
Technique: honey fill -> cylindrical warp of the flat label -> vertical bow ->
lighting transfer from the real jar luminance -> glass reflection over the label.
"""
import sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

prev = "/Users/gowthamreddy/nutrigreenz project/branding/previews"
PRESETS = {
    "honey": ("honey", (236, 174, 60), (140, 84, 16), 0.15),
    "ghee":  ("ghee",  (244, 216, 132), (190, 146, 50), 0.13),
}
key = sys.argv[1] if len(sys.argv) > 1 else "honey"
label_name, c_top, c_bot, fill_frac = PRESETS[key]

# ---------- load jar + geometry ----------
cut = Image.open(f"{prev}/jar-cutout.png").convert("RGBA")
W, H = cut.size
arr = np.asarray(cut).astype(np.float32)
alpha = arr[..., 3] / 255.0
bbox = cut.split()[3].getbbox()
jx0, jy0, jx1, jy1 = bbox
jw, jh = jx1 - jx0, jy1 - jy0
cx = (jx0 + jx1) / 2.0
r = jw / 2.0
luma = 0.299*arr[..., 0] + 0.587*arr[..., 1] + 0.114*arr[..., 2]

# ---------- 1. fill with honey, keep glass reflections ----------
fill_top = int(jy0 + fill_frac * jh)
ys = np.arange(H).reshape(H, 1)
t = np.clip((ys - fill_top) / max(1, (jy1 - fill_top)), 0, 1)
honey = np.zeros((H, W, 3), np.float32)
for i in range(3):
    honey[..., i] = c_top[i] + (c_bot[i] - c_top[i]) * t
m = np.clip(0.58 + (luma / 255.0) * 0.9, 0.5, 1.55)[..., None]
honey_shaded = np.clip(honey * m, 0, 255)
fill_a = (alpha * (ys >= fill_top) * 0.92)[..., None]
body_rgb = arr[..., :3] * (1 - fill_a) + honey_shaded * fill_a
jar = np.dstack([body_rgb, arr[..., 3]]).astype(np.float32)

# ---------- 2. cylindrical warp of the label ----------
label = Image.open(f"{prev}/front-{label_name}.png").convert("RGBA")
L = np.asarray(label).astype(np.float32)
Lh, Lw = L.shape[:2]

WRAP = 0.86                      # projected label width / body width
proj_half = WRAP * r
theta_m = math.asin(min(0.999, proj_half / r))
band_top = jy0 + 0.265 * jh
band_h = (2 * proj_half) / (Lw / Lh)   # keep label aspect at the centre
band_h = min(band_h, 0.52 * jh)
BOW = 0.045 * band_h             # vertical curve at the sides

x0 = int(cx - proj_half); x1 = int(cx + proj_half)
y0 = int(band_top); y1 = int(band_top + band_h)
sx = np.arange(x0, x1); sy = np.arange(y0, y1)
GX, GY = np.meshgrid(sx, sy)                      # absolute coords of sub-rect
dx = (GX - cx) / r
dx = np.clip(dx, -math.sin(theta_m), math.sin(theta_m))
theta = np.arcsin(dx)
U = (theta / theta_m * 0.5 + 0.5) * (Lw - 1)      # horizontal cylinder map
frac = (GX - cx) / proj_half
Vbase = (GY - y0) / max(1, (y1 - y0 - 1)) * (Lh - 1)
V = Vbase + BOW * (frac**2) * (Lh / band_h)       # smile/frown bow

def bilinear(src, U, V):
    Hh, Ww = src.shape[:2]
    u0 = np.floor(U).astype(int); v0 = np.floor(V).astype(int)
    fu = (U - u0)[..., None]; fv = (V - v0)[..., None]
    u0c, u1c = np.clip(u0, 0, Ww-1), np.clip(u0+1, 0, Ww-1)
    v0c, v1c = np.clip(v0, 0, Hh-1), np.clip(v0+1, 0, Hh-1)
    a = src[v0c, u0c]; b = src[v0c, u1c]; c = src[v1c, u0c]; d = src[v1c, u1c]
    return (a*(1-fu)+b*fu)*(1-fv) + (c*(1-fu)+d*fu)*fv

warp = bilinear(L, U, V)                          # (h,w,4)
warp_rgb = warp[..., :3]
warp_a = warp[..., 3] / 255.0

# ---------- 3. matte-paper shading (cylinder + window-from-left) ----------
# A paper label is opaque & matte: it must NOT mirror the glass's specular
# reflections. It only takes gentle cylinder shading + soft directional light.
sub_alpha = alpha[y0:y1, x0:x1]
cyl = np.clip(np.cos(theta), 0.0, 1.0)            # 1 centre -> 0 at the sides
shade = 0.82 + 0.18 * cyl                          # 0.82..1.00 across the curve
window = np.clip(1.0 + 0.09 * (-frac), 0.90, 1.12) # window on the left -> brighter
light = shade * window
lit = np.clip(warp_rgb * light[..., None], 0, 255)

# one soft broad window-sheen in the upper-left (subtle, not blown out)
yy = (GY - y0) / max(1, (y1 - y0))
sheen = np.clip(1 - ((frac + 0.45)**2 * 3 + (yy - 0.30)**2 * 4), 0, 1) * 22
lit = np.clip(lit + sheen[..., None], 0, 255)

# label only where the jar is opaque
eff_a = warp_a * (sub_alpha > 0.5)

# ---------- 5. composite onto jar ----------
sub_jar = jar[y0:y1, x0:x1, :3]
jar[y0:y1, x0:x1, :3] = sub_jar * (1 - eff_a[..., None]) + lit * eff_a[..., None]
jar_img = Image.fromarray(np.clip(jar, 0, 255).astype(np.uint8), "RGBA")

# soft seat-shadow under the label edge
seat = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(seat).rounded_rectangle([x0+4, y0+6, x1-4, y1+6], radius=16, outline=(20,12,4,70), width=6)
jar_img.alpha_composite(seat.filter(ImageFilter.GaussianBlur(6)))

# tight-crop the transparent jar and export it for campaign layouts
jb = jar_img.split()[3].getbbox()
jar_img.crop(jb).save(f"{prev}/jar-pro-{key}.png")

# ---------- 6. white plate + contact shadow + finalize ----------
plate = Image.new("RGBA", (W, H), (255, 255, 255, 255))
sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(sh).ellipse([cx - jw*0.5, jy1 - jh*0.045, cx + jw*0.5, jy1 + jh*0.07], fill=(40,28,12,130))
plate.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26)))
plate.alpha_composite(jar_img)
plate.convert("RGB").save(f"{prev}/mockup-pro-{key}.png", quality=95)
print(f"saved mockup-pro-{key}.png | theta_m={math.degrees(theta_m):.0f}deg band=({x0},{y0})-({x1},{y1}) bow={BOW:.1f}")
