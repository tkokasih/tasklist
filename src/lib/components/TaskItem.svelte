<script lang="ts">
	import { onMount, tick } from 'svelte';
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
	let isDraftNewTask = false;
	let wasEditing = false;
	let initialTitleSnapshot = task.title.trim();
	let pendingReapplyFocus = false;

	$: state = $taskStore;
	$: isActive = state.data.activeTaskId === task.id;
	$: isPreviewed = state.previewTaskId === task.id;
	$: latestSession = task.sessions?.length ? task.sessions[task.sessions.length - 1] : null;
	$: activeSessionElapsed =
		isActive && latestSession && !latestSession.endedAt ? Math.max(0, latestSession.durationMs) : 0;

	$: if (!editing) {
		draftTitle = task.title;
		initialTitleSnapshot = task.title.trim();
	}

	$: {
		if (editing && !wasEditing) {
			initialTitleSnapshot = draftTitle.trim();
			tick().then(() => {
				titleInput?.focus();
				titleInput?.select();
			});
		}

		wasEditing = editing;
	}
	$: if (addingSubtask) {
		tick().then(() => {
			subtaskInput?.focus();
		});
	}

	$: if (state.focusedEditorTaskId === task.id) {
		if (!editing) {
			editing = true;
		}
		if (!pendingReapplyFocus) {
			pendingReapplyFocus = true;
			tick().then(() => {
				titleInput?.focus();
				titleInput?.select();
				taskStore.clearFocusedEditor(task.id);
				pendingReapplyFocus = false;
			});
		}
	}

	const indent = Math.min(depth * (1.1 / 3), 4.4 / 3);

	onMount(() => {
		isDraftNewTask = task.title.trim().length === 0;
		if (isDraftNewTask) {
			editing = true;
		}
	});

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

const handleMoveUp = () => {
	taskStore.moveTaskUp(task.id);
};

	const handleMoveDown = () => {
		taskStore.moveTaskDown(task.id);
	};

	const handleComplete = () => {
		taskStore.completeTask(task.id);
	};

	const commitTitle = (): boolean => {
		editing = false;
		const trimmedDraft = draftTitle.trim();
		const trimmedCurrent = task.title.trim();

		if (!trimmedDraft) {
			if (isDraftNewTask) {
				taskStore.deleteTask(task.id);
			} else {
				draftTitle = task.title;
			}
			return false;
		}

		if (trimmedDraft !== trimmedCurrent) {
			taskStore.updateTaskTitle(task.id, draftTitle);
		}

		initialTitleSnapshot = trimmedDraft;
		isDraftNewTask = false;
		return true;
	};

	const cancelEditing = () => {
		const shouldRemove = isDraftNewTask && draftTitle.trim() === initialTitleSnapshot;
		editing = false;
		draftTitle = task.title;
		if (shouldRemove) {
			taskStore.deleteTask(task.id);
		}
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

	const handleTitleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
			event.preventDefault();
			const committed = commitTitle();
			if (committed) {
				taskStore.createSiblingTaskAfter(task.id);
			}
			return;
		}

		if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey && !event.altKey) {
			event.preventDefault();
			const wasEditing = editing;
			const committed = commitTitle();
			if (!committed) {
				if (wasEditing) {
					editing = true;
				}
				return;
			}

			if (event.shiftKey) {
				taskStore.outdentTask(task.id);
			} else {
				taskStore.indentTask(task.id);
			}

			if (wasEditing) {
				taskStore.focusTaskEditor(task.id);
			}

			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditing();
		}
	};
</script>

<div class="space-y-1" style={`margin-left: ${indent}rem`}>
	<TaskRowSummary
		{task}
		{expanded}
		hasChildren={task.children.length > 0}
		bind:editing
		bind:draftTitle
		bind:titleInput
		{isActive}
		{isPreviewed}
		{latestSession}
		{activeSessionElapsed}
		onToggleExpand={toggleExpand}
		onStartOrPause={handleStartOrPause}
		onArchive={handleArchive}
		onCommitTitle={commitTitle}
		onTitleKeydown={handleTitleKeydown}
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
		<div class="space-y-1 border-l border-slate-200 pl-5">
			{#each task.children as child (child.id)}
				<svelte:self task={child} depth={depth + 1} />
			{/each}
		</div>
	{/if}
</div>
