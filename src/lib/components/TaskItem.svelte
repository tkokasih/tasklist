<script lang="ts">
import { tick } from 'svelte';
import type { Task } from '$lib/core/taskTypes';
import { formatDuration, formatTimestamp } from '$lib/core/time';
import { taskStore } from '$lib/stores/taskStore';

export let task: Task;
export let depth = 0;

let expanded = true;
let editing = false;
let draftTitle = task.title;
let showDetails = false;
let addingSubtask = false;
let subtaskTitle = '';
let titleInput: HTMLInputElement | null = null;
let subtaskInput: HTMLInputElement | null = null;

	$: state = $taskStore;
	$: isActive = state.data.activeTaskId === task.id;
	$: isPreviewed = state.previewTaskId === task.id;

$: if (!editing) {
	draftTitle = task.title;
}

$: if (editing) {
	tick().then(() => {
		titleInput?.focus();
		titleInput?.select();
	});
}

$: if (addingSubtask) {
	tick().then(() => {
		subtaskInput?.focus();
	});
}

const statusLabels: Record<Task['status'], string> = {
	archived: 'Archived',
	completed: 'Completed',
	'idle': 'Idle',
	'in-progress': 'In progress',
		paused: 'Paused'
	};

	const statusStyles: Record<Task['status'], string> = {
		archived: 'bg-slate-200 text-slate-500 border-slate-300',
		completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
		'idle': 'bg-slate-100 text-slate-600 border-slate-200',
		'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
		paused: 'bg-amber-100 text-amber-700 border-amber-200'
	};

	const indent = Math.min(depth * 1.2, 4.8);

	const toggleExpand = () => {
		if (task.children.length === 0) {
			return;
		}
		expanded = !expanded;
	};

	const handleStartOrPause = () => {
		taskStore.startTask(task.id);
	};

	const handleArchive = () => {
		taskStore.archiveTask(task.id);
	};

	const handlePeek = () => {
		showDetails = !showDetails;
		taskStore.selectPreview(isPreviewed ? null : task.id);
	};

	const commitTitle = () => {
		editing = false;
		if (draftTitle.trim() && draftTitle.trim() !== task.title.trim()) {
			taskStore.updateTaskTitle(task.id, draftTitle);
		}
	};

	const cancelEditing = () => {
		editing = false;
		draftTitle = task.title;
	};

	const submitSubtask = () => {
		if (!subtaskTitle.trim()) {
			return;
		}
		taskStore.addTask(subtaskTitle, task.id);
		subtaskTitle = '';
		addingSubtask = false;
		expanded = true;
	};
</script>

<div class="space-y-2" style={`margin-left: ${indent}rem`}>
	<div
		class={`flex items-start gap-3 rounded-lg border bg-white/70 p-4 shadow-sm transition ${
			isActive ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'
		} ${isPreviewed ? 'ring-2 ring-amber-200' : ''}`}
	>
		<button
			class={`mt-1 h-6 w-6 flex-shrink-0 rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-50 ${
				task.children.length === 0 ? 'cursor-default opacity-60' : ''
			}`}
			on:click={toggleExpand}
			aria-label={expanded ? 'Collapse task' : 'Expand task'}
			type="button"
			disabled={task.children.length === 0}
		>
			{#if task.children.length > 0}
				<span class="inline-block transition" style={`transform: rotate(${expanded ? 90 : 0}deg)`}>❯</span>
			{:else}
				<span class="inline-block">•</span>
			{/if}
		</button>

		<div class="flex w-full flex-col gap-2">
			<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
				<div class="flex flex-col gap-2">
					<div class="flex flex-wrap items-center gap-2">
						{#if editing}
							<input
								class="w-full rounded border border-blue-300 px-2 py-1 text-base shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-400 md:w-64"
								bind:value={draftTitle}
								bind:this={titleInput}
								on:blur={commitTitle}
								on:keydown={(event) => {
									if (event.key === 'Enter') {
										event.preventDefault();
										commitTitle();
									}
									if (event.key === 'Escape') {
										cancelEditing();
									}
								}}
							/>
						{:else}
							<button
								type="button"
								class="text-left text-lg font-semibold text-slate-800 hover:text-blue-600"
								on:dblclick={() => (editing = true)}
							>
								{task.title}
							</button>
						{/if}

						<span class={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[task.status]}`}>
							<span class="h-2 w-2 rounded-full bg-current opacity-70"></span>
							{statusLabels[task.status]}
						</span>

						<span class="text-sm font-medium text-slate-600">⏱ {formatDuration(task.timeSpentMs)}</span>
					</div>

					{#if showDetails}
						<div class="grid gap-1 text-xs text-slate-500 md:grid-cols-2">
							<span>
								<strong>Created:</strong> {formatTimestamp(task.createdAt)}
							</span>
							<span>
								<strong>Updated:</strong> {formatTimestamp(task.updatedAt)}
							</span>
							{#if task.lastStartedAt}
								<span>
									<strong>Last started:</strong> {formatTimestamp(task.lastStartedAt)}
								</span>
							{/if}
							{#if task.archivedAt}
								<span>
									<strong>Archived:</strong> {formatTimestamp(task.archivedAt)}
								</span>
							{/if}
						</div>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<button
						class={`rounded-full border px-3 py-1 text-sm font-medium transition ${
							isActive ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600' : 'border-blue-500 text-blue-600 hover:bg-blue-50'
						}`}
						on:click={handleStartOrPause}
						type="button"
					>
						{isActive ? 'Pause' : 'Play'}
					</button>
					<button
						class="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
						on:click={handleArchive}
						type="button"
					>
						Archive
					</button>
					<button
						class="rounded-full border border-amber-300 px-3 py-1 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
						on:click={handlePeek}
						type="button"
					>
						{showDetails ? 'Hide' : 'Peek'}
					</button>
					<div class="flex items-center gap-1">
						<button
							class="rounded-full border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-50"
							on:click={() => taskStore.moveTaskUp(task.id)}
							type="button"
							aria-label="Move task up"
						>
							↑
						</button>
						<button
							class="rounded-full border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-50"
							on:click={() => taskStore.moveTaskDown(task.id)}
							type="button"
							aria-label="Move task down"
						>
							↓
						</button>
					</div>
					<button
						class="rounded-full border border-green-400 px-3 py-1 text-sm font-medium text-green-600 transition hover:bg-green-50"
						on:click={() => taskStore.completeTask(task.id)}
						type="button"
					>
						Done
					</button>
				</div>
			</div>

			{#if addingSubtask}
				<form
					class="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-3 md:flex-row"
					on:submit|preventDefault={submitSubtask}
				>
					<input
						class="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
						placeholder="Sub-task title"
						bind:value={subtaskTitle}
						bind:this={subtaskInput}
					/>
					<div class="flex gap-2">
						<button
							class="rounded border border-blue-500 px-3 py-1 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
							type="submit"
						>
							Add
						</button>
						<button
							class="rounded border border-slate-200 px-3 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
							type="button"
							on:click={() => {
								addingSubtask = false;
								subtaskTitle = '';
							}}
						>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<button
					class="w-max rounded-full border border-dashed border-slate-200 px-3 py-1 text-sm font-medium text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
					on:click={() => {
						addingSubtask = true;
						showDetails = true;
					}}
					type="button"
				>
					+ Add sub-task
				</button>
			{/if}
		</div>
	</div>

	{#if expanded && task.children.length > 0}
		<div class="space-y-2 border-l border-slate-200 pl-6">
			{#each task.children as child (child.id)}
				<svelte:self task={child} depth={depth + 1} parentId={task.id} />
			{/each}
		</div>
	{/if}
</div>
