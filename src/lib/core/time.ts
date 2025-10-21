export const formatDuration = (ms: number): string => {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const pad = (value: number) => value.toString().padStart(2, '0');

	if (hours > 0) {
		return `${hours}:${pad(minutes)}:${pad(seconds)}`;
	}

	return `${pad(minutes)}:${pad(seconds)}`;
};

export const formatTimestamp = (iso: string | undefined): string => {
	if (!iso) {
		return '';
	}

	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return iso;
	}

	return date.toLocaleString();
};

export type TimePreset = 'today' | 'this-week' | 'last-seven-days';

export interface TimeRangeConfig {
	preset?: TimePreset;
	start: Date;
	end: Date;
}

const now = () => new Date();

const startOfDay = (date: Date) => {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
};

const endOfDay = (date: Date) => {
	const copy = new Date(date);
	copy.setHours(23, 59, 59, 999);
	return copy;
};

const startOfWeek = (date: Date, weekStartsOn: number) => {
	const copy = startOfDay(date);
	const day = copy.getDay();
	const diff = (day - weekStartsOn + 7) % 7;
	copy.setDate(copy.getDate() - diff);
	return copy;
};

export interface PresetOptions {
	weekStartsOn?: number;
	nowFactory?: () => Date;
}

const applyOptionsNow = (options?: PresetOptions) => (options?.nowFactory ?? now)();

export const buildPresetRange = (preset: TimePreset, options?: PresetOptions): TimeRangeConfig => {
	const current = applyOptionsNow(options);

	switch (preset) {
		case 'today': {
			const start = startOfDay(current);
			const end = endOfDay(current);
			return { preset, start, end };
		}
		case 'this-week': {
			const weekAnchor = startOfWeek(current, options?.weekStartsOn ?? 1);
			const start = weekAnchor;
			const end = endOfDay(new Date(weekAnchor.getTime() + 6 * 24 * 60 * 60 * 1000));
			return { preset, start, end };
		}
		case 'last-seven-days': {
			const end = endOfDay(current);
			const start = new Date(end);
			start.setDate(start.getDate() - 6);
			start.setHours(0, 0, 0, 0);
			return { preset, start, end };
		}
		default:
			return { preset, start: startOfDay(current), end: endOfDay(current) };
	}
};
