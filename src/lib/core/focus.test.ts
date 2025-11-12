import { describe, expect, it } from "vitest";
import type { Task } from "./taskTypes";
import { filterTasksToFocusScope, countFocusedTasks } from "./focus";

const makeTask = (
  id: string,
  overrides: Partial<Task> = {},
  children: Task[] = [],
): Task => ({
  id,
  title: overrides.title ?? id,
  status: overrides.status ?? "idle",
  isFocused: overrides.isFocused ?? false,
  timeSpentMs: overrides.timeSpentMs ?? 0,
  sessions: overrides.sessions ?? [],
  children,
  createdAt: overrides.createdAt ?? "2024-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2024-01-01T00:00:00.000Z",
});

const tree = (): Task[] => {
  const leaf = makeTask("leaf", { isFocused: true });
  const branch = makeTask("branch", {}, [leaf, makeTask("sibling")]);
  const other = makeTask("other");
  const root = makeTask("root", {}, [branch, other]);
  const standalone = makeTask("standalone");
  return [root, standalone];
};

const cloneWithoutFocus = (tasks: Task[]): Task[] =>
  tasks.map((task) => ({
    ...task,
    isFocused: false,
    children: cloneWithoutFocus(task.children ?? []),
  }));

describe("focus helpers", () => {
  it("returns empty tasks when no focused nodes exist", () => {
    const tasks = cloneWithoutFocus(tree());
    const result = filterTasksToFocusScope(tasks);
    expect(result.containsFocus).toBe(false);
    expect(result.tasks).toEqual([]);
  });

  it("keeps ancestors and descendants around focused nodes", () => {
    const tasks = tree();
    const result = filterTasksToFocusScope(tasks);
    expect(result.containsFocus).toBe(true);
    expect(result.tasks).toHaveLength(1);
    const root = result.tasks[0];
    expect(root.id).toBe("root");
    expect(root.children).toHaveLength(1);
    const branch = root.children[0];
    expect(branch.id).toBe("branch");
    expect(branch.children.map((child) => child.id)).toEqual([
      "leaf",
    ]);
  });

  it("preserves full subtree for focused parents", () => {
    const focusedParent = makeTask(
      "parent",
      { isFocused: true },
      [makeTask("child"), makeTask("child-2")],
    );
    const result = filterTasksToFocusScope([focusedParent]);
    expect(result.tasks[0].children).toHaveLength(2);
  });

  it("counts focused tasks within a tree", () => {
    const tasks = [
      makeTask("a", { isFocused: true }, [makeTask("b"), makeTask("c", { isFocused: true })]),
      makeTask("d"),
    ];
    expect(countFocusedTasks(tasks)).toBe(2);
  });
});
