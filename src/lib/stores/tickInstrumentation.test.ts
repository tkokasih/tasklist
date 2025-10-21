import { describe, expect, it, beforeEach } from 'vitest';
import {
	getTickMetrics,
	measureAndRecord,
	recordTickDuration,
	resetTickMetrics,
	TICK_INSTRUMENTATION_ENABLED
} from './tickInstrumentation';

describe('tickInstrumentation', () => {
	beforeEach(() => {
		resetTickMetrics();
	});

	it('records durations and updates aggregate stats', () => {
		recordTickDuration(5);
		recordTickDuration(10);
		const metrics = getTickMetrics();

		expect(metrics.count).toBe(TICK_INSTRUMENTATION_ENABLED ? 2 : 0);
		if (TICK_INSTRUMENTATION_ENABLED) {
			expect(metrics.min).toBe(5);
			expect(metrics.max).toBe(10);
			expect(metrics.total).toBe(15);
			expect(metrics.lastSampleAt).not.toBeNull();
		}
	});

	it('measures wrapped functions automatically', () => {
		const result = measureAndRecord(() => 'value');
		expect(result).toBe('value');
		const metrics = getTickMetrics();
		expect(metrics.count).toBe(TICK_INSTRUMENTATION_ENABLED ? 1 : 0);
	});
});
