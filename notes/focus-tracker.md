# Focus Mode Implementation Tracker

## Goals
- Let users tag high-priority tasks for Today or This Week without duplicating work.
- Keep focused tasks visible (with ancestors/subtasks) while encouraging clearing them quickly.
- Ensure focus metadata survives reloads, snapshots, and exports.

## Milestones
- [ ] Extend `taskStore` schema with focus metadata on tasks (today/week flags, timestamps, ordering).
- [ ] Add "Focus" action to `TaskItem` controls so users can select or clear focused items inline.
- [ ] Add "Focus Mode" filter/pill in `RibbonFilters.svelte` that toggles the scoped tree view and displays counts.
- [ ] Update `TaskTree` rendering to always include focused tasks, all descendants, and collapsed ancestor breadcrumbs.
- [ ] Implement optional ancestor one-liner UI that can expand on demand without exiting Focus Mode.
- [ ] Provide a compact focus summary surface (e.g., sidebar card or ribbon status) with quick clear/promote actions.
- [ ] Cover persistence flows: import/export payloads, snapshots, and LocalStorage migrations for new focus fields.
- [ ] Add derived selectors/tests ensuring timers, archives, and deletions automatically drop focus flags.
- [ ] QA checklist: keyboard selection, mobile layout, and warning state when users exceed recommended focused tasks.

## Notes
- Track design decisions and wireframe links here as they evolve.
- Update checkbox status as work lands; add sub-bullets with PR references when applicable.
