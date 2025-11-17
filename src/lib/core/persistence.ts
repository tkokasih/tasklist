/**
 * LocalStorage and import/export helpers for the Tasklist data model.
 */
import type { Task, TaskData, TaskSnapshot } from "./taskTypes";

/** LocalStorage key for the persisted TaskData envelope. */
export const STORAGE_KEY = "tasklist:data";

/** LocalStorage key storing serialized snapshots array. */
export const SNAPSHOT_STORAGE_KEY = "tasklist:snapshots";

/** Bump this when stored structures change; drives migration logic. */
export const CURRENT_DATA_VERSION = 2;

interface PersistedEnvelope {
  version: number;
  data: TaskData;
}

const isEnvelope = (value: unknown): value is PersistedEnvelope =>
  Boolean(
    value &&
      typeof value === "object" &&
      "version" in value &&
      typeof (value as PersistedEnvelope).version === "number" &&
      "data" in value,
  );

const applyToTasks = (tasks: Task[], transform: (task: Task) => Task): Task[] =>
  tasks.map((task) => {
    const nextChildren = Array.isArray(task.children)
      ? applyToTasks(task.children, transform)
      : [];

    return transform({ ...task, children: nextChildren });
  });

const ensureFocusFlag = (data: TaskData): TaskData => ({
  ...data,
  projects: data.projects.map((project) => ({
    ...project,
    tasks: applyToTasks(project.tasks ?? [], (task) => ({
      ...task,
      isFocused: Boolean((task as Task & { isFocused?: boolean }).isFocused),
    })),
  })),
});

const migrateStep = (fromVersion: number, data: TaskData): TaskData => {
  switch (fromVersion) {
    case 0:
      // Version 0 predates envelopes; no structural changes needed.
      return data;
    case 1:
      // Version 2 introduces per-task focus metadata.
      return ensureFocusFlag(data);
    default:
      return data;
  }
};

/**
 * Run the data through incremental migrations until CURRENT_DATA_VERSION.
 */
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
  data,
});

const unwrapData = (raw: string): { version: number; data: TaskData } => {
  const parsed = JSON.parse(raw) as unknown;

  if (isEnvelope(parsed)) {
    return {
      version: parsed.version,
      data: parsed.data,
    };
  }

  return {
    version: 0,
    data: parsed as TaskData,
  };
};

/**
 * Serialize TaskData as a versioned JSON envelope.
 */
export const serializeData = (data: TaskData): string =>
  JSON.stringify(wrapData(data));

/**
 * Parse raw JSON into TaskData, upgrading it if older versions are detected.
 */
export const deserializeData = (raw: string): TaskData => {
  const { version, data } = unwrapData(raw);
  return migrateData(version, data);
};

/**
 * Convert snapshots array to JSON for storage or download.
 */
export const serializeSnapshots = (snapshots: TaskSnapshot[]): string =>
  JSON.stringify(snapshots);

/**
 * Parse snapshot JSON payloads into strongly typed objects.
 */
export const deserializeSnapshots = (raw: string): TaskSnapshot[] =>
  JSON.parse(raw) as TaskSnapshot[];

/**
 * Create a blob-backed URL for downloading a TaskData export file.
 */
export const createDownloadUrl = (data: TaskData): string => {
  const envelope = wrapData(data);
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json",
  });
  return URL.createObjectURL(blob);
};

/**
 * Clean up a previously created download URL to avoid leaking blobs.
 */
export const revokeDownloadUrl = (url: string) => {
  URL.revokeObjectURL(url);
};

/**
 * Parse imported JSON text into the current TaskData shape, migrating as needed.
 */
export const parseImportedText = (text: string): TaskData => {
  const { version, data } = unwrapData(text);
  return migrateData(version, data);
};
