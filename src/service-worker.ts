/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const ASSET_CACHE = `tasklist-assets-${version}`;
const NAVIGATION_CACHE = `tasklist-navigation-${version}`;

const swPath = self.location.pathname;
const basePath = swPath.slice(0, swPath.lastIndexOf('/'));

const toPath = (path: string) => {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	return basePath ? `${basePath}${normalized}` : normalized;
};

const toUrl = (path: string) => new URL(toPath(path), self.location.origin).toString();

const ASSET_URLS = [...new Set([...build, ...files].map((path) => toUrl(path)))] as string[];
const ASSET_URL_SET = new Set(ASSET_URLS);
const SHELL_URL = toUrl('/');

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(ASSET_CACHE);
			await cache.addAll([...ASSET_URLS.map((url) => new Request(url, { cache: 'reload' })), new Request(SHELL_URL, { cache: 'reload' })]);
		})()
	);

	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys.map((key) => {
					if (key !== ASSET_CACHE && key !== NAVIGATION_CACHE) {
						return caches.delete(key);
					}
				})
			);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;

	if (request.method !== 'GET') {
		return;
	}

	const url = new URL(request.url);

	if (url.origin !== self.location.origin) {
		return;
	}

	if (ASSET_URL_SET.has(request.url)) {
		event.respondWith(cacheFirst(request));
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(navigationStrategy(request));
		return;
	}

	// default: try network, fall back to cache if available
	event.respondWith(networkFallingBackToCache(request));
});

async function cacheFirst(request: Request): Promise<Response> {
	const cache = await caches.open(ASSET_CACHE);
	const cached = await cache.match(request);
	if (cached) {
		return cached;
	}
	const response = await fetch(request);
	cache.put(request, response.clone());
	return response;
}

async function navigationStrategy(request: Request): Promise<Response> {
	const cache = await caches.open(NAVIGATION_CACHE);
	try {
		const response = await fetch(request);
		cache.put(request, response.clone());
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}
		const shell = await caches.match(SHELL_URL);
		if (shell) {
			return shell;
		}
		return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
	}
}

async function networkFallingBackToCache(request: Request): Promise<Response> {
	try {
		return await fetch(request);
	} catch (error) {
		const cached = await caches.match(request);
		if (cached) {
			return cached;
		}
		throw error;
	}
}
