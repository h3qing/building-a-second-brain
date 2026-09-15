# Law Offices of Jerry Wang — website

A rebuild of the firm's website: a statically exported Next.js site that can be
hosted on Vercel, Netlify, Cloudflare Pages, or any static host.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to ./out — upload this directory
```

## Design

Mid-century modern, taken from the materials of the period's furniture rather
than its novelty shapes: walnut, travertine, mustard wool, burnt orange,
glazed-ceramic teal, teak. The era's *structure* — strict grids, long
horizontals, geometric reduction, Didone-and-geometric-sans typography — does
the work of gravitas. None of the period's kitsch (starbursts, boomerangs,
pastels) is invited.

- **Type.** Bodoni Moda for display, Jost for everything else — the canonical
  modernist pairing. Self-hosted through `next/font`, so no request reaches
  Google when someone opens the site.
- **Illustration.** Every drawing is hand-written SVG in `components/Illustrations.tsx`
  — flat colour, no gradients, three colours each. There is no photography and
  no stock imagery anywhere on the site.
- **Colour blocking.** Each practice area carries its own chip from the palette,
  the way Alexander Girard blocked a textile range. The colour appears in the
  area's illustration, its card rule, and its page.
- **Motifs.** A brass-line arcade and a breeze-block screen — the perforated
  wall of every mid-century California building.

### Accessibility

Every text/background pair in the palette meets WCAG AA (4.5:1 for body,
3.0:1 for large display type). Two constraints fall out of that and are worth
keeping if the palette is ever extended:

- **Ochre (`--ochre`) may not carry text on travertine** — it reaches only
  2.02:1. It is a colour for shapes and rules. Small accent text uses
  `--accent-ink`, large type uses it too.
- **The ochre button takes ink-coloured labels, not white.** Dark on mustard is
  6.96:1; white on mustard is 3.76:1 and fails.

Also: skip link, visible focus rings, one `h1` per page with no skipped
heading levels, labelled form fields, and `prefers-reduced-motion` honoured.

## Where the content lives

`src/content/site.ts` is the single source of truth — firm details, contact
information, practice areas, credentials, and copy. Editing that file changes
the whole site; no page hard-codes a phone number or an address.

Facts in it (name, phone, address, email, education, bar membership, the list
of practice areas) are transcribed from the firm's previous website and are
real. The per-practice-area prose was written for this rebuild and is marked
`newCopy` — **the attorney should read it before launch**, both for accuracy
and because California's Rules of Professional Conduct 7.1–7.5 govern what a
law firm may say in its own advertising.

Two things the old site did not publish and this one therefore does not invent:

- **Office hours.** Worth adding — "are they open now?" is a common reason
  someone leaves a law firm's site.
- **A portrait.** The attorney page holds the space with the monogram instead
  of a stock photograph.

## Navigation

The brief was that important information should be easy to find, so:

- The phone number is on screen at every scroll position — in the utility
  strip, in the header button, and, on phones, in a fixed bottom bar with
  Call / Email / Directions.
- Practice areas open as a panel with every area, its illustration, and a
  one-line description, rather than a list of bare links.
- Every page has breadcrumbs; every practice-area page links to the other six.
- Phone numbers are `tel:` links, the address opens in Maps.

## The contact form

The site is static, so there is no server to post to. Set
`NEXT_PUBLIC_FORM_ENDPOINT` to a form service (Formspree, Basin, Netlify Forms)
and submissions go there. With no endpoint configured the form composes an
email in the visitor's own mail client instead — it never silently drops a
message.

## SEO

`LegalService` structured data in the root layout, per-page metadata, a
generated `sitemap.xml` and `robots.txt`. The structured data is the highest-
leverage piece here, since the practice depends on local search.
