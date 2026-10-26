#!/usr/bin/env node
// Resizes data/raw-images/<sourceId>/<n>.jpg to max 480px wide, JPEG quality 70 (macOS `sips`)
// into public/exercises/<exerciseId>/<n>.jpg. Run after scripts/fetch-images.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/raw/free-exercise-db.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/curation.json'), 'utf8'));
const rawById = new Map(raw.map((r) => [r.id, r]));

let count = 0;
let bytes = 0;
for (const c of cfg) {
  const r = rawById.get(c.src);
  r.images.forEach((rel, i) => {
    const src = path.join(ROOT, 'data/raw-images', rel);
    const dest = path.join(ROOT, 'public/exercises', c.id, `${i}.jpg`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    execFileSync(
      'sips',
      ['-Z', '480', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70', src, '--out', dest],
      { stdio: 'ignore' },
    );
    count++;
    bytes += fs.statSync(dest).size;
  });
}
console.log(`optimized ${count} images, ${(bytes / 1024 / 1024).toFixed(2)} MB total`);
