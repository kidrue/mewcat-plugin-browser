// 已停用（2026-08-06）——本脚本用纯 Node + zlib 手绘几何图形，画的是旧版橙色猫脸图标。
// 现行图标是「朱砂印 · 譯」，需要真实宋体字形，几何绘制做不到。
// 生成方式改为：用浏览器渲染 design-preview/icon-source.html（512×512）后截图直出 assets/icon.png。
// 保留此文件仅作历史参考，运行它会覆盖掉当前图标。
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 512;
const buf = Buffer.alloc(SIZE * SIZE * 4, 0);

function idx(x, y) { return (y * SIZE + x) * 4; }

function blendPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = idx(x, y);
  const srcA = a / 255;
  const dstA = buf[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  buf[i]     = Math.round((r * srcA + buf[i]     * dstA * (1 - srcA)) / outA);
  buf[i + 1] = Math.round((g * srcA + buf[i + 1] * dstA * (1 - srcA)) / outA);
  buf[i + 2] = Math.round((b * srcA + buf[i + 2] * dstA * (1 - srcA)) / outA);
  buf[i + 3] = Math.round(outA * 255);
}

function fillCircleAA(cx, cy, r, R, G, B, A = 255) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const alpha = Math.max(0, Math.min(1, r + 0.5 - dist));
      if (alpha > 0) blendPixel(x, y, R, G, B, Math.round(A * alpha));
    }
  }
}

function fillEllipseAA(cx, cy, rx, ry, R, G, B, A = 255) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const edge = 1.5 / Math.max(rx, ry);
      const alpha = Math.max(0, Math.min(1, (1 - dist) / edge + 0.5));
      if (alpha > 0) blendPixel(x, y, R, G, B, Math.round(A * alpha));
    }
  }
}

function fillRoundRect(x1, y1, x2, y2, r, R, G, B, A = 255) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      const dx = Math.max(0, Math.max(x1 + r - x, x - (x2 - r)));
      const dy = Math.max(0, Math.max(y1 + r - y, y - (y2 - r)));
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = Math.max(0, Math.min(1, r + 0.5 - dist));
      if (alpha > 0) blendPixel(x, y, R, G, B, Math.round(A * alpha));
    }
  }
}

function fillTriangleAA(x1, y1, x2, y2, x3, y3, R, G, B, A = 255) {
  const minX = Math.floor(Math.min(x1, x2, x3)) - 1;
  const maxX = Math.ceil(Math.max(x1, x2, x3)) + 1;
  const minY = Math.floor(Math.min(y1, y2, y3)) - 1;
  const maxY = Math.ceil(Math.max(y1, y2, y3)) + 1;
  function edgeFn(ax, ay, bx, by, px, py) { return (bx - ax) * (py - ay) - (by - ay) * (px - ax); }
  const area = edgeFn(x1, y1, x2, y2, x3, y3);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = edgeFn(x2, y2, x3, y3, x, y) / area;
      const w1 = edgeFn(x3, y3, x1, y1, x, y) / area;
      const w2 = edgeFn(x1, y1, x2, y2, x, y) / area;
      const minW = Math.min(w0, w1, w2);
      const alpha = Math.max(0, Math.min(1, minW * 8 + 0.5));
      if (alpha > 0) blendPixel(x, y, R, G, B, Math.round(A * alpha));
    }
  }
}

function drawLineAA(x1, y1, x2, y2, thick, R, G, B, A = 255) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const nx = -dy / len, ny = dx / len;
  const steps = Math.ceil(len * 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = x1 + dx * t, cy = y1 + dy * t;
    for (let w = -(thick + 1); w <= thick + 1; w++) {
      const px = Math.round(cx + nx * w), py = Math.round(cy + ny * w);
      const dist = Math.abs(w);
      const alpha = Math.max(0, Math.min(1, thick + 0.5 - dist));
      if (alpha > 0) blendPixel(px, py, R, G, B, Math.round(A * alpha));
    }
  }
}

// Colors
const OG  = [249, 115,  22]; // #f97316 orange
const OGD = [194,  65,  12]; // #c2410c dark orange
const OGL = [253, 186, 116]; // #fdba74 light orange
const WHT = [255, 255, 255];
const BLK = [ 20,  12,   5];
const PNK = [255, 182, 193];
const PNK2= [240, 100, 130];
const CRM = [255, 248, 235]; // cream
const AMB = [180, 120,  15]; // amber iris

// Background rounded square
fillRoundRect(0, 0, 511, 511, 88, OG[0], OG[1], OG[2]);

// Subtle inner shadow at bottom for depth
for (let y = 400; y < 512; y++) {
  const alpha = Math.round(((y - 400) / 112) * 40);
  for (let x = 0; x < SIZE; x++) {
    blendPixel(x, y, 0, 0, 0, alpha);
  }
}

// === EARS ===
// Left ear outer
fillTriangleAA(62, 235, 148, 62, 232, 235, OGD[0], OGD[1], OGD[2]);
// Left ear inner
fillTriangleAA(95, 220, 148, 95, 202, 220, PNK[0], PNK[1], PNK[2]);
// Right ear outer
fillTriangleAA(280, 235, 364, 62, 450, 235, OGD[0], OGD[1], OGD[2]);
// Right ear inner
fillTriangleAA(310, 220, 364, 95, 417, 220, PNK[0], PNK[1], PNK[2]);

// === HEAD ===
fillCircleAA(256, 302, 172, CRM[0], CRM[1], CRM[2]);

// Subtle head shadow (bottom)
for (let y = 380; y < 480; y++) {
  for (let x = 84; x < 428; x++) {
    const dx = x - 256, dy = y - 302;
    if (dx * dx + dy * dy < 172 * 172) {
      const alpha = Math.round(((y - 380) / 100) * 18);
      blendPixel(x, y, 180, 100, 30, alpha);
    }
  }
}

// === FOREHEAD STRIPES ===
for (let i = -1; i <= 1; i++) {
  const sx = 256 + i * 40;
  drawLineAA(sx - 8, 148, sx + 8, 200, 4, OGL[0], OGL[1], OGL[2], 160);
}

// === EYES ===
// Eye whites
fillEllipseAA(192, 278, 38, 32, WHT[0], WHT[1], WHT[2]);
fillEllipseAA(320, 278, 38, 32, WHT[0], WHT[1], WHT[2]);

// Iris (amber)
fillEllipseAA(192, 282, 24, 27, AMB[0], AMB[1], AMB[2]);
fillEllipseAA(320, 282, 24, 27, AMB[0], AMB[1], AMB[2]);

// Iris detail ring
for (let a = 0; a < 360; a += 3) {
  const rad = a * Math.PI / 180;
  const ex = 192 + 18 * Math.cos(rad), ey = 282 + 20 * Math.sin(rad);
  fillCircleAA(ex, ey, 1.5, 220, 160, 30, 120);
  const ex2 = 320 + 18 * Math.cos(rad), ey2 = 282 + 20 * Math.sin(rad);
  fillCircleAA(ex2, ey2, 1.5, 220, 160, 30, 120);
}

// Pupils
fillEllipseAA(192, 285, 12, 20, BLK[0], BLK[1], BLK[2]);
fillEllipseAA(320, 285, 12, 20, BLK[0], BLK[1], BLK[2]);

// Eye shine (main)
fillCircleAA(202, 270, 8, WHT[0], WHT[1], WHT[2]);
fillCircleAA(330, 270, 8, WHT[0], WHT[1], WHT[2]);
// Eye shine (small)
fillCircleAA(184, 280, 3.5, WHT[0], WHT[1], WHT[2]);
fillCircleAA(312, 280, 3.5, WHT[0], WHT[1], WHT[2]);

// Eye outline
for (let a = 0; a < 360; a += 1) {
  const rad = a * Math.PI / 180;
  const ex = 192 + 38 * Math.cos(rad), ey = 278 + 32 * Math.sin(rad);
  fillCircleAA(ex, ey, 2.8, BLK[0], BLK[1], BLK[2]);
  const ex2 = 320 + 38 * Math.cos(rad), ey2 = 278 + 32 * Math.sin(rad);
  fillCircleAA(ex2, ey2, 2.8, BLK[0], BLK[1], BLK[2]);
}

// === NOSE ===
fillTriangleAA(244, 322, 256, 342, 268, 322, PNK2[0], PNK2[1], PNK2[2]);
// Nose highlight
fillCircleAA(252, 326, 3, 255, 160, 180, 120);

// === MOUTH ===
drawLineAA(222, 350, 242, 366, 2.8, BLK[0], BLK[1], BLK[2]);
drawLineAA(242, 366, 256, 355, 2.8, BLK[0], BLK[1], BLK[2]);
drawLineAA(256, 355, 270, 366, 2.8, BLK[0], BLK[1], BLK[2]);
drawLineAA(270, 366, 290, 350, 2.8, BLK[0], BLK[1], BLK[2]);

// === WHISKERS ===
drawLineAA( 95, 312, 228, 322, 1.8, BLK[0], BLK[1], BLK[2], 160);
drawLineAA( 95, 330, 228, 332, 1.8, BLK[0], BLK[1], BLK[2], 160);
drawLineAA( 95, 348, 228, 342, 1.8, BLK[0], BLK[1], BLK[2], 160);
drawLineAA(284, 322, 417, 312, 1.8, BLK[0], BLK[1], BLK[2], 160);
drawLineAA(284, 332, 417, 330, 1.8, BLK[0], BLK[1], BLK[2], 160);
drawLineAA(284, 342, 417, 348, 1.8, BLK[0], BLK[1], BLK[2], 160);

// === CHEEK BLUSH ===
fillEllipseAA(152, 338, 32, 20, 255, 160, 150, 70);
fillEllipseAA(360, 338, 32, 20, 255, 160, 150, 70);

// === WRITE PNG ===
function crc32(data) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcB]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6;

const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  raw[y * (1 + SIZE * 4)] = 0;
  buf.copy(raw, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const compressed = zlib.deflateSync(raw, { level: 9 });

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);

const outPath = path.join(__dirname, '../assets/icon.png');
fs.writeFileSync(outPath, png);
console.log('icon.png written:', png.length, 'bytes,', SIZE + 'x' + SIZE);
