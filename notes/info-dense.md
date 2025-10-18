# Tasklist Information Density Plan

_Last updated: October 18, 2025_

## Guiding Principles
- Prioritize scannability: dense layouts must keep typography legible and interactive targets accessible.
- Preserve direct manipulation: frequent actions should remain inline to avoid modals or deep menus.
- Keep progressive disclosure: advanced controls collapse by default but remain one click or shortcut away.
- Treat timer context as always visible; no layout mode should hide active task feedback.

## Layout & Structure Initiatives
- [ ] **Responsive task workspace width** — Allow the task column to expand on large screens while capping max width and using generous inner padding so text remains readable.
- [ ] **Compact task rows** — Rebuild `TaskItem` spacing so the summary line fits on one row by default, with secondary metadata (status, assignee, timers) tucked into inline badges or hoverable affordances.
- [ ] **Sticky side utilities** — Convert `SidePanel` into a sticky column that remains anchored on scroll, ensuring data snapshots and active controls stay visible even at deep scroll positions.
- [ ] **Collapsible sidebar with floating timer** — Add a slide-out affordance to collapse the side panel; when collapsed, show a minimal floating timer popover that exposes start/pause, elapsed time, and quick re-open.

## Task Editing Experience
- [ ] **Inline editable descriptions** — Replace the separate description surface with an inline Markdown editor inside each `TaskItem`, mirroring git commit UX (summary first line, optional body after a blank line).
- [ ] **Live Markdown rendering** — Provide instant preview for Markdown formatting (bold, lists, code) either via split view toggle or focus/blur transformation.
- [ ] **Keyboard-first creation** — Introduce shortcuts for `new task`, `new sibling task`, `new subtask`, and quick indentation/outdent to mirror text-editor ergonomics.

## Additional Density Opportunities
- [ ] **Hierarchy focus modes** — Offer single-project and single-branch focus toggles that temporarily collapse unrelated branches to reduce vertical sprawl.
- [ ] **Adaptive metadata display** — Surface due dates, tags, or owners as icons with tooltips; expand to full text on hover or keyboard focus.
- [ ] **Batch actions toolbar** — Provide a contextual toolbar that appears when multiple tasks are selected to reduce repeated trips to the sidebar.
- [ ] **Search & filter ribbon** — Keep lightweight filters (status, tag, time window) persistent at the top bar for quick slicing.
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
