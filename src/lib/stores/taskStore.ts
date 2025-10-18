import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import {
	addTask as addTaskToProject,
	addTaskAfter,
	applySnapshot,
	createInitialData,
	createProject,
	createSnapshot,
	flattenTasks,
	incrementTaskTime,
	locateTask,
	moveTask,
	indentTask as indentTaskInTree,
	outdentTask as outdentTaskInTree,
	removeTaskById,
	setTaskStatus,
	updateTaskById
} from '$lib/core/taskTree';
import {
	createDownloadUrl,
	deserializeData,
	parseImportedText,
	revokeDownloadUrl,
	serializeData,
	STORAGE_KEY
} from '$lib/core/persistence';
import type { Task, TaskData, TaskSession } from '$lib/core/taskTypes';

const isoNow = () => new Date().toISOString();

const generateSessionId = () => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `sess-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeSession = (session: TaskSession | undefined, fallbackTimestamp: string): TaskSession => {
	if (!session) {
		return {
			id: generateSessionId(),
			startedAt: fallbackTimestamp,
			endedAt: fallbackTimestamp,
			durationMs: 0
		};
	}

	return {
		id: session.id ?? generateSessionId(),
		startedAt: typeof session.startedAt === 'string' ? session.startedAt : fallbackTimestamp,
		endedAt: typeof session.endedAt === 'string' ? session.endedAt : undefined,
		durationMs: typeof session.durationMs === 'number' && Number.isFinite(session.durationMs)
			? Math.max(0, session.durationMs)
			: 0
	};
};

const normalizeTaskSessions = (task: Task): { sessions: TaskSession[]; totalFromSessions: number; total: number } => {
	const fallbackTimestamp = task.lastStartedAt ?? task.updatedAt ?? task.createdAt ?? isoNow();
	const rawSessions = Array.isArray((task as Task & { sessions?: TaskSession[] }).sessions)
		? ((task as Task & { sessions?: TaskSession[] }).sessions as TaskSession[])
		: [];

	const sessions = rawSessions.map((session) => normalizeSession(session, fallbackTimestamp));
	let totalFromSessions = sessions.reduce((sum, current) => sum + current.durationMs, 0);

	const total =
		typeof task.timeSpentMs === 'number' && Number.isFinite(task.timeSpentMs) ? Math.max(0, task.timeSpentMs) : 0;

	if (sessions.length === 0 && total > 0) {
		const fallbackSession = normalizeSession(
			{
				id: generateSessionId(),
				startedAt: fallbackTimestamp,
				endedAt: fallbackTimestamp,
				durationMs: total
			},
			fallbackTimestamp
		);

		return {
			sessions: [fallbackSession],
			totalFromSessions: fallbackSession.durationMs,
			total
		};
	}

	return { sessions, totalFromSessions, total };
};

const normalizeTask = (task: Task): Task => {
	const children = Array.isArray(task.children) ? task.children.map((child) => normalizeTask(child)) : [];
	const { sessions, totalFromSessions, total } = normalizeTaskSessions(task);

	return {
		...task,
		children,
		sessions,
		timeSpentMs: Math.max(total, totalFromSessions)
	};
};

const normalizeProjects = (projects: TaskData['projects']): TaskData['projects'] =>
	projects.map((project) => ({
		...project,
		tasks: Array.isArray(project.tasks) ? project.tasks.map((task) => normalizeTask(task)) : []
	}));

interface TaskStoreState {
	data: TaskData;
	previewTaskId: string | null;
	timerStartedAt: number | null;
	lastTickAt: number | null;
	exportUrl: string | null;
	focusedEditorTaskId: string | null;
}

const sanitizeData = (data: TaskData): TaskData => {
	const projects = normalizeProjects(data.projects ?? []);
	const activeProjectId =
		data.activeProjectId && projects.some((project) => project.id === data.activeProjectId)
			? data.activeProjectId
			: projects[0]?.id ?? null;

	const flattened = flattenTasks(projects);
	const hasTask = (taskId: string | null | undefined) =>
		Boolean(taskId && flattened.some((item) => item.task.id === taskId));

	const limitedRecent = (data.recentTaskIds ?? [])
		.filter((id, index, array) => array.indexOf(id) === index)
		.filter((id) => hasTask(id))
		.slice(0, 5);

	const activeTaskId = hasTask(data.activeTaskId) ? data.activeTaskId : null;

	return {
		...data,
		projects,
		activeProjectId,
		activeTaskId,
		recentTaskIds: limitedRecent,
		snapshots: data.snapshots ?? [],
		lastSavedAt: data.lastSavedAt ?? isoNow()
	};
};

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

const initialState: TaskStoreState = {
	data: loadInitialData(),
	previewTaskId: null,
	timerStartedAt: null,
	lastTickAt: null,
	exportUrl: null,
	focusedEditorTaskId: null
};

const store = writable<TaskStoreState>(initialState);

let tickHandle: ReturnType<typeof window.setInterval> | null = null;

const stopTicking = () => {
	if (tickHandle) {
		window.clearInterval(tickHandle);
		tickHandle = null;
	}
};

const beginTicking = () => {
	if (!browser) {
		return;
	}

	stopTicking();

	tickHandle = window.setInterval(() => {
		store.update((state) => {
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
		});
	}, 1000);
};

const withDataUpdate = (updater: (data: TaskData) => TaskData) => {
	store.update((state) => {
		const nextData = updater(state.data);
		if (nextData === state.data) {
			return state;
		}

		const touched = touchData(nextData);
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

			return { ...data, activeProjectId: projectId };
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

			const nextData = touchData({
				...state.data,
				projects,
				activeProjectId,
				activeTaskId
			});

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

			const nextData = touchData({
				...state.data,
				projects
			});

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
			const nextData = touchData({
				...state.data,
				projects,
				activeTaskId: wasActive ? null : state.data.activeTaskId,
				recentTaskIds: state.data.recentTaskIds.filter((id) => id !== taskId)
			});

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

			const nextData: TaskData = {
				...state.data,
				projects,
				activeTaskId: taskId,
				recentTaskIds
			};

			const finalData = changed || activeTaskId !== taskId ? touchData(nextData) : nextData;

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
			const nextData = touchData({
				...state.data,
				projects,
				activeTaskId: null
			});

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

			const nextData = touchData({
				...state.data,
				projects,
				activeTaskId
			});

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

			const nextData = touchData({
				...state.data,
				projects,
				activeTaskId
			});

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
				activeTaskId: null
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
			revokeDownloadUrl(state.exportUrl);
		}

	if (!browser) {
		return null;
	}

	const exportPayload: TaskData = { ...state.data, snapshots: [] };
	const url = createDownloadUrl(exportPayload);
	store.update((current) => ({ ...current, exportUrl: url }));
	return url;
},

	clearExportUrl() {
		const state = get(store);
		if (state.exportUrl) {
			revokeDownloadUrl(state.exportUrl);
		}

		store.update((current) => ({ ...current, exportUrl: null }));
	},

	async importFile(file: File) {
		const text = await file.text();
		this.importData(parseImportedText(text));
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

export const activeProject = derived(taskStore, ($state) => {
	const activeId = $state.data.activeProjectId;
	return $state.data.projects.find((project) => project.id === activeId) ?? $state.data.projects[0] ?? null;
});

export const activeTask = derived(taskStore, ($state) => {
	if (!$state.data.activeTaskId) {
		return null;
	}

	const located = locateTask($state.data.projects, $state.data.activeTaskId);
	return located?.task ?? null;
});

export const previewTask = derived(taskStore, ($state) => {
	if (!$state.previewTaskId) {
		return null;
	}

	const located = locateTask($state.data.projects, $state.previewTaskId);
	return located ?? null;
});

export const flattenedTasks = derived(taskStore, ($state) => flattenTasks($state.data.projects));

export const taskById = (taskId: string) =>
	derived(taskStore, ($state) => locateTask($state.data.projects, taskId)?.task ?? null);

export const isTimerRunning = derived(taskStore, ($state) => Boolean($state.data.activeTaskId && $state.timerStartedAt));

export const recentTasks = derived(taskStore, ($state) => {
	const map = new Map<string, Task>();
	flattenTasks($state.data.projects).forEach(({ task }) => {
		map.set(task.id, task);
	});

	return $state.data.recentTaskIds.map((id) => map.get(id)).filter((task): task is Task => Boolean(task));
});
