import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";
import { focusedTasks } from "$lib/stores/taskSelectors";
import { taskStore } from "$lib/stores/taskStore";
import { createInitialData, createTask } from "$lib/core/taskTree";
import type { TaskData } from "$lib/core/taskTypes";

const FOCUSED_TASK_ID = "task-focused";

const buildFocusedData = (): TaskData => {
  const data = createInitialData();
  const project = data.projects[0];
  project.tasks = [
    createTask("Focused", { id: FOCUSED_TASK_ID, isFocused: true }),
    createTask("Secondary", { id: "task-secondary" }),
  ];
  data.activeProjectId = project.id;
  return data;
};

const resetStore = () => {
  taskStore.importData(buildFocusedData());
};

describe("focus selectors + store flows", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    taskStore.reset();
  });

  it("drops focus when a task is completed", () => {
    expect(get(focusedTasks).map((task) => task.id)).toContain(
      FOCUSED_TASK_ID,
    );

    taskStore.completeTask(FOCUSED_TASK_ID);

    expect(get(focusedTasks)).toHaveLength(0);
  });

  it("drops focus when a task is archived", () => {
    expect(get(focusedTasks)).toHaveLength(1);

    taskStore.archiveTask(FOCUSED_TASK_ID);

    expect(get(focusedTasks)).toHaveLength(0);
  });

  it("removes focused entry when task is deleted", () => {
    expect(get(focusedTasks)).toHaveLength(1);

    taskStore.deleteTask(FOCUSED_TASK_ID);

    expect(get(focusedTasks)).toHaveLength(0);
  });
});
