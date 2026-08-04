/**
 * The oil label front face, as HTML.
 *
 * Rebuilt from the flattened image it used to be, because element PLACEMENT was
 * the thing that did not match: the product block has to be a contained panel
 * with the droplet and bowl falling out of it onto open field, the method pill
 * sits inside the block rather than above it, and the pack carries two trust
 * badges. None of that is adjustable in a flat bitmap recovered from a render.
 *
 * Built at 4× and downsampled, so the botanical hairlines and the small caps
 * stay clean once the face is wrapped around a bottle.
 *
 * Two themes, same geometry. `green` is the Nutri Greenz brand field; `blush`
 * is the warm taupe of the reference pack. Only colour differs — every position
 * below is shared, so the two are directly comparable.
 */

import { fieldScene } from "./label-scene.mjs";

/**
 * One wrap face on the 1L bottle is about 92mm across by 132mm tall, so the
 * artboard is PORTRAIT. Exported so the renderer sizes its viewport from the
 * same numbers rather than keeping its own copy.
 */
export const FACE = { W: 1100, H: 1560 };

export const THEMES = {
  green: {
    field: "#1F4D2E",
    fieldDeep: "#14331F",
    block: "#9A4A2B",
    blockDeep: "#7E3B22",
    ink: "#F5F2E0",
    band: "#F7F3E3",
    bandInk: "#14331F",
    gold: "#C9A227",
    goldSoft: "#E3C96B",
    botanical: "#E8DFA8",
    botanicalAlpha: 0.30,
    sceneAlpha: 0.30,
  },
  blush: {
    field: "#C9A492",
    fieldDeep: "#B08D7B",
    block: "#5B3227",
    blockDeep: "#4A281F",
    ink: "#F7F1EA",
    band: "#FBF6F0",
    bandInk: "#4A281F",
    gold: "#8A6A4F",
    goldSoft: "#D9BFA8",
    botanical: "#F0E2D6",
    botanicalAlpha: 0.55,
    sceneAlpha: 0.52,
  },
};

/**
 * Sparse, tone-on-tone botanical.
 *
 * The previous version tiled a dense motif edge to edge at high contrast, which
 * competed with the type. Here the sprigs are placed individually down the two
 * outer margins and left out of the middle, so the block and the bowl sit on
 * quiet field.
 */
function botanical(t, W, H) {
  const sprig = (x, y, s, rot, o) => `
    <g transform="translate(${x},${y}) rotate(${rot}) scale(${s})"
       opacity="${o}" stroke="${t.botanical}" stroke-width="2.2" fill="none"
       stroke-linecap="round">
      <path d="M0 0 C 0 40, 0 90, 0 130"/>
      <path d="M0 26 C 20 18, 34 26, 40 40 C 22 46, 6 40, 0 26 Z"/>
      <path d="M0 26 C -20 18, -34 26, -40 40 C -22 46, -6 40, 0 26 Z"/>
      <path d="M0 60 C 18 52, 32 60, 38 74 C 20 80, 6 74, 0 60 Z"/>
      <path d="M0 60 C -18 52, -32 60, -38 74 C -20 80, -6 74, 0 60 Z"/>
      <path d="M0 94 C 15 87, 27 94, 32 106 C 17 111, 5 106, 0 94 Z"/>
    </g>`;

  const pod = (x, y, s, rot, o) => `
    <g transform="translate(${x},${y}) rotate(${rot}) scale(${s})"
       opacity="${o}" stroke="${t.botanical}" stroke-width="2.2" fill="none">
      <path d="M0 0 q 22 -14 44 0 q 14 20 0 40 q -22 14 -44 0 q -14 -20 0 -40 Z"/>
      <path d="M22 -8 q 20 24 0 56"/>
      <circle cx="12" cy="20" r="6"/><circle cx="32" cy="20" r="6"/>
    </g>`;

  const o = t.botanicalAlpha;
  return `
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
       style="position:absolute;inset:0;z-index:0" xmlns="http://www.w3.org/2000/svg">
    ${sprig(W * 0.075, H * 0.10, 1.15, -12, o)}
    ${sprig(W * 0.925, H * 0.13, 1.05, 14, o)}
    ${sprig(W * 0.055, H * 0.52, 0.95, 8, o * 0.85)}
    ${sprig(W * 0.945, H * 0.55, 1.0, -9, o * 0.85)}
    ${pod(W * 0.05, H * 0.36, 1.0, -20, o * 0.8)}
    ${pod(W * 0.88, H * 0.40, 0.9, 25, o * 0.8)}
    ${pod(W * 0.10, H * 0.80, 0.85, 12, o * 0.7)}
    ${pod(W * 0.86, H * 0.83, 0.95, -16, o * 0.7)}
  </svg>`;
}

/** The two circular trust badges the reference carries and ours lacked. */
function badges(t) {
  const mark = (paths) => `
    <svg viewBox="0 0 24 24" fill="none" stroke="${t.ink}" stroke-width="1.4"
         stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

  const shield = `<path d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6Z"/><path d="M8.5 12l2.4 2.4L15.5 10"/>`;
  const nose = `<path d="M14 4c-.6 3-2 4.6-3.6 6.2C9 11.7 8 12.7 8 14.2A3.8 3.8 0 0 0 12 18"/><path d="M9.6 14.4h3"/><path d="M17 8c2 1.4 2.6 3.4 2 5.4"/>`;

  return `
    <div class="badges">
      <div class="badge"><span class="badge__ring">${mark(shield)}</span><em>AFLATOXIN-FREE</em></div>
      <div class="badge"><span class="badge__ring">${mark(nose)}</span><em>SWEET AROMA</em></div>
    </div>`;
}

export function labelFaceHtml(sku, themeName = "green") {
  const t = THEMES[themeName];
  const { W, H } = FACE;

  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Lora:ital,wght@0,600;0,700;1,500&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:${W}px;height:${H}px;overflow:hidden;
       font-family:"Hanken Grotesk",system-ui,sans-serif}
  html,body{background:${t.fieldDeep}}
  .face{position:absolute;inset:0;overflow:hidden;
        background:linear-gradient(180deg,${t.field} 0%,${t.fieldDeep} 100%)}
  .inner{position:relative;z-index:1;height:100%;
         display:flex;flex-direction:column;align-items:center;
         padding:44px 46px 30px}

  /* Wordmark band. */
  .band{width:min(760px,86%);background:${t.band};border-radius:0;
        padding:16px 24px 13px;text-align:center;
        box-shadow:0 2px 0 rgba(0,0,0,.06)}
  .band h1{font-family:Lora,Georgia,serif;font-size:60px;font-weight:700;
           letter-spacing:.02em;color:${t.bandInk};line-height:1}
  .band p{font-family:Lora,Georgia,serif;font-style:italic;font-size:22px;
          font-weight:500;color:${t.bandInk};opacity:.82;margin-top:5px}

  /*
   * The product block is a CONTAINED panel, not a full-width slab. The droplet
   * and the bowl deliberately fall out of its lower edge onto open field —
   * that overlap is what the flat version lost.
   */
  .block{position:relative;margin-top:34px;width:min(760px,86%);
         background:linear-gradient(180deg,${t.block} 0%,${t.blockDeep} 100%);
         border-radius:0;padding:34px 34px 40px;text-align:center;z-index:2}
  .pill{display:inline-block;border:1.6px solid ${t.goldSoft};border-radius:999px;
        padding:8px 28px;font-size:23px;font-weight:700;letter-spacing:.14em;
        color:${t.goldSoft}}
  .name{margin-top:20px;font-size:70px;font-weight:800;line-height:.98;
        letter-spacing:.005em;color:${t.ink}}
  .rule{width:78%;height:1px;background:${t.goldSoft};opacity:.55;margin:18px auto}
  .from{font-size:21px;font-weight:600;letter-spacing:.06em;line-height:1.35;
        color:${t.ink};opacity:.94}

  .badges{display:flex;justify-content:center;gap:34px;margin-top:24px}
  .badge{width:150px;text-align:center}
  .badge__ring{display:flex;width:56px;height:56px;margin:0 auto 8px;
               border:1.6px solid ${t.goldSoft};border-radius:50%;
               align-items:center;justify-content:center}
  .badge__ring svg{width:30px;height:30px}
  .badge em{font-style:normal;font-size:15px;font-weight:700;letter-spacing:.07em;
            color:${t.ink};opacity:.92;white-space:nowrap}

  /* Droplet + bowl sit BELOW the block, on the open field. */
  .fall{position:relative;z-index:3;margin-top:-26px;padding-top:4px;
        display:flex;flex-direction:column;align-items:center}
  .drop{width:66px;height:84px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))}
  .bowl{width:520px;margin-top:-18px}

  .foot{margin-top:auto;width:100%;display:flex;align-items:center;
        justify-content:space-between;padding-top:10px}
  .veg{width:34px;height:34px;border:2.4px solid #1E7A34;background:#fff;
       display:flex;align-items:center;justify-content:center}
  .veg i{width:17px;height:17px;border-radius:50%;background:#1E7A34;display:block}
  .qty{text-align:right;color:${t.ink}}
  .qty b{display:block;font-size:15px;font-weight:700;letter-spacing:.14em;opacity:.85}
  .qty span{font-size:30px;font-weight:700;letter-spacing:.02em}
</style></head><body>
  <div class="face">
    ${fieldScene(t, W, H)}
    <div class="inner">
      <div class="band">
        <h1>NUTRI GREENZ</h1>
        <p>Born in Soil, built for tomorrow</p>
      </div>

      <div class="block">
        <span class="pill">${sku.method}</span>
        <div class="name">${sku.name}</div>
        <div class="rule"></div>
        <div class="from">${sku.from}</div>
        ${badges(t)}
      </div>

      <div class="fall">
        <svg class="drop" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#F6C64B"/><stop offset="1" stop-color="#D99A17"/>
          </linearGradient></defs>
          <path d="M20 2 C 20 16, 37 26, 37 36 A 17 17 0 0 1 3 36 C 3 26, 20 16, 20 2 Z"
                fill="url(#d)"/>
          <ellipse cx="14" cy="34" rx="4.5" ry="7" fill="#fff" opacity=".38"/>
        </svg>
        <img class="bowl" src="${sku.bowl}" alt="">
      </div>

      <div class="foot">
        <div class="veg"><i></i></div>
        <div class="qty"><b>NET QUANTITY</b><span>${sku.qty}</span></div>
      </div>
    </div>
  </div>
</body></html>`;
}
