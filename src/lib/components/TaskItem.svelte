<script lang="ts">
	import { tick } from 'svelte';
	import type { Task } from '$lib/core/taskTypes';
	import { formatTimestamp } from '$lib/core/time';
	import { taskStore } from '$lib/stores/taskStore';
	import TaskRowSummary from './TaskRowSummary.svelte';

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
	$: latestSession = task.sessions?.length ? task.sessions[task.sessions.length - 1] : null;
	$: activeSessionElapsed =
		isActive && latestSession && !latestSession.endedAt ? Math.max(0, latestSession.durationMs) : 0;

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

	const indent = Math.min(depth * (1.1 / 3), 4.4 / 3);

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
		const nextShow = !showDetails;
		showDetails = nextShow;
		taskStore.selectPreview(nextShow ? task.id : null);
	};

	const handleMoveUp = () => {
		taskStore.moveTaskUp(task.id);
	};

	const handleMoveDown = () => {
		taskStore.moveTaskDown(task.id);
	};

	const handleComplete = () => {
		taskStore.completeTask(task.id);
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

	const openSubtaskForm = () => {
		addingSubtask = true;
		showDetails = true;
	};

	const resetSubtaskForm = () => {
		addingSubtask = false;
		subtaskTitle = '';
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
	<TaskRowSummary
		{task}
		{expanded}
		hasChildren={task.children.length > 0}
		bind:editing
		bind:draftTitle
		bind:titleInput
		{isActive}
		{isPreviewed}
		{showDetails}
		{latestSession}
		{activeSessionElapsed}
		onToggleExpand={toggleExpand}
		onStartOrPause={handleStartOrPause}
		onArchive={handleArchive}
		onPeek={handlePeek}
		onCommitTitle={commitTitle}
		onCancelEditing={cancelEditing}
		onMoveUp={handleMoveUp}
		onMoveDown={handleMoveDown}
		onComplete={handleComplete}
		onOpenSubtaskForm={openSubtaskForm}
	/>

	{#if showDetails || addingSubtask}
		<div class="task-detail-panel">
			{#if showDetails}
				<div class="task-meta-grid">
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

			{#if addingSubtask}
				<form class="task-subtask-form" on:submit|preventDefault={submitSubtask}>
					<input
						class="task-subtask-form__input"
						placeholder="Sub-task title"
						bind:value={subtaskTitle}
						bind:this={subtaskInput}
					/>
					<div class="flex items-center gap-2">
						<button class="task-row__action task-row__action--primary" type="submit">
							Add
						</button>
						<button
							class="task-row__action task-row__action--ghost"
							type="button"
							on:click={resetSubtaskForm}
						>
							Cancel
						</button>
					</div>
				</form>
			{/if}
		</div>
	{/if}

	{#if expanded && task.children.length > 0}
		<div class="space-y-2 border-l border-slate-200 pl-5">
			{#each task.children as child (child.id)}
				<svelte:self task={child} depth={depth + 1} />
			{/each}
		</div>
	{/if}
</div>
