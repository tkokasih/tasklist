import { browser } from "$app/environment";
import {
  createDownloadUrl,
  parseImportedText,
  revokeDownloadUrl,
} from "$lib/core/persistence";
import type { TaskData } from "$lib/core/taskTypes";

const stripTransientState = (data: TaskData): TaskData => ({
  ...data,
  snapshots: [],
});

/**
 * Generate a downloadable URL for the provided task data, omitting snapshots.
 */
export const createTaskDataExport = (data: TaskData): string | null => {
  if (!browser) {
    return null;
  }

  const payload = stripTransientState(data);
  return createDownloadUrl(payload);
};

/**
 * Revoke a previously generated export URL when it is no longer needed.
 */
export const revokeTaskDataExport = (url: string | null) => {
  if (url) {
    revokeDownloadUrl(url);
  }
};

/**
 * Read a user-provided file and parse it into the current TaskData shape.
 */
export const parseTaskDataFile = async (file: File): Promise<TaskData> => {
  const text = await file.text();
  return parseImportedText(text);
};
