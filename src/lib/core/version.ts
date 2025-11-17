/**
 * Build-time version information injected by Vite define replacements.
 */
const APP_NAME_DISPLAY = "TASKLIST";
const fallbackCommit = "dev";
const fallbackVersion = "0.0.0";
const fallbackBuildTimestamp: string | undefined = undefined;

const appVersion =
  typeof __APP_VERSION__ === "string" && __APP_VERSION__.length > 0
    ? __APP_VERSION__
    : fallbackVersion;
const commitHash =
  typeof __APP_GIT_COMMIT__ === "string" && __APP_GIT_COMMIT__.length > 0
    ? __APP_GIT_COMMIT__
    : fallbackCommit;

const normalizeBuildTimestamp = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length === 0) {
    return fallbackBuildTimestamp;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackBuildTimestamp;
  }

  return value;
};

const buildTimestamp = normalizeBuildTimestamp(__APP_BUILD_TIMESTAMP__);

/** Semantic version string compiled into the app, or a fallback during dev. */
export const APP_VERSION = appVersion;

/** Git commit hash provided at build time, falling back to `dev`. */
export const APP_COMMIT_HASH = commitHash;

/** ISO timestamp string representing when the app was built, if available. */
export const APP_BUILD_TIMESTAMP = buildTimestamp;

/** Human-readable version string combining app name, semantic version, and commit hash. */
export const APP_VERSION_DISPLAY = `${APP_NAME_DISPLAY} v${APP_VERSION} (build ${APP_COMMIT_HASH})`;
