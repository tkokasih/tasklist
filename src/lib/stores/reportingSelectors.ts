import { derived, type Readable } from "svelte/store";
import type {
  AggregationOptions,
  SessionAggregation,
} from "../core/reporting/timeBuckets";
import { aggregateProjects } from "../core/reporting/timeBuckets";
import type { TimeRangeConfig } from "../core/time";
import type { Project, TaskData } from "../core/taskTypes";
import { taskStore } from "./taskStore";

export const REPORTING_ENABLED = true;

export interface ReportingWarning {
  type: "concurrentSessions";
  taskIds: string[];
}

export interface ReportingSelectorResult {
  range: TimeRangeConfig;
  totals: Map<string, SessionAggregation>;
  warnings: ReportingWarning[];
}

type TaskStoreReadable = Readable<{ data: TaskData }>;

type NormalizedOptions = Required<
  Pick<AggregationOptions, "includeArchived" | "includeCompleted">
>;

const normalizeOptions = (
  options: AggregationOptions = {},
): NormalizedOptions => ({
  includeArchived: options.includeArchived ?? false,
  includeCompleted: options.includeCompleted ?? true,
});

const buildCacheKey = (range: TimeRangeConfig, options: NormalizedOptions) =>
  [
    range.preset ?? "custom",
    range.start.toISOString(),
    range.end.toISOString(),
    options.includeArchived ? "archived:1" : "archived:0",
    options.includeCompleted ? "completed:1" : "completed:0",
  ].join("|");

const storeCache = new WeakMap<
  TaskStoreReadable,
  Map<string, Readable<ReportingSelectorResult>>
>();

const cacheForStore = (storeRef: TaskStoreReadable) => {
  let cache = storeCache.get(storeRef);
  if (!cache) {
    cache = new Map<string, Readable<ReportingSelectorResult>>();
    storeCache.set(storeRef, cache);
  }
  return cache;
};

const cloneRange = (range: TimeRangeConfig): TimeRangeConfig => ({
  preset: range.preset,
  start: new Date(range.start.getTime()),
  end: new Date(range.end.getTime()),
});

const collectWarnings = (
  totals: Map<string, SessionAggregation>,
): ReportingWarning[] => {
  const concurrentTaskIds = [...totals.entries()]
    .filter(([, aggregation]) => aggregation.concurrentSessionsDetected)
    .map(([taskId]) => taskId);

  return concurrentTaskIds.length > 0
    ? [{ type: "concurrentSessions", taskIds: concurrentTaskIds }]
    : [];
};

const ensureProjects = (data: TaskData | undefined): Project[] =>
  data?.projects ?? [];

// NOTE: As reporting consumers expand (e.g., sidebar cards, exports) we may extract this into a dedicated reporting store.
export const createTimeAggregationSelector = (
  range: TimeRangeConfig,
  options: AggregationOptions = {},
  storeRef: TaskStoreReadable = taskStore,
  featureEnabled: boolean = REPORTING_ENABLED,
): Readable<ReportingSelectorResult> => {
  const normalizedRange = cloneRange(range);
  const normalizedOptions = normalizeOptions(options);
  const cacheKey = buildCacheKey(normalizedRange, normalizedOptions);
  const cache = cacheForStore(storeRef);

  const existing = cache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const selector = derived(storeRef, ($state) => {
    if (!featureEnabled) {
      return {
        range: normalizedRange,
        totals: new Map<string, SessionAggregation>(),
        warnings: [],
      };
    }

    const aggregated = aggregateProjects(
      ensureProjects($state?.data),
      normalizedRange,
      normalizedOptions,
    );
    const warnings = collectWarnings(aggregated.taskTotals);

    return {
      range: aggregated.range,
      totals: aggregated.taskTotals,
      warnings,
    };
  });

  cache.set(cacheKey, selector);
  return selector;
};
