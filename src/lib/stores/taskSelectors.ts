import { derived } from "svelte/store";
import { flattenTasks, locateTask } from "$lib/core/taskTree";
import type { Project, Task, TaskStatus } from "$lib/core/taskTypes";
import { filterTasksByStatus } from "$lib/core/taskFilters";
import { taskStore } from "./taskStore";
import { focusMode } from "./uiState";
import {
  filterTasksToFocusScope,
  countFocusedTasks,
} from "$lib/core/focus";

/**
 * Read-only view of the current status filter selection.
 */
export const statusFilters = derived(
  taskStore,
  ($state) => $state.data.filters.statuses,
);

/**
 * Active project reference, falling back to the first project when none is selected.
 */
export const activeProject = derived(taskStore, ($state): Project | null => {
  const activeId = $state.data.activeProjectId;
  return (
    $state.data.projects.find((project) => project.id === activeId) ??
    $state.data.projects[0] ??
    null
  );
});

/**
 * Active project with tasks constrained to the current status filter set.
 */
export const statusFilteredProject = derived(
  [activeProject, statusFilters],
  ([$project, $statuses]): Project | null => {
    if (!$project) {
      return null;
    }

    const allowed = new Set<TaskStatus>($statuses);
    if (allowed.size === 0) {
      return { ...$project, tasks: [] };
    }

    const { tasks, changed } = filterTasksByStatus($project.tasks, allowed);
    if (!changed) {
      return $project;
    }

    return { ...$project, tasks };
  },
);

export const filteredProject = derived(
  [statusFilteredProject, focusMode],
  ([$project, $focusMode]): Project | null => {
    if (!$project) {
      return null;
    }

    if (!$focusMode) {
      return $project;
    }

    const { tasks, containsFocus } = filterTasksToFocusScope($project.tasks);
    if (!containsFocus) {
      return { ...$project, tasks };
    }

    if (tasks === $project.tasks) {
      return $project;
    }

    return { ...$project, tasks };
  },
);

export const focusSummary = derived(
  statusFilteredProject,
  ($project) => ({
    count: $project ? countFocusedTasks($project.tasks) : 0,
  }),
);

/**
 * Retrieve the currently running task, if any.
 */
export const activeTask = derived(taskStore, ($state): Task | null => {
  if (!$state.data.activeTaskId) {
    return null;
  }

  const located = locateTask($state.data.projects, $state.data.activeTaskId);
  return located?.task ?? null;
});

/**
 * Retrieve the UI-selected task, independent of the active timer.
 */
export const selectedTask = derived(taskStore, ($state): Task | null => {
  const selectedId = $state.data.selectedTaskId;
  if (!selectedId) {
    return null;
  }

  const located = locateTask($state.data.projects, selectedId);
  return located?.task ?? null;
});

/**
 * Reference metadata about the task currently in preview mode.
 */
export const previewTask = derived(taskStore, ($state) => {
  if (!$state.previewTaskId) {
    return null;
  }

  return locateTask($state.data.projects, $state.previewTaskId) ?? null;
});

/**
 * Observe the flattened task tree across every project.
 */
export const flattenedTasks = derived(taskStore, ($state) =>
  flattenTasks($state.data.projects),
);

/**
 * Factory for retrieving a single task document by id.
 */
export const taskById = (taskId: string) =>
  derived(
    taskStore,
    ($state) => locateTask($state.data.projects, taskId)?.task ?? null,
  );

/**
 * Boolean flag indicating whether the timer has an active task.
 */
export const isTimerRunning = derived(taskStore, ($state) =>
  Boolean($state.data.activeTaskId && $state.timerStartedAt),
);

/**
 * List of recently active tasks resolved from the stored id history.
 */
export const recentTasks = derived(taskStore, ($state) => {
  const map = new Map<string, Task>();
  flattenTasks($state.data.projects).forEach(({ task }) => {
    map.set(task.id, task);
  });

  return $state.data.recentTaskIds
    .map((id) => map.get(id))
    .filter((task): task is Task => Boolean(task));
});
