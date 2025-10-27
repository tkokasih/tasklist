<script lang="ts">
	import CollapsibleCard from './CollapsibleCard.svelte';
	import TaskSessionList from './TaskSessionList.svelte';
	import { selectedTask } from '$lib/stores/taskStore';
	import { formatDuration, formatTimestamp } from '$lib/core/time';
	import type { Task, TaskStatus } from '$lib/core/taskTypes';

	const statusLabels: Record<TaskStatus, string> = {
		archived: 'Archived',
		completed: 'Completed',
		idle: 'Idle',
		'in-progress': 'In progress',
		paused: 'Paused'
	};

	const statusStyles: Record<TaskStatus, string> = {
		archived: 'task-row__status--archived',
		completed: 'task-row__status--completed',
		idle: 'task-row__status--idle',
		'in-progress': 'task-row__status--active',
		paused: 'task-row__status--paused'
	};

	const formatOptionalTimestamp = (value: string | undefined) => (value ? formatTimestamp(value) : '—');

	let task: Task | null = null;

	$: task = $selectedTask;
</script>

<CollapsibleCard title="Task Details" subtitle="Focus on a task to inspect it">
	{#if task}
		<div class="space-y-4 text-sm">
			<div class="space-y-1">
				<h4 class="break-words text-base font-semibold text-slate-800">{task.title}</h4>
				{#if task.description?.trim()}
					<p class="whitespace-pre-line text-xs leading-relaxed text-slate-600">
						{task.description}
					</p>
				{:else}
					<p class="text-xs italic text-slate-400">No description yet.</p>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2 text-[11px] font-medium">
				<span class={`task-row__status ${statusStyles[task.status]}`}>
					{statusLabels[task.status]}
				</span>
				<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
					<span aria-hidden="true">⏱</span>
					{formatDuration(task.timeSpentMs)}
				</span>
				<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
					<span aria-hidden="true">🧩</span>
					{task.children.length} subtask{task.children.length === 1 ? '' : 's'}
				</span>
			</div>

			<dl class="grid grid-cols-1 gap-3 text-xs text-slate-600 sm:grid-cols-2">
				<div>
					<dt class="uppercase text-[10px] font-semibold tracking-wide text-slate-400">Created</dt>
					<dd class="mt-1 text-slate-700">{formatTimestamp(task.createdAt)}</dd>
				</div>
				<div>
					<dt class="uppercase text-[10px] font-semibold tracking-wide text-slate-400">Last updated</dt>
					<dd class="mt-1 text-slate-700">{formatTimestamp(task.updatedAt)}</dd>
				</div>
				<div>
					<dt class="uppercase text-[10px] font-semibold tracking-wide text-slate-400">Last started</dt>
					<dd class="mt-1 text-slate-700">{formatOptionalTimestamp(task.lastStartedAt)}</dd>
				</div>
				<div>
					<dt class="uppercase text-[10px] font-semibold tracking-wide text-slate-400">Archived</dt>
					<dd class="mt-1 text-slate-700">{formatOptionalTimestamp(task.archivedAt)}</dd>
				</div>
			</dl>
			<TaskSessionList {task} />
		</div>
	{:else}
		<p class="text-sm text-slate-500">
			Select a task in the list to view its current status and history here.
		</p>
	{/if}
</CollapsibleCard>
