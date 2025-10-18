import type { TaskData, TaskSnapshot } from './taskTypes';

export const DEFAULT_DATA_VERSION = 1;
export const CURRENT_DATA_VERSION = 2;

export const STORAGE_KEY = 'tasklist:data';
export const SNAPSHOT_STORAGE_KEY = 'tasklist:snapshots';

export const getDataVersion = (value: Partial<TaskData> | null | undefined): number => {
	if (!value || typeof value !== 'object') {
		return DEFAULT_DATA_VERSION;
	}

	const candidate = value.dataVersion;
	if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= DEFAULT_DATA_VERSION) {
		return Math.floor(candidate);
	}

	return DEFAULT_DATA_VERSION;
};

export const isLegacyDataVersion = (version: number): boolean => version < CURRENT_DATA_VERSION;

export const serializeData = (data: TaskData): string => JSON.stringify(data);

export const deserializeData = (raw: string): TaskData => JSON.parse(raw) as TaskData;

export const serializeSnapshots = (snapshots: TaskSnapshot[]): string => JSON.stringify(snapshots);

export const deserializeSnapshots = (raw: string): TaskSnapshot[] => JSON.parse(raw) as TaskSnapshot[];

export const createDownloadUrl = (data: TaskData): string => {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	return URL.createObjectURL(blob);
};

export const revokeDownloadUrl = (url: string) => {
	URL.revokeObjectURL(url);
};

export const parseImportedText = (text: string): Partial<TaskData> => JSON.parse(text) as Partial<TaskData>;
