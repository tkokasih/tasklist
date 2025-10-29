# Asset Updates

_Last updated: October 29, 2025_

## App Icons
- **Finalized stacked-lane concept** now outputs both `static/icons/icon-512.png` and `static/icons/icon-192.png` via reproducible script `scripts/generate-icons.js`.
- **Palette** leans on deep slate backgrounds with blue/aqua/violet accents to stay aligned with current branding while emphasizing layered planning.
- **Workflow**: run `node scripts/generate-icons.js` to regenerate both PNGs after tweaking colors or layout; script encodes PNGs directly (no external deps).

## Tooling
- **ESLint + Prettier** wired in via `npm run lint`, `npm run lint:fix`, `npm run format`, and `npm run format:check` for consistent Svelte + Tailwind hygiene.
