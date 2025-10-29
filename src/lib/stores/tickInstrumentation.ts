export interface TickMetrics {
  count: number;
  min: number;
  max: number;
  total: number;
  lastSampleAt: number | null;
}

export const TICK_INSTRUMENTATION_ENABLED = true;

const metrics: TickMetrics = {
  count: 0,
  min: Number.POSITIVE_INFINITY,
  max: 0,
  total: 0,
  lastSampleAt: null,
};

const now = () => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
};

export const getTickMetrics = (): TickMetrics => ({
  count: metrics.count,
  min: metrics.count === 0 ? 0 : metrics.min,
  max: metrics.max,
  total: metrics.total,
  lastSampleAt: metrics.lastSampleAt,
});

export const resetTickMetrics = () => {
  metrics.count = 0;
  metrics.min = Number.POSITIVE_INFINITY;
  metrics.max = 0;
  metrics.total = 0;
  metrics.lastSampleAt = null;
};

export const recordTickDuration = (durationMs: number) => {
  if (!TICK_INSTRUMENTATION_ENABLED) {
    return;
  }

  const clamped = Math.max(0, durationMs);
  metrics.count += 1;
  metrics.total += clamped;
  metrics.min = Math.min(metrics.min, clamped);
  metrics.max = Math.max(metrics.max, clamped);
  metrics.lastSampleAt = now();
};

export const measureAndRecord = <T>(fn: () => T): T => {
  const start = now();
  const result = fn();
  const end = now();
  recordTickDuration(end - start);
  return result;
};
