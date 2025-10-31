import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addTask,
  applySnapshot,
  DEFAULT_STATUS_FILTERS,
  createInitialData,
  createProject,
  createSnapshot,
  createTask,
  deleteTaskSession,
  flattenTasks,
  incrementTaskTime,
  locateTask,
  moveTask,
  setTaskStatus,
  updateTaskById,
  updateTaskSession,
} from "./taskTree";
import type { Project, Task } from "./taskTypes";

const baseTime = "2024-01-01T10:00:00.000Z";
const laterTime = "2024-01-02T12:30:00.000Z";

const withFakeTimers = (iso: string = baseTime) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

const restoreTimers = () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
};

const projectWithTasks = (): Project => {
  const child: Task = createTask("Child task", {
    id: "task-child",
    children: [],
    createdAt: baseTime,
    updatedAt: baseTime,
  });

  const root: Task = createTask("Root task", {
    id: "task-root",
    children: [child],
    createdAt: baseTime,
    updatedAt: baseTime,
  });

  return createProject("Demo Project", {
    id: "project-1",
    createdAt: baseTime,
    updatedAt: baseTime,
    tasks: [
      root,
      createTask("Second task", {
        id: "task-2",
        createdAt: baseTime,
        updatedAt: baseTime,
      }),
    ],
  });
};

describe("taskTree core helpers", () => {
  beforeEach(() => {
    withFakeTimers();
  });

  afterEach(() => {
    restoreTimers();
  });

  it("creates a task with expected defaults", () => {
    const task = createTask("New task");

    expect(task.title).toBe("New task");
    expect(task.status).toBe("idle");
    expect(task.timeSpentMs).toBe(0);
    expect(task.sessions).toEqual([]);
    expect(task.children).toEqual([]);
    expect(task.createdAt).toBe(baseTime);
    expect(task.updatedAt).toBe(baseTime);
    expect(typeof task.id).toBe("string");
  });

  it("creates a project with expected defaults", () => {
    const project = createProject("Inbox");

    expect(project.title).toBe("Inbox");
    expect(project.tasks).toEqual([]);
    expect(project.createdAt).toBe(baseTime);
    expect(project.updatedAt).toBe(baseTime);
  });

  it("creates initial seeded data with nested tasks and active project", () => {
    const data = createInitialData();

    expect(data.projects).toHaveLength(1);
    const [project] = data.projects;
    expect(project.tasks.length).toBeGreaterThan(0);
    expect(data.activeProjectId).toBe(project.id);
    expect(data.activeTaskId).toBeNull();
    expect(Array.isArray(data.snapshots)).toBe(true);
    expect(data.recentTaskIds).toEqual([]);
    expect(data.collapsedTaskIds).toEqual([]);
    expect(data.lastSavedAt).toBe(baseTime);
    expect(data.filters.statuses).toEqual(DEFAULT_STATUS_FILTERS);
  });

  it("updates a targeted task and project timestamps via updateTaskById", () => {
    const project = projectWithTasks();
    const projects = [project];

    vi.setSystemTime(new Date(laterTime));

    const result = updateTaskById(projects, "task-child", (task) => ({
      ...task,
      title: "Child updated",
    }));

    expect(result.changed).toBe(true);
    expect(result.projects).not.toBe(projects);
    const updatedProject = result.projects[0];
    expect(updatedProject.updatedAt).toBe(laterTime);
    const updatedChild = updatedProject.tasks[0].children[0];
    expect(updatedChild.title).toBe("Child updated");
    expect(updatedChild.updatedAt).toBe(laterTime);
  });

  it("returns unchanged data when updateTaskById target is missing", () => {
    const project = projectWithTasks();
    const projects = [project];

    const result = updateTaskById(projects, "missing", (task) => task);

    expect(result.changed).toBe(false);
    expect(result.projects).toBe(projects);
  });

  it("locates nested tasks with parent info", () => {
    const project = projectWithTasks();
    const located = locateTask([project], "task-child");

    expect(located).not.toBeNull();
    expect(located?.task.id).toBe("task-child");
    expect(located?.project.id).toBe("project-1");
    expect(located?.parentIds).toEqual(["task-root"]);
    expect(located?.index).toBe(0);
  });

  it("moves tasks within the same level", () => {
    const project = projectWithTasks();
    const projects = [project];

    const moved = moveTask(projects, "task-2", -1);

    expect(moved.changed).toBe(true);
    const [firstTask] = moved.projects[0].tasks;
    expect(firstTask.id).toBe("task-2");
  });

  it("does not move tasks outside boundaries", () => {
    const project = projectWithTasks();
    const projects = [project];

    const moved = moveTask(projects, "task-root", -1);

    expect(moved.changed).toBe(false);
    expect(moved.projects).toBe(projects);
  });

  it("adds new tasks at root and as children", () => {
    const project = projectWithTasks();
    const projects = [project];

    const rootAdded = addTask(projects, "project-1", "Root sibling");
    expect(rootAdded[0].tasks).toHaveLength(3);
    const addedRoot = rootAdded[0].tasks.at(-1);
    expect(addedRoot?.title).toBe("Root sibling");

    const childAdded = addTask(
      rootAdded,
      "project-1",
      "Child sibling",
      "task-root",
    );
    const rootChildren = childAdded[0].tasks[0].children;
    expect(rootChildren.at(-1)?.title).toBe("Child sibling");
  });

  it("updates task status and archived timestamp correctly", () => {
    const project = projectWithTasks();
    const projects = [project];

    const archived = setTaskStatus(projects, "task-root", "archived");
    expect(archived.changed).toBe(true);
    const updated = archived.projects[0].tasks[0];
    expect(updated.status).toBe("archived");
    expect(updated.archivedAt).toBe(baseTime);

    const resumed = setTaskStatus(
      archived.projects,
      "task-root",
      "in-progress",
    );
    const resumedTask = resumed.projects[0].tasks[0];
    expect(resumedTask.status).toBe("in-progress");
    expect(resumedTask.archivedAt).toBe(updated.archivedAt);
  });

  it("increments task time and clamps at zero", () => {
    const project = projectWithTasks();
    const projects = [project];

    vi.setSystemTime(new Date(laterTime));
    const started = setTaskStatus(projects, "task-root", "in-progress");
    const incremented = incrementTaskTime(started.projects, "task-root", 5000);
    const taskAfterIncrement = incremented.projects[0].tasks[0];
    expect(taskAfterIncrement.timeSpentMs).toBe(5000);
    expect(taskAfterIncrement.lastStartedAt).toBe(laterTime);
    expect(taskAfterIncrement.sessions).toHaveLength(1);
    expect(taskAfterIncrement.sessions[0].durationMs).toBe(5000);
    expect(taskAfterIncrement.sessions[0].endedAt).toBeUndefined();

    const decremented = incrementTaskTime(
      incremented.projects,
      "task-root",
      -10000,
    );
    const decrementedTask = decremented.projects[0].tasks[0];
    expect(decrementedTask.timeSpentMs).toBe(0);
    expect(decrementedTask.sessions[0].durationMs).toBe(0);
  });

  it("records session lifecycle when task status changes", () => {
    const project = projectWithTasks();
    const projects = [project];

    vi.setSystemTime(new Date(baseTime));
    const started = setTaskStatus(projects, "task-root", "in-progress");
    const startedTask = started.projects[0].tasks[0];
    expect(startedTask.sessions).toHaveLength(1);
    expect(startedTask.sessions[0].endedAt).toBeUndefined();

    const incremented = incrementTaskTime(started.projects, "task-root", 2000);
    expect(incremented.projects[0].tasks[0].sessions[0].durationMs).toBe(2000);

    vi.setSystemTime(new Date(laterTime));
    const paused = setTaskStatus(incremented.projects, "task-root", "paused");
    const pausedTask = paused.projects[0].tasks[0];
    expect(pausedTask.sessions[0].endedAt).toBe(laterTime);
  });

  it("updates a task session and recalculates totals", () => {
    const sessionId = "session-1";
    const project = createProject("Tracked", {
      id: "project-1",
      createdAt: baseTime,
      updatedAt: baseTime,
      tasks: [
        createTask("Tracked task", {
          id: "task-1",
          createdAt: baseTime,
          updatedAt: baseTime,
          timeSpentMs: 30 * 60 * 1000,
          sessions: [
            {
              id: sessionId,
              startedAt: baseTime,
              endedAt: "2024-01-01T10:30:00.000Z",
              durationMs: 30 * 60 * 1000,
            },
          ],
        }),
      ],
    });

    const result = updateTaskSession([project], "task-1", sessionId, {
      id: sessionId,
      startedAt: baseTime,
      endedAt: "2024-01-01T10:45:00.000Z",
      durationMs: 45 * 60 * 1000,
    });

    expect(result.changed).toBe(true);
    const updatedTask = locateTask(result.projects, "task-1")?.task;
    expect(updatedTask?.sessions).toHaveLength(1);
    expect(updatedTask?.sessions[0].durationMs).toBe(45 * 60 * 1000);
    expect(updatedTask?.timeSpentMs).toBe(45 * 60 * 1000);
    expect(updatedTask?.lastStartedAt).toBe(baseTime);
  });

  it("deletes a task session and updates aggregates", () => {
    const project = createProject("Tracked", {
      id: "project-1",
      createdAt: baseTime,
      updatedAt: baseTime,
      tasks: [
        createTask("Tracked task", {
          id: "task-1",
          createdAt: baseTime,
          updatedAt: baseTime,
          timeSpentMs: 90 * 60 * 1000,
          lastStartedAt: laterTime,
          sessions: [
            {
              id: "session-1",
              startedAt: baseTime,
              endedAt: "2024-01-01T10:15:00.000Z",
              durationMs: 15 * 60 * 1000,
            },
            {
              id: "session-2",
              startedAt: "2024-01-02T12:00:00.000Z",
              endedAt: laterTime,
              durationMs: 75 * 60 * 1000,
            },
          ],
        }),
      ],
    });

    const result = deleteTaskSession([project], "task-1", "session-1");

    expect(result.changed).toBe(true);
    const updatedTask = locateTask(result.projects, "task-1")?.task;
    expect(updatedTask?.sessions).toHaveLength(1);
    expect(updatedTask?.sessions[0].id).toBe("session-2");
    expect(updatedTask?.timeSpentMs).toBe(75 * 60 * 1000);
    expect(updatedTask?.lastStartedAt).toBe("2024-01-02T12:00:00.000Z");
  });

  it("flattens projects into located task list", () => {
    const project = projectWithTasks();
    const flattened = flattenTasks([project]);

    expect(flattened.map((item) => item.task.id)).toEqual([
      "task-root",
      "task-child",
      "task-2",
    ]);
    expect(flattened[0].parentIds).toEqual([]);
    expect(flattened[1].parentIds).toEqual(["task-root"]);
  });

  it("creates and applies snapshots without sharing references", () => {
    const project = projectWithTasks();
    const projects = [project];

    const snapshot = createSnapshot(projects, "Daily");
    expect(snapshot.name).toBe("Daily");
    expect(snapshot.createdAt).toBe(baseTime);
    expect(snapshot.data).not.toBe(projects);
    expect(snapshot.data[0]).not.toBe(projects[0]);

    const restored = applySnapshot(snapshot);
    expect(restored).not.toBe(snapshot.data);
    expect(restored[0]).not.toBe(snapshot.data[0]);
    expect(restored[0].tasks[0].id).toBe("task-root");
  });
});
