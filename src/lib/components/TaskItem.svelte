<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Task } from "$lib/core/taskTypes";
  import type { SessionAggregation } from "$lib/core/reporting/timeBuckets";
  import { formatTimestamp } from "$lib/core/time";
  import { taskStore } from "$lib/stores/taskStore";
  import TaskRowSummary from "./TaskRowSummary.svelte";
  import type { ReportingColumnDefinition } from "$lib/stores/uiState";

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
  let showDetails = false;
  let addingSubtask = false;
  let subtaskTitle = "";
  let titleField: HTMLTextAreaElement | null = null;
  let subtaskInput: HTMLInputElement | null = null;
  let isDraftNewTask = false;
  let wasEditing = false;
  let initialContentSnapshot = "";
  let pendingReapplyFocus = false;
  let isTitleMultiline = false;
  let reportingAggregation: SessionAggregation | null = null;
  let hasConcurrentSessions = false;

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
  $: if (addingSubtask) {
    tick().then(() => {
      subtaskInput?.focus();
    });
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
  const indent = Math.min(depth * (1.1 / 3), 4.4 / 3);

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
    expanded = !expanded;
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

  const openSubtaskForm = () => {
    addingSubtask = true;
    showDetails = true;
  };

  const resetSubtaskForm = () => {
    addingSubtask = false;
    subtaskTitle = "";
  };

  const submitSubtask = () => {
    if (!subtaskTitle.trim()) {
      return;
    }
    taskStore.addTask(subtaskTitle, task.id);
    subtaskTitle = "";
    addingSubtask = false;
    expanded = true;
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
      event.key === "Tab" &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const wasEditing = editing;
      const committed = commitTaskContent();
      if (!committed) {
        if (wasEditing) {
          editing = true;
        }
        return;
      }

      if (event.shiftKey) {
        taskStore.outdentTask(task.id);
      } else {
        taskStore.indentTask(task.id);
      }

      if (wasEditing) {
        taskStore.focusTaskEditor(task.id);
      }

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
</script>

<!-- TaskItem renders a single task row, its inline details/subtask form, and recursively nests any child tasks. -->

<div class="space-y-1" style={`margin-left: ${indent}rem`}>
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
    onOpenSubtaskForm={openSubtaskForm}
  />

  {#if showDetails || addingSubtask}
    <!-- Inline detail panel mirrors the sidebar card so users can stay in context while editing. -->
    <div class="task-detail-panel">
      {#if showDetails}
        <div class="task-meta-grid">
          <span>
            <strong>Created:</strong>
            {formatTimestamp(task.createdAt)}
          </span>
          <span>
            <strong>Updated:</strong>
            {formatTimestamp(task.updatedAt)}
          </span>
          {#if task.lastStartedAt}
            <span>
              <strong>Last started:</strong>
              {formatTimestamp(task.lastStartedAt)}
            </span>
          {/if}
          {#if task.archivedAt}
            <span>
              <strong>Archived:</strong>
              {formatTimestamp(task.archivedAt)}
            </span>
          {/if}
        </div>
      {/if}

      {#if addingSubtask}
        <form
          class="task-subtask-form"
          on:submit|preventDefault={submitSubtask}
        >
          <input
            class="task-subtask-form__input"
            placeholder="Sub-task title"
            bind:value={subtaskTitle}
            bind:this={subtaskInput}
          />
          <div class="flex items-center gap-2">
            <button
              class="task-row__action task-row__action--primary"
              type="submit"
            >
              Add
            </button>
            <button
              class="task-row__action task-row__action--ghost"
              type="button"
              on:click={resetSubtaskForm}
            >
              Cancel
            </button>
          </div>
        </form>
      {/if}
    </div>
  {/if}

  {#if expanded && task.children.length > 0}
    <div class="space-y-1 border-l border-slate-200 pl-5">
      {#each task.children as child (child.id)}
        <svelte:self
          task={child}
          depth={depth + 1}
          {reportingMode}
          {reportingColumns}
          {reportingTotals}
          {reportingConcurrentTaskIds}
        />
      {/each}
    </div>
  {/if}
</div>
