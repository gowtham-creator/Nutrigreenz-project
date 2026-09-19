# Botanical artwork — provenance

All six SVGs are Image Traces of one plate: **Arachis hypogaea ("Arachide")**
from Vilmorin-Andrieux & Cie, *Les Plantes Potagères*, Paris, 1904. The plate is
a wood engraving, published 1904, and is in the **public domain** worldwide.

Source raster: `../vilmorin-1904-arachide.png` (2089 × 2886, 1-bit).
Full provenance and the Wikimedia Commons URL: `../vilmorin-1904-arachide.SOURCE.txt`.

## Why this plate and not Köhler

The Köhler 1887 plate (source record: `../koehler-1887-arachis-hypogaea.SOURCE.txt`;
the 6 MB image itself is kept out of the repo) is a colour chromolithograph. Its foliage
is rendered in tone, not line, so it flattens to black silhouettes at every
threshold, and Image Trace cannot recover leaf structure from it. The Vilmorin
plate is a true line engraving, so it traces cleanly — and its botany is right:
four leaflets per node, yellow pea flowers, pods on pegs below ground.

## Files

| SVG | Paths | Trim | Use |
|---|---|---|---|
| `ng-groundnut-pod-whole-*` | 425 | 65 × 53 mm | front-panel hero, 42 mm |
| `ng-groundnut-pod-split-*` | 362 | 76 × 40 mm | alternate hero, shows the kernels |
| `ng-groundnut-plant-*` | 1993 | 156 × 127 mm | ground art at 8–12% opacity |
| `ng-groundnut-flower-*` | 42 | 30 × 21 mm | small accent, side panels |
| `ng-groundnut-pods-*` | 831 | 144 × 55 mm | both pod studies together |

`-gold` is a flat `#B8912F` fill on every path, `-black` is the untinted master.
No strokes, no embedded raster, no clipping — so they recolour with a string
replace and separate onto a Pantone 871 C foil plate without further work.

## How they were made

1. Crop the region from the plate at 300 ppi (`vilmorin-*-300dpi.png`).
   The DPI tag matters: the first attempt carried 1200 ppi, which placed 1700 px
   into 36 mm and Image Trace merged every hatch line into a solid blob.
2. Paint out fragments intruding from neighbouring figures on the plate.
3. Illustrator → duplicate the placed image → Image Trace, **lineArt** preset →
   expand. Never trace the original.
4. Recolour every path to `#B8912F`, export SVG with presentation attributes.

## Scale limit

This plate was engraved for roughly 120 mm reproduction. Below about 35 mm the
hatching optically fills in and the art turns to mud — which is why the hero is
one pod at 42 mm rather than the whole plant or both pod studies.
