#!/usr/bin/env node
// Downloads source images for the curated exercises into data/raw-images/<sourceId>/<n>.jpg.
// Files are untrusted: only written to disk and checked for JPEG magic bytes, never executed.
// Skips files that already exist and are valid. Run: node scripts/fetch-images.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/raw-images');
const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/raw/free-exercise-db.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/curation.json'), 'utf8'));
const rawById = new Map(raw.map((r) => [r.id, r]));

const isJpeg = (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const SAFE = /^[A-Za-z0-9_\-()]+\/\d+\.jpg$/;

const jobs = [];
for (const c of cfg) {
  const r = rawById.get(c.src);
  if (!r) throw new Error(`source ${c.src} missing`);
  for (const rel of r.images) {
    if (!SAFE.test(rel)) throw new Error(`unsafe image path: ${rel}`);
    jobs.push(rel);
  }
}

let done = 0;
let skipped = 0;
const failures = [];
async function run(rel) {
  const dest = path.join(OUT, rel);
  if (fs.existsSync(dest) && isJpeg(fs.readFileSync(dest))) {
    skipped++;
    return;
  }
  const res = await fetch(BASE + rel.split('/').map(encodeURIComponent).join('/'));
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isJpeg(buf)) throw new Error(`${rel}: not a JPEG`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  done++;
}

const queue = [...jobs];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const rel = queue.shift();
      try {
        await run(rel);
      } catch (e) {
        failures.push(e.message);
      }
    }
  }),
);
console.log(`images: ${jobs.length}, downloaded: ${done}, skipped: ${skipped}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
