import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import os from 'node:os';
import tailwindcss from '@tailwindcss/vite';
import packageJson from './package.json' assert { type: 'json' };

const gitCommitHash = (() => {
	try {
		const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
		const isDirtyOutput = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
		const dirtySuffix = isDirtyOutput.length > 0 ? '-dirty' : '';
		return `${hash}${dirtySuffix}`;
	} catch {
		return 'dev';
	}
})();

const appVersion = typeof packageJson.version === 'string' && packageJson.version.length > 0 ? packageJson.version : '0.0.0';

const resolveHostname = () => {
 const explicitHost = process.env.VITE_DEV_HOST?.trim();
 if (explicitHost) return explicitHost;

 try {
  const machineHost = os.hostname().trim();
  if (machineHost) return machineHost;
 } catch {
  // noop; fallback handled below
 }


 return 'localhost';
};

const resolvedHost = resolveHostname();
const resolvedAllowedHosts = (() => {
 const fromEnv = process.env.VITE_ALLOWED_HOSTS?.split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

 if (fromEnv && fromEnv.length > 0) return fromEnv;

 return Array.from(new Set([resolvedHost, 'localhost', '127.0.0.1'])) as string[];
})();

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	define: {
		__APP_GIT_COMMIT__: JSON.stringify(gitCommitHash),
		__APP_VERSION__: JSON.stringify(appVersion)
	},
	server: {
		host: resolvedHost,
		allowedHosts: resolvedAllowedHosts
	},
	preview: {
		host: resolvedHost,
		allowedHosts: resolvedAllowedHosts
	}
});
