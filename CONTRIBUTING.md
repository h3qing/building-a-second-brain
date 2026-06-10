# Contributing

Thanks for your interest in Building a Second Brain. This project is two parts: a **Next.js web app** (this repo) and a **vault pipeline** (the [`vault-template/`](./vault-template) starter that Claude Code runs). Contributions to either are welcome.

## Good first contributions

- **Source adapters** — new ways to get content into `10 Notes/` (Readwise, Pocket, RSS, Hypothesis, browser extension).
- **Deploy guides** — get the app running somewhere other than Vercel (Netlify, Docker, a VPS).
- **Review UIs** — better spaced-repetition surfaces (a `/concepts` index, mobile review, keyboard shortcuts).
- **Pipeline prompts** — improvements to `vault-template/CLAUDE.md` (better extraction, dedup, concept normalization).

Check the [`good first issue`](https://github.com/h3qing/building-a-second-brain/labels/good%20first%20issue) label.

## Development

```bash
npm install
cp .env.example .env.local   # fill in GITHUB_TOKEN + your vault repo + a PIN hash
npm run dev                  # http://localhost:3000
npm run build                # type-check + production build before opening a PR
npm run lint
```

You can point `GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` at any public vault that follows the schema in [`vault-template/00 Meta/schema.md`](./vault-template/00%20Meta/schema.md) to develop without your own data.

## Pull requests

- Keep PRs focused — one adapter, one fix, one guide.
- Run `npm run build` and `npm run lint` before pushing.
- Describe what changed and how you tested it. Screenshots help for UI changes.
- Don't commit secrets. `.env.local` is gitignored; keep it that way.

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, and your environment (Node version, deploy target). A repro or screenshot makes it 10× faster to fix.
