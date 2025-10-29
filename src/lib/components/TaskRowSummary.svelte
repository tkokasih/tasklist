<script lang="ts">
	import type { Task, TaskSession } from '$lib/core/taskTypes';
	import { formatDuration } from '$lib/core/time';
	import type { SessionAggregation } from '$lib/core/reporting/timeBuckets';
	import type { ReportingColumnDefinition } from '$lib/stores/uiState';

	const noop = () => {};

	const statusLabels: Record<Task['status'], string> = {
		archived: 'Archived',
		completed: 'Completed',
		idle: 'Idle',
		'in-progress': 'In progress',
		paused: 'Paused'
	};

	const statusStyles: Record<Task['status'], string> = {
		archived: 'task-row__status--archived',
		completed: 'task-row__status--completed',
		idle: 'task-row__status--idle',
		'in-progress': 'task-row__status--active',
		paused: 'task-row__status--paused'
	};

	const rowStatusStyles: Record<Task['status'], string> = {
		archived: 'task-row--archived',
		completed: 'task-row--completed',
		idle: '',
		'in-progress': '',
		paused: ''
	};

	export let task: Task;
	export let expanded = true;
	export let hasChildren = false;
export let editing = false;
export let draftContent = '';
export let titleInput: HTMLTextAreaElement | null = null;
export let isTitleMultiline = false;
export let onTitleInput: () => void = noop;
export let isActive = false;
export let isSelected = false;
export let isPreviewed = false;
export let latestSession: TaskSession | null = null;
export let activeSessionElapsed = 0;
export let onToggleExpand: () => void = noop;
export let onStartOrPause: () => void = noop;
export let onArchive: () => void = noop;
export let onCommitTitle: () => void = noop;
export let onMoveUp: () => void = noop;
export let onMoveDown: () => void = noop;
export let onComplete: () => void = noop;
export let onOpenSubtaskForm: () => void = noop;
export let onTitleKeydown: (event: KeyboardEvent) => void = noop;
export let onSelect: () => void = noop;
export let reportingMode = false;
export let reportingColumns: ReportingColumnDefinition[] = [];
export let reportingAggregation: SessionAggregation | null = null;
export let hasConcurrentSessions = false;

const placeholderDuration = '—';
const formatRangeValue = (ms: number) => (ms > 0 ? formatDuration(ms) : placeholderDuration);

$: reportingRangeTotalLabel = formatRangeValue(reportingAggregation?.totalMs ?? 0);
</script>

<div
	class={`task-row ${rowStatusStyles[task.status]} ${isActive ? 'task-row--active' : ''} ${
		isPreviewed ? 'task-row--preview' : ''
	} ${isSelected && !isActive ? 'task-row--selected' : ''} ${
		hasConcurrentSessions ? 'task-row--reporting-warning' : ''
	}`}
	aria-selected={isSelected}
	on:pointerdown={onSelect}
	on:focusin={onSelect}
>
	<button
		class="task-row__toggle"
		type="button"
		on:click={onToggleExpand}
		aria-label={expanded ? 'Collapse task' : 'Expand task'}
		disabled={!hasChildren}
	>
		{#if hasChildren}
			<span class="task-row__toggle-icon" style={`transform: rotate(${expanded ? 90 : 0}deg)`}>❯</span>
		{:else}
			<span class="task-row__toggle-icon">•</span>
		{/if}
	</button>

	<div class="flex min-w-0 flex-1 items-center gap-3">
		<div class="flex min-w-0 flex-1 items-center gap-2">
			{#if editing}
				<textarea
					class="task-row__title-input"
					bind:value={draftContent}
					bind:this={titleInput}
					on:blur={onCommitTitle}
					on:keydown={onTitleKeydown}
					on:input={onTitleInput}
					rows={isTitleMultiline ? 4 : 1}
				></textarea>
			{:else}
				<button
					type="button"
					class={`task-row__title ${
						task.status === 'completed' ? 'task-row__title--completed' : ''
					} ${task.status === 'archived' ? 'task-row__title--archived' : ''}`}
					on:dblclick={() => (editing = true)}
				>
					{task.title}
				</button>
			{/if}

			<span class={`task-row__status ${statusStyles[task.status]}`}>
				<span class="sr-only">Status:</span>
				<span class="task-row__status-dot" aria-hidden="true"></span>
				{statusLabels[task.status]}
			</span>

			<div class="task-row__timers">
				<span class="inline-flex items-center gap-1">
					<span aria-hidden="true">⏱</span>
					{#if reportingMode}
						<span>Range {reportingRangeTotalLabel}</span>
					{:else}
						<span>Total {formatDuration(task.timeSpentMs)}</span>
					{/if}
				</span>
				{#if reportingMode}
					<span class="inline-flex items-center gap-1 text-xs text-slate-500 sm:text-sm">
						<span aria-hidden="true">∞</span>
						<span>Lifetime {formatDuration(task.timeSpentMs)}</span>
					</span>
				{/if}
				{#if isActive && latestSession}
					<span class="inline-flex items-center gap-1 text-blue-600">
						<span aria-hidden="true">•</span>
						<span>Session {formatDuration(activeSessionElapsed)}</span>
					</span>
				{/if}
			</div>
		</div>

	{#if reportingMode}
		<div class="task-row__reporting" role="group" aria-label="Daily reporting breakdown">
			{#if reportingColumns.length === 0}
				<span class="task-row__reporting-empty">No reporting columns</span>
			{:else}
				{#each reportingColumns as column (column.id)}
					{@const bucketMs = reportingAggregation?.buckets?.[column.id] ?? 0}
					{@const columnValue = formatRangeValue(bucketMs)}
					<div
						class={`task-row__reporting-column ${
							column.isToday ? 'task-row__reporting-column--today' : ''
						} ${column.isWeekend ? 'task-row__reporting-column--weekend' : ''} ${
							hasConcurrentSessions && column.isToday ? 'task-row__reporting-column--warning' : ''
						}`}
						aria-label={`${column.label}: ${columnValue === placeholderDuration ? 'No time logged' : columnValue}`}
					>
						<span class="sr-only">{column.label}</span>
						<span class="task-row__reporting-column-value">{columnValue}</span>
					</div>
				{/each}
			{/if}
		</div>
	{:else}
			<div class="task-row__actions">
				<button
					class={`task-row__action task-row__action--primary ${isActive ? 'is-active' : ''}`}
					type="button"
					on:click={onStartOrPause}
				>
					{#if isActive}
						<span aria-hidden="true">⏸</span>
						<span class="hidden sm:inline">Pause</span>
						<span class="sr-only sm:hidden">Pause task</span>
					{:else}
						<span aria-hidden="true">▶</span>
						<span class="hidden sm:inline">Play</span>
						<span class="sr-only sm:hidden">Start task</span>
					{/if}
				</button>

				<button
					class="task-row__action task-row__action--success"
					type="button"
					on:click={onComplete}
				>
					<span aria-hidden="true">✔</span>
					<span class="sr-only sm:hidden">Complete task</span>
					<span class="hidden sm:inline">Done</span>
				</button>

				<button
					class="task-row__action task-row__action--ghost"
					type="button"
					on:click={onOpenSubtaskForm}
				>
					<span aria-hidden="true">＋</span>
					<span class="sr-only sm:hidden">Add sub-task</span>
					<span class="hidden sm:inline">Subtask</span>
				</button>

				<button
					class="task-row__action task-row__action--ghost"
					type="button"
					on:click={onArchive}
				>
					<span aria-hidden="true">🗃</span>
					<span class="sr-only sm:hidden">Archive task</span>
					<span class="hidden sm:inline">Archive</span>
				</button>

				<button
					class="task-row__action task-row__action--ghost"
					type="button"
					on:click={onMoveUp}
					aria-label="Move task up"
				>
					↑
				</button>

				<button
					class="task-row__action task-row__action--ghost"
					type="button"
					on:click={onMoveDown}
					aria-label="Move task down"
				>
					↓
				</button>
			</div>
		{/if}
	</div>
</div>
