# Tasklist Project Overview for Agents

This document orients automation or coding agents to the structure and responsibilities of the Tasklist application after the home page redesign and data layer work.

## Tech Stack

- **Framework**: SvelteKit + Vite
- **UI Styling**: Tailwind classes (configured via `tailwind.config.cjs`, `app.css`)
- **TypeScript**: Enabled by default (`tsconfig.json`)
- **Build**: `npm run build` (SvelteKit), `npm run check` for type and a11y validation

## Source Layout

```
src/
  app.css                 Global styles; Tailwind entry.
  lib/
    core/                 Pure logic modules (UI-agnostic).
      taskTypes.ts        Type definitions for Task/Project/Snapshot.
      taskTree.ts         Immutable task tree utilities (create, update, move).
      persistence.ts      LocalStorage serialization helpers, export/import utils.
      time.ts             Formatting helpers for durations & timestamps.
    stores/
      taskStore.ts        Central writable store handling state, timer loop, snapshots.
    components/           Svelte components built for reuse.
      ProjectHeader.svelte      Project switching/creation UI.
      TaskTree.svelte           Wrapper for task list and new-task form.
      TaskItem.svelte           Recursive task renderer with controls.
      SidePanel.svelte          Container composing sidebar cards.
      DataCard.svelte           Snapshot/import/export UI.
      ActiveTasksCard.svelte    Active task controls/history view.
      CollapsibleCard.svelte    Shared collapsible card shell.
    index.ts              Barrel exports for components/stores/types.
  routes/
    +page.svelte          App homepage assembling ProjectHeader, TaskTree, SidePanel.

static/                   Static assets served as-is.
build/                    Output from the most recent build (ignored during dev).
```

## Data Flow Summary

1. **State Store (`taskStore`)**
   - Loads initial data (default project/tasks) or LocalStorage payload.
   - Exposes actions to mutate projects, tasks, timer state, snapshots.
   - Persists mutations back to LocalStorage (`STORAGE_KEY`).
   - Manages a `setInterval` tick when a task is “in-progress” to increment `timeSpentMs`.
   - Provides derived stores (`activeProject`, `activeTask`, `recentTasks`, etc.) used by the UI.

2. **Core Utilities (`core/`)**
   - `taskTree.ts` handles immutable transformations: add/reorder tasks, snapshot management, search.
   - `persistence.ts` wraps JSON serialization + browser-specific helpers such as download URLs.
   - `time.ts` provides formatting helpers to keep formatting logic outside components.

3. **UI Composition**
   - `routes/+page.svelte` sets the layout using responsive two-column structure (main + sidebar).
   - Task hierarchy rendered via `<TaskTree>` and recursive `<TaskItem>` components.
   - Right sidebar uses `<SidePanel>` to stack `<DataCard>` and `<ActiveTasksCard>` components.
   - Components import store actions to dispatch state updates; non-UI logic remains in `core/`.

## Key Workflows

- **Nested Task Management**: `TaskItem` recursively renders children; actions call store methods (`addTask`, `moveTaskUp/Down`, `archiveTask`, etc.).
- **Timer Tracking**: Starting a task calls `taskStore.startTask`, which pauses previous tasks, sets status, starts interval loop for time accumulation.
- **Snapshots**: `DataCard` uses `taskStore.saveSnapshot/restoreSnapshot/deleteSnapshot`. Snapshots stored in state and persisted via LocalStorage.
- **Import/Export**: Export triggers `taskStore.exportData` to create a download blob; import reads JSON and hands off to `taskStore.importData`.

## Commands & Testing

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Type/a11y checks: `npm run check` (invoked post-changes; currently warning-free)
- Unit tests: `npm run test` (Vitest suite; GitHub Actions runs this before building)
- Build for production: `npm run build`

## Notes for Agents

- Structured clone usage in `taskTree.ts` falls back to JSON cloning for environments without `structuredClone`.
- LocalStorage interactions guarded by SvelteKit `browser` flag to avoid SSR issues.
- Timer interval lives in store module scope; ensure `stopTicking` called when cleaning up (e.g., snapshot restore, archive).
- When extending UI, prefer composing from existing core functions or extending them in `core/` to keep presentation lean.
- For every new task, craft and share a big-picture design plan before touching implementation details. When it fits within reasonable token cost and the task warrants comparison, propose up to two viable alternative solutions with concise pros/cons and call out the recommended approach before proceeding.
- The app is being upgraded for PWA installability; expect `static/manifest.webmanifest`, icon assets under `static/icons`, and a custom `src/service-worker.ts` that caches the built assets—mind cache versioning when touching these.
- Use the `notes/` directory for persistent planning artifacts (e.g., `notes/info-dense.md` tracks the information density roadmap); update relevant notes when starting or landing major work so future agents remain aligned.
- When recording action items in shared notes, use markdown todo markers like `[ ]` so open tasks stay easy to scan.
