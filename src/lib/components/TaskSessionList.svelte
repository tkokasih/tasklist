<script lang="ts">
	import { onDestroy } from 'svelte';
	import { taskStore } from '$lib/stores/taskStore';
	import type {
		SessionMutationFailureReason,
		SessionMutationResult
	} from '$lib/stores/taskStore';
	import { formatDuration, formatTimestamp } from '$lib/core/time';
	import type { Task, TaskSession } from '$lib/core/taskTypes';

	export let task: Task | null = null;

	// Session inline editor surfaces store validation errors using readable copy.
	const failureMessages: Record<SessionMutationFailureReason, string> = {
		'task-active': 'Pause the timer before editing sessions.',
		'task-missing': 'This task is no longer available.',
		'session-missing': 'This session could not be found. It may have been removed.',
		'invalid-start': 'Start time is invalid.',
		'invalid-end': 'End time is invalid.',
		'invalid-range': 'End time must be after the start time.',
		'invalid-duration': 'Duration must be zero or greater.',
		'no-change': 'No changes detected.'
	};

	// Convert ISO timestamps into `datetime-local` inputs while respecting the local offset.
	const toLocalInputValue = (iso: string | undefined): string => {
		if (!iso) {
			return '';
		}

		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) {
			return '';
		}

		const offsetMinutes = date.getTimezoneOffset();
		const local = new Date(date.getTime() - offsetMinutes * 60_000);
		return local.toISOString().slice(0, 16);
	};

	// Track transient success/error toasts so we can fade them out after a delay.
	type NoticeState = { kind: 'success' | 'error'; message: string } | null;

	let sessions: TaskSession[] = [];
	let sortedSessions: TaskSession[] = [];
	let isActiveTask = false;
	let editingSessionId: string | null = null;
	let editStartValue = '';
	let editEndValue = '';
	let editingError: string | null = null;
	let notice: NoticeState = null;
	let noticeTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastTaskId: string | null = null;
	let isWorking = false;

	// Always clear any pending timeout before showing a new message to avoid race conditions.
	const resetNoticeTimeout = () => {
		if (noticeTimeout) {
			clearTimeout(noticeTimeout);
			noticeTimeout = null;
		}
	};

	const showNotice = (kind: 'success' | 'error', message: string) => {
		notice = { kind, message };
		if (typeof window !== 'undefined') {
			resetNoticeTimeout();
			noticeTimeout = setTimeout(() => {
				notice = null;
				noticeTimeout = null;
			}, 4000);
		}
	};

	onDestroy(() => {
		resetNoticeTimeout();
	});

	// Route store mutation results into local editing state and user feedback.
	const applyEditResult = (result: SessionMutationResult) => {
		if (result.ok) {
			editingSessionId = null;
			editingError = null;
			showNotice('success', 'Session updated.');
			return;
		}

		const message = failureMessages[result.reason];
		if (!message) {
			return;
		}

		if (
			result.reason === 'invalid-start' ||
			result.reason === 'invalid-end' ||
			result.reason === 'invalid-range' ||
			result.reason === 'invalid-duration' ||
			result.reason === 'no-change'
		) {
			editingError = message;
			return;
		}

		showNotice('error', message);
		if (result.reason === 'task-missing' || result.reason === 'session-missing') {
			editingSessionId = null;
		}
	};

	const applyDeleteResult = (result: SessionMutationResult) => {
		if (result.ok) {
			showNotice('success', 'Session deleted.');
			return;
		}

		const message = failureMessages[result.reason];
		if (!message) {
			return;
		}

		showNotice('error', message);
	};

	const beginEdit = (session: TaskSession) => {
		editingSessionId = session.id;
		editStartValue = toLocalInputValue(session.startedAt);
		editEndValue = toLocalInputValue(session.endedAt);
		editingError = null;
	};

	const cancelEdit = () => {
		editingSessionId = null;
		editingError = null;
	};

	// Push validated updates through the store with lightweight client-side guards.
	const saveSession = () => {
		if (!task || !editingSessionId) {
			return;
		}

		const trimmedStart = editStartValue.trim();
		const trimmedEnd = editEndValue.trim();

		if (!trimmedStart) {
			editingError = 'Start time is required.';
			return;
		}

		const startMs = Date.parse(trimmedStart);
		if (Number.isNaN(startMs)) {
			editingError = 'Start time is invalid.';
			return;
		}

		if (trimmedEnd) {
			const endMs = Date.parse(trimmedEnd);
			if (Number.isNaN(endMs)) {
				editingError = 'End time is invalid.';
				return;
			}
			if (endMs < startMs) {
				editingError = 'End time must be after the start time.';
				return;
			}
		}

		isWorking = true;
		const result = taskStore.updateSession(task.id, editingSessionId, {
			startedAt: trimmedStart,
			endedAt: trimmedEnd ? trimmedEnd : null
		});
		isWorking = false;
		applyEditResult(result);
	};

	const deleteSession = (session: TaskSession) => {
		if (!task || typeof window === 'undefined') {
			return;
		}

		const confirmed = window.confirm('Delete this session? This action cannot be undone.');
		if (!confirmed) {
			return;
		}

		const result = taskStore.deleteSession(task.id, session.id);
		if (editingSessionId === session.id && result.ok) {
			editingSessionId = null;
		}
		applyDeleteResult(result);
	};

	const formatSessionDuration = (session: TaskSession) => formatDuration(Math.max(0, session.durationMs));

	$: sessions = task?.sessions ?? [];
	$: sortedSessions = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	$: isActiveTask = Boolean(task && $taskStore.data.activeTaskId === task.id);
	// Reset editing/notice state any time the selected task changes.
	$: {
		if ((task?.id ?? null) !== lastTaskId) {
			lastTaskId = task?.id ?? null;
			editingSessionId = null;
			editingError = null;
			notice = null;
			resetNoticeTimeout();
		}
	}
	// Close the editor if the session was removed externally.
	$: {
		if (
			editingSessionId &&
			!sessions.some((session) => session.id === editingSessionId)
		) {
			editingSessionId = null;
			editingError = null;
		}
	}
</script>

<!-- TaskSessionList lets users inspect, edit, or delete the individual timer sessions for the selected task. -->

{#if notice}
	<!-- Surface mutation feedback inline so editors understand what just happened. -->
	<div
		class={`rounded-md border px-3 py-2 text-xs ${notice.kind === 'success'
			? 'border-emerald-200 bg-emerald-50 text-emerald-700'
			: 'border-red-200 bg-red-50 text-red-600'}`}
	>
		{notice.message}
	</div>
{/if}

{#if isActiveTask}
	<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
		Pause the timer before editing or deleting sessions.
	</div>
{/if}

<div class="space-y-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h5 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Sessions</h5>
		{#if sortedSessions.length > 0}
			<span class="text-[11px] text-slate-400">
				{sortedSessions.length} {sortedSessions.length === 1 ? 'entry' : 'entries'}
			</span>
		{/if}
	</div>

	{#if sortedSessions.length === 0}
		<p class="text-xs italic text-slate-400">No sessions recorded yet.</p>
	{:else}
		<div class="space-y-2">
			{#each sortedSessions as session (session.id)}
				<div class="rounded-md border border-slate-200 bg-white/70 px-3 py-2 shadow-sm">
					{#if editingSessionId === session.id}
						<form class="space-y-3" on:submit|preventDefault={saveSession}>
							<div class="grid gap-3 sm:grid-cols-2">
								<label class="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
									<span class="text-[10px] text-slate-400">Started</span>
									<input
										class="rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										type="datetime-local"
										bind:value={editStartValue}
										required
										aria-label="Session start time"
									/>
								</label>
								<label class="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
									<span class="text-[10px] text-slate-400">Ended</span>
									<input
										class="rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										type="datetime-local"
										bind:value={editEndValue}
										aria-label="Session end time"
									/>
								</label>
							</div>
							{#if editingError}
								<p class="text-xs text-red-600">{editingError}</p>
							{/if}
							<div class="flex flex-wrap items-center gap-2 text-xs">
								<button
									class="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-400"
									type="submit"
									disabled={isWorking}
								>
									{#if isWorking}
										Saving…
									{:else}
										Save
									{/if}
								</button>
								<button
									class="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1 font-semibold text-slate-600"
									type="button"
									on:click={cancelEdit}
								>
									Cancel
								</button>
							</div>
						</form>
					{:else}
						<div class="space-y-2 text-xs text-slate-600">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="space-y-1">
									<div class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
										Started
									</div>
									<div class="text-sm font-medium text-slate-700">
										{formatTimestamp(session.startedAt)}
									</div>
								</div>
								<div class="space-y-1 text-right">
									<div class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
										Ended
									</div>
									<div class="text-sm font-medium text-slate-700">
										{session.endedAt ? formatTimestamp(session.endedAt) : 'Active'}
									</div>
								</div>
							</div>
							<div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
								<span>Duration {formatSessionDuration(session)}</span>
								<div class="flex gap-2">
									<button
										class="text-blue-600 hover:text-blue-500 disabled:cursor-not-allowed disabled:text-slate-300"
										type="button"
										on:click={() => beginEdit(session)}
										disabled={isActiveTask}
									>
										Edit
									</button>
									<button
										class="text-red-600 hover:text-red-500 disabled:cursor-not-allowed disabled:text-slate-300"
										type="button"
										on:click={() => deleteSession(session)}
										disabled={isActiveTask}
									>
										Delete
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
