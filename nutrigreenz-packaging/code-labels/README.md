# Code-built labels

Wrap labels generated from a spec and exported straight to print-ready PDF.

```bash
cd nutrigreenz-packaging/code-labels
node build.mjs                 # every SKU
node build.mjs a2-bilona-500   # one
```

Output lands in `../50_exports/print/` as PDF (for the printer) and PNG (for
review).

## Why this replaced the Illustrator scripts

The ExtendScript route positioned every element at a hand-computed millimetre.
Changing one type size meant re-deriving a dozen y-offsets and re-running to see
what collided — sixteen versions of the ghee label, most of them fixing an
overlap the previous fix caused.

Here the browser does the layout. Flexbox and grid keep blocks apart by
construction, text wraps instead of overflowing, and `mm` in CSS maps 1:1 onto
the PDF page.

## Label size is computed, not guessed

```
wrap length = π × jar diameter + 5mm overlap
height      = the jar's straight wall
```

Change `jarDia` / `wallH` in `build.mjs` and the artwork follows. Every earlier
version used one 280×120mm example from the brief for every SKU, which is why
the artwork never matched a real container.

| SKU | Jar | Label |
|---|---|---|
| A2 Bilona 250 ml | ⌀62 × 72mm | 206 × 78mm |
| A2 Bilona 500 ml | ⌀75 × 95mm | 247 × 101mm |
| A2 Bilona 1 L | ⌀95 × 118mm | 309 × 124mm |
| Cultured Buffalo 500 ml | ⌀75 × 95mm | 247 × 101mm |

**DIMENSIONS_UNCONFIRMED** — these are standard squat-jar sizes. Replace with the
vendor's measured dieline before any plate is cut.

## Auto-fit, with a floor

Each zone is measured against its box and its type scaled down until it fits.
The floor is ~5pt, because FSSAI sets a 1mm minimum height for general
declarations. **If a zone still overflows at the floor the build prints a
warning rather than shipping clipped legal copy** — silently cropping an
allergen line is the one failure that must never reach a press.

That guard is what surfaced the 250ml problem below.

## The 250 ml is a different layout, deliberately

A 195 × 72mm wrap cannot carry the full statutory block twice, a 13-row
nutrition table and the variable-data block at legible type. So small packs:

- drop the golden statutory repeat and run **three zones** instead of four
- move the barcode and overprint fields to a **full-width footer strip**
- use a **condensed nutrition table** (8 mandatory rows) and a one-line address

**Whether that shortening is permitted at this pack size is a question for the
labelling consultant.** FSSAI has small-package provisions; the exact thresholds
are not asserted here.

## Anything magenta is a placeholder

`<<14-DIGIT>>`, `<<kcal>>`, `<<g>>`, `<<%>>` and the rest are deliberately loud.
An invented FSSAI number or a plausible calorie figure is far more dangerous
than an obvious blank. Search `<<` to find them all.

## Still needed before print

1. **Vendor dieline** — the numbers above are build targets, not measured dies.
2. **FSSAI licence number**, and whether it is the manufacturer's or marketer's.
3. **Lab COA** for every nutrition figure.
4. **GS1 prefix** — the barcode is drawn bars, deliberately not scannable.
5. **CMYK conversion.** The PDF is RGB; the greens, the golden field and the
   brass need Pantone or CMYK builds drawn down on the real stock. Green shifts
   hard between coated paper, tin and pouch.
6. **Veg-mark green** is prescribed by regulation — confirm the exact value
   rather than brand-matching it.
7. A **labelling consultant** should sign off the first artwork of each category.

## Files

| | |
|---|---|
| `build.mjs` | SKU spec, layout, motif generator, PDF/PNG export |
| `label.css` | All styling, in mm and pt |
| `../20_assets/fonts/` | Roboto Slab, Hanken Grotesk, Noto Sans (rupee glyph) |
| `../20_assets/icons/NG_wordmark.png` | The wordmark lockup — no monogram |
