import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import {
	addTask as addTaskToProject,
	applySnapshot,
	createInitialData,
	createProject,
	createSnapshot,
	flattenTasks,
	incrementTaskTime,
	locateTask,
	moveTask,
	setTaskStatus,
	updateTaskById
} from '$lib/core/taskTree';
import { createDownloadUrl, parseImportedText, revokeDownloadUrl, STORAGE_KEY } from '$lib/core/persistence';
import type { Task, TaskData } from '$lib/core/taskTypes';

const isoNow = () => new Date().toISOString();

interface TaskStoreState {
	data: TaskData;
	previewTaskId: string | null;
	timerStartedAt: number | null;
	lastTickAt: number | null;
	exportUrl: string | null;
}

const sanitizeData = (data: TaskData): TaskData => {
	const projects = data.projects ?? [];
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

		const parsed = JSON.parse(stored) as TaskData;
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
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
	exportUrl: null
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

		const url = createDownloadUrl(state.data);
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
			exportUrl: null
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
