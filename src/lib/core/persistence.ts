import type { TaskData, TaskSnapshot } from './taskTypes';

export const STORAGE_KEY = 'tasklist:data';
export const SNAPSHOT_STORAGE_KEY = 'tasklist:snapshots';

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

export const parseImportedText = (text: string): TaskData => JSON.parse(text) as TaskData;
