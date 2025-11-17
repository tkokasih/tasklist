import { describe, expect, it } from "vitest";
import type { Project, Task, TaskSession } from "$lib/core/taskTypes";
import { buildPresetRange } from "../time";
import {
  aggregateProjects,
  aggregateSessions,
  aggregateTaskTree,
  bucketSessionsForRange,
} from "./timeBuckets";

const iso = (date: string, time: string) => `${date}T${time}.000Z`;

const createSession = (
  start: string,
  end: string | null,
  durationMs: number,
  overrides: Partial<TaskSession> = {},
): TaskSession => ({
  id: overrides.id ?? `sess-${start}`,
  startedAt: start,
  endedAt: end ?? undefined,
  durationMs,
  ...overrides,
});

const createTask = (
  sessions: TaskSession[],
  status: Task["status"] = "in-progress",
): Task => ({
  id: "task-1",
  title: "Sample",
  status,
  isFocused: false,
  sessions,
  children: [],
  timeSpentMs: sessions.reduce((sum, s) => sum + s.durationMs, 0),
  createdAt: iso("2024-01-01", "00:00:00"),
  updatedAt: iso("2024-01-01", "00:00:00"),
});

const range = (start: string, end: string) => ({
  start: new Date(start),
  end: new Date(end),
});

describe("aggregateSessions", () => {
  it("ignores sessions outside the range and buckets remaining duration", () => {
    const sessions = [
      createSession(
        iso("2024-01-02", "09:00:00"),
        iso("2024-01-02", "11:00:00"),
        2 * 60 * 60 * 1000,
      ),
      createSession(
        iso("2024-01-03", "15:00:00"),
        iso("2024-01-03", "16:30:00"),
        90 * 60 * 1000,
      ),
      createSession(
        iso("2024-02-01", "10:00:00"),
        iso("2024-02-01", "11:00:00"),
        60 * 60 * 1000,
      ),
    ];

    const result = aggregateSessions(
      sessions,
      range(iso("2024-01-01", "00:00:00"), iso("2024-01-31", "23:59:59")),
    );

    expect(result.totalMs).toBe(3.5 * 60 * 60 * 1000);
    expect(result.buckets["2024-01-02"]).toBe(2 * 60 * 60 * 1000);
    expect(result.buckets["2024-01-03"]).toBe(90 * 60 * 1000);
    expect(result.buckets["2024-02-01"]).toBeUndefined();
    expect(result.concurrentSessionsDetected).toBe(false);
  });

  it("clamps sessions that partially intersect the range and flags concurrent ones", () => {
    const _now = iso("2024-01-05", "12:00:00");
    const sessions = [
      createSession(
        iso("2024-01-04", "20:00:00"),
        iso("2024-01-05", "02:00:00"),
        6 * 60 * 60 * 1000,
      ),
      createSession(iso("2024-01-05", "10:00:00"), null, 2 * 60 * 60 * 1000),
    ];

    const result = aggregateSessions(
      sessions,
      range(iso("2024-01-05", "00:00:00"), iso("2024-01-06", "00:00:00")),
    );

    const expectedInRange = 2 * 60 * 60 * 1000; // 00:00-02:00 on Jan 5
    expect(result.totalMs).toBeGreaterThanOrEqual(expectedInRange);
    expect(Object.keys(result.buckets)).toContain("2024-01-05");
    expect(result.concurrentSessionsDetected).toBe(true);
  });

  it("returns inclusive totals/buckets that roll up descendant durations", () => {
    const parent = createTask(
      [
        createSession(
          iso("2024-01-03", "08:00:00"),
          iso("2024-01-03", "09:00:00"),
          60 * 60 * 1000,
        ),
      ],
      "completed",
    );
    const child = createTask(
      [
        createSession(
          iso("2024-01-03", "09:30:00"),
          iso("2024-01-03", "10:00:00"),
          30 * 60 * 1000,
        ),
      ],
      "in-progress",
    );
    parent.id = "parent-task";
    child.id = "child-task";
    parent.children.push(child);

    const result = aggregateTaskTree(
      parent,
      range(iso("2024-01-01", "00:00:00"), iso("2024-01-31", "23:59:59")),
    );

    const parentAggregation = result.taskTotals.get(parent.id);
    expect(parentAggregation?.totalMs).toBe(60 * 60 * 1000);
    expect(parentAggregation?.inclusiveMs).toBe(90 * 60 * 1000);
    expect(parentAggregation?.inclusiveBuckets["2024-01-03"]).toBe(
      90 * 60 * 1000,
    );
    expect(parentAggregation?.buckets["2024-01-03"]).toBe(60 * 60 * 1000);

    const childAggregation = result.taskTotals.get(child.id);
    expect(childAggregation?.inclusiveMs).toBe(childAggregation?.totalMs);
  });

  it("falls back to duration when end timestamp is missing or equal to start", () => {
    const session = createSession(
      iso("2024-01-05", "09:00:00"),
      iso("2024-01-05", "09:00:00"),
      45 * 60 * 1000,
    );
    const result = aggregateSessions(
      [session],
      range(iso("2024-01-05", "00:00:00"), iso("2024-01-06", "00:00:00")),
    );

    expect(result.totalMs).toBe(45 * 60 * 1000);
    expect(result.buckets["2024-01-05"]).toBe(45 * 60 * 1000);
  });
});

describe("bucketSessionsForRange", () => {
  it("excludes archived tasks unless includeArchived is true", () => {
    const task = createTask(
      [
        createSession(
          iso("2024-01-02", "09:00:00"),
          iso("2024-01-02", "10:00:00"),
          60 * 60 * 1000,
        ),
      ],
      "archived",
    );

    const rangeConfig = {
      preset: "today" as const,
      ...range(iso("2024-01-01", "00:00:00"), iso("2024-01-03", "00:00:00")),
    };

    const excluded = bucketSessionsForRange(task, rangeConfig);
    expect(excluded.totalMs).toBe(0);
    expect(excluded.buckets).toEqual({});

    const included = bucketSessionsForRange(task, rangeConfig, {
      includeArchived: true,
    });
    expect(included.totalMs).toBe(60 * 60 * 1000);
    expect(included.buckets["2024-01-02"]).toBe(60 * 60 * 1000);
  });

  it("includes completed tasks by default and allows opting out", () => {
    const task = createTask(
      [
        createSession(
          iso("2024-01-02", "12:00:00"),
          iso("2024-01-02", "13:30:00"),
          90 * 60 * 1000,
        ),
      ],
      "completed",
    );
    const rangeConfig = {
      ...range(iso("2024-01-01", "00:00:00"), iso("2024-01-03", "00:00:00")),
    };

    const defaultResult = bucketSessionsForRange(task, rangeConfig);
    expect(defaultResult.totalMs).toBe(90 * 60 * 1000);

    const excluded = bucketSessionsForRange(task, rangeConfig, {
      includeCompleted: false,
    });
    expect(excluded.totalMs).toBe(0);
  });
});

describe("aggregateTaskTree", () => {
  it("aggregates root and children and returns map keyed by task id", () => {
    const parent: Task = {
      id: "parent",
      title: "Parent",
      status: "completed",
      isFocused: false,
      sessions: [
        createSession(
          iso("2024-01-02", "09:00:00"),
          iso("2024-01-02", "10:00:00"),
          60 * 60 * 1000,
        ),
      ],
      children: [],
      timeSpentMs: 60 * 60 * 1000,
      createdAt: iso("2024-01-01", "00:00:00"),
      updatedAt: iso("2024-01-01", "00:00:00"),
    };
    const child: Task = {
      ...createTask(
        [
          createSession(
            iso("2024-01-03", "11:00:00"),
            iso("2024-01-03", "13:00:00"),
            2 * 60 * 60 * 1000,
          ),
        ],
        "in-progress",
      ),
      id: "child",
    };
    parent.children = [child];

    const rangeConfig = buildPresetRange("last-seven-days", {
      nowFactory: () => new Date(iso("2024-01-05", "00:00:00")),
    });

    const result = aggregateTaskTree(parent, rangeConfig);

    expect(result.range).toEqual(rangeConfig);
    expect(result.taskTotals.size).toBe(2);
    expect(result.taskTotals.get("parent")?.totalMs).toBe(60 * 60 * 1000);
    expect(result.taskTotals.get("child")?.totalMs).toBe(2 * 60 * 60 * 1000);
  });
});

describe("aggregateProjects", () => {
  const makeProject = (id: string, tasks: Task[]): Project => ({
    id,
    title: `Project ${id}`,
    description: undefined,
    tasks,
    createdAt: iso("2024-01-01", "00:00:00"),
    updatedAt: iso("2024-01-01", "00:00:00"),
  });

  it("aggregates tasks across multiple projects while respecting options", () => {
    const sharedRange = buildPresetRange("today", {
      nowFactory: () => new Date(iso("2024-01-03", "12:00:00")),
    });

    const projectA = makeProject("A", [
      {
        id: "task-a1",
        title: "Task A1",
        status: "completed",
        sessions: [
          createSession(
            iso("2024-01-03", "09:00:00"),
            iso("2024-01-03", "10:00:00"),
            60 * 60 * 1000,
          ),
          createSession(
            iso("2024-01-02", "11:00:00"),
            iso("2024-01-02", "12:00:00"),
            60 * 60 * 1000,
          ),
        ],
        children: [],
        timeSpentMs: 2 * 60 * 60 * 1000,
        createdAt: iso("2024-01-01", "00:00:00"),
        updatedAt: iso("2024-01-01", "00:00:00"),
        isFocused: false,
      },
    ]);

    const projectB = makeProject("B", [
      {
        ...createTask(
          [
            createSession(
              iso("2024-01-03", "08:30:00"),
              iso("2024-01-03", "09:30:00"),
              60 * 60 * 1000,
            ),
          ],
          "archived",
        ),
        id: "task-b1",
      },
    ]);

    const defaultResult = aggregateProjects([projectA, projectB], sharedRange);
    expect(defaultResult.taskTotals.get("task-a1")?.totalMs).toBe(
      60 * 60 * 1000,
    );
    expect(defaultResult.taskTotals.get("task-b1")).toBeUndefined();

    const includeArchived = aggregateProjects(
      [projectA, projectB],
      sharedRange,
      { includeArchived: true },
    );
    expect(includeArchived.taskTotals.get("task-b1")?.totalMs).toBe(
      60 * 60 * 1000,
    );
  });
});
