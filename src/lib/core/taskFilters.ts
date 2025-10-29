import type { Task, TaskStatus } from '$lib/core/taskTypes';
import { DEFAULT_STATUS_FILTERS } from '$lib/core/taskTree';

const STATUS_ORDER: TaskStatus[] = ['idle', 'in-progress', 'paused', 'completed', 'archived'];
const STATUS_SET = new Set<TaskStatus>(STATUS_ORDER);

/**
 * Enumerate known task statuses in a fixed presentation order.
 */
export const ALL_STATUS_VALUES: ReadonlyArray<TaskStatus> = [...STATUS_ORDER];

/**
 * Clone the default status preset so callers can mutate safely.
 */
export const cloneDefaultStatusSelection = (): TaskStatus[] => [...DEFAULT_STATUS_FILTERS];

/**
 * Determine whether a value is part of the supported status taxonomy.
 */
export const isKnownStatus = (status: TaskStatus): boolean => STATUS_SET.has(status);

/**
 * Order any iterable of statuses according to the canonical sort order.
 */
export const orderStatuses = (statuses: Iterable<TaskStatus>): TaskStatus[] => {
	const selection = new Set<TaskStatus>();
	for (const status of statuses) {
		if (STATUS_SET.has(status)) {
			selection.add(status);
		}
	}
	return STATUS_ORDER.filter((status) => selection.has(status));
};

/**
 * Compare two status arrays for strict equality, including order.
 */
export const statusesEqual = (a: TaskStatus[], b: TaskStatus[]): boolean =>
	a.length === b.length && a.every((status, index) => status === b[index]);

/**
 * Remove tasks whose status is not allowed while preserving matching descendants.
 */
export const filterTasksByStatus = (
	tasks: Task[],
	allowed: Set<TaskStatus>
): { tasks: Task[]; changed: boolean } => {
	if (tasks.length === 0) {
		return { tasks, changed: false };
	}

	let changed = false;
	const next: Task[] = [];

	for (const task of tasks) {
		const { tasks: filteredChildren, changed: childrenChanged } = filterTasksByStatus(task.children, allowed);
		const includeSelf = allowed.has(task.status);

		if (!includeSelf && filteredChildren.length === 0) {
			changed = true;
			continue;
		}

		if (!includeSelf) {
			changed = true;
			next.push({ ...task, children: filteredChildren });
			continue;
		}

		if (childrenChanged) {
			changed = true;
			next.push({ ...task, children: filteredChildren });
			continue;
		}

		next.push(task);
	}

	if (!changed && next.length !== tasks.length) {
		changed = true;
	}

	if (!changed) {
		return { tasks, changed: false };
	}

	return { tasks: next, changed: true };
};
