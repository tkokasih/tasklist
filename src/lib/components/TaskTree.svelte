<script lang="ts">
	import type { Project } from '$lib/core/taskTypes';
	import { taskStore } from '$lib/stores/taskStore';
	import TaskItem from './TaskItem.svelte';

	export let project: Project | null = null;
	export let emptyMessage = 'No tasks yet. Create your first task to get started.';

	let newTaskTitle = '';

	const addRootTask = () => {
		if (!newTaskTitle.trim()) {
			return;
		}
		taskStore.addTask(newTaskTitle);
		newTaskTitle = '';
	};
</script>

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

		{#if project.tasks.length === 0}
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">{emptyMessage}</div>
		{:else}
			<div class="space-y-4">
				{#each project.tasks as task (task.id)}
					<TaskItem {task} depth={0} />
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
		No project selected.
	</div>
{/if}
