<script lang="ts">
	import type { Task, TaskSession } from '$lib/core/taskTypes';
	import { formatDuration } from '$lib/core/time';

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

	export let task: Task;
	export let expanded = true;
	export let hasChildren = false;
	export let editing = false;
	export let draftTitle = '';
	export let titleInput: HTMLInputElement | null = null;
	export let isActive = false;
	export let isPreviewed = false;
	export let showDetails = false;
	export let latestSession: TaskSession | null = null;
	export let activeSessionElapsed = 0;
	export let onToggleExpand: () => void = noop;
	export let onStartOrPause: () => void = noop;
	export let onArchive: () => void = noop;
	export let onPeek: () => void = noop;
export let onCommitTitle: () => void = noop;
export let onMoveUp: () => void = noop;
export let onMoveDown: () => void = noop;
export let onComplete: () => void = noop;
export let onOpenSubtaskForm: () => void = noop;
export let onTitleKeydown: (event: KeyboardEvent) => void = noop;
</script>

<div class={`task-row ${isActive ? 'task-row--active' : ''} ${isPreviewed ? 'task-row--preview' : ''}`}>
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
				<input
					class="task-row__title-input"
					bind:value={draftTitle}
					bind:this={titleInput}
					on:blur={onCommitTitle}
					on:keydown={onTitleKeydown}
				/>
			{:else}
				<button
					type="button"
					class="task-row__title"
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
					<span>Total {formatDuration(task.timeSpentMs)}</span>
				</span>
				{#if isActive && latestSession}
					<span class="inline-flex items-center gap-1 text-blue-600">
						<span aria-hidden="true">•</span>
						<span>Session {formatDuration(activeSessionElapsed)}</span>
					</span>
				{/if}
			</div>
		</div>

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
				class={`task-row__action task-row__action--warning ${showDetails ? 'is-active' : ''}`}
				type="button"
				on:click={onPeek}
			>
				<span aria-hidden="true">👁</span>
				<span class="sr-only sm:hidden">Toggle details</span>
				<span class="hidden sm:inline">{showDetails ? 'Hide' : 'Peek'}</span>
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
	</div>
</div>
