<script lang="ts">
	import { get } from 'svelte/store';
	import type { Project } from '$lib/core/taskTypes';
	import type { SessionAggregation } from '$lib/core/reporting/timeBuckets';
import { taskStore } from '$lib/stores/taskStore';
import { statusFilters } from '$lib/stores/taskSelectors';
	import {
		createTimeAggregationSelector,
		type ReportingSelectorResult,
		type ReportingWarning
	} from '$lib/stores/reportingSelectors';
	import TaskItem from './TaskItem.svelte';
	import { reportingColumns, reportingMode, reportingRange } from '$lib/stores/uiState';

	// Render the root project task list and optionally switch into reporting mode.
	export let project: Project | null = null;
	export let emptyMessage = 'No tasks yet. Create your first task to get started.';

	let newTaskTitle = '';
	// Stable fallbacks used when reporting selectors have not produced any data yet.
	const EMPTY_TOTALS: Map<string, SessionAggregation> = new Map();
	const EMPTY_WARNINGS: ReportingWarning[] = [];
	const initialRange = get(reportingRange);
	const initialStatuses = get(statusFilters);
	// Keep a selector instance so we can reuse memoized results as filters change.
	let reportingSelector = createTimeAggregationSelector(initialRange, {
		includeArchived: initialStatuses.includes('archived'),
		includeCompleted: initialStatuses.includes('completed')
	});
	let reportingResult: ReportingSelectorResult | null = null;
	let reportingTotals: Map<string, SessionAggregation> = EMPTY_TOTALS;
	let reportingWarnings: ReportingWarning[] = EMPTY_WARNINGS;
	let concurrentTaskIds = new Set<string>();

	const addRootTask = () => {
		if (!newTaskTitle.trim()) {
			return;
		}
		taskStore.addTask(newTaskTitle);
		newTaskTitle = '';
	};

	// React to reporting controls in uiState and rebuild the selector with matching filters.
	$: isReportingMode = $reportingMode;
	$: reportingDayColumns = $reportingColumns;
	$: {
		const includeArchived = $statusFilters.includes('archived');
		const includeCompleted = $statusFilters.includes('completed');
		reportingSelector = createTimeAggregationSelector($reportingRange, {
			includeArchived,
			includeCompleted
		});
	}
	$: reportingResult = $reportingSelector;
	$: reportingTotals = reportingResult?.totals ?? EMPTY_TOTALS;
	$: reportingWarnings = reportingResult?.warnings ?? EMPTY_WARNINGS;
	// Flag any tasks that have overlapping sessions so TaskItem can surface a warning state.
	$: concurrentTaskIds = new Set(
		reportingWarnings.flatMap((warning) => (warning.type === 'concurrentSessions' ? warning.taskIds : []))
	);
</script>

<!-- TaskTree orchestrates the root-level task list, optional reporting headers, and new-task entry for a project. -->

{#if project}
	<div class="space-y-4">
		<form
			class="flex flex-col gap-2 rounded border border-dashed border-slate-300 bg-white/60 p-4 md:flex-row"
			on:submit|preventDefault={addRootTask}
		>
			<input
				class="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
				placeholder="Add a new task"
				bind:value={newTaskTitle}
			/>
			<button
				class="rounded border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
				type="submit"
			>
				Add task
			</button>
		</form>

			<div class="task-tree__header">
				<div class="task-tree__header-label">Tasks</div>
			<div
				class={`task-tree__header-columns ${isReportingMode ? '' : 'task-tree__header-columns--inactive'}`}
			>
					{#if reportingDayColumns.length === 0}
						<div class="task-tree__header-column task-tree__header-column--empty">
							<span>No reporting window</span>
						</div>
					{:else}
						{#each reportingDayColumns as column (column.id)}
							<div
								class={`task-tree__header-column ${column.isToday ? 'task-tree__header-column--today' : ''} ${
									column.isWeekend ? 'task-tree__header-column--weekend' : ''
								}`}
								title={column.label}
							>
								<span class="task-tree__header-column-day">{column.weekdayLabel}</span>
								<span class="task-tree__header-column-date">{column.dateLabel}</span>
							</div>
						{/each}
					{/if}
				</div>
			</div>

		{#if project.tasks.length === 0}
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">{emptyMessage}</div>
		{:else}
			<div class="space-y-4">
				{#each project.tasks as task (task.id)}
					<TaskItem
						{task}
						depth={0}
						reportingMode={isReportingMode}
						reportingColumns={reportingDayColumns}
						reportingTotals={reportingTotals}
						reportingConcurrentTaskIds={concurrentTaskIds}
					/>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
		No project selected.
	</div>
{/if}
