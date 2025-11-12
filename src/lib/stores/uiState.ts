import { derived, writable } from "svelte/store";
import {
  buildPresetRange,
  type TimeRangeConfig,
  type TimePreset,
} from "$lib/core/time";
import { sessionBucketKeyForLocalDate } from "$lib/core/reporting/timeBuckets";

export type ActivityRangePresetId = TimePreset;

export interface ActivityRangePresetDefinition {
  id: ActivityRangePresetId;
  label: string;
  description: string;
}

export interface ReportingColumnDefinition {
  id: string;
  label: string;
  weekdayLabel: string;
  dateLabel: string;
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
}

const DEFAULT_ACTIVITY_RANGE_PRESET: ActivityRangePresetId = "last-seven-days";

export const ACTIVITY_RANGE_PRESETS: ActivityRangePresetDefinition[] = [
  {
    id: "all",
    label: "All",
    description: "Include every tracked session regardless of date.",
  },
  {
    id: "today",
    label: "Today",
    description: "Focus on just the current day.",
  },
  {
    id: "last-seven-days",
    label: "Last 7 days",
    description: "Daily totals for the trailing week ending today.",
  },
  {
    id: "this-week",
    label: "This week",
    description: "Totals for the current calendar week.",
  },
];

const buildColumnId = (date: Date) => sessionBucketKeyForLocalDate(date);

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
});
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "numeric",
  day: "numeric",
});
const accessibleFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const normalizeToStartOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const buildColumnsForRange = (
  range: TimeRangeConfig,
): ReportingColumnDefinition[] => {
  const columns: ReportingColumnDefinition[] = [];
  const cursor = normalizeToStartOfDay(range.start);
  const end = normalizeToStartOfDay(range.end);
  const today = normalizeToStartOfDay(new Date());

  while (cursor.getTime() <= end.getTime()) {
    const current = new Date(cursor);
    const isToday = current.getTime() === today.getTime();
    columns.push({
      id: buildColumnId(current),
      label: accessibleFormatter.format(current),
      weekdayLabel: weekdayFormatter.format(current),
      dateLabel: dateFormatter.format(current),
      date: current,
      isToday,
      isWeekend: current.getDay() === 0 || current.getDay() === 6,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return columns;
};

const reportingModeWritable = writable(false);
const activityRangePresetWritable = writable<ActivityRangePresetId>(
  DEFAULT_ACTIVITY_RANGE_PRESET,
);
const focusModeWritable = writable(false);

export const reportingMode = {
  subscribe: reportingModeWritable.subscribe,
};

export const activityRangePreset = {
  subscribe: activityRangePresetWritable.subscribe,
};

export const focusMode = {
  subscribe: focusModeWritable.subscribe,
};

export const activityRange = derived(activityRangePresetWritable, (preset) =>
  buildPresetRange(preset),
);

export const activityScope = derived(
  activityRangePresetWritable,
  (preset) => preset !== "all",
);

const computeReportingColumns = () =>
  buildColumnsForRange(buildPresetRange("last-seven-days"));

export const reportingColumns = derived(reportingMode, () =>
  computeReportingColumns(),
);

export const toggleReportingMode = () => {
  reportingModeWritable.update((current) => !current);
};

export const setReportingMode = (value: boolean) => {
  reportingModeWritable.set(Boolean(value));
};

export const setActivityRangePreset = (preset: ActivityRangePresetId) => {
  const recognized = ACTIVITY_RANGE_PRESETS.some(
    (option) => option.id === preset,
  );
  if (!recognized) {
    return;
  }
  activityRangePresetWritable.set(preset);
};

export const toggleFocusMode = () => {
  focusModeWritable.update((current) => !current);
};

export const setFocusMode = (value: boolean) => {
  focusModeWritable.set(Boolean(value));
};
