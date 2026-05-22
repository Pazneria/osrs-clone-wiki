# OSRS Clone Codex

This repository hosts the standalone codex site for the OSRS Clone project.

The codex does not duplicate gameplay facts by hand. Instead, it syncs a versioned export bundle from the sibling `OSRS Clone` repo and turns that bundle into static pages.

GitHub Pages deployment is handled by `.github/workflows/deploy-pages.yml`. The workflow checks out both this repo and the sibling game source, builds the static site, and publishes `dist/osrs-clone-codex/`.

## Expected workspace layout

This repo assumes the game repo sits beside it:

- `../OSRS Clone`
- `../osrs-clone-codex`

## Scripts

```powershell
npm run sync:data
npm run check
npm run build
npm run dev
npm run serve
```

What they do:

- `sync:data`: runs the exporter in `../OSRS Clone` and copies the bundle into `content/generated/codex-export/`
- `check`: syncs the bundle and validates routes, indexes, and cross-links
- `build`: syncs the bundle and generates the static codex site into `dist/osrs-clone-codex/`
- `dev`: runs an initial build, serves the codex locally at `http://localhost:5520/osrs-clone-codex/`, watches both this repo and the sibling `OSRS Clone` source, and live-reloads after rebuilds
- `serve`: runs a single build and serves the generated codex locally with the browser opened automatically

## Route contract

The codex uses stable ID routes from the export manifest:

- `/osrs-clone-codex/items/:itemId`
- `/osrs-clone-codex/skills/:skillId`
- `/osrs-clone-codex/enemies/:enemyId`

Optional query params:

- `from=arcade|game`
- `return=<encoded-url>`
