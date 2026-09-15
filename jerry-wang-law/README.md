# Jerry Wang Law — website

A redesign of the firm's website, built as a statically exported Next.js site so
it can be hosted on Vercel, Netlify, Cloudflare Pages, or any static host.

## Status

Scaffold only. The project builds and the toolchain is pinned, but no pages have
been written yet.

The rebuild is blocked on source content. `jerrywanglaw.com` is not reachable
from the development environment this was started in — the network egress proxy
rejects it at the CONNECT stage under organization policy, so `WebFetch`, `curl`
and headless Chromium all fail identically. None of the firm's real details
(attorney name, phone, address, bar admissions, practice areas) are known here,
and none of them should be invented: publishing a wrong phone number or an
inaccurate claim about a lawyer's admissions on a law firm's own site is a real
harm, not a cosmetic bug.

To unblock, supply any one of:

- the firm's details directly (name, attorney, phone, fax, email, address,
  hours, practice areas, education, bar admissions, associations, languages);
- a saved copy of the existing site's HTML; or
- network access to the domain, by adjusting the environment's egress policy.

Once content is available it goes in a single content module, so the rest of the
site reads from one source of truth.

## Stack

- Next.js 16 (App Router, Turbopack) with `output: "export"`
- React 19
- TypeScript
- Plain CSS with custom properties — no CSS framework, to keep the bespoke
  visual design unconstrained

## Commands

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to ./out
```
