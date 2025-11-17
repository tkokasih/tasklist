#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const OUTPUT_DIR = join(process.cwd(), "static/icons");
const BASE_SIZE = 512;

const OUTPUTS = [
  { filename: "icon-512.png", size: 512 },
  { filename: "icon-192.png", size: 192 },
];

const COLORS = {
  slate900: rgba("#0f172a"),
  slate700: rgba("#1f2937"),
  blue: rgba("#2563eb"),
  violet: rgba("#8b5cf6"),
  aquamarine: rgba("#14b8a6"),
  white: rgba("#f8fafc"),
  whiteMuted: rgba("#dbeafe", 0.8),
};

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const { filename, size } of OUTPUTS) {
    const canvas = createCanvas(size, size);
    drawIcon(canvas);
    const png = encodePng(canvas);
    const target = join(OUTPUT_DIR, filename);
    writeFileSync(target, png);
    console.log(`Created ${target}`);
  }
}

function drawIcon(canvas) {
  const scale = canvas.width / BASE_SIZE;
  const s = (value) => value * scale;
  const stroke = (value) => Math.max(1, Math.round(value * scale));

  fillVerticalGradient(canvas, COLORS.slate900, COLORS.slate700);
  drawGrid(
    canvas,
    s(96),
    s(128),
    s(320),
    s(320),
    4,
    rgba("#0b1220", 0.4),
    stroke(2),
  );
  drawRoundedRect(canvas, s(140), s(180), s(260), s(60), s(24), COLORS.blue);
  drawRoundedRect(canvas, s(120), s(270), s(220), s(60), s(24), COLORS.violet);
  drawRoundedRect(
    canvas,
    s(170),
    s(360),
    s(210),
    s(60),
    s(24),
    COLORS.aquamarine,
  );

  fillRect(canvas, s(156), s(205), s(140), s(12), COLORS.white);
  fillRect(canvas, s(136), s(295), s(120), s(12), COLORS.whiteMuted);
  fillRect(canvas, s(186), s(385), s(140), s(12), COLORS.whiteMuted);
}

function createCanvas(width, height) {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
}

function rgba(hex, alpha = 1) {
  if (!/^#([0-9a-fA-F]{6})$/.test(hex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return { r, g, b, a: Math.round(alpha * 255) };
}

function fillVerticalGradient(canvas, topColor, bottomColor) {
  for (let y = 0; y < canvas.height; y++) {
    const t = y / Math.max(1, canvas.height - 1);
    const color = lerpColor(topColor, bottomColor, t);
    for (let x = 0; x < canvas.width; x++) {
      setPixel(canvas, x, y, color);
    }
  }
}

function fillRect(canvas, x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(canvas.width, Math.ceil(x + w));
  const y1 = Math.min(canvas.height, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      setPixel(canvas, px, py, color);
    }
  }
}

function drawRoundedRect(canvas, x, y, w, h, radius, color) {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  if (r === 0) {
    fillRect(canvas, x, y, w, h, color);
    return;
  }
  fillRect(canvas, x + r, y, w - 2 * r, h, color);
  fillRect(canvas, x, y + r, r, h - 2 * r, color);
  fillRect(canvas, x + w - r, y + r, r, h - 2 * r, color);
  fillQuarterCircle(canvas, x + r, y + r, r, color, "tl");
  fillQuarterCircle(canvas, x + w - r, y + r, r, color, "tr");
  fillQuarterCircle(canvas, x + r, y + h - r, r, color, "bl");
  fillQuarterCircle(canvas, x + w - r, y + h - r, r, color, "br");
}

function fillQuarterCircle(canvas, cx, cy, radius, color, corner) {
  const xStart = Math.floor(cx - radius);
  const xEnd = Math.ceil(cx + radius);
  const yStart = Math.floor(cy - radius);
  const yEnd = Math.ceil(cy + radius);
  for (let y = yStart; y <= yEnd; y++) {
    for (let x = xStart; x <= xEnd; x++) {
      if (!withinCorner(x, y, corner, cx, cy)) continue;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= radius * radius + 0.5) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function withinCorner(x, y, corner, cx, cy) {
  switch (corner) {
    case "tl":
      return x <= cx && y <= cy;
    case "tr":
      return x >= cx && y <= cy;
    case "bl":
      return x <= cx && y >= cy;
    case "br":
      return x >= cx && y >= cy;
    default:
      return true;
  }
}

function drawGrid(canvas, x, y, w, h, cells, strokeColor, strokeWidth) {
  const cellWidth = w / cells;
  const cellHeight = h / cells;
  for (let i = 0; i <= cells; i++) {
    const vx = Math.round(x + cellWidth * i);
    drawLine(canvas, vx, y, vx, y + h, strokeWidth, strokeColor, true);
    const hy = Math.round(y + cellHeight * i);
    drawLine(canvas, x, hy, x + w, hy, strokeWidth, strokeColor, true);
  }
}

function drawLine(canvas, x0, y0, x1, y1, thickness, color, skipAA = false) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * (skipAA ? 1 : 2);
  if (steps === 0) {
    fillCircle(canvas, x0, y0, thickness / 2, color);
    return;
  }
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    fillCircle(canvas, x, y, thickness / 2, color);
  }
}

function fillCircle(canvas, cx, cy, radius, color) {
  const minX = Math.floor(cx - radius - 1);
  const maxX = Math.ceil(cx + radius + 1);
  const minY = Math.floor(cy - radius - 1);
  const maxY = Math.ceil(cy + radius + 1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (y * canvas.width + x) * 4;
  const srcA = color.a !== undefined ? color.a : 255;
  const dstA = canvas.data[index + 3];
  const outA = srcA + (dstA * (255 - srcA)) / 255;
  const blend = outA === 0 ? 0 : srcA / outA;
  canvas.data[index] = Math.round(
    color.r * blend + canvas.data[index] * (1 - blend),
  );
  canvas.data[index + 1] = Math.round(
    color.g * blend + canvas.data[index + 1] * (1 - blend),
  );
  canvas.data[index + 2] = Math.round(
    color.b * blend + canvas.data[index + 2] * (1 - blend),
  );
  canvas.data[index + 3] = Math.round(outA);
}

function lerpColor(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
    a: Math.round(a.a + (b.a - a.a) * t),
  };
}

function encodePng(canvas) {
  const { width, height, data } = canvas;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      const target = rowStart + 1 + x * 4;
      raw[target] = data[pixelIndex];
      raw[target + 1] = data[pixelIndex + 1];
      raw[target + 2] = data[pixelIndex + 2];
      raw[target + 3] = data[pixelIndex + 3];
    }
  }
  const chunks = [];
  chunks.push(createChunk("IHDR", createIHDR(width, height)));
  chunks.push(createChunk("IDAT", deflateSync(raw)));
  chunks.push(createChunk("IEND", Buffer.alloc(0)));
  return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function createIHDR(width, height) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function createChunk(type, data) {
  const buffer = Buffer.alloc(8 + data.length + 4);
  buffer.writeUInt32BE(data.length, 0);
  buffer.write(type, 4, 4, "ascii");
  data.copy(buffer, 8);
  const crc = crc32(buffer.subarray(4, 8 + data.length));
  buffer.writeUInt32BE(crc, 8 + data.length);
  return buffer;
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

main();
