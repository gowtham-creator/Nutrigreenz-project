/**
 * FooterScene — a bold, tall, hand-authored tonal farm-landscape illustration
 * for the Nutri Greenz footer. A tonal rural scene
 * (plowing oxen + farmer, watering farmer with a can, crouched harvester,
 * grazing cows, dense stippled trees, radiating sun, terraced fields) rendered
 * a few shades lighter than the deep-forest footer background.
 *
 * Unlike the earlier "whisper" version, this one is meant to clearly READ as an
 * illustration: it is tall (occupies roughly the lower ~60% of the footer and
 * rises up behind the link columns), edge-to-edge dense, with crisp silhouettes
 * and a clearly visible sun — while staying tonal so the cream footer text on
 * top remains perfectly legible.
 *
 * Purely decorative: aria-hidden, pointer-events-none, anchored flush to the
 * bottom and full-bleed via preserveAspectRatio="xMidYMax slice".
 */

// Tonal palette derived from the Nutri Greenz tokens. Lighter greens so the
// silhouettes are clearly readable against the deep-forest background.
const FAR = "#1F4D2E"; // ng-forest-soft — farthest layer / back ridge
const MID = "#2E6B43"; // mid-ground layer — scattered trees, cows
const NEAR = "#3A7E50"; // nearest foreground layer — ground, crop ticks, grass
const FIG = "#4E9A63"; // foreground living figures — brightest so they pop crisply
const LEAF = "#66BF73"; // ng-leaf — small highlights, sun, water droplets
const GLOW = "#B5862F"; // ng-clay — warm sun glow

export function FooterScene() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 z-0 w-full select-none"
    >
      <svg
        className="block h-[300px] w-full sm:h-[380px] md:h-[460px] lg:h-[520px]"
        viewBox="0 0 1440 560"
        preserveAspectRatio="xMidYMax slice"
        role="presentation"
      >
        <defs>
          {/* ---- A single stippled tree: tapered trunk + dotted canopy. ---- */}
          {/* Authored once, reused via <use> with scale/translate transforms. */}
          <g id="ng-tree">
            {/* trunk — tapered */}
            <path
              d="M-2.2 0 C -1.4 -22 -1.1 -42 -0.7 -62 L 0.7 -62 C 1.1 -42 1.4 -22 2.2 0 Z"
              fill="currentColor"
            />
            {/* a couple of low branch ticks */}
            <path
              d="M0 -42 L -10 -54 M0 -48 L 10 -58"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
            {/* canopy — dense cluster of circles forming a rounded crown */}
            <g fill="currentColor">
              <circle cx="0" cy="-82" r="9.5" />
              <circle cx="-13" cy="-74" r="8" />
              <circle cx="13" cy="-74" r="8" />
              <circle cx="-22" cy="-66" r="6.5" />
              <circle cx="22" cy="-66" r="6.5" />
              <circle cx="-9" cy="-66" r="7.6" />
              <circle cx="9" cy="-66" r="7.6" />
              <circle cx="0" cy="-69" r="8.2" />
              <circle cx="-16" cy="-86" r="6" />
              <circle cx="16" cy="-86" r="6" />
              <circle cx="0" cy="-95" r="6.2" />
              <circle cx="-27" cy="-73" r="5" />
              <circle cx="27" cy="-73" r="5" />
              <circle cx="-6" cy="-57" r="6.2" />
              <circle cx="7" cy="-57" r="6.2" />
              <circle cx="-18" cy="-58" r="5.4" />
              <circle cx="18" cy="-58" r="5.4" />
            </g>
          </g>

          {/* ---- A tall slender cypress/poplar — adds height variety. ---- */}
          <g id="ng-tree-tall">
            <path
              d="M-2 0 C -1.2 -30 -1 -60 -0.6 -92 L 0.6 -92 C 1 -60 1.2 -30 2 0 Z"
              fill="currentColor"
            />
            <g fill="currentColor">
              <ellipse cx="0" cy="-120" rx="13" ry="38" />
              <circle cx="0" cy="-92" r="11" />
              <circle cx="-7" cy="-104" r="7" />
              <circle cx="7" cy="-104" r="7" />
              <circle cx="0" cy="-150" r="7" />
            </g>
          </g>

          {/* ---- A grazing cow: oval body + 4 legs + lowered head + horns + tail. ---- */}
          <g id="ng-cow" fill="currentColor" stroke="currentColor">
            {/* body */}
            <ellipse cx="0" cy="-20" rx="28" ry="15" stroke="none" />
            {/* neck + lowered head */}
            <path
              d="M23 -27 q 15 -2 21 12 q 2 6 -3 11 l -7 -2 q 2 -8 -5 -11 q -7 -3 -13 0 Z"
              stroke="none"
            />
            {/* two horns */}
            <path
              d="M40 -30 l 5 -7 M46 -27 l 7 -5"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            {/* legs */}
            <g strokeWidth="3.6" strokeLinecap="round">
              <line x1="-18" y1="-6" x2="-18" y2="0" />
              <line x1="-5" y1="-6" x2="-5" y2="0" />
              <line x1="10" y1="-6" x2="10" y2="0" />
              <line x1="21" y1="-6" x2="21" y2="0" />
            </g>
            {/* tail */}
            <path
              d="M-28 -27 q -10 7 -7 23"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
          </g>

          {/* ---- An ox for the plow team: heavier body + raised head/horns. ---- */}
          <g id="ng-ox" fill="currentColor" stroke="currentColor">
            <ellipse cx="0" cy="-22" rx="30" ry="16" stroke="none" />
            {/* forward-reaching neck + head */}
            <path
              d="M26 -28 q 16 -4 24 4 q 4 4 3 11 l -8 1 q 0 -7 -6 -10 q -7 -3 -13 -1 Z"
              stroke="none"
            />
            {/* horns */}
            <path
              d="M50 -34 l 6 -9 M54 -30 l 9 -6"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
            {/* legs (mid-stride) */}
            <g strokeWidth="4" strokeLinecap="round">
              <line x1="-20" y1="-7" x2="-23" y2="2" />
              <line x1="-7" y1="-7" x2="-4" y2="2" />
              <line x1="9" y1="-7" x2="12" y2="2" />
              <line x1="20" y1="-7" x2="17" y2="2" />
            </g>
            <path
              d="M-30 -28 q -11 8 -8 24"
              strokeWidth="2.6"
              fill="none"
              strokeLinecap="round"
            />
          </g>

          {/* ---- A small crop sprout (two leaves on a short stem). ---- */}
          <g id="ng-sprout" stroke="currentColor" fill="currentColor">
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-15"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="M0 -10 q -10 -2 -13 -10 q 10 0 13 6 Z" stroke="none" />
            <path d="M0 -13 q 10 -2 13 -10 q -10 0 -13 6 Z" stroke="none" />
          </g>

          {/* ---- A grass tuft (4–5 thin blades). ---- */}
          <g
            id="ng-grass"
            stroke="currentColor"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M0 0 q -5 -13 -8 -20" strokeWidth="1.8" />
            <path d="M0 0 q -2 -16 -2 -24" strokeWidth="1.8" />
            <path d="M0 0 q 2 -15 5 -21" strokeWidth="1.8" />
            <path d="M0 0 q 5 -12 10 -18" strokeWidth="1.8" />
          </g>
        </defs>

        {/* ====================================================================
            SUN — clearly visible radiating sun, upper-mid/right, behind text.
        ==================================================================== */}
        <g transform="translate(1180 150)">
          {/* warm halo */}
          <circle r="120" fill={GLOW} opacity="0.10" />
          <circle r="74" fill={GLOW} opacity="0.10" />
          {/* core disc */}
          <circle r="34" fill={LEAF} opacity="0.55" />
          <circle r="34" fill="none" stroke={LEAF} strokeWidth="2.5" opacity="0.7" />
          {/* ~16 rays */}
          <g stroke={LEAF} strokeWidth="3.4" strokeLinecap="round" opacity="0.6">
            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const r1 = 44;
              const r2 = i % 2 === 0 ? 70 : 60;
              // Round to 2dp: Math.cos/sin can differ in the last ULP between the
              // server (Node) and client (browser) V8 builds, which trips React's
              // hydration check on the serialized SVG coordinate strings.
              const snap = (n: number) => Math.round(n * 100) / 100;
              return (
                <line
                  key={i}
                  x1={snap(Math.cos(a) * r1)}
                  y1={snap(Math.sin(a) * r1)}
                  x2={snap(Math.cos(a) * r2)}
                  y2={snap(Math.sin(a) * r2)}
                />
              );
            })}
          </g>
        </g>

        {/* ====================================================================
            FAR LAYER — terraced fields + back-ridge tree row, rising high.
        ==================================================================== */}

        {/* terraced field bands — stacked gentle waves, rising up the footer */}
        <g color={FAR}>
          <path
            d="M0 250 C 240 226 460 240 720 230 C 980 220 1200 238 1440 226 L 1440 560 L 0 560 Z"
            fill="currentColor"
            opacity="0.42"
          />
          <path
            d="M0 312 C 260 290 520 304 800 294 C 1060 285 1260 300 1440 290 L 1440 560 L 0 560 Z"
            fill="currentColor"
            opacity="0.58"
          />
          <path
            d="M0 372 C 300 352 600 366 880 358 C 1120 351 1300 364 1440 356 L 1440 560 L 0 560 Z"
            fill="currentColor"
            opacity="0.74"
          />
        </g>

        {/* back-ridge tree row — tall ones rising behind the link columns */}
        <g color={FAR} opacity="0.85">
          <use href="#ng-tree-tall" transform="translate(70 268) scale(0.9)" />
          <use href="#ng-tree" transform="translate(170 262) scale(1.0)" />
          <use href="#ng-tree-tall" transform="translate(300 266) scale(0.8)" />
          <use href="#ng-tree" transform="translate(430 260) scale(1.1)" />
          <use href="#ng-tree-tall" transform="translate(560 268) scale(0.95)" />
          <use href="#ng-tree" transform="translate(700 262) scale(0.95)" />
          <use href="#ng-tree-tall" transform="translate(840 266) scale(0.85)" />
          <use href="#ng-tree" transform="translate(980 260) scale(1.05)" />
          <use href="#ng-tree-tall" transform="translate(1120 268) scale(0.9)" />
          <use href="#ng-tree" transform="translate(1280 262) scale(1.0)" />
          <use href="#ng-tree-tall" transform="translate(1400 266) scale(0.85)" />
        </g>

        {/* ====================================================================
            MID LAYER — dense scattered trees of varying heights + grazing cows.
        ==================================================================== */}
        <g color={MID} opacity="0.92">
          <use href="#ng-tree" transform="translate(50 360) scale(1.25)" />
          <use href="#ng-tree-tall" transform="translate(150 356) scale(1.05)" />
          <use href="#ng-tree" transform="translate(250 364) scale(1.0)" />
          <use href="#ng-tree" transform="translate(360 360) scale(1.4)" />
          <use href="#ng-tree-tall" transform="translate(470 356) scale(1.1)" />
          <use href="#ng-tree" transform="translate(600 364) scale(1.05)" />
          <use href="#ng-tree" transform="translate(740 360) scale(1.3)" />
          <use href="#ng-tree-tall" transform="translate(860 356) scale(1.0)" />
          <use href="#ng-tree" transform="translate(980 364) scale(1.1)" />
          <use href="#ng-tree" transform="translate(1110 360) scale(1.35)" />
          <use href="#ng-tree-tall" transform="translate(1240 356) scale(1.1)" />
          <use href="#ng-tree" transform="translate(1360 364) scale(1.15)" />
          <use href="#ng-tree" transform="translate(1430 360) scale(1.0)" />
        </g>

        {/* grazing cows on the mid-ground */}
        <g color={NEAR} opacity="0.95">
          <use href="#ng-cow" transform="translate(330 408) scale(1.1)" />
          <use href="#ng-cow" transform="translate(905 412) scale(1.0) scale(-1 1)" />
          <use href="#ng-cow" transform="translate(1015 410) scale(0.9)" />
        </g>

        {/* ====================================================================
            FORE LAYER — ground band + crop ticks, plowing scene (lower-left),
            watering farmer (center), crouched harvester (lower-right),
            grass tufts + sprouts along the very bottom.
        ==================================================================== */}

        {/* solid foreground ground band the figures stand on */}
        <path
          d="M0 446 C 320 436 720 452 1080 444 C 1260 440 1360 448 1440 444 L 1440 560 L 0 560 Z"
          fill={MID}
          opacity="0.82"
        />

        {/* crop-row ticks across the ground */}
        <g stroke={NEAR} strokeWidth="2.2" strokeLinecap="round" opacity="0.55">
          {Array.from({ length: 64 }).map((_, i) => {
            const x = 12 + i * 22.5;
            const y = 500 - (i % 3) * 2;
            return <line key={i} x1={x} y1={y} x2={x} y2={y - 12} />;
          })}
        </g>

        {/* ---- Plowing scene: two oxen + yoke + angled plow + farmer (lower-left) ---- */}
        <g transform="translate(150 470)" color={FIG}>
          {/* lead ox */}
          <use href="#ng-ox" transform="translate(168 -2) scale(1.15)" />
          {/* second ox (slightly behind/overlapping) */}
          <use href="#ng-ox" transform="translate(120 6) scale(1.1)" />
          {/* yoke line from oxen back to the plow */}
          <line
            x1="80"
            y1="-22"
            x2="22"
            y2="-4"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* angled plow */}
          <path
            d="M22 -4 L -6 14 L -18 4 M-6 14 L -6 26"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* standing farmer driving the plow */}
          <g stroke="currentColor" fill="currentColor">
            {/* head */}
            <circle cx="-38" cy="-52" r="7" stroke="none" />
            {/* torso */}
            <line
              x1="-38"
              y1="-45"
              x2="-34"
              y2="-20"
              strokeWidth="4.6"
              strokeLinecap="round"
            />
            {/* mid-stride legs */}
            <line
              x1="-34"
              y1="-20"
              x2="-44"
              y2="2"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="-34"
              y1="-20"
              x2="-26"
              y2="2"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* arms reaching to the plow handle */}
            <line
              x1="-37"
              y1="-40"
              x2="-12"
              y2="-20"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* ---- Watering farmer + sprouts (center) ---- */}
        <g transform="translate(720 472)" color={FIG}>
          {/* standing person tilting a watering can */}
          <g stroke="currentColor" fill="currentColor">
            <circle cx="0" cy="-58" r="7.2" stroke="none" />
            <line
              x1="0"
              y1="-51"
              x2="4"
              y2="-24"
              strokeWidth="4.8"
              strokeLinecap="round"
            />
            <line
              x1="4"
              y1="-24"
              x2="-5"
              y2="2"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
            <line
              x1="4"
              y1="-24"
              x2="11"
              y2="2"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
            {/* arm to the can */}
            <line
              x1="2"
              y1="-46"
              x2="24"
              y2="-34"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* watering can: body + tilted spout */}
            <path
              d="M24 -38 l 16 0 l -2 16 l -12 0 Z M40 -38 l 12 -9 M26 -42 q 7 -5 12 0"
              strokeWidth="2.8"
              fill="none"
              strokeLinejoin="round"
            />
          </g>
          {/* dotted water strokes from the spout down to the sprouts */}
          <g fill={LEAF} opacity="0.8">
            <circle cx="54" cy="-44" r="1.7" />
            <circle cx="59" cy="-36" r="1.7" />
            <circle cx="63" cy="-27" r="1.7" />
            <circle cx="66" cy="-17" r="1.7" />
            <circle cx="68" cy="-7" r="1.7" />
          </g>
          {/* sprouts being watered */}
          <use href="#ng-sprout" transform="translate(70 0) scale(1.2)" />
          <use href="#ng-sprout" transform="translate(86 0) scale(1.0)" />
          <use href="#ng-sprout" transform="translate(54 0) scale(0.9)" />
        </g>

        {/* ---- Crouched woman harvesting with a pot/basket (lower-right) ---- */}
        <g transform="translate(1250 474)" color={FIG}>
          <g stroke="currentColor" fill="currentColor">
            {/* head */}
            <circle cx="0" cy="-42" r="7" stroke="none" />
            {/* crouched torso bending forward */}
            <path
              d="M0 -36 q 11 10 16 21"
              strokeWidth="4.8"
              fill="none"
              strokeLinecap="round"
            />
            {/* folded legs / crouch */}
            <path
              d="M16 -15 q 10 4 14 14 M16 -15 q -9 5 -7 14"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            {/* arm reaching down to crops */}
            <line
              x1="11"
              y1="-22"
              x2="28"
              y2="-4"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
          {/* pot / basket beside her */}
          <path d="M38 0 q 2 -14 14 -14 q 12 0 14 14 Z" fill="currentColor" />
          {/* a few crops near her */}
          <use href="#ng-sprout" transform="translate(-20 0) scale(1.1)" />
          <use href="#ng-sprout" transform="translate(-8 0) scale(0.9)" />
        </g>

        {/* ---- Grass tufts + sprouts scattered along the very bottom ---- */}
        <g color={NEAR} opacity="0.8">
          <use href="#ng-grass" transform="translate(60 500) scale(1.3)" />
          <use href="#ng-grass" transform="translate(240 503) scale(1.0)" />
          <use href="#ng-grass" transform="translate(400 500) scale(1.2)" />
          <use href="#ng-grass" transform="translate(560 504) scale(0.9)" />
          <use href="#ng-grass" transform="translate(640 501) scale(1.25)" />
          <use href="#ng-grass" transform="translate(900 503) scale(1.1)" />
          <use href="#ng-grass" transform="translate(1040 500) scale(1.3)" />
          <use href="#ng-grass" transform="translate(1180 504) scale(0.95)" />
          <use href="#ng-grass" transform="translate(1340 501) scale(1.15)" />
          <use href="#ng-grass" transform="translate(1420 503) scale(1.0)" />
        </g>
        <g color={NEAR} opacity="0.8">
          <use href="#ng-sprout" transform="translate(170 503) scale(1.1)" />
          <use href="#ng-sprout" transform="translate(470 504) scale(1.0)" />
          <use href="#ng-sprout" transform="translate(960 503) scale(1.15)" />
          <use href="#ng-sprout" transform="translate(1120 504) scale(1.05)" />
        </g>
      </svg>
    </div>
  );
}

export default FooterScene;
