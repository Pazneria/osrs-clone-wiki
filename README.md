# OSRS Clone Wiki

This repository hosts the standalone wiki site for the OSRS Clone project.

The wiki does not duplicate gameplay facts by hand. Instead, it syncs a versioned export bundle from the sibling `OSRS Clone` repo and turns that bundle into static pages.

GitHub Pages deployment is handled by `.github/workflows/deploy-pages.yml`. The workflow checks out both this repo and `Pazneria/osrs-clone`, builds the static site, and publishes `dist/osrs-clone-wiki/` to `https://pazneria.github.io/osrs-clone-wiki/`.

## Expected workspace layout

This repo assumes the game repo sits beside it:

- `../OSRS Clone`
- `../osrs-clone-wiki`

## Scripts

```powershell
npm run sync:data
npm run check
npm run build
npm run serve
```

What they do:

- `sync:data`: runs the exporter in `../OSRS Clone` and copies the bundle into `content/generated/wiki-export/`
- `check`: syncs the bundle and validates routes, indexes, and cross-links
- `build`: syncs the bundle and generates the static wiki site into `dist/osrs-clone-wiki/`
- `serve`: builds and serves the generated site locally at `http://localhost:5520/osrs-clone-wiki/`

## Route contract

The wiki uses stable ID routes from the export manifest:

- `/osrs-clone-wiki/items/:itemId`
- `/osrs-clone-wiki/skills/:skillId`
- `/osrs-clone-wiki/world/:worldId`

Optional query params:

- `from=arcade|game`
- `return=<encoded-url>`
