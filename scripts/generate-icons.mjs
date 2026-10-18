import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, colorFn) {
  // RGBA buffer with filter byte (0) per row
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = colorFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// Generate CyberPong Theme Icon: Deep dark blue-black gradient with neon cyan paddle, neon pink paddle, and glowing ball
function cyberPongPixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Background gradient: dark violet/navy to deep obsidian
  let r = Math.floor(10 + ny * 14);
  let g = Math.floor(10 + nx * 10);
  let b = Math.floor(25 + ny * 35);
  let a = 255;

  // Center court net
  if (Math.abs(nx - 0.5) < 0.015 && (y % 16 < 10)) {
    r = 60; g = 70; b = 120;
  }

  // Left paddle: Neon Cyan (nx ~ 0.15, ny between 0.35 and 0.65)
  if (nx >= 0.12 && nx <= 0.18 && ny >= 0.32 && ny <= 0.68) {
    return [0, 245, 255, 255]; // Neon Cyan
  }
  // Left paddle glow
  const dLeft = Math.hypot(nx - 0.15, Math.max(0, Math.abs(ny - 0.5) - 0.15));
  if (dLeft < 0.12) {
    const factor = 1 - dLeft / 0.12;
    r = Math.min(255, r + Math.floor(0 * factor));
    g = Math.min(255, g + Math.floor(200 * factor));
    b = Math.min(255, b + Math.floor(255 * factor));
  }

  // Right paddle: Neon Pink/Orange (nx ~ 0.85, ny between 0.35 and 0.65)
  if (nx >= 0.82 && nx <= 0.88 && ny >= 0.32 && ny <= 0.68) {
    return [255, 0, 127, 255]; // Neon Pink
  }
  // Right paddle glow
  const dRight = Math.hypot(nx - 0.85, Math.max(0, Math.abs(ny - 0.5) - 0.15));
  if (dRight < 0.12) {
    const factor = 1 - dRight / 0.12;
    r = Math.min(255, r + Math.floor(255 * factor));
    g = Math.min(255, g + Math.floor(20 * factor));
    b = Math.min(255, b + Math.floor(120 * factor));
  }

  // Glowing Cyber Ball (nx ~ 0.58, ny ~ 0.45)
  const dBall = Math.hypot(nx - 0.58, ny - 0.45);
  if (dBall < 0.05) {
    return [255, 255, 255, 255]; // White hot core
  }
  if (dBall < 0.09) {
    return [255, 220, 40, 255]; // Yellow gold inner aura
  }
  if (dBall < 0.2) {
    const factor = 1 - (dBall - 0.09) / 0.11;
    r = Math.min(255, r + Math.floor(255 * factor));
    g = Math.min(255, g + Math.floor(180 * factor));
    b = Math.min(255, b + Math.floor(60 * factor));
  }

  return [r, g, b, a];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write 192x192
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, cyberPongPixel));
// Write 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, cyberPongPixel));
// Write maskable 512x512 with safe zone margin
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, (x, y, w, h) => {
  // center 80% safe zone
  const cx = w / 2;
  const cy = h / 2;
  const sx = (x - cx) / 0.8 + cx;
  const sy = (y - cy) / 0.8 + cy;
  if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
    return cyberPongPixel(sx, sy, w, h);
  }
  return [10, 10, 25, 255];
}));
// Write apple-touch-icon 180x180
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, cyberPongPixel));

console.log('Successfully generated all PWA PNG icons!');
