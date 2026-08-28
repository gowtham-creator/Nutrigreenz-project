import fs from 'node:fs/promises';
import path from 'node:path';

const dir = '/Users/gowthamreddy/nutrigreenz project/branding/oils';
const files = [
  ["oils-tile-why.png","https://cdn.openart.ai/openart-ai/production/2026-07/create-image/tw2YbQI9cFZbdT7okInR/image_1783371320217_ff9c6305_1783371320814_4a57d031.png"],
  ["oils-tile-comparison.png","https://cdn.openart.ai/openart-ai/production/2026-07/create-image/tw2YbQI9cFZbdT7okInR/image_1783371365199_db8095f8_1783371365962_abdeb265.png"],
  ["oils-tile-woodpress.png","https://cdn.openart.ai/openart-ai/production/2026-07/create-image/tw2YbQI9cFZbdT7okInR/image_1783371339699_3a9c50d3_1783371340363_59473160.png"],
  ["oils-tile-range.png","https://cdn.openart.ai/openart-ai/production/2026-07/create-image/tw2YbQI9cFZbdT7okInR/image_1783371373113_58cd9e3e_1783371373782_72b678ab.png"],
  ["oils-tile-sizes.png","https://cdn.openart.ai/openart-ai/production/2026-07/create-image/tw2YbQI9cFZbdT7okInR/image_1783371349972_97d58efd_1783371350409_c09a32e1.png"],
  ["groundnut-side.png","https://cdn.openart.ai/openart-ai/production/2026-07/create-image/tw2YbQI9cFZbdT7okInR/image_1783371350262_91f166be_1783371350720_78c1b80f.png"]
];

for (const [name, url] of files) {
  const res = await fetch(url);
  if (!res.ok) { console.log(`FAIL ${name} HTTP ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(path.join(dir, name), buf);
  console.log(`OK ${name} ${buf.length} bytes`);
}
