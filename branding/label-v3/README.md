# Groundnut Oil 1 L — label artwork

**Status: design proof for client sign-off. Not press-ready.** Four inputs are
missing and none of them were invented — see *Blockers* below.

## Files

| File | Use |
|---|---|
| `..._FRONT_v01_EDITABLE.svg` | Open in Illustrator to edit. Live text. |
| `..._BACK_v01_EDITABLE.svg` | Live text. |
| `..._FRONT_v01_OUTLINED.svg` | Type converted to paths. Give this to a printer. |
| `..._BACK_v01_OUTLINED.svg` | Type converted to paths. |
| `preview-front.png` / `preview-back.png` | 300 dpi proofs for the client. |
| `fonts/` | The two brand faces + a fallback, with their licences. |
| `build-label.mjs` | Regenerates everything: `node branding/label-v3/build-label.mjs` |

## Opening in Illustrator

File → Open the **EDITABLE** SVG. Then:

1. **Install the fonts first** — `fonts/RobotoSlab[wght].ttf` and
   `fonts/HankenGrotesk[wght].ttf`. Illustrator does not read the fonts embedded
   in the SVG, so without installing them the text substitutes and the design
   changes. If you only need to look at it, open the OUTLINED file instead.
2. **Document colour mode → CMYK.** The file is RGB because SVG cannot carry
   CMYK or spot colours. This conversion is a decision, not a formality — see
   Blocker 2.
3. **Assign the `CutContour` spot to the DIELINE layer**, set it to overprint,
   and mark the layer non-printing. Same for `SAFE-ZONE`.

Layers come through named: `BACKGROUND`, `TYPE`, `HERO-PLACEHOLDER`,
`TRACEABILITY`, `MANDATORY`, `SAFE-ZONE`, `DIELINE`.

## Anything magenta is a placeholder

Every unresolved value is set in magenta so it cannot quietly survive to press.
Search for `<<` to find them all.

## Blockers before this can print

1. **The dieline.** 95 × 120 mm is a build target from `Label-Spec.md`, not a
   measured die. It is also almost certainly a **front panel, not a wrap** —
   `Label-Spec.md` calls it a wrap, but a 1 L bottle is roughly 250–300 mm
   around, so 95 mm cannot go round it. Get the vendor's `.ai` or `.dxf` and the
   real wrap length before anything else; every dimension here depends on it.
2. **Colour.** The greens and the brass need Pantone spots or CMYK builds, drawn
   down on the actual label stock. Green shifts hard between coated paper, tin
   and pouch. The veg-mark green is **prescribed by regulation** — get the exact
   specified value, do not brand-match it.
3. **Nutrition figures.** Every number is `<<placeholder>>` pending a lab COA.
   Printing typical published values for "groundnut oil" would be a
   misdeclaration under FSSAI 2020 if the actual figures differ, and for
   cold-pressed oils they routinely do.
4. **FSSAI licence number**, and whether it is the manufacturer's or the
   marketer's. Both are required if they differ.

Also outstanding: a **vector logo master** (the wordmark here is set in Roboto
Slab, not the real mark), an **approved hero image**, and a **GS1 prefix** for
the barcode.

## Two deliberate design decisions

**The three badge roundels are gone.** The current bottle mockups carry
`FIRST PRESS` / `0% CHOLESTEROL` / `RICH IN OMEGA`. "0% cholesterol" is true of
every vegetable oil and is a regulated nutrient claim; "rich in omega" needs a
substantiated figure to stand. They are also the exact generic-wellness language
the brand's own homepage positions against.

In their place is the **traceability strip** — lot, farm, district, QR. That is
the thing this brand can print and its competitors cannot.

**The hero frame is empty and flagged.** The existing hero is an AI-rendered
peanut bowl at roughly 269 DPI, below press minimum, and identical across sizes.
Leaving the frame visibly empty is more useful than filling it with something
that cannot print.

## Notes from building it

Three defects were caught and fixed here that are worth knowing about, because
they recur:

- The first proof rendered in **Helvetica**. Naming a font in an SVG only works
  if the opening machine has it; embedding it as base64 does not help either,
  because neither librsvg nor Illustrator honours `@font-face` on SVG import.
  Hence the outlined variant.
- **₹ rendered as an empty box.** Neither Roboto Slab nor Hanken Grotesk carries
  U+20B9, and MRP in rupees is a mandatory declaration. A glyph-level fallback to
  Noto Sans now covers it.
- The back panel **overflowed the dieline** and three visual passes missed it.
  The generator now measures content height against the safe zone and refuses
  quietly to pass.
