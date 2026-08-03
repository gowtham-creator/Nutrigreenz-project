# Label work — checkpoint

Paused to clear the app task queue, then payment gateway, then gallery images.
**Resume here.**

## Where it stands

The generator is `code-labels/build.mjs` + `label.css`. Run:

```bash
cd nutrigreenz-packaging/code-labels
node build.mjs                  # every SKU
node build.mjs a2-bilona-500    # one
```

Output → `../50_exports/print/` as PDF (printer) and PNG (review).
Latest copies also in `~/Downloads/nutrigreenz-labels/code-built/`.

## Built and clean

| SKU | Jar | Label |
|---|---|---|
| A2 Bilona Ghee 250 ml | ⌀62 × 72mm | 206 × 78mm |
| A2 Bilona Ghee 500 ml | ⌀75 × 95mm | 247 × 101mm |
| A2 Bilona Ghee 1 L | ⌀95 × 118mm | 309 × 124mm |
| Cultured Buffalo Ghee 500 ml | ⌀75 × 95mm | 247 × 101mm |
| Groundnut Oil 1 L | ⌀85 × 132mm | 278 × 138mm |

Label size is computed — `wrap = π × jarDia + 5mm overlap`, `height = wallH`.
Change those two numbers in `build.mjs` and the artwork follows.

## The three-panel restructure is DONE — 4 of 5 SKUs clean

The golden face flows in **two columns** now. It was stacked in one, which
overflowed every jar below a litre; spending the panel's width instead of
height it does not have fixed all but the smallest jar.

```
a2-bilona-500     clean
a2-bilona-1l      clean
groundnut-oil-1l  clean
buffalo-500       clean
⚠ a2-bilona-250   zone--legal overflows WIDE by 62mm at the type floor
```

### Three things fixed along the way

1. **`label.css` still declared four grid columns** after the nutrition panel was
   folded into the golden face. `build.mjs` set three inline so it rendered
   correctly, but the stylesheet was lying about the structure.
2. **The overflow detector only measured height.** Once content flowed in
   columns it spilled *sideways* and was clipped by `overflow:hidden` —
   invisible to the check. It measures both axes now. The first two-column
   build looked perfect and had a clipped nutrition table.
3. **The 100% PURE seal was clipping the allergen declaration.** It was absolutely
   positioned over the golden face and the second column ran underneath it.
   Removed rather than moved: it duplicated the "100% Pure" line already on the
   display face, and an allergen statement is the one thing on that panel that
   must never be obscured.

### The 250 ml is a real constraint, not a layout bug

At ⌀62 × 72mm the golden face is ~95 × 71mm. The full statutory set plus a
13-row nutrition table needs roughly 1.65× that area at the 5pt floor. It does
not fit, and shrinking type further is not an option.

**Note those jar dimensions are a guess** — see "Blocked on the client" below.
A real 250ml ghee jar is often nearer ⌀70 × 80mm, which may resolve it outright.
Do not redesign around invented numbers; get the dieline first.

## Design decisions already settled — don't relitigate

- **Wordmark only.** `NG_wordmark.png` (name + tagline). No N monogram anywhere,
  on labels or product images. Client instruction.
- **Green** is `#12351F` / `#0C2616` — deepened per the client's reference.
- **Brand face running order**, identical at every size: quote + story →
  Manufactured & Marketed by → fssai mark + licence → feedback line → social
  icons with handle → Swachh Bharat / ZED / ISO / recycle + PRODUCT OF INDIA →
  barcode → website URL.
- **Same structure at every pack size.** What made this possible was moving
  ingredients/storage/best-before off the brand face onto the golden one.
- **No competitor asset, name, logo or copy** anywhere in this system.

## Placeholders — anything magenta

`<<14-DIGIT>>`, `<<kcal>>`, `<<g>>`, `<<%>>`, `<<n>>`. Search `<<`.

The **ZED / ISO / Swachh Bharat marks are dashed placeholder chips**, not drawn
logos. Each is a registered mark with its own usage rules — drawing one by hand
would be a false claim on a pack. Client is supplying the artwork.

## Blocked on the client

1. **Vendor dieline.** All sizes above are standard-jar build targets, not
   measured dies. `DIMENSIONS_UNCONFIRMED` is on every file.
2. **FSSAI licence number**, and whether it is the manufacturer's or marketer's.
3. **Lab COA** for every nutrition figure.
4. **GS1 prefix** — the barcode is drawn bars, deliberately not scannable.
5. **ZED / ISO / Swachh Bharat artwork**, as vector.
6. **CMYK conversion.** The PDF is RGB. The greens, the golden field and the
   brass need Pantone or CMYK builds drawn down on the real stock — green shifts
   hard between coated paper, tin and pouch.
7. **Veg-mark green** is prescribed by regulation; confirm the exact value
   rather than brand-matching it.
8. A **labelling consultant** should sign off the first artwork per category.

## Still to build

- Ghee: Vedic Bilona, Pure Ghee, and the remaining sizes
- Oils: sesame, mustard, coconut, olive, safflower × 8 SKUs each
- Honey: 4 products
- Rice: Sona Masoori, once prices exist

Each is one entry in the `SKUS` array — the layout is shared.

## Superseded

`scripts/20-*.jsx` … `51-*.jsx` are the Illustrator route. Kept for the record
only. Sixteen versions of the ghee label, most of them fixing an overlap the
previous fix had caused — every element sat at a hand-computed millimetre, so
one type-size change meant re-deriving a dozen offsets. That is why this moved
to HTML/CSS, where the browser does the layout and blocks cannot collide by
construction.
