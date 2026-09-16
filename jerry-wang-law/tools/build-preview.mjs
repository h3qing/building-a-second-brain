/**
 * Builds a single-file, self-contained preview of the exported site.
 *
 * The real site is many pages served by a host; a preview shared as an
 * artifact is one page with no server, and the viewer wraps it in its own
 * document skeleton. So this takes the static export in ./out and folds it:
 * every route's <main> is inlined and shown by hash (#/contact/), the site's
 * stylesheet is inlined, fonts and textures become sibling files, Next's
 * runtime is dropped, and a short script stands in for the header's menu and
 * drawer. Nothing in src changes; run `npm run build` first.
 *
 *   node tools/build-preview.mjs        → ./preview/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
const dest = path.join(root, "preview");

const ROUTES = [
  "/",
  "/practice-areas/",
  "/practice-areas/business-law/",
  "/practice-areas/civil-litigation/",
  "/practice-areas/personal-injury/",
  "/practice-areas/family-law/",
  "/practice-areas/prenuptial-agreements/",
  "/practice-areas/real-estate-law/",
  "/practice-areas/criminal-law/",
  "/attorney/",
  "/contact/",
  "/disclaimer/",
];

const read = (p) => fs.readFileSync(p, "utf8");
const pageFile = (route) => path.join(out, route, "index.html");

/** Inner HTML of the first `<tag …>…</tag>` — tags here never nest themselves. */
function inner(html, open, close) {
  const start = html.indexOf(open);
  if (start < 0) throw new Error(`missing ${open}`);
  const from = html.indexOf(">", start) + 1;
  const end = html.indexOf(close, from);
  return html.slice(from, end);
}

const stripScripts = (s) => s.replace(/<script\b[\s\S]*?<\/script>/g, "");

/* Internal links become hash routes; asset paths lose their leading slash. */
const relink = (s) =>
  s
    .replace(/href="\/(?!\/)/g, 'href="#/')
    .replace(/src="\/(?!\/)/g, 'src="');

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.join(dest, "fonts"), { recursive: true });
fs.mkdirSync(path.join(dest, "textures"), { recursive: true });

/* ---- Stylesheet: inline, with fonts and textures pointed at siblings ---- */
const home = read(pageFile("/"));
const cssLinks = [...home.matchAll(/<link rel="stylesheet" href="(\/_next\/[^"]+\.css)"/g)].map((m) => m[1]);
let css = cssLinks.map((href) => read(path.join(out, href))).join("\n");

/* Font URLs are written relative to the chunk's own directory. */
css = css.replace(/url\((["']?)(?:\.\.\/media\/|\/_next\/static\/media\/)([^"')]+)\1\)/g, (_, q, file) => {
  fs.copyFileSync(path.join(out, "_next/static/media", file), path.join(dest, "fonts", file));
  return `url(${q}fonts/${file}${q})`;
});
css = css.replace(/url\((["']?)\/textures\/([^"')]+)\1\)/g, (_, q, file) => {
  fs.copyFileSync(path.join(out, "textures", file), path.join(dest, "textures", file));
  return `url(${q}textures/${file}${q})`;
});
/* next/font sets its --font-* variables through a class on <html>, which the
   preview does not control; hand those declarations to :root instead. */
css = css.replace(/\.[A-Za-z0-9_]+-module__[A-Za-z0-9_]+__variable(?=\s*[,{])/g, ":root");

/* ---- Body: chrome from the home page, one section per route ---- */
let body = relink(stripScripts(inner(home, "<body", "</body>")));
const routeSections = ROUTES.map((route) => {
  const main = relink(stripScripts(inner(read(pageFile(route)), '<main id="main"', "</main>")));
  return `<section class="route" data-route="${route}"${route === "/" ? "" : " hidden"}>${main}</section>`;
}).join("\n");
body = body.replace(/<main id="main">[\s\S]*?<\/main>/, `<main id="main">\n${routeSections}\n</main>`);

const previewCss = `
/* ---- preview-only ------------------------------------------------------ */
.reveal { opacity: 1; transform: none; }          /* the page at rest, no observer */
.hdr { top: env(safe-area-inset-top, 0px); }      /* the viewer pads the root for the phone's status bar */
.preview-note {
  position: fixed; right: 0.75rem; bottom: 0.75rem; z-index: 300;  /* right: the site's calls to action all sit left */
  padding: 0.45rem 0.7rem; font: 500 0.66rem/1.2 var(--font-sans);
  letter-spacing: 0.14em; text-transform: uppercase;
  background: var(--ink); color: var(--paper); opacity: 0.85;
}
@media (max-width: 52rem) { .preview-note { bottom: 4.6rem; } }
`;

const script = `
(function () {
  var routes = Array.prototype.slice.call(document.querySelectorAll('.route'));
  var hdr = document.querySelector('.hdr');
  var group = document.querySelector('.hdr__nav-group');
  var trigger = group && group.querySelector('a');
  var chevron = group && group.querySelector('.hdr__chevron');
  var mega = document.querySelector('.hdr__mega');
  var burger = document.querySelector('.hdr__burger');
  var box = document.querySelector('.hdr__burger-box');
  var drawer = document.querySelector('.hdr__drawer');
  var timer;

  function setMega(open) {
    if (!mega) return;
    clearTimeout(timer);
    mega.hidden = !open;
    mega.classList.toggle('is-open', open);
    if (chevron) chevron.classList.toggle('is-open', open);
    if (trigger) trigger.setAttribute('aria-expanded', String(open));
  }
  function scheduleClose() { clearTimeout(timer); timer = setTimeout(function () { setMega(false); }, 140); }
  function setDrawer(open) {
    if (!drawer) return;
    drawer.hidden = !open;
    drawer.classList.toggle('is-open', open);
    if (box) box.classList.toggle('is-open', open);
    if (burger) burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  function show() {
    var hash = location.hash || '#/';
    if (hash.charAt(1) !== '/') return;            /* an in-page anchor such as #main */
    var route = hash.slice(1);
    var hit = routes.some(function (s) { return s.dataset.route === route; });
    if (!hit) route = '/';
    routes.forEach(function (s) { s.hidden = s.dataset.route !== route; });
    document.querySelectorAll('.hdr__nav-link').forEach(function (a) {
      var href = a.getAttribute('href').replace(/^#/, '');
      a.classList.toggle('is-current', href === '/' ? route === '/' : route.indexOf(href) === 0);
    });
    setMega(false); setDrawer(false);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', show);
  show();

  window.addEventListener('scroll', function () { hdr.classList.toggle('is-scrolled', window.scrollY > 8); }, { passive: true });
  if (group) { group.addEventListener('mouseenter', function () { setMega(true); }); trigger.addEventListener('focus', function () { setMega(true); }); }
  if (mega) mega.addEventListener('mouseenter', function () { setMega(true); });
  hdr.addEventListener('mouseleave', scheduleClose);
  if (burger) burger.addEventListener('click', function () { setDrawer(drawer.hidden); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setMega(false); setDrawer(false); } });

  /* The static export has no server; the form composes an email instead. */
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f.classList || !f.classList.contains('form')) return;
    e.preventDefault();
    var d = new FormData(f);
    var lines = ['Name: ' + d.get('firstName') + ' ' + d.get('lastName'), 'Email: ' + d.get('email'),
      'Phone: ' + d.get('phone'), 'Company: ' + (d.get('company') || '—'), 'Matter: ' + (d.get('matter') || '—'), '', String(d.get('message') || '')];
    location.href = 'mailto:info@jerrywanglaw.com?subject=' + encodeURIComponent('Website enquiry') + '&body=' + encodeURIComponent(lines.join('\\n'));
  });
})();
`;

const html = `<title>Jerry Wang Law</title>
<style>
${css}
${previewCss}
</style>
${body}
<div class="preview-note" aria-hidden="true">Preview · photographs not yet placed</div>
<script>${script}</script>
`;

fs.writeFileSync(path.join(dest, "index.html"), html);
const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + " KB";
console.log(`preview/index.html  ${kb(path.join(dest, "index.html"))}  (${ROUTES.length} routes)`);
for (const dir of ["fonts", "textures"]) {
  for (const f of fs.readdirSync(path.join(dest, dir))) console.log(`preview/${dir}/${f}  ${kb(path.join(dest, dir, f))}`);
}
