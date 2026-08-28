from PIL import Image, ImageDraw, ImageFilter

# Cut the real labeled bottle out of its white studio background by flood-filling
# transparency from the frame edges (the label's internal cream is enclosed by the
# bottle/label outlines, so it is preserved), then drop it onto the warm hero
# canvas that matches the oils slide wash — realistic AND properly branded.
src = Image.open("branding/oils/groundnut-01-front-final.png").convert("RGBA")
w, h = src.size
seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1)]
for sp in seeds:
    try:
        ImageDraw.floodfill(src, sp, (0, 0, 0, 0), thresh=40)
    except Exception:
        pass

bbox = src.getbbox()
bottle = src.crop(bbox)

W, H = 2000, 849
canvas = Image.new("RGBA", (W, H), (243, 233, 201, 255))  # #F3E9C9 wheat/cream

bw, bh = bottle.size
target_h = int(H * 0.95)
scale = target_h / bh
nb = bottle.resize((max(1, int(bw * scale)), target_h), Image.LANCZOS)
nbw, nbh = nb.size
x = W - nbw - 110
y = (H - nbh) // 2 + 6

# Soft grounding shadow.
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
shcol = Image.new("RGBA", nb.size, (70, 52, 22, 85))
shadow.paste(shcol, (x + 16, y + 22), nb.split()[3])
shadow = shadow.filter(ImageFilter.GaussianBlur(20))
canvas.alpha_composite(shadow)
canvas.alpha_composite(nb, (x, y))

canvas.convert("RGB").save("branding/tmp-oils-hero.png", quality=95)
print("saved", canvas.size, "bottle-cropped", bottle.size)
