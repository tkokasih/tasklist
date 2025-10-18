export type TaskStatus = 'idle' | 'in-progress' | 'paused' | 'completed' | 'archived';

export interface TaskSession {
	id: string;
	startedAt: string;
	endedAt?: string;
	durationMs: number;
}

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

export interface Project {
	id: string;
	title: string;
	description?: string;
	tasks: Task[];
	createdAt: string;
	updatedAt: string;
}

export interface TaskSnapshot {
	id: string;
	name: string;
	createdAt: string;
	data: Project[];
}

export interface TaskData {
	projects: Project[];
	activeProjectId: string | null;
	activeTaskId: string | null;
	recentTaskIds: string[];
	snapshots: TaskSnapshot[];
	lastSavedAt?: string;
}
