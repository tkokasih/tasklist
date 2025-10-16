import { browser } from '$app/environment';
import { derived, writable } from 'svelte/store';

export type TaskStatus = {
  id: string;
  name: string;
  color: string;
  isDone: boolean;
};

export type TaskTimerLog = {
  id: string;
  start: number;
  end?: number;
};

export interface Task {
  id: string;
  description: string;
  statusId: string;
  children: Task[];
  expanded: boolean;
  timerLogs: TaskTimerLog[];
  activeTimerStart?: number | null;
}

export type PersistedData = {
  tasks: Task[];
  statuses: TaskStatus[];
  selectedTaskId: string | null;
  lastActivated: string[];
};

const STORAGE_KEY = 'tasklist-data-v1';
const BACKUP_KEY = 'tasklist-backups-v1';

const defaultStatuses: TaskStatus[] = [
  { id: 'inbox', name: 'Inbox', color: '#6c6cff', isDone: false },
  { id: 'in-progress', name: 'In Progress', color: '#f59e0b', isDone: false },
  { id: 'done', name: 'Done', color: '#10b981', isDone: true }
];

function createId(prefix: string) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);
  return `${prefix}-${id}`;
}

function safeLoad(): PersistedData | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedData;
    if (!parsed.tasks || !parsed.statuses) return null;
    return parsed;
  } catch (error) {
    console.error('Failed to load saved task list', error);
    return null;
  }
}

function walkTasks(tasks: Task[], callback: (task: Task, parent: Task | null, index: number, siblings: Task[]) => void) {
  const visit = (list: Task[], parent: Task | null) => {
    list.forEach((task, index) => {
      callback(task, parent, index, list);
      visit(task.children, task);
    });
  };
  visit(tasks, null);
}

export function totalDuration(task: Task, now = Date.now()): number {
  return task.timerLogs.reduce((acc, entry) => {
    const end = entry.end ?? now;
    return acc + Math.max(0, end - entry.start);
  }, 0);
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function createTask(description = '', statusId = defaultStatuses[0].id): Task {
  return {
    id: createId('task'),
    description,
    statusId,
    children: [],
    expanded: true,
    timerLogs: [],
    activeTimerStart: null
  };
}

function cloneTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    children: cloneTasks(task.children),
    timerLogs: task.timerLogs.map((log) => ({ ...log }))
  }));
}

function findTask(tasks: Task[], taskId: string) {
  let result: { task: Task; parent: Task | null; index: number; siblings: Task[] } | null = null;
  walkTasks(tasks, (task, parent, index, siblings) => {
    if (task.id === taskId) {
      result = { task, parent, index, siblings };
    }
  });
  return result;
}

function removeTask(tasks: Task[], taskId: string) {
  const cloned = cloneTasks(tasks);
  const stack: Task[][] = [cloned];
  while (stack.length) {
    const current = stack.pop()!;
    const index = current.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      const [removed] = current.splice(index, 1);
      return { list: cloned, removed, parentList: current };
    }
    current.forEach((child) => stack.push(child.children));
  }
  return { list: cloned, removed: null, parentList: null };
}

function insertTaskAt(targetList: Task[], index: number, task: Task) {
  targetList.splice(index, 0, task);
}

export function createTaskStore() {
  const persisted = safeLoad();

  const tasks = writable<Task[]>(persisted?.tasks ?? [createTask('New Task')]);
  const statuses = writable<TaskStatus[]>(persisted?.statuses ?? defaultStatuses);
  const selectedTaskId = writable<string | null>(persisted?.selectedTaskId ?? null);
  const lastActivated = writable<string[]>(persisted?.lastActivated ?? []);

  const persist = () => {
    if (!browser) return;
    const value: PersistedData = {
      tasks: stripUndefined(getStoreValue(tasks)),
      statuses: stripUndefined(getStoreValue(statuses)),
      selectedTaskId: getStoreValue(selectedTaskId),
      lastActivated: getStoreValue(lastActivated)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  };

  const sync = () => persist();

  tasks.subscribe(persist);
  statuses.subscribe(persist);
  selectedTaskId.subscribe(persist);
  lastActivated.subscribe(persist);

  function moveTask(taskId: string, targetParentId: string | null, targetIndex: number) {
    let removed: Task | null = null;
    tasks.update((current) => {
      const removal = removeTask(current, taskId);
      if (!removal.removed) return current;
      removed = removal.removed;
      if (targetParentId === null) {
        insertTaskAt(removal.list, targetIndex, removed);
      } else {
        const parent = findTask(removal.list, targetParentId)?.task;
        if (!parent) return current;
        insertTaskAt(parent.children, targetIndex, removed);
        parent.expanded = true;
      }
      return removal.list;
    });
    return removed;
  }

  function addSibling(taskId: string, description = '') {
    const newTask = createTask(description);
    tasks.update((current) => {
      const info = findTask(current, taskId);
      if (!info) return current;
      const parentList = info.parent ? info.parent.children : current;
      parentList.splice(info.index + 1, 0, newTask);
      return current;
    });
    selectedTaskId.set(newTask.id);
    return newTask;
  }

  function addRootTask(description = '') {
    const newTask = createTask(description);
    tasks.update((current) => {
      current.push(newTask);
      return current;
    });
    selectedTaskId.set(newTask.id);
    return newTask;
  }

  function addChild(taskId: string, description = '') {
    const newTask = createTask(description);
    tasks.update((current) => {
      const info = findTask(current, taskId);
      if (!info) return current;
      info.task.children.push(newTask);
      info.task.expanded = true;
      return current;
    });
    selectedTaskId.set(newTask.id);
    return newTask;
  }

  function indentTask(taskId: string) {
    tasks.update((current) => {
      const info = findTask(current, taskId);
      if (!info) return current;
      const parentList = info.parent ? info.parent.children : current;
      if (info.index === 0) return current;
      const previousSibling = parentList[info.index - 1];
      parentList.splice(info.index, 1);
      previousSibling.children.push(info.task);
      previousSibling.expanded = true;
      return current;
    });
  }

  function outdentTask(taskId: string) {
    tasks.update((current) => {
      const info = findTask(current, taskId);
      if (!info || !info.parent) return current;
      const grandParent = findTask(current, info.parent.id)?.parent;
      const parentList = info.parent.children;
      parentList.splice(info.index, 1);
      if (grandParent) {
        const gpList = grandParent.children;
        const parentIndex = gpList.findIndex((t) => t.id === info.parent!.id);
        gpList.splice(parentIndex + 1, 0, info.task);
      } else {
        const rootIndex = current.findIndex((t) => t.id === info.parent!.id);
        current.splice(rootIndex + 1, 0, info.task);
      }
      return current;
    });
  }

  function toggleTimer(taskId: string) {
    const now = Date.now();
    tasks.update((current) => {
      const activeEntry = findActiveTask(current);
      if (activeEntry && activeEntry.task.id !== taskId) {
        stopTimerInternal(activeEntry.task, now);
      }
      const info = findTask(current, taskId);
      if (!info) return current;
      const task = info.task;
      if (task.activeTimerStart) {
        stopTimerInternal(task, now);
      } else {
        startTimerInternal(task, now);
        pushLastActivated(taskId);
      }
      return current;
    });
  }

  function stopTimer(taskId: string) {
    const now = Date.now();
    tasks.update((current) => {
      const info = findTask(current, taskId);
      if (!info || !info.task.activeTimerStart) return current;
      stopTimerInternal(info.task, now);
      return current;
    });
  }

  function startTimerInternal(task: Task, start: number) {
    task.activeTimerStart = start;
    const entry: TaskTimerLog = { id: createId('timer'), start };
    task.timerLogs.push(entry);
  }

  function stopTimerInternal(task: Task, end: number) {
    task.activeTimerStart = null;
    const lastEntry = [...task.timerLogs].reverse().find((entry) => entry.end === undefined);
    if (lastEntry) {
      lastEntry.end = end;
    }
  }

  function findActiveTask(tasksList: Task[]) {
    let active: { task: Task } | null = null;
    walkTasks(tasksList, (task) => {
      if (task.activeTimerStart) {
        active = { task };
      }
    });
    return active;
  }

  function pushLastActivated(taskId: string) {
    lastActivated.update((current) => {
      const without = current.filter((id) => id !== taskId);
      without.unshift(taskId);
      return without.slice(0, 5);
    });
  }

  function updateDescription(taskId: string, description: string) {
    tasks.update((current) => {
      const info = findTask(current, taskId);
      if (!info) return current;
      info.task.description = description;
      return current;
    });
  }

  function updateStatus(taskId: string, statusId: string) {
    tasks.update((current) => {
      const info = findTask(current, taskId);
      if (!info) return current;
      info.task.statusId = statusId;
      return current;
    });
  }

  function toggleExpanded(taskId: string) {
    tasks.update((current) => {
      const info = findTask(current, taskId);
      if (!info) return current;
      info.task.expanded = !info.task.expanded;
      return current;
    });
  }

  function selectTask(taskId: string | null) {
    selectedTaskId.set(taskId);
  }

  function snapshot(): PersistedData | null {
    if (!browser) return null;
    const snapshotData: PersistedData = {
      tasks: stripUndefined(getStoreValue(tasks)),
      statuses: stripUndefined(getStoreValue(statuses)),
      selectedTaskId: getStoreValue(selectedTaskId),
      lastActivated: getStoreValue(lastActivated)
    };
    const entry = {
      id: createId('snapshot'),
      createdAt: Date.now(),
      data: snapshotData
    };
    const history = loadBackups();
    history.unshift(entry);
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify(history.slice(0, 5))
    );
    return snapshotData;
  }

  function loadBackups() {
    if (!browser) return [] as BackupEntry[];
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as BackupEntry[];
      return parsed ?? [];
    } catch (error) {
      console.error('Failed to load backups', error);
      return [];
    }
  }

  function applyData(data: PersistedData) {
    tasks.set(cloneTasks(data.tasks));
    statuses.set(data.statuses);
    selectedTaskId.set(data.selectedTaskId);
    lastActivated.set(data.lastActivated ?? []);
    sync();
  }

  const backups = writable<BackupEntry[]>(browser ? loadBackups() : []);

  function refreshBackups() {
    backups.set(browser ? loadBackups() : []);
  }

  function saveSnapshot() {
    const result = snapshot();
    if (result) {
      refreshBackups();
    }
    return result;
  }

  function importData(raw: string) {
    try {
      const parsed = JSON.parse(raw) as PersistedData;
      if (!parsed.tasks || !parsed.statuses) {
        throw new Error('Invalid data');
      }
      applyData(parsed);
      refreshBackups();
      return true;
    } catch (error) {
      console.error('Failed to import data', error);
      return false;
    }
  }

  const selectedTask = derived([tasks, selectedTaskId], ([$tasks, $selectedId]) => {
    if (!$selectedId) return null;
    const info = findTask($tasks, $selectedId);
    return info?.task ?? null;
  });

  return {
    tasks,
    statuses,
    selectedTaskId,
    selectedTask,
    lastActivated,
    backups,
    selectTask,
    addSibling,
    addRootTask,
    addChild,
    indentTask,
    outdentTask,
    moveTask,
    toggleTimer,
    stopTimer,
    updateDescription,
    updateStatus,
    toggleExpanded,
    saveSnapshot,
    importData,
    refreshBackups,
    totalDuration
  };
}

type BackupEntry = {
  id: string;
  createdAt: number;
  data: PersistedData;
};

function getStoreValue<T>(store: { subscribe: (run: (value: T) => void) => () => void }): T {
  let value!: T;
  store.subscribe((current) => (value = current))();
  return value;
}
