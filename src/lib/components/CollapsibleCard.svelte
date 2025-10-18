<script lang="ts">
	export let title: string;
	export let subtitle: string | null = null;
	export let initialOpen = true;

	let open = initialOpen;
</script>

<section class="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow">
	<header class="flex items-center justify-between gap-4">
		<div>
			<h3 class="text-base font-semibold text-slate-800">{title}</h3>
			{#if subtitle}
				<p class="text-xs text-slate-500">{subtitle}</p>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<slot name="header-actions" />
			<button
				class="rounded-full border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
				on:click={() => (open = !open)}
				type="button"
				aria-expanded={open}
				aria-label={open ? 'Collapse card' : 'Expand card'}
			>
				{open ? 'Hide' : 'Show'}
			</button>
		</div>
	</header>

	{#if open}
		<div class="mt-3">
			<slot />
		</div>
	{/if}
</section>
