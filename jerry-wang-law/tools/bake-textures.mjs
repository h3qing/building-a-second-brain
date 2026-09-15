/**
 * Bakes the material surfaces the site is built from into image files.
 *
 * The grain is generated with SVG filters — turbulence stretched along one
 * axis, then pushed through a periodic transfer function so the smooth noise
 * breaks into grain lines rather than staying a haze. Running that filter live
 * on a full-width panel costs a hundred milliseconds or more on every repaint,
 * so it is rendered once here and shipped as a flat image.
 *
 *   node tools/bake-textures.mjs
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "public", "textures");

/** One plank: grain bands, plus a slow sweep of light across the board. */
function wood({ w, h, baseFrequency, octaves, seed, r, g, b, sheen }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}"
                  numOctaves="${octaves}" seed="${seed}" result="n"/>
    <!-- Collapse to one channel so the bands stay a single colour ramp
         instead of three unrelated noises. -->
    <feColorMatrix in="n" type="matrix"
      values="1 0 0 0 0
              1 0 0 0 0
              1 0 0 0 0
              0 0 0 0 1" result="m"/>
    <!-- The periodic table is what turns haze into grain. -->
    <feComponentTransfer in="m">
      <feFuncR type="table" tableValues="${r}"/>
      <feFuncG type="table" tableValues="${g}"/>
      <feFuncB type="table" tableValues="${b}"/>
    </feComponentTransfer>
  </filter>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0.35">
    <stop offset="0"    stop-color="#fff" stop-opacity="${sheen}"/>
    <stop offset="0.45" stop-color="#fff" stop-opacity="0"/>
    <stop offset="1"    stop-color="#000" stop-opacity="${sheen * 1.6}"/>
  </linearGradient>
  <rect width="${w}" height="${h}" filter="url(#grain)"/>
  <rect width="${w}" height="${h}" fill="url(#sheen)"/>
</svg>`;
}

/** Travertine: coarse cloud, fine pitting, almost no directionality. */
function stone({ w, h }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <filter id="cloud" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.028 0.034" numOctaves="4" seed="17" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="matrix"
      values="1 0 0 0 0
              1 0 0 0 0
              1 0 0 0 0
              0 0 0 0 1" result="m"/>
    <feComponentTransfer in="m">
      <feFuncR type="table" tableValues="0.921 0.949 0.928 0.956"/>
      <feFuncG type="table" tableValues="0.888 0.917 0.895 0.924"/>
      <feFuncB type="table" tableValues="0.826 0.858 0.833 0.866"/>
    </feComponentTransfer>
  </filter>
  <filter id="pits" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.09 0.055" numOctaves="3" seed="5" stitchTiles="stitch" result="p"/>
    <feColorMatrix in="p" type="matrix"
      values="0 0 0 0 0.35
              0 0 0 0 0.28
              0 0 0 0 0.20
              0.9 0 0 0 -0.45"/>
  </filter>
  <rect width="${w}" height="${h}" filter="url(#cloud)"/>
  <rect width="${w}" height="${h}" filter="url(#pits)" opacity="0.07"/>
</svg>`;
}

const jobs = [
  {
    file: "walnut.jpg",
    w: 1600,
    h: 900,
    quality: 86,
    svg: wood({
      w: 1600, h: 900,
      baseFrequency: "0.004 0.11", octaves: 5, seed: 3,
      // Kept dark enough that even the lightest band clears 4.5:1 against
      // travertine type — checked in tools/check-texture-contrast.mjs.
      r: "0.165 0.375 0.19 0.395 0.175 0.355",
      g: "0.098 0.238 0.115 0.252 0.105 0.228",
      b: "0.055 0.132 0.065 0.142 0.058 0.125",
      sheen: 0.05,
    }),
  },
  { file: "travertine.jpg", w: 1400, h: 900, quality: 88, svg: stone({ w: 1400, h: 900 }) },
];

const browser = await chromium.launch();
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.w, height: job.h } });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;overflow:hidden}</style>${job.svg}`,
  );
  await page.waitForTimeout(700);
  await page.screenshot({
    path: path.join(out, job.file),
    type: "jpeg",
    quality: job.quality,
  });
  await page.close();
  console.log(`baked ${job.file}  ${job.w}x${job.h}`);
}
await browser.close();
