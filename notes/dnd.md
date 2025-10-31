# Drag-and-Drop Task Reordering (2025-10-31)

## Current State
- Pointer users rely on Up/Down buttons in `TaskRowSummary.svelte:220` and must repeat clicks to traverse long lists.
- Keyboard shortcuts already support reorder (`Alt+↑/↓`), indent (`Alt/Shift+Tab`), and structural safety via `runStructuralCommand` in `TaskItem.svelte:184`.
- Task hierarchy is shallow in most projects but can become deeply nested; `TaskItem` clamps visual indent to `4.4/3rem`.
- Data layer only reorders within the current parent (`moveTask`) or single-level indent/outdent transformations; no generic “move to arbitrary parent/index” helper yet.

## Goals
- Give mouse/touch users a predictable, learnable way to drag tasks anywhere in the tree.
- Preserve the ability to reorder without breaking existing keyboard-first workflows.
- Make indentation changes discoverable during the drag, with low error cost.
- Keep the interface accessible (screen readers, high-contrast, reduced motion).

## Non-Goals
- Writing the full implementation today.
- Changing existing keyboard shortcuts; they already serve power users well.
- Virtualizing the task list; current DOM size is manageable.

## Design Principles
- **Visible affordance:** Provide a left-aligned grip that signals drag capability without crowding the expand toggle.
- **Intent clarity:** While dragging, show explicit drop previews (line + badge) so users know if the result is sibling reorder or new parent.
- **Undo safety:** Structural changes should still push to `taskStore` history so future undo/redo work has clean hooks.
- **Touch-friendly:** Minimum 36px square hit area for the handle.

## UX Alternatives

### Option A – Handle + Horizontal Thresholds *(Recommended)*
1. Add a dedicated drag handle between the expand toggle and title. The handle acts as the exclusive drag start region; clicking it without drag does nothing.
2. On drag start, ghost the task card and insert a placeholder row matching current height.
3. As the pointer crosses list rows, highlight potential drop targets and render a vertical bar to indicate insertion point.
4. Detect horizontal offset relative to the origin indent. Offsets within ±0.5 indent keep the task as a sibling; exceeding +0.75 indent once allows dropping as a child of the hovered row; going negative beyond −0.75 outdents one level (capped at root).
5. Auto-expand collapsed tasks after 500 ms hover to enable dropping into their children.
6. On drop, dispatch a generalized `taskStore.moveTaskTo({taskId, targetParentId, targetIndex})`, falling back to indent/outdent helpers when appropriate.

**Pros**
- Mimics established tree editors (Linear, Notion) so users transfer knowledge quickly.
- Single drag gesture covers reorder + indent changes, reducing follow-up adjustments.
- Horizontal thresholds align with visual indent, reinforcing hierarchy mentally.

**Cons**
- Requires robust collision math to prevent accidental parent changes.
- Needs careful tuning for small screens where available horizontal space shrinks.

### Option B – Handle + Drop Intent Palette
1. Drag handle only sets the vertical drop location (before/after another task).
2. On drop, show a context popover with three intents: “Place above/below”, “Nest under target”, “Detach to parent level”.
3. Users confirm intent with a quick click or by pressing 1/2/3. Optional “always remember my choice” checkbox.

**Pros**
- Simplifies drag hover logic; only vertical positioning matters during drag.
- Reduces accidental hierarchy changes, because users confirm intent explicitly.

**Cons**
- Adds a second decision step, slowing down repetitive reordering.
- Popovers risk covering nearby tasks; requires escape handling and focus traps.
- Feels clunkier on touch devices where the popover steals flow.

### Recommendation
Adopt **Option A**. It keeps the interaction fluid, aligns with user expectations for modern outliners, and keeps the hierarchy change inside the same gesture. Employ generous thresholds, visual badges (“↳ Nest under *Task A*”) and undo support to mitigate misdrops.

## Decision
- Commit to Option A (handle + horizontal thresholds) as the drag-and-drop model for implementation.
- Keep Option B documented solely as a fallback exploration; no engineering work planned for it unless usability testing uncovers blockers.

## Detailed Interaction Notes (Option A)
- **Handle Placement:** 24px wide grip with `aria-label="Drag task"`; only it exposes `draggable`. Expand toggle remains the leftmost control, preserving muscle memory.
- **Drop Previews:** Placeholder row inherits `task-row` styling with dashed border. Display a small tooltip near the cursor (e.g., “Drop as child of ‘Sprint Planning’”).
- **Indent Feedback:** Animate the placeholder snapping horizontally to the computed indent level so the future hierarchy is obvious.
- **Auto-Scroll:** When dragging near container edges, scroll the list to reveal additional drop targets.
- **Touch Support:** Long-press (~180 ms) activates drag handle; vibrate lightly via Web Vibration API when available.
- **Abort Behavior:** Escape or dropping outside cancels and restores the original row.

## Accessibility
- Use `role="application"` sparingly; prefer `aria-grabbed` on the handle, announce “Grabbed {task title}. Use arrow keys to move, space to drop.” when keyboard users press Space on the handle.
- Maintain existing keyboard shortcuts untouched; expose a context menu shortcut (“Move via keyboard”) for screen reader discoverability.
- Keep motion subtle and respect `prefers-reduced-motion`.

## Technical Outline
- **Store:** Implement `moveTaskTo` in `taskTree.ts` that takes `{taskId, destinationParentId, destinationIndex}`. Update `taskStore` to expose `moveTaskTo` and persist via `withDataUpdate`.
- **Components:** Extract shared DnD logic into `src/lib/components/dnd/taskDragContext.ts` (Svelte store) to track drag state and broadcast events to `TaskItem`.
- **Events:** Replace `task-row` pointerdown handler for selection with a check that bypasses when the drag handle initiates; ensure selection still happens on row click.
- **Auto-expand:** Manage timers in `TaskItem` scoped to the hovered target to avoid global state churn.
- **Testing:** Add Vitest coverage for `moveTaskTo` (reordering across parents, deep indent/outdent). Consider Playwright story for drag flows post-MVP.

## Risks & Open Questions
- Determining indent thresholds that feel right across desktop and mobile; may need responsive tuning.
- Performance for large trees if re-rendering every row on drag; might require throttled derived stores.
- Interaction with snapshots/import/export—ensure drag updates still mark `updatedAt`.

## Implementation To-Do
- [ ] **Data layer:** Implement and test `moveTaskTo` in `taskTree.ts`, surface it through `taskStore`, and ensure updated tasks touch `updatedAt`.
- [ ] **Drag context:** Scaffold shared DnD state (`taskDragContext`) to coordinate active drag metadata across `TaskItem` instances.
- [ ] **UI affordance:** Add the drag handle, placeholder styling, and horizontal threshold logic to `TaskRowSummary`/`TaskItem`; guard behind a feature flag for the spike phase.
- [ ] **Auto behaviors:** Implement hover-to-expand, auto-scroll, and indentation snapping animations with respect for `prefers-reduced-motion`.
- [ ] **Accessibility:** Announce drag state changes, expose keyboard equivalents via the handle, and verify focus management during abort/drop.
- [ ] **Validation:** Run targeted Vitest suites and capture a lightweight manual test script (desktop + touch) before promoting the feature flag.
