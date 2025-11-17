<script lang="ts">
  import { get } from "svelte/store";
  import type { Project, Task } from "$lib/core/taskTypes";
  import type { SessionAggregation } from "$lib/core/reporting/timeBuckets";
  import { taskStore } from "$lib/stores/taskStore";
  import { statusFilters } from "$lib/stores/taskSelectors";
  import {
    createTimeAggregationSelector,
    type ReportingSelectorResult,
    type ReportingWarning,
  } from "$lib/stores/reportingSelectors";
  import TaskItem from "./TaskItem.svelte";
  import TaskShadowRow from "./TaskShadowRow.svelte";
  import {
    reportingColumns,
    reportingMode,
    activityScope,
    activityRange,
    reportingIncludeChildren,
  } from "$lib/stores/uiState";
  import { isDraftPlaceholder } from "$lib/core/taskFilters";
  import {
    dndzone,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    TRIGGERS,
  } from "svelte-dnd-action";
  import type { DndEvent, Item as DndItem } from "svelte-dnd-action";

  type TaskDndItem = DndItem & {
    id: string;
    taskRef?: Task;
  };

  // Render the root project task list and optionally switch into reporting mode.
  export let project: Project | null = null;
  export let emptyMessage =
    "No tasks yet. Create your first task to get started.";

  let newTaskTitle = "";
  // Stable fallbacks used when reporting selectors have not produced any data yet.
  const EMPTY_TOTALS: Map<string, SessionAggregation> = new Map();
  const EMPTY_WARNINGS: ReportingWarning[] = [];
  const initialRange = get(activityRange);
  const initialStatuses = get(statusFilters);
  // Keep a selector instance so we can reuse memoized results as filters change.
  let reportingSelector = createTimeAggregationSelector(initialRange, {
    includeArchived: initialStatuses.includes("archived"),
    includeCompleted: initialStatuses.includes("completed"),
  });
  let reportingResult: ReportingSelectorResult | null = null;
  let reportingTotals: Map<string, SessionAggregation> = EMPTY_TOTALS;
  let reportingTotalsSelf: Map<string, SessionAggregation> = EMPTY_TOTALS;
  let reportingTotalsInclusive: Map<string, SessionAggregation> = EMPTY_TOTALS;
  let reportingWarnings: ReportingWarning[] = EMPTY_WARNINGS;
  let concurrentTaskIds = new Set<string>();
  let rootZoneItems: TaskDndItem[] = [];
  let rootDragActive = false;
  let taskLookup: Map<string, Task> = new Map();
  let rootRenderList: Task[] = [];
  let includeDescendants = false;

  const DND_ZONE_TYPE = "task-tree";
  const DND_FLIP_DURATION_MS = 150;

  const indexTasks = (tasks: Task[], map: Map<string, Task>) => {
    for (const current of tasks) {
      map.set(current.id, current);
      if (current.children?.length) {
        indexTasks(current.children, map);
      }
    }
  };

  const ensureTaskRefs = (items: TaskDndItem[]): TaskDndItem[] =>
    items.map((item) => {
      if (item[SHADOW_ITEM_MARKER_PROPERTY_NAME]) {
        return item;
      }
      if (item.taskRef && item.taskRef.id === item.id) {
        return item;
      }
      const located = taskLookup.get(item.id);
      return located ? { ...item, taskRef: located } : item;
    });

  const buildZoneItems = (tasks: Task[]): TaskDndItem[] =>
    tasks.map((task) => ({
      id: task.id,
      taskRef: task,
    }));

  const filterTasksForReportingWindow = (
    tasks: Task[],
    totals: Map<string, SessionAggregation>,
  ): Task[] => {
    if (!tasks || tasks.length === 0) {
      return [];
    }

    const filtered: Task[] = [];

    for (const task of tasks) {
      const scopedChildren = filterTasksForReportingWindow(
        task.children ?? [],
        totals,
      );
      const aggregation = totals.get(task.id);
      const totalMs = aggregation?.totalMs ?? 0;
      const includeActive = task.status === "in-progress";
      // Keep draft placeholders visible so users can finish editing new tasks even when activity filters exclude them.
      const includeDraft = isDraftPlaceholder(task);

      if (
        includeDraft ||
        totalMs > 0 ||
        scopedChildren.length > 0 ||
        includeActive
      ) {
        filtered.push({
          ...task,
          children: scopedChildren,
        });
      }
    }

    return filtered;
  };

  const addRootTask = () => {
    if (!newTaskTitle.trim()) {
      return;
    }
    taskStore.addTask(newTaskTitle);
    newTaskTitle = "";
  };

  // React to reporting controls in uiState and rebuild the selector with matching filters.
  $: isReportingMode = $reportingMode;
  $: reportingDayColumns = $reportingColumns;
  $: {
    const includeArchived = $statusFilters.includes("archived");
    const includeCompleted = $statusFilters.includes("completed");
    reportingSelector = createTimeAggregationSelector($activityRange, {
      includeArchived,
      includeCompleted,
    });
  }
  $: includeDescendants = $reportingIncludeChildren;
  $: reportingResult = $reportingSelector;
  $: reportingTotalsSelf = reportingResult?.totals ?? EMPTY_TOTALS;
  $: reportingTotalsInclusive =
    reportingResult?.inclusiveTotals ?? EMPTY_TOTALS;
  $: reportingTotals = includeDescendants
    ? reportingTotalsInclusive
    : reportingTotalsSelf;
  $: reportingWarnings = reportingResult?.warnings ?? EMPTY_WARNINGS;
  // Flag any tasks that have overlapping sessions so TaskItem can surface a warning state.
  $: concurrentTaskIds = new Set(
    reportingWarnings.flatMap((warning) =>
      warning.type === "concurrentSessions" ? warning.taskIds : [],
    ),
  );
  $: isReportingScopeEnabled = $activityScope;
  $: hasScopedProject =
    Boolean(project) && isReportingScopeEnabled && Boolean(reportingResult);
  $: scopedTasks =
    hasScopedProject && project
      ? filterTasksForReportingWindow(project.tasks, reportingTotals)
      : (project?.tasks ?? []);
  $: renderProject =
    hasScopedProject && project ? { ...project, tasks: scopedTasks } : project;
  $: renderTasks = renderProject?.tasks ?? [];
  $: scopedEmptyMessage =
    project &&
    hasScopedProject &&
    project.tasks.length > 0 &&
    renderTasks.length === 0
      ? "No tasks fall within the selected reporting window."
      : emptyMessage;

  $: {
    const map = new Map<string, Task>();
    if (renderProject) {
      indexTasks(renderProject.tasks, map);
    }
    taskLookup = map;
  }

  $: if (!rootDragActive) {
    rootZoneItems = ensureTaskRefs(buildZoneItems(renderTasks));
  }

  $: rootRenderList = rootZoneItems
    .filter((item) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME])
    .map((item) => item.taskRef ?? taskLookup.get(item.id))
    .filter((candidate): candidate is Task => Boolean(candidate));

  const handleRootConsider = (event: CustomEvent<DndEvent<TaskDndItem>>) => {
    rootDragActive = true;
    rootZoneItems = ensureTaskRefs(event.detail.items as TaskDndItem[]);
  };

  const handleRootFinalize = (event: CustomEvent<DndEvent<TaskDndItem>>) => {
    rootZoneItems = ensureTaskRefs(event.detail.items as TaskDndItem[]);
    rootDragActive = false;

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
      destinationParentId: null,
      destinationIndex,
    });
  };
</script>

<!-- TaskTree orchestrates the root-level task list, optional reporting headers, and new-task entry for a project. -->

{#if renderProject}
  <div class="space-y-1">
    <form
      class="flex flex-col gap-2 rounded border border-dashed border-slate-300 bg-white/60 p-2 md:flex-row"
      on:submit|preventDefault={addRootTask}
    >
      <input
        class="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:outline-none"
        placeholder="Add a new task"
        bind:value={newTaskTitle}
      />
      <button
        class="rounded border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
        type="submit"
      >
        Add task
      </button>
    </form>

    <div class="task-tree__header">
      <div class="task-tree__header-label">Tasks</div>
      <div
        class={`task-tree__header-columns ${isReportingMode ? "" : "task-tree__header-columns--inactive"}`}
      >
        {#if reportingDayColumns.length === 0}
          <div class="task-tree__header-column task-tree__header-column--empty">
            <span>No reporting window</span>
          </div>
        {:else}
          {#each reportingDayColumns as column (column.id)}
            <div
              class={`task-tree__header-column ${column.isToday ? "task-tree__header-column--today" : ""} ${
                column.isWeekend ? "task-tree__header-column--weekend" : ""
              }`}
              title={column.label}
            >
              <span class="task-tree__header-column-day"
                >{column.weekdayLabel}</span
              >
              <span class="task-tree__header-column-date"
                >{column.dateLabel}</span
              >
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <div
      class="task-dnd-zone space-y-4"
      use:dndzone={{
        items: rootZoneItems,
        type: DND_ZONE_TYPE,
        flipDurationMs: DND_FLIP_DURATION_MS,
      }}
      on:consider={handleRootConsider}
      on:finalize={handleRootFinalize}
      aria-label="Project tasks"
    >
      {#if rootRenderList.length === 0 && !rootDragActive}
        <div
          class="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500"
        >
          {scopedEmptyMessage}
        </div>
      {/if}

      {#each rootZoneItems as item (item.id)}
        {#if item[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
          <TaskShadowRow depth={0} />
        {:else}
          {@const resolvedTask = item.taskRef ?? taskLookup.get(item.id)}
          {#if resolvedTask}
            <TaskItem
              task={resolvedTask}
              depth={0}
              reportingMode={isReportingMode}
              reportingColumns={reportingDayColumns}
              {reportingTotals}
              reportingConcurrentTaskIds={concurrentTaskIds}
              reportingIncludesChildren={includeDescendants}
            />
          {/if}
        {/if}
      {/each}
    </div>
  </div>
{:else}
  <div
    class="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500"
  >
    No project selected.
  </div>
{/if}
