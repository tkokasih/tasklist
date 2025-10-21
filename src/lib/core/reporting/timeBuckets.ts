import type { Task, TaskSession } from '$lib/core/taskTypes';

export type TimeRangePreset = 'today' | 'this-week' | 'last-seven-days';

export interface TimeRange {
	preset?: TimeRangePreset;
	start: Date;
	end: Date;
}

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
	range: TimeRange;
	taskTotals: Map<string, SessionAggregation>;
}

export const bucketSessionsForRange = (
	task: Task,
	range: TimeRange,
	options: AggregationOptions = {}
): SessionAggregation => {
	const { includeArchived = false, includeCompleted = true } = options;
	const allowStatus =
		task.status !== 'archived' || includeArchived
			? task.status !== 'completed' || includeCompleted
				? true
				: false
			: false;

	if (!allowStatus) {
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

export const aggregateSessions = (sessions: TaskSession[], range: TimeRange) => {
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
		const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();

		if (Number.isNaN(begin) || Number.isNaN(end) || end <= startMs || begin >= endMs) {
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

		if (!session.endedAt) {
			activeOverlapDetected = true;
		}
	}

	return { buckets, totalMs, activeOverlapDetected };
};

const sessionBucketKey = (timestampMs: number) => {
	const date = new Date(timestampMs);
	return date.toISOString().slice(0, 10);
};
