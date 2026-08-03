# BUILD — Nutri Greenz label system

## Regenerate

```bash
osascript -e 'tell application "Adobe Illustrator" to do javascript file \
"<repo>/nutrigreenz-packaging/scripts/30-full-label.jsx"'
```

One script builds the whole flat. It closes any open documents first and
suppresses alerts — earlier runs left eleven documents open and Illustrator
stopped answering AppleEvents for three hours.

Scripts 20/21/22/23 are superseded by 30. Kept for the record only.

## Current output — NG-OIL-GN-1L-GLASS

`40_skus/NG-OIL-GN-1L-GLASS_FLAT_v07.ai`
`50_exports/print/NG-OIL-GN-1L-GLASS_FLAT_v07.png` (300 dpi)

286×126mm (280×120 + 3mm bleed), CMYK, 9 named layers, guides locked and
non-printing. Four panels: FRONT · NUTRITION · STORY · GLUE FLAP.

### Real assets placed, not redrawn

| Asset | Source | Notes |
|---|---|---|
| Brandmark | `public/brand/logo-stacked.png` | The actual N-leaf monogram, wordmark and "Born in Soil, built for tomorrow" tagline. ~700 dpi at 36mm. **Raster — ask the client for the vector master.** |
| Botanical hero | Köhler's *Medizinal-Pflanzen*, 1887 | Public domain, verified on the specific Wikimedia file record (Copyrighted = False). Toned to the palette, paper keyed to alpha. ~1400 dpi. |
| Veg mark | Drawn to the regulatory spec | Filled circle inside a square outline. Geometry is prescribed, not creative. **Confirm the exact green.** |

### Component inventory (from the client's own reference photos)

**Front** logo · `~ LAKDI GHANI EXTRACTION ~` with tilde flourishes · ghani-press
icon · product name · script line · COLD PRESSED · botanical · three trust
roundels with captions · closing couplet · veg mark · trace QR

**Nutrition** circular badge with text on a curved path · centred info rows
separated by hairlines · gold keyline table with %RDA column, indented sub-rows
and footnote · white overprint sticker

**Story** botanical · opening quote · gold keyline box holding script headline
and story · closing quote · Manufactured & Marketed by · FSSAI block · feedback
line · social · recycling marks · PRODUCT OF INDIA · barcode · website

## Blocked — client input, not code

1. **Bottle dimensions.** 280×120 with 4×70mm panels is the brief's example.
   `DIMENSIONS_UNCONFIRMED` watermark is on the dieline layer. Need
   circumference, label height, shoulder clearance. Wrap = circumference + 3–5mm.
2. **FSSAI logo + licence number.** The mark comes with the licence pack. It is
   a registered regulatory logo and is NOT recreated by hand here — the panel
   carries a flagged placeholder box.
3. **Nutrition values.** Every figure is `<<placeholder>>` pending lab COA.
4. **Vector logo master.** Currently a 1110px raster.
5. **Script typeface.** "Genuinely & Traditionally" and the story headline are
   set in Roboto Slab Light. The reference uses a true calligraphic face and that
   is the main remaining reason it reads richer. One script line is all the brief
   allows — Cormorant Infant Italic (OFL) is a free option.
6. **GS1 prefix.** Barcode is drawn bars, deliberately not scannable.
7. **Swachh Bharat / ZED / ISO marks** — client supplying.
8. **Gold: foil or CMYK build?** Decides how the swatch is specified.

## Anything magenta is a placeholder

Search `<<` to find every one.

## Not carried over, by client instruction

No competitor logo, asset, copy or naming appears anywhere in this system.
24 competitor asset files were also removed from the storefront's `public/`
folder, where they had been publicly served.
