# Capybara

Neurosec **tropical endless runner** — one button / tap to hop. **Vite**, **React 19**, and the same **Elata** EEG + rPPG patterns as [Reaction Trainer](https://github.com/wkyleg/reaction-trainer), with an opinionated **jungle / lagoon / sunset** UI (Fredoka + Nunito, Tailwind v4 `@theme`).

The legacy **single-file** prototype stays as [`original.html`](./original.html).

## Play locally

```bash
pnpm install
pnpm dev
```

Open the URL Vite prints (default port `3010`).

## Build

```bash
pnpm build
```

For a local Pages-style build (use your GitHub repo name as the path prefix):

```bash
GITHUB_PAGES=true GITHUB_PAGES_BASE=/<your-repo-name>/ pnpm build
```

## Controls

- **Space / tap / click** — jump (hold slightly for higher hop)
- **P** — pause
- **R** — restart run
- With sensors: **calm / arousal** gently change scroll speed and obstacle spacing (slider under Settings).

## Stack

- `@elata-biosciences/eeg-web`, `eeg-web-ble`, `rppg-web`
- Session recording + **Canopy report** charts (Recharts)
- Hash routing for static hosting

## App store assets (PNGs + listing)

Store PNGs and **`listing.json`** normally live under **`docs/store-assets/`** (WebP) with masters in a separate **app-store-assets** checkout if you use the Elata asset scripts.

1. Set **`OPENAI_KEY`** in your environment (see the app-store-assets package README and its `.env.example` wherever you keep that repo).
2. From app-store-assets: `npm run generate-images:capybara` — DALL·E 3 PNGs, then `npm run process-screenshots` to refresh **`docs/store-assets/`** in this repo.
3. Optional: `npm run generate-listing:capybara` to draft listing copy (review before commit).

## GitHub Pages

This repository is meant to be the **Git root** (not a subfolder inside a larger monorepo).

1. Create a GitHub repo and push **only** the contents of this project as the default branch **`main`**.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions** (first run may ask you to approve the `github-pages` environment).
3. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds on every push to `main` with `GITHUB_PAGES=true` and `GITHUB_PAGES_BASE=/<repo-name>/` so Vite’s base path matches `https://<user>.github.io/<repo>/`.

## License

ISC
