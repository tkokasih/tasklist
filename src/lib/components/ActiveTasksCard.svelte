<script lang="ts">
	import { formatDuration } from '$lib/core/time';
	import { activeTask, isTimerRunning, recentTasks, taskStore } from '$lib/stores/taskStore';
	import CollapsibleCard from './CollapsibleCard.svelte';

	$: current = $activeTask;
	$: running = $isTimerRunning;
	$: recents = $recentTasks;
	$: currentSession = current?.sessions?.length ? current.sessions[current.sessions.length - 1] : null;
	$: currentSessionElapsed =
		currentSession && !currentSession.endedAt ? Math.max(0, currentSession.durationMs) : 0;

	const toggleActive = () => {
		if (current) {
			taskStore.pauseActiveTask();
			return;
		}

		const next = recents[0];
		if (next) {
			taskStore.startTask(next.id);
		}
	};
</script>

<CollapsibleCard title="Active tasks" subtitle="Control playback and jump to recent work">
	<div class="space-y-4">
		<div class="flex flex-col items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center text-slate-700">
			<p class="text-xs font-semibold uppercase tracking-wide text-blue-600">Current task</p>
			{#if current}
				<h4 class="text-lg font-semibold text-slate-900">{current.title}</h4>
				<div class="flex flex-col items-center gap-1 text-sm text-slate-600">
					<p class="text-3xl font-mono font-semibold text-blue-700">{formatDuration(current.timeSpentMs)}</p>
					<p class="font-medium">Total tracked time</p>
					{#if running && currentSession}
						<p class="text-xs uppercase tracking-wide text-blue-600">
							Current session {formatDuration(currentSessionElapsed)}
						</p>
					{/if}
				</div>
				<button
					class={`rounded-full px-6 py-2 text-sm font-semibold shadow transition ${
						running ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-blue-600 text-white hover:bg-blue-700'
					}`}
					type="button"
					on:click={toggleActive}
				>
					{running ? 'Pause' : 'Resume'}
				</button>
			{:else}
				<p class="text-sm text-slate-500">No active task. Select one from the list to get started.</p>
				<button
					class="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700"
					type="button"
					on:click={toggleActive}
					disabled={recents.length === 0}
				>
					Start last task
				</button>
			{/if}
		</div>

		<div class="space-y-2">
			<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Last active tasks</p>
			{#if recents.length > 0}
				<ul class="space-y-2">
					{#each recents as task (task.id)}
						<li class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
							<div class="flex flex-col">
								<p class="text-sm font-semibold text-slate-700">{task.title}</p>
								<p class="text-xs text-slate-500">Tracked {formatDuration(task.timeSpentMs)}</p>
							</div>
							<button
								class="rounded-full border border-blue-500 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
								type="button"
								on:click={() => taskStore.startTask(task.id)}
							>
								Resume
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs text-slate-500">No history yet.</p>
			{/if}
		</div>
	</div>
</CollapsibleCard>
