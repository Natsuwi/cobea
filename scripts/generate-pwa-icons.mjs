import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'pwa');
fs.mkdirSync(outDir, { recursive: true });

const svg = fs
  .readFileSync(path.join(root, 'public', 'logo', 'CobeaLogo.svg'), 'utf8')
  .replaceAll('#111113', '#ffffff');

async function makeIcon(size, name, { pad = 0.18, bg = '#970BF5' } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(Buffer.from(svg))
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path.join(outDir, name));

  console.log(`✓ ${name} (${size}×${size})`);
}

await makeIcon(192, 'icon-192.png');
await makeIcon(512, 'icon-512.png');
await makeIcon(512, 'icon-512-maskable.png', { pad: 0.28 });
await makeIcon(180, 'apple-touch-icon.png', { pad: 0.16 });
