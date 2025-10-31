import { flattenTasks } from "$lib/core/taskTree";
import type {
  Task,
  TaskData,
  TaskSession,
  TaskStatus,
} from "$lib/core/taskTypes";
import {
  cloneDefaultStatusSelection,
  orderStatuses,
} from "$lib/core/taskFilters";

/**
 * Provide a consistent ISO timestamp string for persistence and comparisons.
 */
export const isoNow = (): string => new Date().toISOString();

const generateSessionId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `sess-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeSession = (
  session: TaskSession | undefined,
  fallbackTimestamp: string,
): TaskSession => {
  if (!session) {
    return {
      id: generateSessionId(),
      startedAt: fallbackTimestamp,
      endedAt: fallbackTimestamp,
      durationMs: 0,
    };
  }

  return {
    id: session.id ?? generateSessionId(),
    startedAt:
      typeof session.startedAt === "string"
        ? session.startedAt
        : fallbackTimestamp,
    endedAt: typeof session.endedAt === "string" ? session.endedAt : undefined,
    durationMs:
      typeof session.durationMs === "number" &&
      Number.isFinite(session.durationMs)
        ? Math.max(0, session.durationMs)
        : 0,
  };
};

interface NormalizedSessions {
  sessions: TaskSession[];
  totalFromSessions: number;
  total: number;
}

/**
 * Normalize a task's sessions, synthesizing a placeholder entry when only aggregate time exists.
 * Ensures duration totals stay non-negative and all timestamps follow ISO formatting.
 */
const normalizeTaskSessions = (task: Task): NormalizedSessions => {
  const fallbackTimestamp =
    task.lastStartedAt ?? task.updatedAt ?? task.createdAt ?? isoNow();
  const rawSessions = Array.isArray(
    (task as Task & { sessions?: TaskSession[] }).sessions,
  )
    ? ((task as Task & { sessions?: TaskSession[] }).sessions as TaskSession[])
    : [];

  const sessions = rawSessions.map((session) =>
    normalizeSession(session, fallbackTimestamp),
  );
  let totalFromSessions = sessions.reduce(
    (sum, current) => sum + current.durationMs,
    0,
  );

  const total =
    typeof task.timeSpentMs === "number" && Number.isFinite(task.timeSpentMs)
      ? Math.max(0, task.timeSpentMs)
      : 0;

  if (sessions.length === 0 && total > 0) {
    const fallbackStart = new Date(fallbackTimestamp);
    const fallbackStartMs = fallbackStart.getTime();
    const fallbackEndIso =
      Number.isNaN(fallbackStartMs) || total <= 0
        ? fallbackTimestamp
        : new Date(fallbackStartMs + total).toISOString();

    const fallbackSession = normalizeSession(
      {
        id: generateSessionId(),
        startedAt: fallbackTimestamp,
        endedAt: fallbackEndIso,
        durationMs: total,
      },
      fallbackTimestamp,
    );

    return {
      sessions: [fallbackSession],
      totalFromSessions: fallbackSession.durationMs,
      total,
    };
  }

  return { sessions, totalFromSessions, total };
};

/**
 * Ensure a task and its descendants contain normalized session arrays and duration totals.
 */
export const normalizeTask = (task: Task): Task => {
  const children = Array.isArray(task.children)
    ? task.children.map((child) => normalizeTask(child))
    : [];
  const { sessions, totalFromSessions, total } = normalizeTaskSessions(task);

  return {
    ...task,
    children,
    sessions,
    timeSpentMs: Math.max(total, totalFromSessions),
  };
};

/**
 * Recursively normalize all tasks within the supplied projects list.
 */
export const normalizeProjects = (
  projects: TaskData["projects"],
): TaskData["projects"] =>
  projects.map((project) => ({
    ...project,
    tasks: Array.isArray(project.tasks)
      ? project.tasks.map((task) => normalizeTask(task))
      : [],
  }));

const parseTimestamp = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
};

const normalizeIsoString = (
  value: string | null | undefined,
): string | null => {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) {
    return null;
  }

  return new Date(timestamp).toISOString();
};

const sanitizeFilters = (
  rawStatuses: TaskStatus[] | undefined,
): TaskStatus[] => {
  if (!rawStatuses) {
    return cloneDefaultStatusSelection();
  }

  const ordered = orderStatuses(rawStatuses);
  return ordered.length > 0 ? ordered : cloneDefaultStatusSelection();
};

/**
 * Merge incoming task data with defaults, normalizing relationships and filter state.
 */
export const sanitizeData = (data: TaskData): TaskData => {
  const projects = normalizeProjects(data.projects ?? []);
  const activeProjectId =
    data.activeProjectId &&
    projects.some((project) => project.id === data.activeProjectId)
      ? data.activeProjectId
      : (projects[0]?.id ?? null);

  const flattened = flattenTasks(projects);
  const hasTask = (taskId: string | null | undefined) =>
    Boolean(taskId && flattened.some((item) => item.task.id === taskId));

  const limitedRecent = (data.recentTaskIds ?? [])
    .filter((id, index, array) => array.indexOf(id) === index)
    .filter((id) => hasTask(id))
    .slice(0, 5);

  const rawCollapsed = Array.isArray(
    (data as TaskData & { collapsedTaskIds?: string[] }).collapsedTaskIds,
  )
    ? ((data as TaskData & { collapsedTaskIds?: string[] })
        .collapsedTaskIds as string[])
    : [];
  const collapsedTaskIds = rawCollapsed
    .filter((id, index, array) => array.indexOf(id) === index)
    .filter((id) => hasTask(id));

  const activeTaskId = hasTask(data.activeTaskId) ? data.activeTaskId : null;
  const selectedTaskId = hasTask(data.selectedTaskId)
    ? data.selectedTaskId
    : null;

  const rawStatuses = Array.isArray(data.filters?.statuses)
    ? (data.filters.statuses as TaskStatus[])
    : undefined;
  const normalizedStatuses = sanitizeFilters(rawStatuses);

  return {
    ...data,
    projects,
    activeProjectId,
    activeTaskId,
    selectedTaskId,
    recentTaskIds: limitedRecent,
    collapsedTaskIds,
    snapshots: data.snapshots ?? [],
    lastSavedAt: data.lastSavedAt ?? isoNow(),
    filters: {
      statuses: normalizedStatuses,
    },
  };
};

/**
 * Normalize an ISO timestamp or return null when parsing fails.
 */
export const normalizeSessionTimestamp = normalizeIsoString;
