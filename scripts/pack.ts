#!/usr/bin/env node
/**
 * The packed extension, written from `extension/dist`.
 *
 * `pnpm build:extension` leaves a folder chrome can load unpacked. A person who
 * only wants to install it needs the same folder as one file, and the web store
 * takes a zip of exactly that shape — the manifest at the root of the archive.
 * So this walks the build and writes it to `docs/.docs/public/`, where the docs
 * site serves it at `/agentak-extension.zip`.
 *
 * The zip is written here rather than by `zip`, which is a tool the build cannot
 * count on: a store entry is a header, a deflated body and a line in the central
 * directory, and node deflates. Every entry carries the same fixed timestamp, so
 * an unchanged build packs to the same bytes — the archive is a build output and
 * is not committed, and a rebuild of it is not a new download.
 *
 * Run: `node scripts/pack.ts`, which `pnpm build:extension` does for you. The
 * docs build runs that same command first, because the zip it serves is git
 * ignored and is made where the site is built.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const src = fileURLToPath(new URL("../extension/dist", import.meta.url));
const out = fileURLToPath(new URL("../docs/.docs/public/agentak-extension.zip", import.meta.url));

/** 1980-01-01, the earliest a dos timestamp reaches. */
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;

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

/** Every file under `dir`, as archive paths, in a stable order. */
function walk(dir: string, prefix = ""): string[] {
  const names: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) names.push(...walk(`${dir}/${entry.name}`, `${path}/`));
    else names.push(path);
  }
  return names;
}

type Entry = {
  name: Buffer;
  crc: number;
  body: Buffer;
  size: number;
  offset: number;
};

/** The local header and the central directory entry share these 16 bytes. */
function shared(entry: Entry): Buffer {
  const head = Buffer.alloc(16);
  head.writeUInt16LE(0, 0); // no flags
  head.writeUInt16LE(8, 2); // deflate
  head.writeUInt16LE(DOS_TIME, 4);
  head.writeUInt16LE(DOS_DATE, 6);
  head.writeUInt32LE(entry.crc, 8);
  head.writeUInt32LE(entry.body.length, 12);
  return head;
}

function zip(dir: string): Buffer {
  const parts: Buffer[] = [];
  const entries: Entry[] = [];
  let offset = 0;

  for (const path of walk(dir)) {
    const raw = readFileSync(`${dir}/${path}`);
    const entry: Entry = {
      name: Buffer.from(path, "utf8"),
      crc: crc32(raw),
      body: deflateRawSync(raw, { level: 9 }),
      size: raw.length,
      offset,
    };
    entries.push(entry);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // the version that reads it
    shared(entry).copy(header, 6);
    header.writeUInt32LE(entry.size, 22);
    header.writeUInt16LE(entry.name.length, 26);
    parts.push(header, entry.name, entry.body);
    offset += header.length + entry.name.length + entry.body.length;
  }

  const directory: Buffer[] = [];
  let size = 0;
  for (const entry of entries) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4); // the version that wrote it
    header.writeUInt16LE(20, 6);
    shared(entry).copy(header, 8);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(entry.name.length, 28);
    header.writeUInt32LE(entry.offset, 42);
    directory.push(header, entry.name);
    size += header.length + entry.name.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, ...directory, end]);
}

const archive = zip(src);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, archive);
console.log(`agentak-extension.zip  ${(archive.length / 1024).toFixed(0)} kB`);
