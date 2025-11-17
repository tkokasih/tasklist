# Focus Mode Implementation Tracker

## Goals
- Let users tag high-priority tasks for Today or This Week without duplicating work.
- Keep focused tasks visible (with ancestors/subtasks) while encouraging clearing them quickly.
- Ensure focus metadata survives reloads, snapshots, and exports.

## Milestones
- [x] Extend `taskStore` schema with a lightweight `isFocused` boolean on tasks (note upgrade path if richer metadata returns).
  - 2025-11-12: Schema + normalization updated to persist `isFocused` while clearing on archive/complete.
- [x] Add "Focus" action to `TaskItem` controls so users can select or clear focused items inline.
  - 2025-11-12: Row summary button, badge, and styling shipped for initial focus UX.
- [x] Add "Focus Mode" filter/pill in `RibbonFilters.svelte` that toggles the scoped tree view and displays counts.
  - 2025-11-12: Ribbon pill toggles the scoped task tree, summary text shows "Focused only" clause with visible counts.
- [ ] Update `TaskTree` rendering to always include focused tasks, all descendants, and collapsed ancestor breadcrumbs.
- [ ] Implement optional ancestor one-liner UI that can expand on demand without exiting Focus Mode.
- [ ] Provide a compact focus summary surface (e.g., sidebar card or ribbon status) with quick clear/promote actions.
- [ ] Finalize the user-facing label for focused tasks (e.g., Spotlight, Priority Pick) and keep copy consistent across UI.
- [x] Cover persistence flows: import/export payloads, snapshots, and LocalStorage migrations for new focus fields.
  - 2025-11-12: Added data-version migration plus tests to ensure `isFocused` survives exports/imports and snapshot restores.
- [x] Add derived selectors/tests ensuring timers, archives, and deletions automatically drop focus flags.
  - 2025-11-12: Added `focusedTasks`/`focusedTaskIds` selectors plus store tests covering completion, archive, and delete flows.
- [ ] QA checklist: keyboard selection, mobile layout, and warning state when users exceed recommended focused tasks.

## Notes
- Track design decisions and wireframe links here as they evolve.
- Update checkbox status as work lands; add sub-bullets with PR references when applicable.
- Current implementation plan keeps per-task metadata to a single `isFocused` boolean; revisit Today/Week scopes later if we reintroduce tiered focus.
- Naming brainstorm to date: "Priority" and "Spotlight" both read well as nouns and verbs ("Add to Priority"); keep watching for better language.
- 2025-11-12: Added basic focus toggle button plus styling and persisted boolean flag via Codex pass.
- 2025-11-12: Focus-mode derived selectors and regression tests confirm timers/archives/deletes drop the flag automatically.
