// Renders PWA PNG icons from SVG sources using Playwright's chromium (no extra deps).
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const any = readFileSync('public/favicon.svg', 'utf8');
const maskable = readFileSync('scripts/icon-maskable.svg', 'utf8');
const jobs = [
  [any, 192, 'public/pwa-192x192.png'],
  [any, 512, 'public/pwa-512x512.png'],
  [any, 180, 'public/apple-touch-icon.png'],
  [maskable, 512, 'public/pwa-maskable-512x512.png'],
];

const browser = await chromium.launch();
for (const [svg, size, out] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${dataUrl}">`,
  );
  await page.screenshot({ path: out, omitBackground: true });
  await page.close();
}
await browser.close();
