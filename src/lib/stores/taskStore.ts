import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import {
	addTask as addTaskToProject,
	addTaskAfter,
	applySnapshot,
	createInitialData,
	createProject,
	createSnapshot,
	incrementTaskTime,
	locateTask,
	moveTask,
	deleteTaskSession as deleteTaskSessionInTree,
	indentTask as indentTaskInTree,
	outdentTask as outdentTaskInTree,
	removeTaskById,
	setTaskStatus,
	updateTaskById,
	updateTaskSession as updateTaskSessionInTree
} from '$lib/core/taskTree';
import { deserializeData, serializeData, STORAGE_KEY } from '$lib/core/persistence';
import type { TaskData, TaskSession, TaskStatus } from '$lib/core/taskTypes';
import {
	orderStatuses,
	statusesEqual,
	cloneDefaultStatusSelection,
	ALL_STATUS_VALUES,
	isKnownStatus
} from '$lib/core/taskFilters';
import { isoNow, sanitizeData, normalizeSessionTimestamp } from '$lib/core/normalization';
import { createTaskDataExport, parseTaskDataFile, revokeTaskDataExport } from '$lib/core/exporter';
import { measureAndRecord } from './tickInstrumentation';

export { ALL_STATUS_VALUES } from '$lib/core/taskFilters';

export type SessionMutationFailureReason =
	| 'task-active'
	| 'task-missing'
	| 'session-missing'
	| 'invalid-start'
	| 'invalid-end'
	| 'invalid-range'
	| 'invalid-duration'
	| 'no-change';

export type SessionMutationResult = { ok: true } | { ok: false; reason: SessionMutationFailureReason };

interface SessionEditPayload {
	startedAt?: string;
	endedAt?: string | null;
	durationMs?: number;
}

interface TaskStoreState {
	data: TaskData;
	previewTaskId: string | null;
	timerStartedAt: number | null;
	lastTickAt: number | null;
	exportUrl: string | null;
	focusedEditorTaskId: string | null;
}

const loadInitialData = (): TaskData => {
	const fallback = createInitialData();
	if (!browser) {
		return fallback;
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return fallback;
		}

		const parsed = deserializeData(stored);
		return sanitizeData({ ...fallback, ...parsed });
	} catch (error) {
		console.warn('Failed to parse stored task data, resetting to defaults', error);
		return fallback;
	}
};

const persist = (data: TaskData) => {
	if (!browser) {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, serializeData(data));
	} catch (error) {
		console.error('Failed to persist task data', error);
	}
};

const touchData = (data: TaskData): TaskData => {
	const next = { ...data, lastSavedAt: isoNow() };
	persist(next);
	return next;
};

const ensureValidSelectedTask = (data: TaskData): TaskData => {
	const selectedId = data.selectedTaskId ?? null;
	if (!selectedId) {
		return selectedId === null ? data : { ...data, selectedTaskId: null };
	}

	const located = locateTask(data.projects, selectedId);
	if (located) {
		return data;
	}

	return { ...data, selectedTaskId: null };
};

const initialState: TaskStoreState = {
	data: loadInitialData(),
	previewTaskId: null,
	timerStartedAt: null,
	lastTickAt: null,
	exportUrl: null,
	focusedEditorTaskId: null
};

const store = writable<TaskStoreState>(initialState);

// Timer lifecycle contract: only a single `tickHandle` may run at any time, and consumers must call
// `stopTicking` whenever the active task switches, completes, or the store resets to avoid leaking intervals.
let tickHandle: number | null = null;
const stopTicking = () => {
	if (tickHandle) {
		window.clearInterval(tickHandle);
		tickHandle = null;
	}
};

// `beginTicking` attaches a 1s interval that pipes into `incrementTaskTime`. It always clears any prior
// handle first so repeated calls remain idempotent. Consumers should invoke this after transitioning a task
// into the `in-progress` state.
const beginTicking = () => {
	if (!browser) {
		return;
	}

	stopTicking();

	tickHandle = window.setInterval(() => {
		measureAndRecord(() => store.update((state) => {
			const activeId = state.data.activeTaskId;
			if (!activeId || state.timerStartedAt === null) {
				return state;
			}

			const nowMs = Date.now();
			const delta = state.lastTickAt ? nowMs - state.lastTickAt : 0;
			if (delta <= 0) {
				return { ...state, lastTickAt: nowMs };
			}

			const { projects, changed } = incrementTaskTime(state.data.projects, activeId, delta);
			if (!changed) {
				return { ...state, lastTickAt: nowMs };
			}

			const nextData = touchData({
				...state.data,
				projects
			});

			return { ...state, data: nextData, lastTickAt: nowMs };
		}));
	}, 1000);
};

const withDataUpdate = (updater: (data: TaskData) => TaskData) => {
	store.update((state) => {
		const nextData = updater(state.data);
		if (nextData === state.data) {
			return state;
		}

		const validated = ensureValidSelectedTask(nextData);
		const touched = touchData(validated);
		return { ...state, data: touched };
	});
};

export const taskStore = {
	subscribe: store.subscribe,

	setActiveProject(projectId: string) {
		withDataUpdate((data) => {
			if (data.activeProjectId === projectId) {
				return data;
			}

			if (!data.projects.some((project) => project.id === projectId)) {
				return data;
			}

			const locatedSelection = data.selectedTaskId ? locateTask(data.projects, data.selectedTaskId) : null;
			const selectedTaskId =
				locatedSelection && locatedSelection.project.id === projectId ? locatedSelection.task.id : null;

			return { ...data, activeProjectId: projectId, selectedTaskId };
		});
	},

	addProject(title: string) {
		withDataUpdate((data) => {
			const newProject = createProject(title.trim() || 'Untitled project');

			return {
				...data,
				projects: [...data.projects, newProject],
				activeProjectId: newProject.id
			};
		});
	},

	renameProject(projectId: string, title: string) {
		withDataUpdate((data) => {
			const projects = data.projects.map((project) =>
				project.id === projectId ? { ...project, title: title.trim() || project.title, updatedAt: isoNow() } : project
			);

			return { ...data, projects };
		});
	},

	deleteProject(projectId: string) {
		let clearedTimer = false;
		store.update((state) => {
			if (state.data.projects.length <= 1) {
				return state;
			}

			const projects = state.data.projects.filter((project) => project.id !== projectId);
			const activeProjectId =
				state.data.activeProjectId === projectId ? projects[0]?.id ?? null : state.data.activeProjectId;

			const activeTaskStillPresent =
				state.data.activeTaskId && locateTask(projects, state.data.activeTaskId) ? state.data.activeTaskId : null;

			const activeTaskId = activeTaskStillPresent ?? null;
			clearedTimer = Boolean(state.data.activeTaskId && !activeTaskStillPresent);

			const selectedTaskId =
				state.data.selectedTaskId && locateTask(projects, state.data.selectedTaskId)
					? state.data.selectedTaskId
					: null;

			const nextData = touchData(
				ensureValidSelectedTask({
					...state.data,
					projects,
					activeProjectId,
					activeTaskId,
					selectedTaskId
				})
			);

			return {
				...state,
				data: nextData,
				timerStartedAt: clearedTimer ? null : state.timerStartedAt,
				lastTickAt: clearedTimer ? null : state.lastTickAt
			};
		});

		if (clearedTimer) {
			stopTicking();
		}
	},

	addTask(title: string, parentTaskId: string | null = null) {
		const state = get(store);
		const projectId = state.data.activeProjectId;
		if (!projectId) {
			return;
		}

		withDataUpdate((data) => ({
			...data,
			projects: addTaskToProject(data.projects, projectId, title.trim() || 'Untitled task', parentTaskId)
		}));
	},

	createSiblingTaskAfter(taskId: string) {
		let createdTaskId: string | null = null;

		store.update((state) => {
			const { projects, task, changed } = addTaskAfter(state.data.projects, taskId, '');
			if (!changed || !task) {
				return state;
			}

			createdTaskId = task.id;

			const nextData = touchData(
				ensureValidSelectedTask({
					...state.data,
					projects
				})
			);

			return { ...state, data: nextData };
		});

		return createdTaskId;
	},

	deleteTask(taskId: string) {
		let clearedTimer = false;
		let removed = false;

		store.update((state) => {
			const { projects, changed } = removeTaskById(state.data.projects, taskId);
			if (!changed) {
				return state;
			}

			removed = true;
			const wasActive = state.data.activeTaskId === taskId;
			const baseData: TaskData = {
				...state.data,
				projects,
				activeTaskId: wasActive ? null : state.data.activeTaskId,
				selectedTaskId: state.data.selectedTaskId === taskId ? null : state.data.selectedTaskId,
				recentTaskIds: state.data.recentTaskIds.filter((id) => id !== taskId)
			};
			const nextData = touchData(ensureValidSelectedTask(baseData));

			clearedTimer = wasActive;

			return {
				...state,
				data: nextData,
				previewTaskId: state.previewTaskId === taskId ? null : state.previewTaskId,
				timerStartedAt: wasActive ? null : state.timerStartedAt,
				lastTickAt: wasActive ? null : state.lastTickAt,
				focusedEditorTaskId: state.focusedEditorTaskId === taskId ? null : state.focusedEditorTaskId
			};
		});

		if (clearedTimer) {
			stopTicking();
		}

		return removed;
	},

	updateTaskTitle(taskId: string, title: string) {
		withDataUpdate((data) => {
			const { projects, changed } = updateTaskById(data.projects, taskId, (task) => ({
				...task,
				title: title.trim() || task.title
			}));

			if (!changed) {
				return data;
			}

			return { ...data, projects };
		});
	},

	updateTaskDescription(taskId: string, description: string) {
		withDataUpdate((data) => {
			const nextDescription = description.trim().length > 0 ? description : undefined;
			const { projects, changed } = updateTaskById(data.projects, taskId, (task) => ({
				...task,
				description: nextDescription
			}));

			if (!changed) {
				return data;
			}

			return { ...data, projects };
		});
	},

	updateSession(taskId: string, sessionId: string, updates: SessionEditPayload): SessionMutationResult {
		let outcome: SessionMutationResult = { ok: false, reason: 'no-change' };

		withDataUpdate((data) => {
			if (data.activeTaskId === taskId) {
				outcome = { ok: false, reason: 'task-active' };
				return data;
			}

			const located = locateTask(data.projects, taskId);
			if (!located) {
				outcome = { ok: false, reason: 'task-missing' };
				return data;
			}

			const targetSession = located.task.sessions.find((session) => session.id === sessionId);
			if (!targetSession) {
				outcome = { ok: false, reason: 'session-missing' };
				return data;
			}

			const startIso = normalizeSessionTimestamp(updates.startedAt ?? targetSession.startedAt);
			if (!startIso) {
				outcome = { ok: false, reason: 'invalid-start' };
				return data;
			}

			const endedAtSource = Object.prototype.hasOwnProperty.call(updates, 'endedAt')
				? updates.endedAt
				: targetSession.endedAt;
			const endIso = normalizeSessionTimestamp(endedAtSource ?? undefined);
			if (endedAtSource && !endIso) {
				outcome = { ok: false, reason: 'invalid-end' };
				return data;
			}

			const startMs = Date.parse(startIso);
			let durationMs = targetSession.durationMs;

			if (endIso) {
				const endMs = Date.parse(endIso);
				if (Number.isNaN(endMs) || endMs < startMs) {
					outcome = { ok: false, reason: 'invalid-range' };
					return data;
				}
				durationMs = endMs - startMs;
			} else if (typeof updates.durationMs === 'number') {
				if (!Number.isFinite(updates.durationMs) || updates.durationMs < 0) {
					outcome = { ok: false, reason: 'invalid-duration' };
					return data;
				}
				durationMs = updates.durationMs;
			}

			const sessionPayload: TaskSession = {
				...targetSession,
				startedAt: startIso,
				endedAt: endIso ?? undefined,
				durationMs: Math.max(0, Math.round(durationMs))
			};

			const { projects, changed } = updateTaskSessionInTree(data.projects, taskId, sessionId, sessionPayload);
			if (!changed) {
				outcome = { ok: false, reason: 'no-change' };
				return data;
			}

			outcome = { ok: true };
			return { ...data, projects };
		});

		return outcome;
	},

	deleteSession(taskId: string, sessionId: string): SessionMutationResult {
		let outcome: SessionMutationResult = { ok: false, reason: 'no-change' };

		withDataUpdate((data) => {
			if (data.activeTaskId === taskId) {
				outcome = { ok: false, reason: 'task-active' };
				return data;
			}

			const located = locateTask(data.projects, taskId);
			if (!located) {
				outcome = { ok: false, reason: 'task-missing' };
				return data;
			}

			const hasSession = located.task.sessions.some((session) => session.id === sessionId);
			if (!hasSession) {
				outcome = { ok: false, reason: 'session-missing' };
				return data;
			}

			const { projects, changed } = deleteTaskSessionInTree(data.projects, taskId, sessionId);
			if (!changed) {
				outcome = { ok: false, reason: 'no-change' };
				return data;
			}

			outcome = { ok: true };
			return { ...data, projects };
		});

		return outcome;
	},

	startTask(taskId: string) {
		const currentState = get(store);
		if (currentState.data.activeTaskId === taskId && currentState.timerStartedAt !== null) {
			this.pauseActiveTask();
			return;
		}

		let shouldStartTimer = false;

		store.update((state) => {
			let projects = state.data.projects;
			let changed = false;
			const { activeTaskId } = state.data;

			if (activeTaskId && activeTaskId !== taskId) {
				const result = setTaskStatus(projects, activeTaskId, 'paused');
				if (result.changed) {
					projects = result.projects;
					changed = true;
				}
			}

			const statusResult = setTaskStatus(projects, taskId, 'in-progress');
			if (statusResult.changed) {
				projects = statusResult.projects;
				changed = true;
			}

			const recentTaskIds = [taskId, ...state.data.recentTaskIds.filter((id) => id !== taskId)].slice(0, 5);
			const selectionChanged = state.data.selectedTaskId !== taskId;

			const nextData: TaskData = {
				...state.data,
				projects,
				activeTaskId: taskId,
				selectedTaskId: taskId,
				recentTaskIds
			};

			const preparedData = ensureValidSelectedTask(nextData);
			const shouldPersist = changed || activeTaskId !== taskId || selectionChanged;
			const finalData = shouldPersist ? touchData(preparedData) : preparedData;

			shouldStartTimer = true;

			return {
				...state,
				data: finalData,
				timerStartedAt: Date.now(),
				lastTickAt: Date.now()
			};
		});

		if (shouldStartTimer) {
			beginTicking();
		}
	},

	pauseActiveTask() {
		let shouldStop = false;
		store.update((state) => {
			const activeId = state.data.activeTaskId;
			if (!activeId) {
				return state;
			}

			const { projects, changed } = setTaskStatus(state.data.projects, activeId, 'paused');
			const nextData = touchData(
				ensureValidSelectedTask({
					...state.data,
					projects,
					activeTaskId: null
				})
			);

			shouldStop = true;

			return {
				...state,
				data: nextData,
				timerStartedAt: null,
				lastTickAt: null
			};
		});

		if (shouldStop) {
			stopTicking();
		}
	},

	completeTask(taskId: string) {
		let clearedTimer = false;
		store.update((state) => {
			const { projects, changed } = setTaskStatus(state.data.projects, taskId, 'completed');
			if (!changed) {
				return state;
			}

			const activeTaskId = state.data.activeTaskId === taskId ? null : state.data.activeTaskId;
			if (state.data.activeTaskId === taskId) {
				clearedTimer = true;
			}

			const baseData: TaskData = {
				...state.data,
				projects,
				activeTaskId,
				selectedTaskId: state.data.selectedTaskId === taskId ? null : state.data.selectedTaskId
			};
			const nextData = touchData(ensureValidSelectedTask(baseData));

			return {
				...state,
				data: nextData,
				timerStartedAt: clearedTimer ? null : state.timerStartedAt,
				lastTickAt: clearedTimer ? null : state.lastTickAt
			};
		});

		if (clearedTimer) {
			stopTicking();
		}
	},

	archiveTask(taskId: string) {
		let clearedTimer = false;
		store.update((state) => {
			const { projects, changed } = setTaskStatus(state.data.projects, taskId, 'archived');
			if (!changed) {
				return state;
			}

			const activeTaskId = state.data.activeTaskId === taskId ? null : state.data.activeTaskId;
			if (state.data.activeTaskId === taskId) {
				clearedTimer = true;
			}

			const baseData: TaskData = {
				...state.data,
				projects,
				activeTaskId,
				selectedTaskId: state.data.selectedTaskId === taskId ? null : state.data.selectedTaskId
			};
			const nextData = touchData(ensureValidSelectedTask(baseData));

			return {
				...state,
				data: nextData,
				timerStartedAt: clearedTimer ? null : state.timerStartedAt,
				lastTickAt: clearedTimer ? null : state.lastTickAt
			};
		});

		if (clearedTimer) {
			stopTicking();
		}
	},

	moveTaskUp(taskId: string) {
		withDataUpdate((data) => {
			const result = moveTask(data.projects, taskId, -1);
			if (!result.changed) {
				return data;
			}

			return { ...data, projects: result.projects };
		});
	},

	moveTaskDown(taskId: string) {
		withDataUpdate((data) => {
			const result = moveTask(data.projects, taskId, 1);
			if (!result.changed) {
				return data;
			}

			return { ...data, projects: result.projects };
		});
	},

	indentTask(taskId: string): boolean {
		let moved = false;
		withDataUpdate((data) => {
			const result = indentTaskInTree(data.projects, taskId);
			if (!result.changed) {
				return data;
			}

			moved = true;
			return { ...data, projects: result.projects };
		});
		return moved;
	},

	outdentTask(taskId: string): boolean {
		let moved = false;
		withDataUpdate((data) => {
			const result = outdentTaskInTree(data.projects, taskId);
			if (!result.changed) {
				return data;
			}

			moved = true;
			return { ...data, projects: result.projects };
		});
		return moved;
	},

	focusTaskEditor(taskId: string) {
		store.update((state) => ({ ...state, focusedEditorTaskId: taskId }));
	},

	clearFocusedEditor(taskId?: string) {
		store.update((state) => {
			if (taskId && state.focusedEditorTaskId !== taskId) {
				return state;
			}
			if (!state.focusedEditorTaskId) {
				return state;
			}
			return { ...state, focusedEditorTaskId: null };
		});
	},

	setStatusFilters(statuses: TaskStatus[]) {
		withDataUpdate((data) => {
			const ordered = orderStatuses(statuses);
			if (statusesEqual(ordered, data.filters.statuses)) {
				return data;
			}

			return {
				...data,
				filters: {
					...data.filters,
					statuses: ordered
				}
			};
		});
	},

	toggleStatusFilter(status: TaskStatus) {
		if (!isKnownStatus(status)) {
			return;
		}

		withDataUpdate((data) => {
			const current = new Set(data.filters.statuses);
			if (current.has(status)) {
				current.delete(status);
			} else {
				current.add(status);
			}

			const nextStatuses = orderStatuses(current);
			if (statusesEqual(nextStatuses, data.filters.statuses)) {
				return data;
			}

			return {
				...data,
				filters: {
					...data.filters,
					statuses: nextStatuses
				}
			};
		});
	},

	selectAllStatuses() {
		this.setStatusFilters(Array.from(ALL_STATUS_VALUES));
	},

	clearStatusFilters() {
		this.setStatusFilters([]);
	},

	resetStatusFilters() {
		this.setStatusFilters(cloneDefaultStatusSelection());
	},

	selectTask(taskId: string | null) {
		store.update((state) => {
			const requestedId = taskId ?? null;
			const nextSelected = requestedId && locateTask(state.data.projects, requestedId) ? requestedId : null;

			if (nextSelected === state.data.selectedTaskId) {
				return state;
			}

			const baseData: TaskData = {
				...state.data,
				selectedTaskId: nextSelected
			};
			const nextData = touchData(ensureValidSelectedTask(baseData));

			return { ...state, data: nextData };
		});
	},

	selectPreview(taskId: string | null) {
		store.update((state) => ({ ...state, previewTaskId: taskId }));
	},

	saveSnapshot(name?: string) {
		withDataUpdate((data) => {
			const snapshot = createSnapshot(data.projects, name);
			return { ...data, snapshots: [snapshot, ...data.snapshots].slice(0, 20) };
		});
	},

	restoreSnapshot(snapshotId: string) {
		withDataUpdate((data) => {
			const snapshot = data.snapshots.find((item) => item.id === snapshotId);
			if (!snapshot) {
				return data;
			}

			const projects = applySnapshot(snapshot);

			const activeProjectId =
				data.activeProjectId && projects.some((project) => project.id === data.activeProjectId)
					? data.activeProjectId
					: projects[0]?.id ?? null;

			return {
				...data,
				projects,
				activeProjectId,
				activeTaskId: null,
				selectedTaskId: null
			};
		});

		stopTicking();
		store.update((state) => ({ ...state, timerStartedAt: null, lastTickAt: null }));
	},

	deleteSnapshot(snapshotId: string) {
		withDataUpdate((data) => ({
			...data,
			snapshots: data.snapshots.filter((snapshot) => snapshot.id !== snapshotId)
		}));
	},

	exportData(): string | null {
		const state = get(store);
		if (state.exportUrl) {
			revokeTaskDataExport(state.exportUrl);
		}

		const url = createTaskDataExport(state.data);
		if (!url) {
			return null;
		}

		store.update((current) => ({ ...current, exportUrl: url }));
		return url;
	},

	clearExportUrl() {
		const state = get(store);
		if (state.exportUrl) {
			revokeTaskDataExport(state.exportUrl);
		}

		store.update((current) => ({ ...current, exportUrl: null }));
	},

	async importFile(file: File) {
		const data = await parseTaskDataFile(file);
		this.importData(data);
	},

	importData(data: TaskData) {
		withDataUpdate(() => sanitizeData(data));
		stopTicking();
		store.update((state) => ({ ...state, timerStartedAt: null, lastTickAt: null }));
	},

	reset() {
		const initial = createInitialData();
		store.set({
			data: touchData(initial),
			previewTaskId: null,
			timerStartedAt: null,
			lastTickAt: null,
			exportUrl: null,
			focusedEditorTaskId: null
		});
		stopTicking();
	}
};
