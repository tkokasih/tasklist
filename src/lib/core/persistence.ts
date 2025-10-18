import type { TaskData, TaskSnapshot } from './taskTypes';

export const STORAGE_KEY = 'tasklist:data';
export const SNAPSHOT_STORAGE_KEY = 'tasklist:snapshots';
export const CURRENT_DATA_VERSION = 1;

interface PersistedEnvelope {
	version: number;
	data: TaskData;
}

const isEnvelope = (value: unknown): value is PersistedEnvelope =>
	Boolean(
		value &&
		typeof value === 'object' &&
		'version' in value &&
		typeof (value as PersistedEnvelope).version === 'number' &&
		'data' in value
	);

const migrateStep = (fromVersion: number, data: TaskData): TaskData => {
	// Placeholder: future migrations will transform data between versions.
	return data;
};

export const migrateData = (version: number, data: TaskData): TaskData => {
	let currentVersion = version;
	let nextData = data;

	while (currentVersion < CURRENT_DATA_VERSION) {
		nextData = migrateStep(currentVersion, nextData);
		currentVersion += 1;
	}

	return nextData;
};

const wrapData = (data: TaskData): PersistedEnvelope => ({
	version: CURRENT_DATA_VERSION,
	data
});

const unwrapData = (raw: string): { version: number; data: TaskData } => {
	const parsed = JSON.parse(raw) as unknown;

	if (isEnvelope(parsed)) {
		return {
			version: parsed.version,
			data: parsed.data
		};
	}

	return {
		version: 0,
		data: parsed as TaskData
	};
};

export const serializeData = (data: TaskData): string => JSON.stringify(wrapData(data));

export const deserializeData = (raw: string): TaskData => {
	const { version, data } = unwrapData(raw);
	return migrateData(version, data);
};

export const serializeSnapshots = (snapshots: TaskSnapshot[]): string => JSON.stringify(snapshots);

export const deserializeSnapshots = (raw: string): TaskSnapshot[] => JSON.parse(raw) as TaskSnapshot[];

export const createDownloadUrl = (data: TaskData): string => {
	const envelope = wrapData(data);
	const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
	return URL.createObjectURL(blob);
};

export const revokeDownloadUrl = (url: string) => {
	URL.revokeObjectURL(url);
};

export const parseImportedText = (text: string): TaskData => {
	const { version, data } = unwrapData(text);
	return migrateData(version, data);
};
