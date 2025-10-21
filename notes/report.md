# Reporting Roadmap

## Vision
- Surface time spent per task directly in the existing hierarchy so users can explore context, compare sibling tasks, and drill into subtasks without switching screens.
- Allow flexible period breakdowns (daily/weekly/custom ranges) and ensure active timers update the aggregates in real time.
- Provide export and sharing hooks (CSV, snapshot links) after in-app reporting is stable.

## Guiding Constraints
- Reuse the current task tree rendering path to avoid duplicating traversal logic or diverging UX.
- Keep reporting lightweight enough to run in the browser without degrading main interactions; defer heavy calculations to background workers only if profiling indicates a need.
- Maintain compatibility with LocalStorage persistence and snapshot import/export formats.

## Incremental Delivery Plan
- **Iteration 0 – Discovery & Instrumentation**
  - Audit existing task/session data for edge cases (missing durations, overlapping sessions).
  - Capture baseline performance considerations around `taskStore` ticks to monitor aggregation impact.
  - Document decisions on archived tasks, timezone handling, and concurrent timers (resolve Open Questions where possible).
- **Iteration 1 – Aggregation API**
  - Add `core/reporting/timeBuckets.ts` with pure aggregation helpers for configurable ranges (preset + custom start/end).
  - Add `core/time.ts` utilities for generating standard ranges and formatting summed durations.
  - Ship Vitest coverage for aggregation helpers and tick scenarios; guard by feature flag to keep UI untouched.
- **Iteration 2 – Store Integration**
  - Introduce memoized selectors in `stores/taskStore.ts` that expose aggregated results keyed by range configuration.
  - Ensure selectors recompute incrementally when active sessions tick; profile with synthetic load to confirm no frame drops.
  - Provide developer-facing story (Storybook sandbox or console demo) to validate data outputs before UI exposure.
- **Iteration 3 – Reporting Mode UI (Beta)**
  - Add a reporting toggle in the main toolbar or sidebar (`TaskTree` or `SidePanel`).
  - Render additional time columns in the existing tree when reporting mode is active; keep expand/collapse behavior intact.
  - Ship preset range selector (Today, This Week, Last 7 Days) and basic responsive styles in `src/app.css`.
  - Roll out behind a user-facing beta flag to gather feedback without disrupting current workflows.
- **Iteration 4 – Range Customization & Polish**
  - Add custom date range picker and persist the selection via LocalStorage.
  - Refine accessibility (focus order, column headers) and responsive scaling for narrower viewports.
  - Capture QA checklist and regression cases for user acceptance.
- **Iteration 5 – Exports & Summary Cards**
  - Hook aggregated data into export pipeline (CSV/JSON) and add sidebar summary cards (top tasks, totals).
  - Evaluate visual affordances (sparklines, progress bars) once text reporting is stable.
  - Measure usage; decide on beta flag removal and GA criteria.

## Validation & Release Strategy
- Each iteration ends with `npm run check` + targeted Vitest suites; add integration smoke test once reporting mode renders.
- Gate UI changes behind feature flags to allow internal QA before general availability.
- Track performance budget (ms spent per tick) and error rates across releases to catch regressions.

## Iteration 0 Outcomes (2025-10-21) — Completed
- **Data Audit**
  - `normalizeTaskSessions` in `src/lib/stores/taskStore.ts` backfills missing session fields, clamps negative durations, and synthesizes a fallback session when only `timeSpentMs` is present.
  - `incrementTaskTime` (`src/lib/core/taskTree.ts`) updates a single active task per tick and ensures negative deltas walk sessions backward without dropping below zero.
  - `taskStore.startTask` pauses any previously active task before starting a new one, so overlapping sessions only occur if multiple browser tabs run simultaneously; flag for anomaly detection during aggregation.
- **Policy Decisions**
  - Archived tasks: exclude by default in reporting mode, provide an “Include archived” toggle to surface historical data without cluttering active views. Completed tasks remain visible by default.
  - Timezone handling: rely on the browser’s local timezone for range boundaries; document that shared exports use ISO timestamps to remain timezone-agnostic.
  - Concurrent timers: treat as unsupported; add detection to aggregation helpers to log overlapping session warnings so the UI can flag inconsistent data.
- **Performance Baseline**
  - Current tick loop touches only the active task once per second; mutation depth is O(tree height) because `incrementTaskTime` updates a single path.
  - Instrumentation plan: add `performance.now()` sampling around the tick path before introducing aggregations and capture median/max over 60-second windows; store results in notes when collected.
  - Target budget: keep tick processing under 4 ms on mid-range hardware to avoid UI jank; revisit after aggregation prototypes run.

## Iteration 1 Progress (2025-10-21)
- Created `src/lib/core/reporting/timeBuckets.ts` with session aggregation helpers and range/option typings.
- Added Vitest coverage in `src/lib/core/reporting/timeBuckets.test.ts` verifying range clamping, status filters, and active-session detection.
- Extended helpers to aggregate entire task trees (returns normalized map) and aligned shared range types with `core/time.ts`.
- Added preset range builders (`buildPresetRange`) and supporting utilities (start/end of day/week) in `src/lib/core/time.ts`.
- Introduced project-level aggregation (`aggregateProjects`) and tightened status gating so archived tasks stay excluded by default.
- Defined selector integration plan: introduce `src/lib/stores/reportingSelectors.ts` exporting a memoized `createTimeAggregationSelector(range, options)` that wraps `aggregateProjects`, caches by serialized range+option key, emits `{ range, totals, warnings }`, and respects a `REPORTING_ENABLED` flag for gradual rollout.
- Landed `src/lib/stores/reportingSelectors.ts` with memoized selector factory, overlap warnings, and feature-flag guard, plus Vitest coverage (`src/lib/stores/reportingSelectors.test.ts`) validating caching, archived handling, and live updates.
- Updated `vitest.config.ts` to stub `$app/environment` and map `$lib` during tests, enabling store modules to run in Node without SvelteKit globals.
- Added tick loop instrumentation (`src/lib/stores/tickInstrumentation.ts`) and wrapped the interval in `taskStore` with `measureAndRecord`, capturing per-sample duration stats for future baseline logging (`src/lib/stores/tickInstrumentation.test.ts`).
- Next focus: finalize selector design for consuming aggregates and wire instrumentation before store integration.

## Next Steps
- Capture the first 60-second tick sample using the new instrumentation and update this note with observed numbers.
- Sketch how aggregated maps flow into reporting mode data structures to validate selector API requirements and drive UI shape.
- Prepare lightweight mockups for reporting mode to align on column layout before Iteration 3 work.

## Reporting Data Flow Sketch
- Selector entry (`createTimeAggregationSelector`) emits `{ range, totals, warnings }`.
- UI composition:
  - `TaskTree` (reporting mode) pulls selector output + raw task tree to render rows; uses map lookups (`totals.get(task.id)`) for per-column values without re-traversal.
  - Sidebar cards subscribe to the same selector for summary stats (total range sum, top tasks).
  - Warning stream -> badge/toast component highlighting tasks with active overlaps.
- State coordination:
  - Range selector component updates a derived store (`reportingRangeStore`) that feeds the selector factory.
  - Feature flag gating ensures legacy UI ignores reporting stores until enabled.
