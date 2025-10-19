<script lang="ts">
import { DEFAULT_STATUS_FILTERS } from '$lib/core/taskTree';
import type { TaskStatus } from '$lib/core/taskTypes';
import { ALL_STATUS_VALUES, statusFilters, taskStore } from '$lib/stores/taskStore';

const clone = <T>(values: Iterable<T>): T[] => Array.from(values);

	const STATUS_PRESETS: Array<{
		id: string;
		label: string;
		description: string;
		statuses: TaskStatus[];
	}> = [
		{
			id: 'all',
			label: 'All',
			description: 'Show every task regardless of status.',
			statuses: clone(ALL_STATUS_VALUES)
		},
		{
			id: 'active',
			label: 'Active',
			description: 'Idle, In progress, and Paused tasks that still need attention.',
			statuses: clone(DEFAULT_STATUS_FILTERS)
		},
		{
			id: 'completed',
			label: 'Completed',
			description: 'Only finished tasks for quick review.',
			statuses: ['completed']
		},
		{
			id: 'archived',
			label: 'Archived',
			description: 'Long-term reference tasks moved out of the main flow.',
			statuses: ['archived']
		}
	];

	const timeWindows = [
		{ label: 'Any time', active: true },
		{ label: 'Past week', active: false },
		{ label: 'Past month', active: false }
	];

	$: statusSummary = (() => {
		if ($statusFilters.length === 0) {
			return 'No statuses';
		}
		for (const preset of STATUS_PRESETS) {
			const matches = preset.statuses.length === $statusFilters.length &&
				preset.statuses.every((status) => $statusFilters.includes(status));
			if (matches) {
				return `${preset.label} tasks`;
			}
		}
		return `${$statusFilters.length} statuses selected`;
	})();
</script>

<div class="flex flex-wrap items-center justify-end gap-3 text-sm text-slate-600">
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-xs uppercase tracking-wide text-slate-400">Status</span>
		<div class="flex overflow-hidden rounded-full border border-slate-200 bg-white shadow-inner shadow-slate-200/50">
			{#each STATUS_PRESETS as preset}
				{@const selected =
					preset.statuses.length === $statusFilters.length &&
					preset.statuses.every((status) => $statusFilters.includes(status))}
				<button
					type="button"
					class={`px-3 py-1 text-xs font-medium transition-colors ${
						selected ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
					}`}
					on:click={() => taskStore.setStatusFilters(preset.statuses)}
					aria-pressed={selected}
					title={preset.description}
				>
					{preset.label}
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
			{statusSummary}
		</span>
	</div>
</div>
