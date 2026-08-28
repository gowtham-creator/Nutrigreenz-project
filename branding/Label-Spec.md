# Nutri Greenz — Label Print Spec & Client Checklist

Master artwork: `labels/nutrigreenz-labels.html` · Rendered previews: `previews/`

## What these samples are
Three on-brand label designs — **front face** + **statutory back panel** — for the glass-bottle
range. Built from the live storefront's exact palette, fonts and logo so the packaging and the
website read as one brand. Show the rendered PNGs to the client; the HTML is the editable master.

## Sample set
| # | Product | Pack | Label format | Dieline (W × H) |
|---|---------|------|--------------|-----------------|
| 01 | Cold-Pressed Groundnut Oil | 1 L flint-glass bottle | Wrap (front+back continuous) | 95 × 120 mm |
| 02 | A2 Gir Cow Bilona Ghee | 500 ml amber-glass jar | Front + back stickers | 80 × 95 mm |
| 03 | Wild Forest Honey | 500 g flint-glass jar | Front + back stickers | 80 × 95 mm |

## Print-ready settings (for the printer)
- **Bleed:** +3 mm all sides · **Safe margin:** 4 mm inside the dieline (dashed keyline = cut line, non-printing).
- **Colour:** convert brand hex → CMYK/Pantone before print (Forest ≈ Pantone 5535 C, Clay/gold ≈ 873 C metallic option, Amber ≈ 137 C).
- **Stock:** matte/textured paper or transparent "no-label-look" film; spot-gloss or gold-foil on the leaf mark optional.
- **Resolution:** export at 300 dpi (HTML master can be printed-to-PDF, or re-supplied as vector on approval).

## ⚠️ Client must confirm before production (placeholders used in samples)
- [ ] **FSSAI licence no.** — sample uses `10822005000123` (from site footer). Confirm real number.
- [ ] **Nutrition values** — indicative; replace with figures from each product's **lab COA**.
- [ ] **Net quantity convention** — ghee shown as `500 ml`; confirm if sold by **weight (g)** instead.
- [ ] **MRP, batch & dates** — `NG-…` lot codes, Mfd 04/2026 and best-before windows are samples.
- [ ] **Barcode / EAN** — `8 90123 4567X` is a placeholder; supply real GS1 numbers.
- [ ] **QR target** — the scan-to-trace QR is decorative; wire it to the live traceability page.
- [ ] **Address & support email** — confirm registered address line and `care@nutrigreenz.farm`.
- [ ] **Allergen statement** — confirm shared-facility wording for the oil line.

## How to regenerate previews
```
node branding/render.mjs   # writes previews/sheet-full.png + label-{oil,ghee,honey}.png
```
