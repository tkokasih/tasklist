import type { Project, Task, TaskData, TaskSession, TaskSnapshot, TaskStatus } from './taskTypes';

export interface TaskUpdateContext {
	projectId: string;
	parentIds: string[];
	index: number;
}

type TaskUpdater = (task: Task, context: TaskUpdateContext) => Task;

export interface LocatedTask {
	task: Task;
	project: Project;
	parentIds: string[];
	index: number;
}

const now = () => new Date().toISOString();

const cloneProjects = (projects: Project[]): Project[] =>
	typeof structuredClone === 'function'
		? structuredClone(projects)
		: JSON.parse(JSON.stringify(projects)) as Project[];

const generateId = () => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `tsk-${Math.random().toString(36).slice(2, 10)}`;
};

export const createTask = (title: string, overrides: Partial<Task> = {}): Task => {
	const timestamp = now();
	return {
		id: generateId(),
		title,
		status: 'idle',
		timeSpentMs: 0,
		sessions: [],
		children: [],
		createdAt: timestamp,
		updatedAt: timestamp,
		...overrides
	};
};

export const createProject = (title: string, overrides: Partial<Project> = {}): Project => {
	const timestamp = now();
	return {
		id: generateId(),
		title,
		tasks: [],
		createdAt: timestamp,
		updatedAt: timestamp,
		...overrides
	};
};

export const createInitialData = (): TaskData => {
	const project = createProject('Project Alpha', {
		tasks: [
			createTask('Parent task', {
				children: [
					createTask('Sub task', {
						children: [createTask('Sub-sub task')]
					}),
					createTask('Sub task 2')
				]
			}),
			createTask('Parent task 2', {
				children: [createTask('Sub task 3')]
			})
		]
	});

	return {
		projects: [project],
		activeProjectId: project.id,
		activeTaskId: null,
		recentTaskIds: [],
		snapshots: [],
		lastSavedAt: now()
	};
};

const mapTasks = (
	tasks: Task[],
	projectId: string,
	updater: TaskUpdater,
	targetId: string
): { next: Task[]; changed: boolean } => {
	let changed = false;

	const next = tasks.map((task, index) => {
		if (task.id === targetId) {
			changed = true;
			const updated = updater(task, { projectId, parentIds: [], index });
			return { ...updated, updatedAt: now() };
		}

		const { next: childTasks, changed: childChanged } = mapTasksWithParent(
			task.children,
			projectId,
			updater,
			targetId,
			[task.id]
		);

		if (childChanged) {
			changed = true;
			return { ...task, children: childTasks, updatedAt: now() };
		}

		return task;
	});

	return { next, changed };
};

const mapTasksWithParent = (
	tasks: Task[],
	projectId: string,
	updater: TaskUpdater,
	targetId: string,
	parentIds: string[]
): { next: Task[]; changed: boolean } => {
	let changed = false;

	const next = tasks.map((task, index) => {
		if (task.id === targetId) {
			changed = true;
			const updated = updater(task, { projectId, parentIds, index });
			return { ...updated, updatedAt: now() };
		}

		const { next: childTasks, changed: childChanged } = mapTasksWithParent(
			task.children,
			projectId,
			updater,
			targetId,
			[...parentIds, task.id]
		);

		if (childChanged) {
			changed = true;
			return { ...task, children: childTasks, updatedAt: now() };
		}

		return task;
	});

	return { next, changed };
};

export const updateTaskById = (
	projects: Project[],
	taskId: string,
	updater: TaskUpdater
): { projects: Project[]; changed: boolean } => {
	let changed = false;

	const nextProjects = projects.map((project) => {
		const { next, changed: projectChanged } = mapTasks(project.tasks, project.id, updater, taskId);
		if (projectChanged) {
			changed = true;
			return { ...project, tasks: next, updatedAt: now() };
		}
		return project;
	});

	return { projects: changed ? nextProjects : projects, changed };
};

const locateTaskRecursive = (
	tasks: Task[],
	taskId: string,
	project: Project,
	parentIds: string[] = []
): LocatedTask | null => {
	for (let index = 0; index < tasks.length; index += 1) {
		const task = tasks[index];
		if (task.id === taskId) {
			return { task, project, parentIds, index };
		}

		const located = locateTaskRecursive(task.children, taskId, project, [...parentIds, task.id]);
		if (located) {
			return located;
		}
	}

	return null;
};

export const locateTask = (projects: Project[], taskId: string): LocatedTask | null => {
	for (const project of projects) {
		const located = locateTaskRecursive(project.tasks, taskId, project);
		if (located) {
			return located;
		}
	}
	return null;
};

const reorderWithin = (list: Task[], from: number, to: number): Task[] => {
	const next = [...list];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
};

const reorderTasksRecursive = (
	tasks: Task[],
	targetId: string,
	delta: 1 | -1
): { next: Task[]; changed: boolean } => {
	const index = tasks.findIndex((task) => task.id === targetId);
	if (index !== -1) {
		const nextIndex = index + delta;
		if (nextIndex < 0 || nextIndex >= tasks.length) {
			return { next: tasks, changed: false };
		}

		return { next: reorderWithin(tasks, index, nextIndex), changed: true };
	}

	for (let i = 0; i < tasks.length; i += 1) {
		const task = tasks[i];
		const { next: childTasks, changed } = reorderTasksRecursive(task.children, targetId, delta);
		if (changed) {
			const updatedTask = { ...task, children: childTasks, updatedAt: now() };
			const next = [...tasks];
			next[i] = updatedTask;
			return { next, changed: true };
		}
	}

	return { next: tasks, changed: false };
};

export const moveTask = (
	projects: Project[],
	taskId: string,
	delta: 1 | -1
): { projects: Project[]; changed: boolean } => {
	let changed = false;
	const nextProjects = projects.map((project) => {
		const { next, changed: projectChanged } = reorderTasksRecursive(project.tasks, taskId, delta);
		if (projectChanged) {
			changed = true;
			return { ...project, tasks: next, updatedAt: now() };
		}
		return project;
	});

	return { projects: changed ? nextProjects : projects, changed };
};

const appendTaskRecursive = (
	tasks: Task[],
	parentId: string | null,
	newTask: Task
): { next: Task[]; changed: boolean } => {
	if (parentId === null) {
		return { next: [...tasks, newTask], changed: true };
	}

	let changed = false;

	const next = tasks.map((task) => {
		if (task.id === parentId) {
			changed = true;
			return { ...task, children: [...task.children, newTask], updatedAt: now() };
		}

		const { next: childTasks, changed: childChanged } = appendTaskRecursive(task.children, parentId, newTask);
		if (childChanged) {
			changed = true;
			return { ...task, children: childTasks, updatedAt: now() };
		}

		return task;
	});

	return { next, changed };
};

export const addTask = (
	projects: Project[],
	projectId: string,
	title: string,
	parentId: string | null = null
): Project[] => {
	const newTask = createTask(title);
	return projects.map((project) => {
		if (project.id !== projectId) {
			return project;
		}

		const { next } = appendTaskRecursive(project.tasks, parentId, newTask);
		return { ...project, tasks: next, updatedAt: now() };
	});
};

const findTaskContainer = (project: Project, parentIds: string[]): Task[] | null => {
	let container: Task[] = project.tasks;

	for (const parentId of parentIds) {
		const parentTask = container.find((task) => task.id === parentId);
		if (!parentTask) {
			return null;
		}
		container = parentTask.children;
	}

	return container;
};

const touchAncestors = (project: Project, parentIds: string[], timestamp: string) => {
	project.updatedAt = timestamp;

	let container: Task[] = project.tasks;
	for (const parentId of parentIds) {
		const parentTask = container.find((task) => task.id === parentId);
		if (!parentTask) {
			return;
		}
		parentTask.updatedAt = timestamp;
		container = parentTask.children;
	}
};

export const addTaskAfter = (
	projects: Project[],
	targetTaskId: string,
	title: string
): { projects: Project[]; task: Task | null; changed: boolean } => {
	const located = locateTask(projects, targetTaskId);
	if (!located) {
		return { projects, task: null, changed: false };
	}

	const nextProjects = cloneProjects(projects);
	const project = nextProjects.find((candidate) => candidate.id === located.project.id);
	if (!project) {
		return { projects, task: null, changed: false };
	}

	const container = findTaskContainer(project, located.parentIds);
	if (!container) {
		return { projects, task: null, changed: false };
	}

	const timestamp = now();
	const newTask = createTask(title);

	container.splice(located.index + 1, 0, newTask);
	touchAncestors(project, located.parentIds, timestamp);

	return { projects: nextProjects, task: newTask, changed: true };
};

export const removeTaskById = (
	projects: Project[],
	taskId: string
): { projects: Project[]; changed: boolean } => {
	const located = locateTask(projects, taskId);
	if (!located) {
		return { projects, changed: false };
	}

	const nextProjects = cloneProjects(projects);
	const project = nextProjects.find((candidate) => candidate.id === located.project.id);
	if (!project) {
		return { projects, changed: false };
	}

	const container = findTaskContainer(project, located.parentIds);
	if (!container) {
		return { projects, changed: false };
	}

	container.splice(located.index, 1);
	touchAncestors(project, located.parentIds, now());

	return { projects: nextProjects, changed: true };
};

export const indentTask = (
	projects: Project[],
	taskId: string
): { projects: Project[]; changed: boolean } => {
	const located = locateTask(projects, taskId);
	if (!located) {
		return { projects, changed: false };
	}

	const { project, parentIds, index } = located;
	if (index <= 0) {
		return { projects, changed: false };
	}

	const nextProjects = cloneProjects(projects);
	const projectRef = nextProjects.find((candidate) => candidate.id === project.id);
	if (!projectRef) {
		return { projects, changed: false };
	}

	const container = findTaskContainer(projectRef, parentIds);
	if (!container) {
		return { projects, changed: false };
	}

	const previousSibling = container[index - 1];
	const movingTask = container[index];
	if (!previousSibling || !movingTask) {
		return { projects, changed: false };
	}

	const timestamp = now();
	const updatedTask = { ...movingTask, updatedAt: timestamp };
	container.splice(index, 1);
	previousSibling.children = [...previousSibling.children, updatedTask];
	previousSibling.updatedAt = timestamp;

	touchAncestors(projectRef, parentIds, timestamp);
	touchAncestors(projectRef, [...parentIds, previousSibling.id], timestamp);

	return { projects: nextProjects, changed: true };
};

export const outdentTask = (
	projects: Project[],
	taskId: string
): { projects: Project[]; changed: boolean } => {
	const located = locateTask(projects, taskId);
	if (!located) {
		return { projects, changed: false };
	}

	const { project, parentIds, index } = located;
	if (parentIds.length === 0) {
		return { projects, changed: false };
	}

	const nextProjects = cloneProjects(projects);
	const projectRef = nextProjects.find((candidate) => candidate.id === project.id);
	if (!projectRef) {
		return { projects, changed: false };
	}

	const parentId = parentIds[parentIds.length - 1];
	const parentContainer = findTaskContainer(projectRef, parentIds.slice(0, -1));
	const childContainer = findTaskContainer(projectRef, parentIds);
	if (!parentContainer || !childContainer) {
		return { projects, changed: false };
	}

	const parentIndex = parentContainer.findIndex((task) => task.id === parentId);
	if (parentIndex === -1) {
		return { projects, changed: false };
	}

	const movingTask = childContainer[index];
	if (!movingTask) {
		return { projects, changed: false };
	}

	const timestamp = now();
	childContainer.splice(index, 1);
	const updatedTask = { ...movingTask, updatedAt: timestamp };
	parentContainer.splice(parentIndex + 1, 0, updatedTask);

	touchAncestors(projectRef, parentIds, timestamp);
	touchAncestors(projectRef, parentIds.slice(0, -1), timestamp);

	return { projects: nextProjects, changed: true };
};

const ensureSessions = (task: Task): TaskSession[] => {
	if (Array.isArray(task.sessions)) {
		return task.sessions;
	}
	return [];
};

const startNewSession = (sessions: TaskSession[], startedAt: string): TaskSession[] => [
	...sessions,
	{
		id: generateId(),
		startedAt,
		durationMs: 0
	}
];

const closeActiveSession = (sessions: TaskSession[], endedAt: string): TaskSession[] => {
	if (sessions.length === 0) {
		return sessions;
	}

	const last = sessions[sessions.length - 1];
	if (last.endedAt) {
		return sessions;
	}

	const next = [...sessions];
	next[next.length - 1] = {
		...last,
		endedAt,
		durationMs: Math.max(0, last.durationMs)
	};
	return next;
};

export const setTaskStatus = (
	projects: Project[],
	taskId: string,
	status: TaskStatus
): { projects: Project[]; changed: boolean } =>
	updateTaskById(projects, taskId, (task) => {
		const timestamp = now();
		const sessions = ensureSessions(task);

		let nextSessions = sessions;
		let lastStartedAt = task.lastStartedAt;

		if (status === 'in-progress') {
			const last = sessions.at(-1);
			if (!last || last.endedAt) {
				nextSessions = startNewSession(sessions, timestamp);
			}
			lastStartedAt = timestamp;
		} else if (task.status === 'in-progress') {
			nextSessions = closeActiveSession(sessions, timestamp);
		}

		return {
			...task,
			status,
			sessions: nextSessions,
			archivedAt: status === 'archived' ? timestamp : task.archivedAt,
			lastStartedAt
		};
	});

export const incrementTaskTime = (
	projects: Project[],
	taskId: string,
	deltaMs: number
): { projects: Project[]; changed: boolean } =>
	updateTaskById(projects, taskId, (task) => ({
		...task,
		...(() => {
			const nextTotal = Math.max(0, task.timeSpentMs + deltaMs);
			const sessions = ensureSessions(task);
			let nextSessions = sessions.map((session) => ({ ...session }));

			if (deltaMs > 0) {
				if (nextSessions.length === 0 || nextSessions[nextSessions.length - 1].endedAt) {
					nextSessions = startNewSession(nextSessions, now());
				}

				const activeIndex = nextSessions.length - 1;
				const active = nextSessions[activeIndex];
				nextSessions[activeIndex] = {
					...active,
					durationMs: Math.max(0, active.durationMs + deltaMs)
				};
			} else if (deltaMs < 0 && nextSessions.length > 0) {
				let remaining = Math.abs(deltaMs);
				for (let index = nextSessions.length - 1; index >= 0 && remaining > 0; index -= 1) {
					const session = nextSessions[index];
					if (session.durationMs <= 0) {
						continue;
					}
					const deduction = Math.min(session.durationMs, remaining);
					nextSessions[index] = {
						...session,
						durationMs: session.durationMs - deduction
					};
					remaining -= deduction;
				}
			}

			return {
				timeSpentMs: nextTotal,
				sessions: nextSessions
			};
		})()
	}));

export const flattenTasks = (projects: Project[]): LocatedTask[] => {
	const items: LocatedTask[] = [];

	for (const project of projects) {
		const walk = (tasks: Task[], parentIds: string[] = []) => {
			tasks.forEach((task, index) => {
				items.push({ task, project, parentIds, index });
				if (task.children.length > 0) {
					walk(task.children, [...parentIds, task.id]);
				}
			});
		};

		walk(project.tasks);
	}

	return items;
};

export const createSnapshot = (projects: Project[], name?: string): TaskSnapshot => ({
	id: generateId(),
	name: name ?? `Snapshot ${new Date().toLocaleString()}`,
	createdAt: now(),
	data: cloneProjects(projects)
});

export const applySnapshot = (snapshot: TaskSnapshot): Project[] => cloneProjects(snapshot.data);
