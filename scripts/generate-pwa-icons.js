'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

const COLORS = {
  bg: [15, 20, 25, 255],
  paper: [232, 238, 245, 255],
  paperLine: [180, 194, 210, 255],
  accent: [26, 159, 122, 255],
  slot: [12, 18, 22, 230],
  button: [232, 238, 245, 255],
};

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function roundedRectSDF(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - hw + r;
  const dy = Math.abs(py - cy) - hh + r;
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ox, oy) - r;
}

function circleSDF(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
    a[3] + (b[3] - a[3]) * k,
  ];
}

function overlay(dst, src, alpha) {
  const a = (src[3] / 255) * Math.max(0, Math.min(1, alpha));
  if (a <= 0) return dst;
  const outA = a + dst[3] / 255 * (1 - a);
  return [
    (src[0] * a + dst[0] * (dst[3] / 255) * (1 - a)) / outA,
    (src[1] * a + dst[1] * (dst[3] / 255) * (1 - a)) / outA,
    (src[2] * a + dst[2] * (dst[3] / 255) * (1 - a)) / outA,
    outA * 255,
  ];
}

function coverage(sdf, aa) {
  return 1 - Math.max(0, Math.min(1, sdf / aa + 0.5));
}

function drawIcon(size, { maskable }) {
  const pixels = Buffer.alloc(size * size * 4);
  const pad = maskable ? 0.22 : 0.08;
  const inner = 1 - pad * 2;
  const aa = 1.2 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const px = (u - pad) / inner;
      const py = (v - pad) / inner;

      let color = COLORS.bg.slice();

      const plate = roundedRectSDF(px, py, 0.5, 0.5, 0.48, 0.48, 0.22);
      color = overlay(color, COLORS.bg, coverage(plate, aa));

      const paper = roundedRectSDF(px, py, 0.5, 0.32, 0.2, 0.18, 0.04);
      color = overlay(color, COLORS.paper, coverage(paper, aa));

      const line1 = roundedRectSDF(px, py, 0.5, 0.24, 0.13, 0.012, 0.01);
      const line2 = roundedRectSDF(px, py, 0.46, 0.30, 0.1, 0.012, 0.01);
      color = overlay(color, COLORS.paperLine, coverage(line1, aa));
      color = overlay(color, COLORS.paperLine, coverage(line2, aa));

      const body = roundedRectSDF(px, py, 0.5, 0.62, 0.34, 0.2, 0.08);
      color = overlay(color, COLORS.accent, coverage(body, aa));

      const slot = roundedRectSDF(px, py, 0.5, 0.5, 0.24, 0.028, 0.014);
      color = overlay(color, COLORS.slot, coverage(slot, aa));

      const btn = circleSDF(px, py, 0.72, 0.68, 0.035);
      color = overlay(color, COLORS.button, coverage(btn, aa));

      const i = (y * size + x) * 4;
      pixels[i] = Math.round(color[0]);
      pixels[i + 1] = Math.round(color[1]);
      pixels[i + 2] = Math.round(color[2]);
      pixels[i + 3] = Math.round(color[3]);
    }
  }

  return pixels;
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const dest = y * (size * 4 + 1);
    raw[dest] = 0;
    rgba.copy(raw, dest + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writePng(name, size, options) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, encodePng(size, drawIcon(size, options)));
  console.log('wrote', path.relative(process.cwd(), file));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
writePng('icon-192.png', 192, { maskable: false });
writePng('icon-512.png', 512, { maskable: false });
writePng('icon-maskable-192.png', 192, { maskable: true });
writePng('icon-maskable-512.png', 512, { maskable: true });
writePng('apple-touch-icon.png', 180, { maskable: false });
