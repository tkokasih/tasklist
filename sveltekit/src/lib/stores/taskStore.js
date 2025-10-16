import { browser } from '$app/environment';
import { get, readable, writable } from 'svelte/store';
import {
  cloneTasks,
  computeTotalTime,
  createTask,
  findTaskPath,
  formatDuration,
  getParentAndIndex,
  insertTaskAfter,
  moveTask,
  removeTaskAtPath
} from '$utils/taskUtils';

const STORAGE_KEY = 'tasklist-data';
const BACKUP_KEY = 'tasklist-backups';

export const defaultStatuses = [
  { id: 'inbox', name: 'Inbox', color: '#2563eb', isDone: false },
  { id: 'in-progress', name: 'In Progress', color: '#f59e0b', isDone: false },
  { id: 'done', name: 'Done', color: '#16a34a', isDone: true }
];

const tickReadable = readable(Date.now(), (set) => {
  const interval = setInterval(() => set(Date.now()), 1000);
  return () => clearInterval(interval);
});

export const now = tickReadable;

function loadData() {
  if (!browser) {
    return {
      tasks: [],
      statuses: defaultStatuses,
      activeTaskId: null,
      timerHistory: []
    };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      tasks: [],
      statuses: defaultStatuses,
      activeTaskId: null,
      timerHistory: []
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      tasks: parsed.tasks ?? [],
      statuses: parsed.statuses ?? defaultStatuses,
      activeTaskId: parsed.activeTaskId ?? null,
      timerHistory: parsed.timerHistory ?? []
    };
  } catch (error) {
    console.error('Failed to parse task data', error);
    return {
      tasks: [],
      statuses: defaultStatuses,
      activeTaskId: null,
      timerHistory: []
    };
  }
}

function saveData(data) {
  if (!browser) return;
  const payload = JSON.stringify({
    tasks: data.tasks,
    statuses: data.statuses,
    activeTaskId: data.activeTaskId,
    timerHistory: data.timerHistory
  });
  localStorage.setItem(STORAGE_KEY, payload);
}

function loadBackups() {
  if (!browser) return [];
  const raw = localStorage.getItem(BACKUP_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse backups', error);
    return [];
  }
}

function saveBackups(backups) {
  if (!browser) return;
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
}

const initialData = loadData();

const internalStore = writable(initialData);
internalStore.subscribe((value) => {
  saveData(value);
});

export const backups = writable(loadBackups());
backups.subscribe((value) => {
  saveBackups(value);
});

export const selectedTaskId = writable(null);
export const focusTaskId = writable(null);

function updateTasksData(updater) {
  internalStore.update((state) => {
    const next = {
      ...state,
      tasks: cloneTasks(state.tasks),
      timerHistory: [...state.timerHistory]
    };
    updater(next);
    return next;
  });
}

function stopRunningTask(nextState, taskId, timestamp) {
  if (!taskId) return;
  const path = findTaskPath(nextState.tasks, taskId);
  if (!path) return;
  const info = getParentAndIndex(nextState.tasks, [...path]);
  if (!info) return;
  const task = info.task;
  if (!task) return;
  task.timer.sessions = task.timer.sessions ?? [];
  const activeSession = task.timer.sessions.find((session) => !session.end);
  if (activeSession) {
    activeSession.end = timestamp;
  }
  task.timer.isRunning = false;
}

function startTaskTimer(nextState, taskId, timestamp) {
  const path = findTaskPath(nextState.tasks, taskId);
  if (!path) return;
  const info = getParentAndIndex(nextState.tasks, path);
  if (!info) return;
  const task = info.task;
  if (!task) return;
  task.timer.sessions = task.timer.sessions ?? [];
  if (!task.timer.sessions.find((session) => !session.end)) {
    task.timer.sessions.push({ start: timestamp, end: null });
  }
  task.timer.isRunning = true;
  nextState.activeTaskId = taskId;
  const existingIndex = nextState.timerHistory.findIndex((entry) => entry.taskId === taskId);
  if (existingIndex !== -1) {
    nextState.timerHistory.splice(existingIndex, 1);
  }
  nextState.timerHistory.unshift({ taskId, startedAt: timestamp });
  nextState.timerHistory = nextState.timerHistory.slice(0, 10);
}

function ensureTaskPath(nextState, taskId) {
  const path = findTaskPath(nextState.tasks, taskId);
  if (!path) return null;
  return path;
}

export const taskStore = {
  subscribe: internalStore.subscribe,
  addTaskAfter(taskId) {
    let newTaskId = null;
    updateTasksData((next) => {
      const newTask = createTask();
      if (!taskId) {
        next.tasks.push(newTask);
      } else {
        const path = ensureTaskPath(next, taskId);
        if (!path) {
          next.tasks.push(newTask);
        } else {
          insertTaskAfter(next.tasks, path, newTask);
        }
      }
      newTaskId = newTask.id;
      next.activeTaskId = next.activeTaskId;
    });
    if (newTaskId) {
      selectedTaskId.set(newTaskId);
      focusTaskId.set(newTaskId);
    }
    return newTaskId;
  },
  updateDescription(taskId, description) {
    updateTasksData((next) => {
      const path = ensureTaskPath(next, taskId);
      if (!path) return;
      const info = getParentAndIndex(next.tasks, path);
      if (!info) return;
      info.task.description = description;
    });
  },
  updateStatus(taskId, statusId) {
    updateTasksData((next) => {
      const path = ensureTaskPath(next, taskId);
      if (!path) return;
      const info = getParentAndIndex(next.tasks, path);
      if (!info) return;
      info.task.statusId = statusId;
    });
  },
  indentTask(taskId) {
    updateTasksData((next) => {
      const path = ensureTaskPath(next, taskId);
      if (!path) return;
      const info = getParentAndIndex(next.tasks, path);
      if (!info) return;
      if (info.index === 0) return; // no previous sibling
      const parentArray = info.parentArray;
      const [removed] = parentArray.splice(info.index, 1);
      if (!removed) return;
      const previousSibling = parentArray[info.index - 1];
      if (!previousSibling) return;
      previousSibling.children = Array.isArray(previousSibling.children) ? previousSibling.children : [];
      previousSibling.children.push(removed);
    });
  },
  unindentTask(taskId) {
    updateTasksData((next) => {
      const path = ensureTaskPath(next, taskId);
      if (!path || path.length === 1) return;
      const parentPath = path.slice(0, -1);
      const parentInfo = getParentAndIndex(next.tasks, parentPath);
      if (!parentInfo) return;
      const parentTask = parentInfo.task;
      if (!parentTask) return;
      parentTask.children = Array.isArray(parentTask.children) ? parentTask.children : [];
      const childIndex = path[path.length - 1];
      const [removed] = parentTask.children.splice(childIndex, 1);
      if (!removed) return;
      parentInfo.parentArray.splice(parentInfo.index + 1, 0, removed);
    });
  },
  removeTask(taskId) {
    updateTasksData((next) => {
      const path = ensureTaskPath(next, taskId);
      if (!path) return;
      removeTaskAtPath(next.tasks, path);
    });
  },
  moveTask(taskId, targetId, position) {
    if (!taskId || !targetId || taskId === targetId) return;
    updateTasksData((next) => {
      const sourcePath = ensureTaskPath(next, taskId);
      const targetPath = ensureTaskPath(next, targetId);
      if (!sourcePath || !targetPath) return;
      next.tasks = moveTask(next.tasks, sourcePath, targetPath, position);
    });
  },
  startTimer(taskId) {
    updateTasksData((next) => {
      const timestamp = Date.now();
      if (next.activeTaskId && next.activeTaskId !== taskId) {
        stopRunningTask(next, next.activeTaskId, timestamp);
      }
      const path = ensureTaskPath(next, taskId);
      if (!path) return;
      const info = getParentAndIndex(next.tasks, path);
      if (!info) return;
      const task = info.task;
      if (!task) return;
      if (task.timer.isRunning) return;
      task.timer.sessions = task.timer.sessions ?? [];
      task.timer.sessions.push({ start: timestamp, end: null });
      task.timer.isRunning = true;
      if (next.activeTaskId && next.activeTaskId !== taskId) {
        stopRunningTask(next, next.activeTaskId, timestamp);
      }
      next.activeTaskId = taskId;
      const existingIndex = next.timerHistory.findIndex((entry) => entry.taskId === taskId);
      if (existingIndex !== -1) {
        next.timerHistory.splice(existingIndex, 1);
      }
      next.timerHistory.unshift({ taskId, startedAt: timestamp });
      next.timerHistory = next.timerHistory.slice(0, 10);
    });
  },
  stopTimer(taskId) {
    updateTasksData((next) => {
      const timestamp = Date.now();
      const path = ensureTaskPath(next, taskId);
      if (!path) return;
      const info = getParentAndIndex(next.tasks, path);
      if (!info) return;
      const task = info.task;
      if (!task?.timer?.isRunning) return;
      stopRunningTask(next, taskId, timestamp);
      if (next.activeTaskId === taskId) {
        next.activeTaskId = null;
      }
    });
  },
  toggleTimer(taskId) {
    const state = get(internalStore);
    const path = findTaskPath(state.tasks, taskId);
    if (!path) return;
    const info = getParentAndIndex(state.tasks, path);
    const task = info?.task;
    if (!task) return;
    if (task.timer.isRunning) {
      this.stopTimer(taskId);
    } else {
      this.startTimer(taskId);
    }
  },
  clearAll() {
    internalStore.set({
      tasks: [],
      statuses: defaultStatuses,
      activeTaskId: null,
      timerHistory: []
    });
  }
};

export const dataHelpers = {
  getTaskById(taskId) {
    const state = get(internalStore);
    const path = findTaskPath(state.tasks, taskId);
    if (!path) return null;
    const info = getParentAndIndex(state.tasks, path);
    return info?.task ?? null;
  },
  getStatusById(statusId) {
    const state = get(internalStore);
    return state.statuses.find((status) => status.id === statusId) ?? state.statuses[0];
  },
  getStatuses() {
    const state = get(internalStore);
    return state.statuses;
  },
  getTotalTime(taskId) {
    const state = get(internalStore);
    const task = this.getTaskById(taskId);
    if (!task) return 0;
    return computeTotalTime(task.timer, Date.now());
  },
  getFormattedTotal(taskId) {
    return formatDuration(this.getTotalTime(taskId));
  }
};

export const timerHistory = {
  subscribe: (run) => internalStore.subscribe((value) => run(value.timerHistory))
};

export const activeTaskId = {
  subscribe: (run) => internalStore.subscribe((value) => run(value.activeTaskId))
};

export function createSnapshot() {
  const state = get(internalStore);
  const snapshot = {
    id: crypto.randomUUID?.() ?? `snapshot-${Date.now()}`,
    createdAt: Date.now(),
    data: {
      tasks: cloneTasks(state.tasks),
      statuses: state.statuses,
      timerHistory: [...state.timerHistory],
      activeTaskId: state.activeTaskId
    }
  };
  backups.update((list) => [snapshot, ...list].slice(0, 10));
  return snapshot;
}

export function restoreSnapshot(snapshotId) {
  const snapshot = get(backups).find((item) => item.id === snapshotId);
  if (!snapshot) return false;
  internalStore.set({
    tasks: cloneTasks(snapshot.data.tasks ?? []),
    statuses: snapshot.data.statuses ?? defaultStatuses,
    timerHistory: snapshot.data.timerHistory ?? [],
    activeTaskId: snapshot.data.activeTaskId ?? null
  });
  return true;
}

export function exportData() {
  const state = get(internalStore);
  return {
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
    statuses: state.statuses,
    timerHistory: state.timerHistory,
    activeTaskId: state.activeTaskId
  };
}

export function importData(payload) {
  if (!payload) return false;
  internalStore.set({
    tasks: cloneTasks(payload.tasks ?? []),
    statuses: payload.statuses ?? defaultStatuses,
    timerHistory: payload.timerHistory ?? [],
    activeTaskId: payload.activeTaskId ?? null
  });
  return true;
}
