/**
 * Helpers for rolling up session durations into reporting-friendly buckets.
 */
import type { Project, Task, TaskSession } from "$lib/core/taskTypes";
import type { TimeRangeConfig } from "../time";

/**
 * Flags that determine which task states should be included in summaries.
 */
export interface AggregationOptions {
  includeArchived?: boolean;
  includeCompleted?: boolean;
}

/**
 * Aggregated duration data for a single task across time buckets.
 * `totalMs` captures only the in-range duration (sum of bucket values that fall inside the requested window),
 * so open sessions or spans outside the window do not inflate the total.
 * We keep it alongside `buckets` so consumers do not need to recompute the total repeatedly.
 */
export interface SessionAggregation {
  taskId: string;
  totalMs: number;
  /**
   * Map of `YYYY-MM-DD` keys to in-range durations (ms) for that calendar day.
   * Each entry represents how much of the task's tracked time falls on that date
   * after clamping sessions to the requested reporting window.
   */
  buckets: Record<string, number>;
  concurrentSessionsDetected: boolean;
}

/**
 * Aggregation result keyed by task id, scoped to a requested time range.
 */
export interface AggregationResult {
  range: TimeRangeConfig;
  taskTotals: Map<string, SessionAggregation>;
}

const shouldIncludeTask = (task: Task, options: AggregationOptions) => {
  const { includeArchived = false, includeCompleted = true } = options;

  if (task.status === "archived" && !includeArchived) {
    return false;
  }

  if (task.status === "completed" && !includeCompleted) {
    return false;
  }

  return true;
};

/**
 * Aggregate a single task tree into daily buckets for the requested range.
 */
export const aggregateTaskTree = (
  root: Task,
  range: TimeRangeConfig,
  options: AggregationOptions = {},
): AggregationResult => {
  const taskTotals = new Map<string, SessionAggregation>();

  const walk = (task: Task) => {
    if (!shouldIncludeTask(task, options)) {
      return;
    }

    const aggregation = bucketSessionsForRange(task, range, options);
    taskTotals.set(task.id, aggregation);

    for (const child of task.children ?? []) {
      walk(child);
    }
  };

  walk(root);
  return { range, taskTotals };
};

/**
 * Aggregate all tasks across projects, merging duplicate task ids if encountered.
 */
export const aggregateProjects = (
  projects: Project[],
  range: TimeRangeConfig,
  options: AggregationOptions = {},
): AggregationResult => {
  const taskTotals = new Map<string, SessionAggregation>();

  for (const project of projects) {
    for (const task of project.tasks ?? []) {
      const subtree = aggregateTaskTree(task, range, options);
      for (const [taskId, aggregation] of subtree.taskTotals) {
        const existing = taskTotals.get(taskId);
        if (!existing) {
          taskTotals.set(taskId, aggregation);
          continue;
        }

        taskTotals.set(taskId, {
          taskId,
          totalMs: existing.totalMs + aggregation.totalMs,
          buckets: mergeBuckets(existing.buckets, aggregation.buckets),
          concurrentSessionsDetected:
            existing.concurrentSessionsDetected ||
            aggregation.concurrentSessionsDetected,
        });
      }
    }
  }

  return { range, taskTotals };
};

const mergeBuckets = (a: Record<string, number>, b: Record<string, number>) => {
  const combined: Record<string, number> = { ...a };
  for (const [bucket, value] of Object.entries(b)) {
    combined[bucket] = (combined[bucket] ?? 0) + value;
  }
  return combined;
};

/**
 * Aggregate a single task's sessions while respecting inclusion options.
 */
export const bucketSessionsForRange = (
  task: Task,
  range: TimeRangeConfig,
  options: AggregationOptions = {},
): SessionAggregation => {
  if (!shouldIncludeTask(task, options)) {
    return {
      taskId: task.id,
      totalMs: 0,
      buckets: {},
      concurrentSessionsDetected: false,
    };
  }

  const { buckets, totalMs, concurrentSessionsDetected } = aggregateSessions(
    task.sessions ?? [],
    range,
  );

  return {
    taskId: task.id,
    totalMs,
    buckets,
    concurrentSessionsDetected,
  };
};

/**
 * Aggregate raw sessions into bucket totals and overall in-range duration for a window.
 * Sessions are clamped to the [start, end] window, so time outside the range is excluded.
 */
export const aggregateSessions = (
  sessions: TaskSession[],
  range: TimeRangeConfig,
) => {
  const buckets: Record<string, number> = {};
  let totalMs = 0;
  let concurrentSessionsDetected = false;

  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  for (const session of sessions) {
    const { durationMs } = session;
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      continue;
    }

    const begin = new Date(session.startedAt).getTime();
    let end = session.endedAt
      ? new Date(session.endedAt).getTime()
      : Date.now();
    const isOpenSession = !session.endedAt;

    if (Number.isNaN(begin)) {
      continue;
    }

    if (Number.isNaN(end) || end <= begin) {
      const durationFallback = Number.isFinite(session.durationMs)
        ? Math.max(0, session.durationMs)
        : 0;
      if (durationFallback > 0) {
        end = begin + durationFallback;
      }
    }

    if (Number.isNaN(end) || end <= startMs || begin >= endMs) {
      continue;
    }

    const clampedBegin = Math.max(begin, startMs);
    const clampedEnd = Math.min(end, endMs);

    // Clip each session to the requested range so only in-range duration contributes to totals.
    const inRangeDurationMs = Math.max(0, clampedEnd - clampedBegin);
    if (inRangeDurationMs <= 0) {
      continue;
    }

    totalMs += inRangeDurationMs;

    // Group entries by the clamped start date so reporting views can render day columns.
    const bucketKey = sessionBucketKey(clampedBegin);
    buckets[bucketKey] = (buckets[bucketKey] ?? 0) + inRangeDurationMs;

    if (isOpenSession) {
      concurrentSessionsDetected = true;
    }
  }

  return { buckets, totalMs, concurrentSessionsDetected };
};

export const sessionBucketKey = (timestampMs: number) => {
  const date = new Date(timestampMs);
  // ISO date portion (YYYY-MM-DD) is used so buckets remain locale-agnostic and sortable.
  return date.toISOString().slice(0, 10);
};

export const sessionBucketKeyForLocalDate = (date: Date) =>
  sessionBucketKey(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
