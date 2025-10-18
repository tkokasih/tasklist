import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	CURRENT_DATA_VERSION,
	createDownloadUrl,
	deserializeData,
	deserializeSnapshots,
	parseImportedText,
	revokeDownloadUrl,
	serializeData,
	serializeSnapshots
} from './persistence';
import type { TaskData, TaskSnapshot } from './taskTypes';

const sampleData: TaskData = {
	dataVersion: CURRENT_DATA_VERSION,
	projects: [
		{
			id: 'project-1',
			title: 'Inbox',
			tasks: [],
			createdAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z'
		}
	],
	activeProjectId: 'project-1',
	activeTaskId: null,
	recentTaskIds: [],
	snapshots: [],
	lastSavedAt: '2024-01-01T00:00:00.000Z'
};

const sampleSnapshots: TaskSnapshot[] = [
	{
		id: 'snap-1',
		name: 'Snapshot',
		createdAt: '2024-01-01T00:00:00.000Z',
		data: sampleData.projects
	}
];

describe('persistence helpers', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('serializes and deserializes task data', () => {
		const serialized = serializeData(sampleData);
		expect(serialized).toContain('"activeProjectId":"project-1"');

		const parsed = deserializeData(serialized);
		expect(parsed).toEqual(sampleData);
	});

	it('serializes and deserializes snapshots', () => {
		const serialized = serializeSnapshots(sampleSnapshots);

		const parsed = deserializeSnapshots(serialized);
		expect(parsed).toEqual(sampleSnapshots);
	});

	it('creates download urls using Blob serialization', () => {
		const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://mock');

		const url = createDownloadUrl(sampleData);
		expect(createSpy).toHaveBeenCalledTimes(1);
		const [blobArgument] = createSpy.mock.calls[0];
		expect(blobArgument).toBeInstanceOf(Blob);
		expect(url).toBe('blob://mock');
	});

	it('revokes download urls', () => {
		const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

		revokeDownloadUrl('blob://mock');
		expect(revokeSpy).toHaveBeenCalledWith('blob://mock');
	});

	it('parses imported text into task data', () => {
		const json = JSON.stringify(sampleData);

		const parsed = parseImportedText(json);
		expect(parsed).toEqual(sampleData);
	});
});
