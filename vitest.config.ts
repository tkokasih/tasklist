import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'$app/environment': path.resolve(__dirname, 'tests/mocks/app-environment.ts'),
			$lib: path.resolve(__dirname, 'src/lib')
		}
	},
	test: {
		environment: 'node',
		retry: 0,
		watch: false,
		pool: 'vmThreads',
		isolate: false
	}
});
