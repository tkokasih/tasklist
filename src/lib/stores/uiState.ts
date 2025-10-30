import { derived, writable } from "svelte/store";
import {
  buildPresetRange,
  type TimeRangeConfig,
  type TimePreset,
} from "$lib/core/time";
import { sessionBucketKeyForLocalDate } from "$lib/core/reporting/timeBuckets";

export type ReportingPresetId = TimePreset;

export interface ReportingPresetDefinition {
  id: ReportingPresetId;
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

const DEFAULT_PRESET: ReportingPresetId = "last-seven-days";

export const REPORTING_PRESETS: ReportingPresetDefinition[] = [
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
const reportingPresetWritable = writable<ReportingPresetId>(DEFAULT_PRESET);

export const reportingMode = {
  subscribe: reportingModeWritable.subscribe,
};

export const reportingPreset = {
  subscribe: reportingPresetWritable.subscribe,
};

export const reportingRange = derived(reportingPresetWritable, (preset) =>
  buildPresetRange(preset),
);

export const reportingColumns = derived(reportingRange, (range) =>
  buildColumnsForRange(range),
);

export const toggleReportingMode = () => {
  reportingModeWritable.update((current) => !current);
};

export const setReportingMode = (value: boolean) => {
  reportingModeWritable.set(Boolean(value));
};

export const setReportingPreset = (preset: ReportingPresetId) => {
  const recognized = REPORTING_PRESETS.some((option) => option.id === preset);
  if (!recognized) {
    return;
  }
  reportingPresetWritable.set(preset);
};
