from PIL import Image, ImageDraw, ImageFilter, ImageChops
import sys

prev = "/Users/gowthamreddy/nutrigreenz project/branding/previews"
label_name = sys.argv[1] if len(sys.argv) > 1 else "honey"

cut = Image.open(f"{prev}/jar-cutout.png").convert("RGBA")
W, H = cut.size
bbox = cut.split()[3].getbbox()  # alpha bounding box of the jar
jx0, jy0, jx1, jy1 = bbox
jw, jh = jx1 - jx0, jy1 - jy0
print("jar bbox:", bbox, "body w,h:", jw, jh)

# ---- build clean white plate with soft contact shadow ----
plate = Image.new("RGBA", (W, H), (255, 255, 255, 255))
# contact shadow under the jar
sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(sh)
cx = (jx0 + jx1) // 2
sd.ellipse([cx - jw*0.46, jy1 - jh*0.05, cx + jw*0.46, jy1 + jh*0.06],
           fill=(40, 30, 15, 120))
sh = sh.filter(ImageFilter.GaussianBlur(22))
plate.alpha_composite(sh)
plate.alpha_composite(cut)

# ---- prepare the label ----
label = Image.open(f"{prev}/front-{label_name}.png").convert("RGBA")
# target width ~ 78% of jar body width
target_w = int(jw * 0.78)
scale = target_w / label.width
target_h = int(label.height * scale)
# don't let it exceed the glass area (leave room under lid + above base)
max_h = int(jh * 0.52)
if target_h > max_h:
    target_h = max_h
    target_w = int(label.width * (target_h / label.height))
label = label.resize((target_w, target_h), Image.LANCZOS)

# cylinder shading: darken left/right edges (multiply)
shade = Image.new("L", (target_w, 1), 255)
for x in range(target_w):
    t = x / (target_w - 1)
    # edges -> ~0.72 brightness, center -> 1.0
    edge = min(t, 1 - t) * 2  # 0 at edges, 1 at center
    val = int(185 + 70 * min(edge / 0.32, 1.0))  # ramp up quickly
    shade.putpixel((x, 0), min(val, 255))
shade = shade.resize((target_w, target_h))
shade_rgb = Image.merge("RGB", (shade, shade, shade))
lab_rgb = ImageChops.multiply(label.convert("RGB"), shade_rgb)
label = Image.merge("RGBA", (*lab_rgb.split(), label.split()[3]))

# subtle gloss highlight band (center-left) over the label
gloss = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
gd = ImageDraw.Draw(gloss)
gd.ellipse([int(target_w*0.10), -int(target_h*0.1), int(target_w*0.30), int(target_h*1.1)],
           fill=(255, 255, 255, 28))
gloss = gloss.filter(ImageFilter.GaussianBlur(10))
gloss.putalpha(ImageChops.multiply(gloss.split()[3], label.split()[3]))
label.alpha_composite(gloss)

# drop a faint shadow behind the label so it sits on the glass
lshadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
px = cx - target_w // 2
py = jy0 + int(jh * 0.34)
ls = Image.new("RGBA", (target_w + 16, target_h + 16), (0, 0, 0, 0))
ld = ImageDraw.Draw(ls)
ld.rounded_rectangle([8, 8, target_w + 8, target_h + 8], radius=14, fill=(0, 0, 0, 80))
ls = ls.filter(ImageFilter.GaussianBlur(7))
lshadow.alpha_composite(ls, (px - 8, py - 4))
plate.alpha_composite(lshadow)

# place the label
plate.alpha_composite(label, (px, py))

plate.convert("RGB").save(f"{prev}/mockup-real-{label_name}.png", quality=95)
print("saved mockup-real-%s.png  label placed at" % label_name, (px, py), "size", (target_w, target_h))
