# Tasklist Information Density Plan

_Last updated: October 19, 2025_

## Guiding Principles
- Prioritize scannability: dense layouts must keep typography legible and interactive targets accessible.
- Preserve direct manipulation: frequent actions should remain inline to avoid modals or deep menus.
- Keep progressive disclosure: advanced controls collapse by default but remain one click or shortcut away.
- Treat timer context as always visible; no layout mode should hide active task feedback.

## Layout & Structure Initiatives
- [x] **Responsive task workspace width** — Allow the task column to expand on large screens while capping max width and using generous inner padding so text remains readable. _Shipped October 18, 2025 — widened `+page.svelte` container to max-w-[120rem]._
- [x] **Compact task rows** — Rebuild `TaskItem` spacing so the summary line fits on one row by default, with secondary metadata (status, assignee, timers) tucked into inline badges or hoverable affordances. _Shipped October 18, 2025 — introduced `TaskRowSummary` and density utilities._
- [x] **Sticky side utilities** — Convert `SidePanel` into a fixed column that remains anchored on scroll, ensuring data snapshots and active controls stay visible even at deep scroll positions. _Shipped October 19, 2025 — reserved right-edge space on large screens, fixed the sidebar, and added an internal scroll container with dedicated styling so utility cards stay pinned yet independently scrollable._
- [x] **Selected task detail card** — Surface contextual metadata without leaving the task list by pairing a persisted `selectedTaskId` with a new `TaskDetailsCard`. _Shipped October 19, 2025 — Task rows now expose a selection highlight distinct from the in-progress timer state, and the SidePanel card shows read-only timestamps/summary while we stage inline editing._
- [ ] **SidePanel accordion discipline** — Allow only one utility card to expand at a time to reduce vertical sprawl inside the fixed panel.
- [ ] **Floating timer control** — Surface a compact timer widget that stays visible while the sidebar is collapsed or scrolled out of view.
- [ ] **Collapsible sidebar with floating timer** — Add a slide-out affordance to collapse the side panel; when collapsed, show a minimal floating timer popover that exposes start/pause, elapsed time, and quick re-open.

## Task Editing Experience
- [x] **Inline editable descriptions** — Replace the separate description surface with an inline Markdown editor inside each `TaskItem`, mirroring git commit UX (summary first line, optional body after a blank line). _Shipped October 19, 2025 — Shift+Enter turns the task title field into a multi-line commit-style editor; blur or ⏎ (no modifiers) commits, and the store splits the first line into title + body._
- [ ] **Live Markdown rendering** — Provide instant preview for Markdown formatting (bold, lists, code) either via split view toggle or focus/blur transformation.
- [ ] **Keyboard-first creation** — Introduce shortcuts for `new task`, `new sibling task`, `new subtask`, and quick indentation/outdent to mirror text-editor ergonomics.  
  _Design scope (drafted October 18, 2025)_  
  - [x] Commit-on-create: `Enter` accepts the current title and immediately spawns a focused sibling edit row; `Shift+Enter` nests a new child under the active task and opens it for editing.  
    _Shipped October 18, 2025 — Enter commits an inline edit and creates a new sibling draft; Escape cancels edits and removes untouched draft tasks. Shift+Enter reserved for multiline descriptions._
  - [ ] Navigation layer: when no input is focused, arrow keys or `j`/`k` move a “selection” highlight through visible tasks; `Enter` while navigating jumps into edit mode, `Space` toggles expansion.  
  - [ ] Mode affordance: while in navigation, apply a semi-transparent “glass” overlay to the app canvas and elevate the selected row so users see they are in keyboard mode.  
  - [x] Indent/outdent: map `Tab`/`Shift+Tab` (or `]`/`[`) to call new store helpers that reparent the selected task; guard browser focus wrappers by preventing default when navigation mode is active. _Shipped October 18, 2025 — added task tree reparent helpers with Tab/Shift+Tab shortcuts that keep the editor focused._
  - [ ] Cursor continuity: after indent/outdent reuse the prior caret position instead of refocusing with full selection, so typing resumes exactly where the user left off.

## Additional Density Opportunities
- [ ] **Hierarchy focus modes** — Offer single-project and single-branch focus toggles that temporarily collapse unrelated branches to reduce vertical sprawl.
- [ ] **Adaptive metadata display** — Surface due dates, tags, or owners as icons with tooltips; expand to full text on hover or keyboard focus.
- [ ] **Batch actions toolbar** — Provide a contextual toolbar that appears when multiple tasks are selected to reduce repeated trips to the sidebar.
- [x] **Search & filter ribbon** — Shipped October 18, 2025 — added a persistent top-of-workspace ribbon scaffold with search and filter placeholders. _Update October 18, 2025:_ Status selection now ships as preset chip group (All / Active / Completed / Archived) mapped to semantic filter combinations. _Next:_ connect the search input to task-tree querying, activate tag/time selectors, and surface dynamic result counts.
- [ ] **Density presets** — Ship “Comfortable / Compact / Ultra” spacing presets to let users control vertical rhythm without manual overrides.
- [ ] **Accessible color cues** — Audit contrast on densified UI to ensure WCAG AA compliance even after shrinking padding and font sizes.
- [ ] **Performance guardrails** — Validate that denser renders do not degrade scroll performance; instrument virtualization if needed as tasks scale.

## Cross-Cutting Considerations
- Refactor shared spacing tokens in `app.css` / Tailwind config to support density presets.
- Update store interactions to ensure inline editing and keyboard shortcuts do not conflict with existing timer controls.
- Add integration tests and accessibility checks (`npm run check`) focused on keyboard navigation and ARIA expectations for collapsible regions.
- Defer mobile and narrow-view optimizations to `notes/mobile-display.md` so desktop density can iterate independently.

## Tracking & Next Steps
- Maintain this note as the single source of truth for information-density workstreams.
- After completing each initiative, mark it as done, add implementation notes, and link to relevant pull requests or docs.
