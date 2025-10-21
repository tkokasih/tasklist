import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
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

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	define: {
		__APP_GIT_COMMIT__: JSON.stringify(gitCommitHash),
		__APP_VERSION__: JSON.stringify(appVersion)
	}
});
