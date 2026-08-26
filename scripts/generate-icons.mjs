/**
 * calorAI PWA icon generator — zero-dependency PNG writer.
 *
 * Renders app icons programmatically (rounded-square warm gradient,
 * white abstract "c" ring + flame mark) and writes raw PNGs via zlib.
 * No external image tooling required, so it runs anywhere Node does.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "icons");

/* ---------------------------------- colors --------------------------------- */

const GRAD_A = [0xff, 0x8e, 0x5e]; // light tangerine (top-left)
const GRAD_B = [0xef, 0x4a, 0x1f]; // deep coral-red (bottom-right)
const WHITE = [255, 255, 255];

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/* ------------------------------- PNG encoding ------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // compression (0), filter (0), interlace (0) already zero

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------ shape math --------------------------------- */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** Anti-aliased coverage for a signed-distance value given in pixels. */
const coverage = (sdfPx) => clamp01(0.5 - sdfPx);

/** Rounded rectangle SDF centered at origin. `half` is half-size in px. */
function sdRoundRect(px, py, halfX, halfY, radius) {
  const qx = Math.abs(px) - (halfX - radius);
  const qy = Math.abs(py) - (halfY - radius);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - radius;
}

/** Axis-aligned box SDF centered at (cx, cy). */
function sdBox(px, py, cx, cy, halfX, halfY) {
  const dx = Math.abs(px - cx) - halfX;
  const dy = Math.abs(py - cy) - halfY;
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ox, oy);
}

/**
 * The white mark: a lowercase-"c" ring (opening to the right) with a
 * teardrop "flame" nested in its counter. Coordinates are fractions of the
 * canvas size, relative to the canvas center (+y points down).
 * Returns a signed distance in px (negative = inside).
 */
function markSdf(px, py, size) {
  // Coordinates are relative to the canvas center (+y points down).
  const x = px / size - 0.5;
  const y = py / size - 0.5;

  // "c" ring
  const ringCx = 0;
  const ringCy = 0.035;
  const ringR = 0.265; // mid radius
  const ringT = 0.105; // thickness
  const ringDist = Math.hypot(x - ringCx, y - ringCy) - ringR;
  const ring = Math.abs(ringDist) - ringT / 2;

  // Notch that opens the ring to the right (box subtracted from ring).
  const notch = sdBox(x, y, 0.3, ringCy, 0.16, 0.115);
  const cShape = Math.max(ring, -notch);

  // Flame: union of disks along a slight curve (base -> tip).
  const p0 = { x: -0.005, y: 0.078, r: 0.086 };
  const p1 = { x: 0.014, y: -0.02 };
  const p2 = { x: -0.006, y: -0.116, r: 0.016 };
  let flame = Infinity;
  const STEPS = 28;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const mt = 1 - t;
    const cx = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const cy = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
    const r = p0.r * mt + p2.r * t;
    flame = Math.min(flame, Math.hypot(x - cx, y - cy) - r);
  }

  return Math.min(cShape, flame) * size;
}

/* -------------------------------- rendering -------------------------------- */

/**
 * @param {number} size canvas edge length in px
 * @param {{ fullBleed?: boolean, contentScale?: number }} opts
 */
function renderIcon(size, opts = {}) {
  const { fullBleed = false, contentScale = 0.88 } = opts;
  const buf = new Uint8Array(size * size * 4);
  const cornerRadius = fullBleed ? 0 : 0.225;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const cx = px + 0.5;
      const cy = py + 0.5;

      const bgCov = fullBleed ? 1 : coverage(sdRoundRect(cx - size / 2, cy - size / 2, size / 2, size / 2, cornerRadius * size));

      if (bgCov === 0) continue; // transparent corner — buffer starts zeroed

      // Diagonal gradient across the tile.
      const grad = mix(GRAD_A, GRAD_B, (cx / size + cy / size) / 2);

      // Rescale pixel position into the content-safe design space.
      const ux = ((cx / size - 0.5) / contentScale + 0.5) * size;
      const uy = ((cy / size - 0.5) / contentScale + 0.5) * size;
      const markCov = coverage(markSdf(ux, uy, size));

      const col = mix(grad, WHITE, markCov);
      const i = (py * size + px) * 4;
      buf[i] = col[0];
      buf[i + 1] = col[1];
      buf[i + 2] = col[2];
      buf[i + 3] = Math.round(bgCov * 255);
    }
  }
  return buf;
}

/* ---------------------------------- main ----------------------------------- */

fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "maskable-192.png", size: 192, opts: { fullBleed: true, contentScale: 0.74 } },
  { file: "maskable-512.png", size: 512, opts: { fullBleed: true, contentScale: 0.74 } },
  { file: "apple-touch-icon.png", size: 180, opts: { fullBleed: true, contentScale: 0.82 } },
];

for (const { file, size, opts } of targets) {
  const png = encodePng(size, size, renderIcon(size, opts));
  fs.writeFileSync(path.join(OUT_DIR, file), png);
  console.log(`wrote public/icons/${file} (${size}x${size}, ${png.length} bytes)`);
}
