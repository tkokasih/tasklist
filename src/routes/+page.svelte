<section class="hero">
	<h1>Tasklist</h1>
	<p>Build a modern task manager powered by SvelteKit and deployed with GitHub Pages.</p>
	<a class="cta" href="https://github.com/tkokasih/tasklist">View the repo</a>
</section>

<section class="features">
	<h2>Why this stack?</h2>
	<ul>
		<li>SvelteKit for fast, composable user interfaces.</li>
		<li>Static adapter for a zero-server SPA.</li>
		<li>Continuous deployment with GitHub Actions.</li>
	</ul>
</section>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		background: radial-gradient(circle at top left, #fdf5ff, #f0f4ff);
		min-height: 100vh;
		color: #1f2933;
	}

	.hero {
		display: grid;
		gap: 1rem;
		padding: clamp(3rem, 5vw, 6rem);
		text-align: center;
	}

	h1 {
		font-size: clamp(2.5rem, 8vw, 3.5rem);
		margin: 0;
	}

	p {
		margin: 0 auto;
		max-width: 36ch;
		line-height: 1.6;
		font-size: 1.05rem;
	}

	.cta {
		display: inline-block;
		padding: 0.75rem 2.5rem;
		border-radius: 999px;
		font-weight: 600;
		background: #2563eb;
		color: white;
		text-decoration: none;
		box-shadow: 0 12px 30px rgba(37, 99, 235, 0.2);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.cta:hover {
		transform: translateY(-2px);
		box-shadow: 0 20px 40px rgba(37, 99, 235, 0.25);
	}

	.features {
		background: rgba(255, 255, 255, 0.7);
		padding: clamp(2rem, 5vw, 4rem);
		backdrop-filter: blur(6px);
	}

	.features h2 {
		text-align: center;
		margin-bottom: 1.5rem;
		font-size: 1.5rem;
	}

	ul {
		list-style: none;
		display: grid;
		gap: 1rem;
		max-width: 40rem;
		margin: 0 auto;
		padding: 0;
	}

	li {
		background: white;
		border-radius: 1rem;
		padding: 1.25rem;
		box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
	}
</style>
