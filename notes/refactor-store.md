# Task Store Refactor Plan

_Last updated: October 29, 2025_

## Objectives
- Reduce `src/lib/stores/taskStore.ts` surface area by extracting pure helpers, selectors, and side effects into cohesive modules.
- Preserve the public store API while shrinking mutation complexity for easier testing and future upgrades.
- Lay groundwork for eventual multi-store or service-based architecture without blocking near-term iterations.

## Short-Term Refactor Tasks
- [x] **Extract normalization utilities** — Move task/session normalization helpers into `src/lib/core/normalization.ts`, export typed functions, update store imports.
- [x] **Lift filter helpers** — Relocate status ordering/equality helpers to `src/lib/core/taskFilters.ts` (or similar) for reuse by UI and tests.
- [x] **Spin out derived selectors** — Create `src/lib/stores/taskSelectors.ts` that exports memo-friendly derived stores (`activeProject`, `filteredProject`, etc.) so the main store file focuses on mutations/state.
- [x] **Isolate export/import helpers** — Wrap download URL life-cycle logic in `src/lib/core/exporter.ts` and consume it from the store to reduce direct DOM API usage.
- [x] **Document timer contract** — Add concise comments describing tick lifecycle and entry points, preparing for later extraction.
- [x] **Run `npm run check`** — Ensure type/a11y validation passes after the extractions.

## Longer-Term Refactor Initiatives
- [ ] **Timer service module** — Encapsulate interval control in a dedicated helper that takes callbacks, enabling SSR-safe mocks and unit testing.
- [ ] **Split UI state from data state** — Consider separate writable store for view concerns (`previewTaskId`, `focusedEditorTaskId`, filters) to reduce coupling with persistence logic.
- [ ] **Session editing API redesign** — Replace mutation command nesting with declarative session updater utilities shared across components.
- [ ] **File-size guardrails** — Add lint/CI check to flag store modules that exceed a line-count threshold, keeping future sprawl in check.
- [ ] **Adopt domain-driven slices** — Evaluate migrating from monolithic store to composable domain stores (projects, tasks, sessions) once extracted helpers are stable.

## Coordination Notes
- Align extracted module naming with existing `core/` folder conventions to aid discoverability.
- Update `notes/report.md` once short-term tasks land to capture scope, testing, and follow-ups.
- Revisit this plan after the short-term list is complete to reprioritize long-term initiatives.
