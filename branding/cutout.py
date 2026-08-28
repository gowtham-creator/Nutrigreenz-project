import sys
from rembg import remove, new_session
from PIL import Image

src = "/Users/gowthamreddy/Downloads/pomelli_photoshoot_image_9_16_0609.png"
out_dir = "/Users/gowthamreddy/nutrigreenz project/branding/previews"

img = Image.open(src).convert("RGBA")
print("input size:", img.size)

# u2net is good for general objects; alpha matting cleans glass edges
session = new_session("u2net")
cut = remove(
    img,
    session=session,
    alpha_matting=True,
    alpha_matting_foreground_threshold=240,
    alpha_matting_background_threshold=20,
    alpha_matting_erode_size=8,
)
cut.save(f"{out_dir}/jar-cutout.png")

# composite over pure white
white = Image.new("RGBA", cut.size, (255, 255, 255, 255))
white.alpha_composite(cut)
white.convert("RGB").save(f"{out_dir}/jar-white.png", quality=95)
print("saved jar-cutout.png and jar-white.png")
