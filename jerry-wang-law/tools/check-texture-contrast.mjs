/**
 * Reads the baked textures back and checks the worst pixel, not the average.
 *
 * A wood panel is not one colour — type sitting on it has to stay legible over
 * the lightest band in the grain, so that is what gets measured.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const srgb = (c) => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => {
  const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};

/* Read the palette out of the stylesheet, so this never checks a colour the
   site stopped using. */
const css = await readFile(path.join(root, "src", "app", "globals.css"), "utf8");
const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`token --${name} not found`);
  const h = m[1];
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const TEXT = { travertine: token("paper"), ochreLt: token("ochre-lt") };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8110/");

for (const file of ["walnut.jpg", "travertine.jpg"]) {
  const url = `http://127.0.0.1:8110/textures/${file}`;
  const stats = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let lightest = [0, 0, 0], darkest = [255, 255, 255], lSum = 0, dSum = 999;
    let rs = 0, gs = 0, bs = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 17) {
      const px = [d[i], d[i + 1], d[i + 2]];
      const s = px[0] + px[1] + px[2];
      if (s > lSum) { lSum = s; lightest = px; }
      if (s < dSum) { dSum = s; darkest = px; }
      rs += px[0]; gs += px[1]; bs += px[2]; n++;
    }
    return { lightest, darkest, mean: [rs / n | 0, gs / n | 0, bs / n | 0] };
  }, url);

  console.log(`\n${file}`);
  console.log(`  mean rgb(${stats.mean})  lightest rgb(${stats.lightest})  darkest rgb(${stats.darkest})`);
  if (file !== "travertine.jpg") {
    for (const [name, col] of Object.entries(TEXT)) {
      const worst = ratio(col, stats.lightest);
      console.log(`  ${name} over the LIGHTEST grain: ${worst.toFixed(2)}:1  ${worst >= 4.5 ? "AA" : "FAIL"}`);
    }
  } else {
    const worst = ratio(token("ink"), stats.darkest);
    console.log(`  ink over the DARKEST mottle: ${worst.toFixed(2)}:1  ${worst >= 4.5 ? "AA" : "FAIL"}`);
  }
}
await browser.close();
