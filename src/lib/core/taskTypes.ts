/**
 * Lifecycle states a task can move through as it is worked on or archived.
 */
export type TaskStatus =
  | "idle"
  | "in-progress"
  | "paused"
  | "completed"
  | "archived";

/**
 * Represents a contiguous period of active work tracked for a task.
 */
export interface TaskSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  durationMs: number;
}

/**
 * Canonical shape for hierarchical task data persisted in projects.
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  timeSpentMs: number;
  sessions: TaskSession[];
  children: Task[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  lastStartedAt?: string;
}

/**
 * Top-level container for a task tree. Projects own their task hierarchy.
 */
export interface Project {
  id: string;
  title: string;
  description?: string;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Named snapshot of all projects/tasks used for backups or reports.
 */
export interface TaskSnapshot {
  id: string;
  name: string;
  createdAt: string;
  data: Project[];
}

/**
 * Filters used to narrow which tasks are shown in the UI.
 */
export interface TaskFilters {
  statuses: TaskStatus[];
}

/**
 * Full persisted application state mirrored to LocalStorage.
 */
export interface TaskData {
  projects: Project[];
  activeProjectId: string | null;
  activeTaskId: string | null;
  selectedTaskId: string | null;
  recentTaskIds: string[];
  collapsedTaskIds: string[];
  snapshots: TaskSnapshot[];
  lastSavedAt?: string;
  filters: TaskFilters;
}
