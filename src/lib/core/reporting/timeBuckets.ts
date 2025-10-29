import type { Project, Task, TaskSession } from '$lib/core/taskTypes';
import type { TimeRangeConfig } from '../time';

export interface AggregationOptions {
	includeArchived?: boolean;
	includeCompleted?: boolean;
}

export interface SessionAggregation {
	taskId: string;
	totalMs: number;
	buckets: Record<string, number>;
	activeOverlapDetected: boolean;
}

export interface AggregationResult {
	range: TimeRangeConfig;
	taskTotals: Map<string, SessionAggregation>;
}

const shouldIncludeTask = (task: Task, options: AggregationOptions) => {
	const { includeArchived = false, includeCompleted = true } = options;

	if (task.status === 'archived' && !includeArchived) {
		return false;
	}

	if (task.status === 'completed' && !includeCompleted) {
		return false;
	}

	return true;
};

export const aggregateTaskTree = (
	root: Task,
	range: TimeRangeConfig,
	options: AggregationOptions = {}
): AggregationResult => {
	const taskTotals = new Map<string, SessionAggregation>();

	const walk = (task: Task) => {
		if (!shouldIncludeTask(task, options)) {
			return;
		}

		const aggregation = bucketSessionsForRange(task, range, options);
		taskTotals.set(task.id, aggregation);

		for (const child of task.children ?? []) {
			walk(child);
		}
	};

	walk(root);
	return { range, taskTotals };
};

export const aggregateProjects = (
	projects: Project[],
	range: TimeRangeConfig,
	options: AggregationOptions = {}
): AggregationResult => {
	const taskTotals = new Map<string, SessionAggregation>();

	for (const project of projects) {
		for (const task of project.tasks ?? []) {
			const subtree = aggregateTaskTree(task, range, options);
			for (const [taskId, aggregation] of subtree.taskTotals) {
				const existing = taskTotals.get(taskId);
				if (!existing) {
					taskTotals.set(taskId, aggregation);
					continue;
				}

				taskTotals.set(taskId, {
					taskId,
					totalMs: existing.totalMs + aggregation.totalMs,
					buckets: mergeBuckets(existing.buckets, aggregation.buckets),
					activeOverlapDetected: existing.activeOverlapDetected || aggregation.activeOverlapDetected
				});
			}
		}
	}

	return { range, taskTotals };
};

const mergeBuckets = (a: Record<string, number>, b: Record<string, number>) => {
	const combined: Record<string, number> = { ...a };
	for (const [bucket, value] of Object.entries(b)) {
		combined[bucket] = (combined[bucket] ?? 0) + value;
	}
	return combined;
};

export const bucketSessionsForRange = (
	task: Task,
	range: TimeRangeConfig,
	options: AggregationOptions = {}
): SessionAggregation => {
	if (!shouldIncludeTask(task, options)) {
		return {
			taskId: task.id,
			totalMs: 0,
			buckets: {},
			activeOverlapDetected: false
		};
	}

	const { buckets, totalMs, activeOverlapDetected } = aggregateSessions(task.sessions ?? [], range);

	return {
		taskId: task.id,
		totalMs,
		buckets,
		activeOverlapDetected
	};
};

export const aggregateSessions = (sessions: TaskSession[], range: TimeRangeConfig) => {
	const buckets: Record<string, number> = {};
	let totalMs = 0;
	let activeOverlapDetected = false;

	const startMs = range.start.getTime();
	const endMs = range.end.getTime();

	for (const session of sessions) {
		const { durationMs } = session;
		if (!Number.isFinite(durationMs) || durationMs <= 0) {
			continue;
		}

		const begin = new Date(session.startedAt).getTime();
		let end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
		const isOpenSession = !session.endedAt;

		if (Number.isNaN(begin)) {
			continue;
		}

		if (Number.isNaN(end) || end <= begin) {
			const durationFallback = Number.isFinite(session.durationMs) ? Math.max(0, session.durationMs) : 0;
			if (durationFallback > 0) {
				end = begin + durationFallback;
			}
		}

		if (Number.isNaN(end) || end <= startMs || begin >= endMs) {
			continue;
		}

		const clampedBegin = Math.max(begin, startMs);
		const clampedEnd = Math.min(end, endMs);

		const overlapMs = Math.max(0, clampedEnd - clampedBegin);
		if (overlapMs <= 0) {
			continue;
		}

		totalMs += overlapMs;

		const bucketKey = sessionBucketKey(clampedBegin);
		buckets[bucketKey] = (buckets[bucketKey] ?? 0) + overlapMs;

		if (isOpenSession) {
			activeOverlapDetected = true;
		}
	}

	return { buckets, totalMs, activeOverlapDetected };
};

const sessionBucketKey = (timestampMs: number) => {
	const date = new Date(timestampMs);
	return date.toISOString().slice(0, 10);
};
