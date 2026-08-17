#!/usr/bin/env node
/**
 * The extension's toolbar icons, drawn from `assets/agentak.svg`.
 *
 * Chrome takes a bitmap and one bitmap only, at four sizes, so the logo has to
 * be rasterised somewhere. It is done here rather than by a tool nobody has
 * installed: the drawing is a stroked rounded rectangle, three quadratic curves
 * and two circles, and every one of those has a distance function of a few
 * lines. The shapes below are the svg's own, resolved the way a renderer
 * resolves them — so this is the same drawing at 16 pixels, not a photograph of
 * it.
 *
 * **The plate is the one thing the svg does not have.** The svg picks its ink
 * from the reader's colour scheme; a png cannot, and a toolbar is light for one
 * person and dark for the next. So the logo is drawn in the svg's own
 * dark-scheme ink, on a rounded plate of its light-scheme ink, which reads on
 * either toolbar.
 *
 * Run: `pnpm icons`, or `node scripts/icons.ts`. Rerun it when the logo changes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const out = fileURLToPath(new URL("../extension/icons", import.meta.url));

/** The two colours the svg declares, one per colour scheme. */
const PLATE = [0x14, 0x16, 0x1a];
const INK = [0xee, 0xf0, 0xf3];

/** `viewBox="6 6.5 52 52"`, and the `stroke-width` every stroked shape carries. */
const VIEW = { size: 52, x: 6, y: 6.5 };
const STROKE = 3.2;

const SIZES = [16, 32, 48, 128];

// --- png ---------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, byte) => {
  let c = byte;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buffer: Buffer): number => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

/** 8-bit rgba, no interlacing, and the one filter that is no filter at all. */
const png = (size: number, pixels: Buffer): Buffer => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // rgba

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let row = 0; row < size; row++) {
    pixels.copy(raw, row * stride + 1, row * size * 4, (row + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

// --- the drawing, in svg units -----------------------------------------------

type Point = [number, number];

/** Signed distance to a rounded rectangle. Negative inside it. */
function roundRect(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
): number {
  const halfWidth = (x1 - x0) / 2;
  const halfHeight = (y1 - y0) / 2;
  const qx = Math.abs(px - (x0 + halfWidth)) - halfWidth + radius;
  const qy = Math.abs(py - (y0 + halfHeight)) - halfHeight + radius;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

/** Distance to a segment. Stroking one of these round-caps it, as the svg asks. */
function segment(px: number, py: number, [ax, ay]: Point, [bx, by]: Point): number {
  const vx = bx - ax;
  const vy = by - ay;
  const along = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - ax - vx * along, py - ay - vy * along);
}

/** One quadratic bézier as a polyline. 48 steps is well under a pixel at 128. */
function flatten(start: Point, control: Point, end: Point, steps = 48): Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const u = 1 - t;
    points.push([
      u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
    ]);
  }
  return points;
}

const polyline = (px: number, py: number, points: Point[]): number => {
  let near = Infinity;
  for (let n = 1; n < points.length; n++)
    near = Math.min(near, segment(px, py, points[n - 1]!, points[n]!));
  return near;
};

/** `q` is relative, so a control point is the start plus the pair after it. */
const quad = (start: Point, control: Point, end: Point): Point[] =>
  flatten(
    start,
    [start[0] + control[0], start[1] + control[1]],
    [start[0] + end[0], start[1] + end[1]],
  );

/** The two ears, and the smile. */
const CURVES = [
  quad([11.5, 30], [-4, 6], [0, 13]),
  quad([52.5, 30], [4, 6], [0, 13]),
  quad([29, 38], [3, 3.5], [6, 0]),
];

/** How far this point is from the ink. Negative is inside it. */
function ink(x: number, y: number): number {
  // The head: a stroke, so the distance is to its outline either side.
  let near = Math.abs(roundRect(x, y, 17, 15, 47, 50, 12)) - STROKE / 2;
  for (const curve of CURVES) near = Math.min(near, polyline(x, y, curve) - STROKE / 2);
  // The eyes are filled, and are the only shape that is.
  near = Math.min(near, Math.hypot(x - 26, y - 31) - 2.4);
  return Math.min(near, Math.hypot(x - 38, y - 31) - 2.4);
}

// --- the icon ----------------------------------------------------------------

const PLATE_INSET = 0.015;
const PLATE_RADIUS = 0.22;

/** Coverage from a distance in pixels: one pixel of edge, centred on the edge. */
const cover = (pixels: number): number => Math.max(0, Math.min(1, 0.5 - pixels));

function draw(size: number): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / VIEW.size;

  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      // The centre of the pixel, in svg units and again in unit ones.
      const x = VIEW.x + (column + 0.5) / scale;
      const y = VIEW.y + (row + 0.5) / scale;
      const u = (column + 0.5) / size;
      const v = (row + 0.5) / size;

      const plate = cover(
        roundRect(u, v, PLATE_INSET, PLATE_INSET, 1 - PLATE_INSET, 1 - PLATE_INSET, PLATE_RADIUS) *
          size,
      );
      const mark = cover(ink(x, y) * scale);

      const at = (row * size + column) * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels[at + channel] = Math.round(PLATE[channel]! * (1 - mark) + INK[channel]! * mark);
      }
      // The ink is only ever drawn on the plate, so the plate is the alpha.
      pixels[at + 3] = Math.round(255 * plate);
    }
  }

  return png(size, pixels);
}

mkdirSync(out, { recursive: true });
for (const size of SIZES) {
  writeFileSync(`${out}/icon-${size}.png`, draw(size));
  console.log(`icon-${size}.png`);
}
