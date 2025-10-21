const VERSION_PREFIX = 'Tasklist v';
const fallbackCommit = 'dev';
const fallbackVersion = '0.0.0';

const appVersion =
	typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0 ? __APP_VERSION__ : fallbackVersion;
const commitHash =
	typeof __APP_GIT_COMMIT__ === 'string' && __APP_GIT_COMMIT__.length > 0 ? __APP_GIT_COMMIT__ : fallbackCommit;

export const APP_VERSION = appVersion;
export const APP_COMMIT_HASH = commitHash;
export const APP_VERSION_DISPLAY = `${VERSION_PREFIX}${APP_VERSION} (${APP_COMMIT_HASH})`;
