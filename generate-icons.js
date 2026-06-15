// Generates 192x192 and 512x512 PNG icons using pure Node.js (zlib built-in).
// Icon: blue (#1976d2) rounded square with 3 white ascending bar-chart bars.

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── PNG encoder ──────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++)
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t   = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function writePNG(filePath, w, h, rgba) {
  // rgba: Uint8Array of length w*h*4 (row-major, RGBA)
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = y * (1 + w * 4) + 1 + x * 4;
      raw[d]   = rgba[s];   raw[d+1] = rgba[s+1];
      raw[d+2] = rgba[s+2]; raw[d+3] = rgba[s+3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 7 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
  console.log(`  ✓  ${filePath}`);
}

// ── Icon renderer ─────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Anti-aliased rounded-rect coverage for pixel (px, py).
// Uses 4×4 supersampling.
function rrectCoverage(px, py, rx, ry, rw, rh, radius) {
  let hits = 0;
  const sub = 4;
  for (let sy = 0; sy < sub; sy++) {
    for (let sx = 0; sx < sub; sx++) {
      const cx = px + (sx + 0.5) / sub;
      const cy = py + (sy + 0.5) / sub;
      // Translate to rect-local coords
      const lx = cx - rx, ly = cy - ry;
      if (lx < 0 || lx > rw || ly < 0 || ly > rh) continue;
      // Check corners
      const inCorner =
        (lx < radius && ly < radius         && Math.hypot(lx - radius, ly - radius) > radius) ||
        (lx > rw - radius && ly < radius    && Math.hypot(lx - (rw - radius), ly - radius) > radius) ||
        (lx < radius && ly > rh - radius    && Math.hypot(lx - radius, ly - (rh - radius)) > radius) ||
        (lx > rw - radius && ly > rh - radius && Math.hypot(lx - (rw - radius), ly - (rh - radius)) > radius);
      if (!inCorner) hits++;
    }
  }
  return hits / (sub * sub);
}

function renderIcon(size) {
  const rgba = new Uint8Array(size * size * 4);
  const sc   = size / 512;

  const BG = [25, 118, 210];   // #1976d2
  const FG = [255, 255, 255];  // white

  const bgRadius = Math.round(88 * sc);

  // Bar chart (3 bars, ascending left→right)
  const barW    = Math.round(80 * sc);
  const barGap  = Math.round(40 * sc);
  const totalW  = 3 * barW + 2 * barGap;
  const startX  = (size - totalW) / 2;
  const padB    = Math.round(108 * sc);
  const maxH    = size - 2 * padB;
  const bottomY = size - padB;
  const bHeights = [0.42, 0.68, 1.0].map(f => Math.round(f * maxH));
  const bRadius  = Math.round(12 * sc);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Background coverage
      const bgA = rrectCoverage(px, py, 0, 0, size, size, bgRadius);
      if (bgA === 0) continue;

      // Bar coverage
      let barA = 0;
      for (let i = 0; i < 3; i++) {
        const bx = startX + i * (barW + barGap);
        const bh = bHeights[i];
        const by = bottomY - bh;
        const a  = rrectCoverage(px, py, bx, by, barW, bh, bRadius);
        if (a > barA) barA = a;
      }

      const idx = (py * size + px) * 4;
      rgba[idx + 3] = Math.round(255 * bgA);

      if (barA > 0) {
        // Blend BG → FG
        rgba[idx]   = Math.round(BG[0] * (1 - barA) + FG[0] * barA);
        rgba[idx+1] = Math.round(BG[1] * (1 - barA) + FG[1] * barA);
        rgba[idx+2] = Math.round(BG[2] * (1 - barA) + FG[2] * barA);
      } else {
        rgba[idx]   = BG[0];
        rgba[idx+1] = BG[1];
        rgba[idx+2] = BG[2];
      }
    }
  }
  return rgba;
}

// ── Generate ──────────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, 'frontend', 'public');
console.log('Generating icons...');

for (const size of [192, 512]) {
  const rgba = renderIcon(size);
  writePNG(path.join(outDir, `icon-${size}.png`), size, size, rgba);
}

console.log('Done.');
