import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get, writable } from "svelte/store";
import type { TaskData, Task, Project, TaskSession } from "../core/taskTypes";
import { buildPresetRange } from "../core/time";
import { createTimeAggregationSelector } from "./reportingSelectors";
import type { ReportingSelectorResult } from "./reportingSelectors";

const iso = (date: string, time: string) => `${date}T${time}.000Z`;

const createSession = (
  start: string,
  end: string | null,
  durationMs: number,
): TaskSession => ({
  id: `session-${start}`,
  startedAt: start,
  endedAt: end ?? undefined,
  durationMs,
});

const makeTask = (
  overrides: Partial<Task> & Pick<Task, "id" | "title" | "status">,
): Task => ({
  id: overrides.id,
  title: overrides.title,
  status: overrides.status,
  isFocused: overrides.isFocused ?? false,
  timeSpentMs: overrides.timeSpentMs ?? 0,
  sessions: overrides.sessions ?? [],
  children: overrides.children ?? [],
  description: overrides.description,
  createdAt: overrides.createdAt ?? iso("2024-01-01", "00:00:00"),
  updatedAt: overrides.updatedAt ?? iso("2024-01-01", "00:00:00"),
  archivedAt: overrides.archivedAt,
  lastStartedAt: overrides.lastStartedAt,
});

const makeProject = (id: string, tasks: Task[]): Project => ({
  id,
  title: `Project ${id}`,
  description: undefined,
  tasks,
  createdAt: iso("2024-01-01", "00:00:00"),
  updatedAt: iso("2024-01-01", "00:00:00"),
});

const withProjects = (projects: Project[]): TaskData => ({
  projects,
  activeProjectId: projects[0]?.id ?? null,
  activeTaskId: null,
  selectedTaskId: null,
  recentTaskIds: [],
  collapsedTaskIds: [],
  snapshots: [],
  lastSavedAt: iso("2024-01-01", "00:00:00"),
  filters: {
    statuses: ["idle", "in-progress", "paused", "completed", "archived"],
  },
});

const rangeToday = buildPresetRange("today", {
  nowFactory: () => new Date(iso("2024-01-03", "12:00:00")),
});

const getResult = (
  selector: ReturnType<typeof createTimeAggregationSelector>,
): ReportingSelectorResult => get(selector);

describe("reportingSelectors", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso("2024-01-03", "12:00:00")));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aggregates project tasks into totals map", () => {
    const child = makeTask({
      id: "task-child",
      title: "Child",
      status: "in-progress",
      sessions: [
        createSession(
          iso("2024-01-03", "10:00:00"),
          iso("2024-01-03", "10:30:00"),
          30 * 60 * 1000,
        ),
      ],
      timeSpentMs: 30 * 60 * 1000,
    });
    const parent = makeTask({
      id: "task-parent",
      title: "Parent",
      status: "completed",
      sessions: [
        createSession(
          iso("2024-01-03", "09:00:00"),
          iso("2024-01-03", "10:00:00"),
          60 * 60 * 1000,
        ),
      ],
      timeSpentMs: 90 * 60 * 1000,
      children: [child],
    });

    const store = writable({
      data: withProjects([makeProject("A", [parent])]),
    });
    const selector = createTimeAggregationSelector(rangeToday, {}, store, true);

    const result = getResult(selector);
    expect(result.range).toEqual(rangeToday);
    expect(result.totals.get("task-parent")?.totalMs).toBe(60 * 60 * 1000);
    expect(result.totals.get("task-child")?.totalMs).toBe(30 * 60 * 1000);
    expect(result.warnings).toEqual([]);
  });

  it("memoizes selectors per store/range/options combination", () => {
    const store = writable({ data: withProjects([makeProject("A", [])]) });
    const selectorA = createTimeAggregationSelector(
      rangeToday,
      {},
      store,
      true,
    );
    const selectorB = createTimeAggregationSelector(
      rangeToday,
      {},
      store,
      true,
    );
    expect(selectorA).toBe(selectorB);
  });

  it("updates when store projects change", () => {
    const project = makeProject("A", [
      makeTask({
        id: "task-1",
        title: "Task 1",
        status: "completed",
        sessions: [
          createSession(
            iso("2024-01-03", "08:00:00"),
            iso("2024-01-03", "09:00:00"),
            60 * 60 * 1000,
          ),
        ],
        timeSpentMs: 60 * 60 * 1000,
      }),
    ]);

    const store = writable({ data: withProjects([project]) });
    const selector = createTimeAggregationSelector(rangeToday, {}, store, true);

    expect(getResult(selector).totals.get("task-1")?.totalMs).toBe(
      60 * 60 * 1000,
    );

    const updatedProject = makeProject("A", [
      makeTask({
        id: "task-1",
        title: "Task 1",
        status: "completed",
        sessions: [
          createSession(
            iso("2024-01-03", "08:00:00"),
            iso("2024-01-03", "10:00:00"),
            2 * 60 * 60 * 1000,
          ),
        ],
        timeSpentMs: 2 * 60 * 60 * 1000,
      }),
    ]);

    store.set({ data: withProjects([updatedProject]) });
    expect(getResult(selector).totals.get("task-1")?.totalMs).toBe(
      2 * 60 * 60 * 1000,
    );
  });

  it("respects includeArchived option when aggregating", () => {
    const archivedTask = makeTask({
      id: "archived-task",
      title: "Archived",
      status: "archived",
      sessions: [
        createSession(
          iso("2024-01-03", "07:00:00"),
          iso("2024-01-03", "08:00:00"),
          60 * 60 * 1000,
        ),
      ],
      timeSpentMs: 60 * 60 * 1000,
    });

    const store = writable({
      data: withProjects([makeProject("A", [archivedTask])]),
    });
    const defaultSelector = createTimeAggregationSelector(
      rangeToday,
      {},
      store,
      true,
    );
    expect(
      getResult(defaultSelector).totals.get("archived-task"),
    ).toBeUndefined();

    const includeArchivedSelector = createTimeAggregationSelector(
      rangeToday,
      { includeArchived: true },
      store,
      true,
    );
    expect(
      getResult(includeArchivedSelector).totals.get("archived-task")?.totalMs,
    ).toBe(60 * 60 * 1000);
  });

  it("surfaces concurrent session warnings when open sessions exist", () => {
    const task = makeTask({
      id: "task-open",
      title: "Open session",
      status: "in-progress",
      sessions: [
        createSession(iso("2024-01-03", "11:00:00"), null, 60 * 60 * 1000),
      ],
      timeSpentMs: 60 * 60 * 1000,
    });

    const store = writable({ data: withProjects([makeProject("A", [task])]) });
    const selector = createTimeAggregationSelector(rangeToday, {}, store, true);
    const warnings = getResult(selector).warnings;
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toEqual({
      type: "concurrentSessions",
      taskIds: ["task-open"],
    });
  });

  it("returns empty totals when feature flag disabled", () => {
    const task = makeTask({
      id: "task-1",
      title: "Task 1",
      status: "completed",
      sessions: [
        createSession(
          iso("2024-01-03", "08:00:00"),
          iso("2024-01-03", "09:00:00"),
          60 * 60 * 1000,
        ),
      ],
      timeSpentMs: 60 * 60 * 1000,
    });

    const store = writable({ data: withProjects([makeProject("A", [task])]) });
    const selector = createTimeAggregationSelector(
      rangeToday,
      {},
      store,
      false,
    );
    const result = getResult(selector);
    expect(result.totals.size).toBe(0);
    expect(result.warnings).toEqual([]);
  });
});
