import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			// Generate a single-page app with a fallback so GitHub Pages can serve client routes
			fallback: 'index.html'
		}),
		paths: {
			// BASE_PATH is injected by the GitHub Pages workflow for repository pages
			base: process.env.BASE_PATH ?? ''
		},
		prerender: {
			// Keep the root page prerendered while allowing spa-style routing elsewhere
			handleHttpError: 'warn'
		}
	}
};

export default config;
