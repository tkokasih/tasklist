import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		retry: 0,
		watch: false,
		pool: 'vmThreads',
		isolate: false
	}
});
