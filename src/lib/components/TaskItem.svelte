<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Task } from "$lib/core/taskTypes";
  import type { SessionAggregation } from "$lib/core/reporting/timeBuckets";
  import { taskStore } from "$lib/stores/taskStore";
  import TaskRowSummary from "./TaskRowSummary.svelte";
  import type { ReportingColumnDefinition } from "$lib/stores/uiState";
  import {
    dndzone,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    TRIGGERS,
  } from "svelte-dnd-action";
  import type { DndEvent, Item as DndItem } from "svelte-dnd-action";
  import { locateTask } from "$lib/core/taskTree";
  import TaskShadowRow from "./TaskShadowRow.svelte";

  type TaskDndItem = DndItem & {
    id: string;
    taskRef?: Task;
  };

  // Reuse immutable empty collections so Svelte doesn't see a new reference every render.
  const EMPTY_TOTALS: Map<string, SessionAggregation> = new Map();
  const EMPTY_CONCURRENCY_IDS = new Set<string>();

  export let task: Task;
  export let depth = 0;
  export let reportingMode = false;
  export let reportingColumns: ReportingColumnDefinition[] = [];
  export let reportingTotals: Map<string, SessionAggregation> = EMPTY_TOTALS;
  export let reportingConcurrentTaskIds: Set<string> = EMPTY_CONCURRENCY_IDS;

  let expanded = true;
  let editing = false;
  let draftContent = "";
  let titleField: HTMLTextAreaElement | null = null;
  let isDraftNewTask = false;
  let wasEditing = false;
  let initialContentSnapshot = "";
  let pendingReapplyFocus = false;
  let isTitleMultiline = false;
  let reportingAggregation: SessionAggregation | null = null;
  let hasConcurrentSessions = false;
  let skipNextBlurCommit = false;
  let childZoneItems: TaskDndItem[] = [];
  let childDragActive = false;
  let hasChildRows = false;
  let hasChildShadow = false;

  const DND_ZONE_TYPE = "task-tree";
  const DND_FLIP_DURATION_MS = 150;

  $: state = $taskStore;
  $: isActive = state.data.activeTaskId === task.id;
  $: isSelected = state.data.selectedTaskId === task.id;
  $: isPreviewed = state.previewTaskId === task.id;
  $: latestSession = task.sessions?.length
    ? task.sessions[task.sessions.length - 1]
    : null;
  $: activeSessionElapsed =
    isActive && latestSession && !latestSession.endedAt
      ? Math.max(0, latestSession.durationMs)
      : 0;

  const findTaskById = (taskId: string): Task | null => {
    const located = locateTask(state.data.projects, taskId);
    return located?.task ?? null;
  };

  const buildChildZoneItems = (children: Task[]): TaskDndItem[] =>
    children.map((child) => ({
      id: child.id,
      taskRef: child,
    }));

  const ensureTaskRefs = (items: TaskDndItem[]): TaskDndItem[] =>
    items.map((item) => {
      if (item[SHADOW_ITEM_MARKER_PROPERTY_NAME]) {
        return item;
      }
      if (item.taskRef && item.taskRef.id === item.id) {
        return item;
      }
      const located = findTaskById(item.id);
      return located ? { ...item, taskRef: located } : item;
    });

  $: if (!childDragActive) {
    childZoneItems = ensureTaskRefs(buildChildZoneItems(task.children));
  }

  $: {
    hasChildRows = childZoneItems.some(
      (item) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME],
    );
    hasChildShadow = childZoneItems.some((item) =>
      Boolean(item[SHADOW_ITEM_MARKER_PROPERTY_NAME]),
    );
  }

  const handleChildConsider = (event: CustomEvent<DndEvent<TaskDndItem>>) => {
    childDragActive = true;
    childZoneItems = ensureTaskRefs(event.detail.items as TaskDndItem[]);
  };

  const handleChildFinalize = (event: CustomEvent<DndEvent<TaskDndItem>>) => {
    childZoneItems = ensureTaskRefs(event.detail.items as TaskDndItem[]);
    childDragActive = false;

    if (event.detail.info.trigger !== TRIGGERS.DROPPED_INTO_ZONE) {
      return;
    }

    const orderedItems = (event.detail.items as TaskDndItem[]).filter(
      (item) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME],
    );

    const destinationIndex = orderedItems.findIndex(
      (item) => item.id === event.detail.info.id,
    );

    if (destinationIndex === -1) {
      return;
    }

    taskStore.moveTaskTo({
      taskId: event.detail.info.id,
      destinationParentId: task.id,
      destinationIndex,
    });
  };

  // Compose the textarea content from the task title/description so we can round-trip edits.
  const composeTaskContent = (currentTask: Task) => {
    const baseTitle = currentTask.title;
    const body = currentTask.description?.trim();
    return body && body.length > 0 ? `${baseTitle}\n\n${body}` : baseTitle;
  };

  // Keep local editing state in sync with the last committed task data and manage focus handoff.
  $: {
    if (!editing) {
      draftContent = composeTaskContent(task);
      initialContentSnapshot = draftContent;
      isTitleMultiline = draftContent.includes("\n");
    }

    if (editing && !wasEditing) {
      initialContentSnapshot = draftContent;
      tick().then(() => {
        titleField?.focus();
        titleField?.select();
        resizeTitleField();
      });
    }

    wasEditing = editing;
  }
  // When another component requests focus here, reopen the editor and reapply focus after the DOM updates.
  $: if (state.focusedEditorTaskId === task.id) {
    if (!editing) {
      editing = true;
    }
    if (!pendingReapplyFocus) {
      pendingReapplyFocus = true;
      tick().then(() => {
        titleField?.focus();
        titleField?.select();
        resizeTitleField();
        taskStore.clearFocusedEditor(task.id);
        pendingReapplyFocus = false;
      });
    }
  }

  // Cap the visual indent so very deep trees do not drift too far right.
  const indent = Math.min(depth * (1.0 / 10), 4.0 / 10);

  // Initialize draft state and auto-open editors for brand-new tasks after first render.
  onMount(() => {
    draftContent = composeTaskContent(task);
    initialContentSnapshot = draftContent;
    isDraftNewTask = task.title.trim().length === 0;
    isTitleMultiline = draftContent.includes("\n");
    if (isDraftNewTask) {
      editing = true;
    }
  });

  const toggleExpand = () => {
    if (task.children.length === 0) {
      return;
    }
    taskStore.toggleTaskExpansion(task.id);
  };

  const handleStartOrPause = () => {
    taskStore.startTask(task.id);
  };

  const handleArchive = () => {
    taskStore.archiveTask(task.id);
  };

  const handleMoveUp = () => {
    taskStore.moveTaskUp(task.id);
  };

  const handleMoveDown = () => {
    taskStore.moveTaskDown(task.id);
  };

  const handleComplete = () => {
    taskStore.completeTask(task.id);
  };

  const selectTask = () => {
    taskStore.selectTask(task.id);
  };

  const resizeTitleField = () => {
    if (!titleField) {
      return;
    }
    titleField.style.height = "auto";
    titleField.style.height = `${titleField.scrollHeight}px`;
  };

  // Commit the textarea content, normalizing line endings and splitting title/description.
  const commitTaskContent = (): boolean => {
    if (skipNextBlurCommit) {
      skipNextBlurCommit = false;
      return false;
    }
    editing = false;
    const normalized = draftContent.replace(/\r\n/g, "\n").trim();
    const currentTitle = task.title.trim();
    const currentDescription = (task.description ?? "")
      .replace(/\r\n/g, "\n")
      .trim();

    if (!normalized) {
      if (isDraftNewTask) {
        taskStore.deleteTask(task.id);
      } else {
        draftContent = composeTaskContent(task);
        isTitleMultiline = draftContent.includes("\n");
      }
      return false;
    }

    const [firstLine, ...rest] = draftContent
      .replace(/\r\n/g, "\n")
      .split("\n");
    const nextTitle = firstLine.trim() || currentTitle || "Untitled task";
    const body = rest.join("\n").trim();

    if (nextTitle !== task.title) {
      taskStore.updateTaskTitle(task.id, nextTitle);
    }

    if (body !== currentDescription) {
      taskStore.updateTaskDescription(task.id, body);
    }

    isTitleMultiline = body.length > 0;
    draftContent = composeTaskContent({
      ...task,
      title: nextTitle,
      description: body.length > 0 ? body : undefined,
    });
    initialContentSnapshot = draftContent;
    isDraftNewTask = false;
    return true;
  };

  // runStructuralCommand ensures structural edits (indent/outdent/reorder) respect draft state.
  // 1. Blank new drafts stay in edit mode without committing.
  // 2. Existing content commits before the command; aborted commits cancel the structural change.
  // 3. Editor focus returns afterward when users triggered the shortcut from an editor.
  const runStructuralCommand = (command: () => void) => {
    const wasEditing = editing;
    const isBlankDraft = isDraftNewTask && draftContent.trim().length === 0;

    if (isBlankDraft) {
      skipNextBlurCommit = true;
      tick().then(() => {
        skipNextBlurCommit = false;
      });
      editing = true;
    } else if (!commitTaskContent()) {
      if (wasEditing) {
        editing = true;
      }
      return;
    }

    command();

    if (wasEditing || isBlankDraft) {
      taskStore.focusTaskEditor(task.id);
    }
  };

  const cancelEditing = () => {
    const shouldRemove =
      isDraftNewTask && draftContent.trim() === initialContentSnapshot.trim();
    editing = false;
    draftContent = composeTaskContent(task);
    isTitleMultiline = draftContent.includes("\n");
    if (shouldRemove) {
      taskStore.deleteTask(task.id);
    }
  };

  const createSubtask = () => {
    const createdTaskId = taskStore.createSiblingTaskAfter(task.id);
    if (!createdTaskId) {
      return;
    }
    taskStore.indentTask(createdTaskId);
    taskStore.setTaskExpanded(task.id, true);
    taskStore.focusTaskEditor(createdTaskId);
  };

  // Support multiline editing, quick sibling creation, and indent/outdent shortcuts.
  const handleTitleKeydown = (event: KeyboardEvent) => {
    if (
      event.key === "Enter" &&
      event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      isTitleMultiline = true;
      tick().then(() => {
        resizeTitleField();
      });
      return;
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const committed = commitTaskContent();
      if (committed) {
        taskStore.createSiblingTaskAfter(task.id);
      }
      return;
    }

    if (
      event.altKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      (event.key === "ArrowRight" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown")
    ) {
      event.preventDefault();
      runStructuralCommand(() => {
        if (event.key === "ArrowRight") {
          taskStore.indentTask(task.id);
        } else if (event.key === "ArrowLeft") {
          taskStore.outdentTask(task.id);
        } else if (event.key === "ArrowUp") {
          taskStore.moveTaskUp(task.id);
        } else {
          taskStore.moveTaskDown(task.id);
        }
      });
      return;
    }

    if (
      event.key === "Tab" &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      runStructuralCommand(() => {
        if (event.shiftKey) {
          taskStore.outdentTask(task.id);
        } else {
          taskStore.indentTask(task.id);
        }
      });
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  // Expand the textarea in-place as the user types so the full content stays visible.
  const handleTitleInput = () => {
    isTitleMultiline = draftContent.includes("\n");
    resizeTitleField();
  };

  // Pull cached reporting totals for this task and flag days with overlapping sessions.
  $: {
    reportingAggregation = reportingTotals.get(task.id) ?? null;
    hasConcurrentSessions =
      Boolean(reportingAggregation?.concurrentSessionsDetected) ||
      reportingConcurrentTaskIds.has(task.id);
  }

  $: expanded = !(state.data.collapsedTaskIds ?? []).includes(task.id);
</script>

<!-- TaskItem renders a single task row and recursively nests any child tasks. -->

<div class="mb-0 space-y-0" style={`margin-left: ${indent}rem`}>
  <TaskRowSummary
    {task}
    {expanded}
    hasChildren={task.children.length > 0}
    bind:editing
    bind:draftContent
    bind:titleInput={titleField}
    {isTitleMultiline}
    onTitleInput={handleTitleInput}
    {isActive}
    {isSelected}
    {isPreviewed}
    {latestSession}
    {activeSessionElapsed}
    {reportingMode}
    {reportingColumns}
    {reportingAggregation}
    {hasConcurrentSessions}
    onSelect={selectTask}
    onToggleExpand={toggleExpand}
    onStartOrPause={handleStartOrPause}
    onArchive={handleArchive}
    onCommitTitle={commitTaskContent}
    onTitleKeydown={handleTitleKeydown}
    onMoveUp={handleMoveUp}
    onMoveDown={handleMoveDown}
    onComplete={handleComplete}
    onCreateSubtask={createSubtask}
  />

  {#if expanded}
    <div
      class="task-dnd-zone"
      class:space-y-0={hasChildRows || hasChildShadow}
      class:border-l={hasChildRows || hasChildShadow}
      class:border-slate-200={hasChildRows || hasChildShadow}
      class:pl-5={hasChildRows || hasChildShadow}
      class:task-dnd-zone--empty={!hasChildRows && !hasChildShadow}
      use:dndzone={{
        items: childZoneItems,
        type: DND_ZONE_TYPE,
        flipDurationMs: DND_FLIP_DURATION_MS,
      }}
      on:consider={handleChildConsider}
      on:finalize={handleChildFinalize}
      aria-label={`Subtasks for ${task.title}`}
    >
      {#each childZoneItems as childItem (childItem.id)}
        {#if childItem[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
          <TaskShadowRow depth={depth + 1} />
        {:else}
          {@const resolvedChild =
            childItem.taskRef ?? findTaskById(childItem.id)}
          {#if resolvedChild}
            <svelte:self
              task={resolvedChild}
              depth={depth + 1}
              {reportingMode}
              {reportingColumns}
              {reportingTotals}
              {reportingConcurrentTaskIds}
            />
          {/if}
        {/if}
      {/each}
    </div>
  {/if}
</div>
