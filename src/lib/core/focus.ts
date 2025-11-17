import type { Task } from "./taskTypes";
import { isDraftPlaceholder } from "./taskFilters";

interface FocusFilterResult {
  tasks: Task[];
  containsFocus: boolean;
  changed: boolean;
}

const filterBranch = (
  tasks: Task[],
  ancestorFocused: boolean,
): FocusFilterResult => {
  if (tasks.length === 0) {
    return { tasks, containsFocus: false, changed: false };
  }

  if (ancestorFocused) {
    let containsFocus = false;
    for (const task of tasks) {
      if (task.isFocused) {
        containsFocus = true;
      }
      const childResult = filterBranch(task.children, true);
      if (childResult.containsFocus) {
        containsFocus = true;
      }
    }

    return { tasks, containsFocus, changed: false };
  }

  const filtered: Task[] = [];
  let containsFocus = false;
  let changed = false;

  for (const task of tasks) {
    const isFocused = Boolean(task.isFocused);
    const isDraft = isDraftPlaceholder(task);
    const childResult = filterBranch(task.children, isFocused);
    const childContainsFocus = childResult.containsFocus;
    const keep = isDraft || isFocused || childContainsFocus;

    if (!keep) {
      changed = true;
      continue;
    }

    if (isFocused || childContainsFocus) {
      containsFocus = true;
    }

    if (isFocused) {
      filtered.push(task);
      continue;
    }

    const childTasks = childResult.tasks;
    if (childResult.changed) {
      filtered.push({ ...task, children: childTasks });
      changed = true;
    } else {
      filtered.push(task);
    }
  }

  if (filtered.length !== tasks.length) {
    changed = true;
  }

  return { tasks: filtered, containsFocus, changed };
};

export const filterTasksToFocusScope = (
  tasks: Task[],
): { tasks: Task[]; containsFocus: boolean } => {
  const { tasks: scoped, containsFocus } = filterBranch(tasks, false);
  if (!containsFocus) {
    return { tasks: [], containsFocus: false };
  }
  return { tasks: scoped, containsFocus: true };
};

export const countFocusedTasks = (tasks: Task[]): number => {
  let count = 0;
  const stack: Task[] = [...tasks];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    if (current.isFocused) {
      count += 1;
    }
    if (current.children?.length) {
      stack.push(...current.children);
    }
  }
  return count;
};
