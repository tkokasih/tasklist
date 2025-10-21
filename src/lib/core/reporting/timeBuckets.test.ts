import { describe, expect, it } from 'vitest';
import type { Task, TaskSession } from '$lib/core/taskTypes';
import { buildPresetRange } from '../time';
import { aggregateSessions, aggregateTaskTree, bucketSessionsForRange } from './timeBuckets';

const iso = (date: string, time: string) => `${date}T${time}.000Z`;

const createSession = (
	start: string,
	end: string | null,
	durationMs: number,
	overrides: Partial<TaskSession> = {}
): TaskSession => ({
	id: overrides.id ?? `sess-${start}`,
	startedAt: start,
	endedAt: end ?? undefined,
	durationMs,
	...overrides
});

const createTask = (sessions: TaskSession[], status: Task['status'] = 'in-progress'): Task => ({
	id: 'task-1',
	title: 'Sample',
	status,
	sessions,
	children: [],
	timeSpentMs: sessions.reduce((sum, s) => sum + s.durationMs, 0),
	createdAt: iso('2024-01-01', '00:00:00'),
	updatedAt: iso('2024-01-01', '00:00:00')
});

const range = (start: string, end: string) => ({
	start: new Date(start),
	end: new Date(end)
});

describe('aggregateSessions', () => {
	it('ignores sessions outside the range and buckets remaining duration', () => {
		const sessions = [
			createSession(iso('2024-01-02', '09:00:00'), iso('2024-01-02', '11:00:00'), 2 * 60 * 60 * 1000),
			createSession(iso('2024-01-03', '15:00:00'), iso('2024-01-03', '16:30:00'), 90 * 60 * 1000),
			createSession(iso('2024-02-01', '10:00:00'), iso('2024-02-01', '11:00:00'), 60 * 60 * 1000)
		];

		const result = aggregateSessions(sessions, range(iso('2024-01-01', '00:00:00'), iso('2024-01-31', '23:59:59')));

		expect(result.totalMs).toBe(3.5 * 60 * 60 * 1000);
		expect(result.buckets['2024-01-02']).toBe(2 * 60 * 60 * 1000);
		expect(result.buckets['2024-01-03']).toBe(90 * 60 * 1000);
		expect(result.buckets['2024-02-01']).toBeUndefined();
		expect(result.activeOverlapDetected).toBe(false);
	});

	it('clamps sessions that overlap partially with the range and flags active ones', () => {
		const now = iso('2024-01-05', '12:00:00');
		const sessions = [
			createSession(iso('2024-01-04', '20:00:00'), iso('2024-01-05', '02:00:00'), 6 * 60 * 60 * 1000),
			createSession(iso('2024-01-05', '10:00:00'), null, 2 * 60 * 60 * 1000)
		];

		const result = aggregateSessions(sessions, range(iso('2024-01-05', '00:00:00'), iso('2024-01-06', '00:00:00')));

		const expectedFirstOverlap = 2 * 60 * 60 * 1000; // 00:00-02:00 on Jan 5
		expect(result.totalMs).toBeGreaterThanOrEqual(expectedFirstOverlap);
		expect(Object.keys(result.buckets)).toContain('2024-01-05');
		expect(result.activeOverlapDetected).toBe(true);
	});
});

describe('bucketSessionsForRange', () => {
	it('excludes archived tasks unless includeArchived is true', () => {
		const task = createTask(
			[createSession(iso('2024-01-02', '09:00:00'), iso('2024-01-02', '10:00:00'), 60 * 60 * 1000)],
			'archived'
		);

		const rangeConfig = {
			preset: 'today' as const,
			...range(iso('2024-01-01', '00:00:00'), iso('2024-01-03', '00:00:00'))
		};

		const excluded = bucketSessionsForRange(task, rangeConfig);
		expect(excluded.totalMs).toBe(0);
		expect(excluded.buckets).toEqual({});

		const included = bucketSessionsForRange(task, rangeConfig, { includeArchived: true });
		expect(included.totalMs).toBe(60 * 60 * 1000);
		expect(included.buckets['2024-01-02']).toBe(60 * 60 * 1000);
	});

	it('includes completed tasks by default and allows opting out', () => {
		const task = createTask(
			[createSession(iso('2024-01-02', '12:00:00'), iso('2024-01-02', '13:30:00'), 90 * 60 * 1000)],
			'completed'
		);
		const rangeConfig = {
			...range(iso('2024-01-01', '00:00:00'), iso('2024-01-03', '00:00:00'))
		};

		const defaultResult = bucketSessionsForRange(task, rangeConfig);
		expect(defaultResult.totalMs).toBe(90 * 60 * 1000);

		const excluded = bucketSessionsForRange(task, rangeConfig, { includeCompleted: false });
		expect(excluded.totalMs).toBe(0);
	});
});

describe('aggregateTaskTree', () => {
	it('aggregates root and children and returns map keyed by task id', () => {
		const parent: Task = {
			id: 'parent',
			title: 'Parent',
			status: 'completed',
			sessions: [createSession(iso('2024-01-02', '09:00:00'), iso('2024-01-02', '10:00:00'), 60 * 60 * 1000)],
			children: [],
			timeSpentMs: 60 * 60 * 1000,
			createdAt: iso('2024-01-01', '00:00:00'),
			updatedAt: iso('2024-01-01', '00:00:00')
		};
		const child: Task = {
			...createTask(
				[createSession(iso('2024-01-03', '11:00:00'), iso('2024-01-03', '13:00:00'), 2 * 60 * 60 * 1000)],
				'in-progress'
			),
			id: 'child'
		};
		parent.children = [child];

		const rangeConfig = buildPresetRange('last-seven-days', { nowFactory: () => new Date(iso('2024-01-05', '00:00:00')) });

		const result = aggregateTaskTree(parent, rangeConfig);

		expect(result.range).toEqual(rangeConfig);
		expect(result.taskTotals.size).toBe(2);
		expect(result.taskTotals.get('parent')?.totalMs).toBe(60 * 60 * 1000);
		expect(result.taskTotals.get('child')?.totalMs).toBe(2 * 60 * 60 * 1000);
	});
});
