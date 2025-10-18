<script lang="ts">
	const statusFilters = [
		{ label: 'All', active: true },
		{ label: 'Active', active: false },
		{ label: 'Completed', active: false },
		{ label: 'Archived', active: false }
	];

	const timeWindows = [
		{ label: 'Any time', active: true },
		{ label: 'Past week', active: false },
		{ label: 'Past month', active: false }
	];
</script>

<div class="flex flex-wrap items-center justify-end gap-3 text-sm text-slate-600">
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-xs uppercase tracking-wide text-slate-400">Status</span>
		<div class="flex overflow-hidden rounded-full border border-slate-200 bg-white shadow-inner shadow-slate-200/50">
			{#each statusFilters as filter}
				<button
					type="button"
					class={`px-3 py-1 text-xs font-medium transition-colors ${filter.active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
					aria-pressed={filter.active}
				>
					{filter.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex items-center gap-2">
		<button
			type="button"
			class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-700"
			aria-haspopup="listbox"
		>
			<span>Tags</span>
			<svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path d="M3 4L6 7L9 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>

		<div class="flex items-center gap-2">
			<span class="text-xs uppercase tracking-wide text-slate-400">Time</span>
			<div class="flex overflow-hidden rounded-full border border-slate-200 bg-white shadow-inner shadow-slate-200/50">
				{#each timeWindows as window}
					<button
						type="button"
						class={`px-3 py-1 text-xs font-medium transition-colors ${window.active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
						aria-pressed={window.active}
					>
						{window.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<button
			type="button"
			class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-700"
			aria-haspopup="menu"
		>
			<span>Sort</span>
			<svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path d="M3 4L6 7L9 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>

		<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
			All tasks
		</span>
	</div>
</div>
