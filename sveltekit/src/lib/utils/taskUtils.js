export function createTask(overrides = {}) {
  const baseChildren = Array.isArray(overrides.children) ? overrides.children : [];
  const baseTimer = overrides.timer ?? { sessions: [], isRunning: false };
  return {
    id: overrides.id ?? crypto.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: overrides.description ?? '',
    statusId: overrides.statusId ?? 'inbox',
    children: baseChildren.map((child) => cloneTask(child)),
    timer: {
      sessions: Array.isArray(baseTimer.sessions) ? baseTimer.sessions.map((s) => ({ ...s })) : [],
      isRunning: baseTimer.isRunning ?? false
    }
  };
}

export function cloneTask(task) {
  const children = Array.isArray(task.children) ? task.children : [];
  const timer = task.timer ?? { sessions: [], isRunning: false };
  return {
    id: task.id,
    description: task.description,
    statusId: task.statusId,
    children: children.map((child) => cloneTask(child)),
    timer: {
      sessions: Array.isArray(timer.sessions) ? timer.sessions.map((session) => ({ ...session })) : [],
      isRunning: timer.isRunning ?? false
    }
  };
}

export function cloneTasks(tasks) {
  return tasks.map((task) => cloneTask(task));
}

export function findTaskPath(tasks, id, path = []) {
  for (let i = 0; i < tasks.length; i += 1) {
    const task = tasks[i];
    const currentPath = [...path, i];
    if (task.id === id) {
      return currentPath;
    }
    const childPath = findTaskPath(task.children, id, currentPath);
    if (childPath) {
      return childPath;
    }
  }
  return null;
}

export function getArrayAtPath(tasks, path) {
  if (path.length === 0) return tasks;
  let cursor = tasks;
  for (let i = 0; i < path.length; i += 1) {
    const index = path[i];
    if (!cursor[index]) return null;
    if (i === path.length - 1) {
      return cursor[index].children;
    }
    cursor = cursor[index].children;
  }
  return null;
}

export function getParentAndIndex(tasks, path) {
  if (path.length === 0) return null;
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  const parentArray = parentPath.length === 0 ? tasks : getArrayAtPath(tasks, parentPath);
  if (!parentArray) return null;
  return {
    parentArray,
    index,
    task: parentArray[index]
  };
}

export function removeTaskAtPath(tasks, path) {
  const info = getParentAndIndex(tasks, path);
  if (!info) return null;
  const [removed] = info.parentArray.splice(info.index, 1);
  return removed ?? null;
}

export function insertTaskAtPath(tasks, path, task) {
  const parentArray = path.length === 0 ? tasks : getArrayAtPath(tasks, path.slice(0, -1));
  const index = path.length === 0 ? tasks.length : path[path.length - 1];
  if (!parentArray) return false;
  parentArray.splice(index, 0, task);
  return true;
}

export function insertTaskAfter(tasks, referencePath, task) {
  const info = getParentAndIndex(tasks, referencePath);
  if (!info) {
    tasks.push(task);
    return true;
  }
  info.parentArray.splice(info.index + 1, 0, task);
  return true;
}

export function moveTask(tasks, sourcePath, targetPath, position = 'after') {
  if (!sourcePath || !targetPath) return tasks;
  const sourceClone = cloneTasks(tasks);
  const removed = removeTaskAtPath(sourceClone, sourcePath);
  if (!removed) return tasks;
  let adjustedTargetPath = targetPath.slice();

  if (position === 'after') {
    // When removing task that was before target in same parent, adjust index
    if (sameParent(sourcePath, targetPath) && sourcePath[sourcePath.length - 1] < targetPath[targetPath.length - 1]) {
      adjustedTargetPath[adjustedTargetPath.length - 1] -= 1;
    }
    const info = getParentAndIndex(sourceClone, adjustedTargetPath);
    if (!info) {
      sourceClone.push(removed);
      return sourceClone;
    }
    info.parentArray.splice(info.index + 1, 0, removed);
  } else if (position === 'before') {
    if (sameParent(sourcePath, targetPath) && sourcePath[sourcePath.length - 1] < targetPath[targetPath.length - 1]) {
      adjustedTargetPath[adjustedTargetPath.length - 1] -= 1;
    }
    const info = getParentAndIndex(sourceClone, adjustedTargetPath);
    if (!info) {
      sourceClone.unshift(removed);
      return sourceClone;
    }
    info.parentArray.splice(info.index, 0, removed);
  } else if (position === 'inside') {
    const info = getParentAndIndex(sourceClone, adjustedTargetPath);
    const target = info ? info.task : null;
    if (target) {
      target.children = target.children ?? [];
      target.children.push(removed);
    } else {
      sourceClone.push(removed);
    }
  }

  return sourceClone;
}

function sameParent(pathA, pathB) {
  if (!pathA || !pathB) return false;
  if (pathA.length !== pathB.length) return false;
  for (let i = 0; i < pathA.length - 1; i += 1) {
    if (pathA[i] !== pathB[i]) return false;
  }
  return true;
}

export function computeTotalTime(timer, now = Date.now()) {
  if (!timer) return 0;
  let total = 0;
  for (const session of timer.sessions) {
    if (session.end) {
      total += session.end - session.start;
    } else {
      total += Math.max(0, now - session.start);
    }
  }
  return total;
}

export function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0'));
  return parts.join(':');
}

export function firstMarkdownLine(markdown) {
  const firstLine = markdown.split('\n')[0] ?? '';
  return renderMarkdownInline(firstLine);
}

export function renderMarkdownInline(text) {
  if (!text) return '';
  let rendered = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  rendered = rendered.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return rendered;
}

export function renderMarkdownBlock(text) {
  if (!text) return '';
  return text
    .split(/\n+/)
    .map((line) => renderMarkdownInline(line))
    .join('<br/>');
}
