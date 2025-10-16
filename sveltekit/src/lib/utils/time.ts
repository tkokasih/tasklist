import type { Task } from '$lib/stores/taskStore';
import { totalDuration } from '$lib/stores/taskStore';

export function formatDuration(value: Task | number, now = Date.now()): string {
  const ms = typeof value === 'number' ? value : totalDuration(value, now);
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
