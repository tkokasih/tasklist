<script lang="ts">
  export const ssr = false;
  export const prerender = false;

  import TaskNode from '$components/TaskNode.svelte';
  import { createTaskStore, type Task } from '$lib/stores/taskStore';
  import { formatDuration } from '$lib/utils/time';
  import { toMarkdownHtml } from '$lib/utils/markdown';
  import { onMount } from 'svelte';

  const taskStore = createTaskStore();
  const {
    tasks,
    statuses,
    selectedTaskId,
    selectedTask,
    lastActivated,
    backups,
    selectTask,
    addSibling,
    addRootTask,
    indentTask,
    outdentTask,
    moveTask,
    toggleTimer,
    stopTimer,
    updateDescription,
    updateStatus,
    toggleExpanded,
    saveSnapshot,
    importData,
    refreshBackups
  } = taskStore;

  let focusedId: string | null = null;
  let showPanel = true;
  let importError: string | null = null;
  let now = Date.now();

  $: activeTaskId = findActiveTask($tasks)?.id ?? null;
  $: activeTaskInfo = activeTaskId ? findTaskInfo($tasks, activeTaskId) : null;
  $: activeTask = activeTaskInfo?.task ?? null;

  function findTaskInfo(list: Task[], id: string, parent: Task | null = null):
    | { task: Task; parent: Task | null; index: number }
    | null {
    for (let index = 0; index < list.length; index += 1) {
      const task = list[index];
      if (task.id === id) {
        return { task, parent, index };
      }
      const child = findTaskInfo(task.children, id, task);
      if (child) return child;
    }
    return null;
  }

  function findActiveTask(list: Task[]): Task | null {
    for (const task of list) {
      if (task.activeTimerStart) return task;
      const child = findActiveTask(task.children);
      if (child) return child;
    }
    return null;
  }

  function containsTask(task: Task, id: string): boolean {
    for (const child of task.children) {
      if (child.id === id || containsTask(child, id)) {
        return true;
      }
    }
    return false;
  }

  function isDescendant(sourceId: string, targetId: string) {
    const sourceInfo = findTaskInfo($tasks, sourceId);
    if (!sourceInfo) return false;
    return containsTask(sourceInfo.task, targetId);
  }

  function handleCreateAfter(event: CustomEvent<{ taskId: string }>) {
    const newTask = addSibling(event.detail.taskId, '');
    focusedId = newTask.id;
  }

  function handleUpdateDescription(event: CustomEvent<{ taskId: string; value: string }>) {
    updateDescription(event.detail.taskId, event.detail.value);
  }

  function handleIndent(event: CustomEvent<{ taskId: string }>) {
    indentTask(event.detail.taskId);
    focusedId = event.detail.taskId;
  }

  function handleOutdent(event: CustomEvent<{ taskId: string }>) {
    outdentTask(event.detail.taskId);
    focusedId = event.detail.taskId;
  }

  function handleDrop(event: CustomEvent<{ sourceId: string; targetId: string; type: 'before' | 'after' | 'into' }>) {
    const { sourceId, targetId, type } = event.detail;
    if (sourceId === targetId) return;
    const targetInfo = findTaskInfo($tasks, targetId);
    if (!targetInfo) return;
    if (isDescendant(sourceId, targetId)) return;

    if (type === 'before') {
      const parentId = targetInfo.parent ? targetInfo.parent.id : null;
      moveTask(sourceId, parentId, targetInfo.index);
    } else if (type === 'after') {
      const parentId = targetInfo.parent ? targetInfo.parent.id : null;
      moveTask(sourceId, parentId, targetInfo.index + 1);
    } else {
      moveTask(sourceId, targetId, targetInfo.task.children.length);
    }
    focusedId = sourceId;
  }

  function handleFocus(event: CustomEvent<{ taskId: string }>) {
    focusedId = event.detail.taskId;
    selectTask(event.detail.taskId);
  }

  function handleToggleTimer(event: CustomEvent<{ taskId: string }>) {
    toggleTimer(event.detail.taskId);
  }

  function handleToggleExpanded(event: CustomEvent<{ taskId: string }>) {
    toggleExpanded(event.detail.taskId);
  }

  function handleAddRoot() {
    const newTask = addRootTask('');
    focusedId = newTask.id;
  }

  function titleForTask(task?: Task | null) {
    if (!task) return 'Untitled task';
    const firstLine = task.description.split('\n')[0]?.trim() ?? '';
    return firstLine || 'Untitled task';
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    importError = null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const success = importData(text);
      if (!success) {
        importError = 'Failed to import data. Please check the file contents.';
      } else {
        focusedId = null;
        selectTask(null);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  function handleExport() {
    const data = {
      tasks: $tasks,
      statuses: $statuses,
      selectedTaskId: $selectedTaskId,
      lastActivated: $lastActivated
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.download = `tasklist-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleSnapshot() {
    saveSnapshot();
  }

  function resumeTask(taskId: string) {
    toggleTimer(taskId);
  }

  function pauseTask(taskId: string) {
    stopTimer(taskId);
  }

  function activateTask(task: Task) {
    selectTask(task.id);
    focusedId = task.id;
  }

  onMount(() => {
    const interval = setInterval(() => {
      now = Date.now();
    }, 1000);
    if ($tasks.length && !$selectedTaskId) {
      selectTask($tasks[0].id);
    }
    return () => clearInterval(interval);
  });
</script>

<svelte:window on:keydown={(event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
    event.preventDefault();
    showPanel = !showPanel;
  }
}} />

<div class="page">
  <main class="board">
    <header class="board-header">
      <h1>Tasklist</h1>
      <div class="header-actions">
        <button on:click={handleAddRoot}>Add task</button>
        <button on:click={() => (showPanel = !showPanel)}>{showPanel ? 'Hide' : 'Show'} details</button>
      </div>
    </header>
    <section class="task-list" aria-label="Task list">
      {#if !$tasks.length}
        <p class="empty">No tasks yet. Press Enter to add a new task.</p>
      {/if}
      {#each $tasks as task}
        <TaskNode
          {task}
          level={0}
          statuses={$statuses}
          selectedId={$selectedTaskId}
          {focusedId}
          activeTaskId={activeTaskId}
          currentTime={now}
          on:create-after={handleCreateAfter}
          on:update-description={handleUpdateDescription}
          on:indent={handleIndent}
          on:outdent={handleOutdent}
          on:drop={handleDrop}
          on:focus={handleFocus}
          on:toggle-timer={handleToggleTimer}
          on:toggle-expanded={handleToggleExpanded}
        />
      {/each}
    </section>
  </main>

  <aside class={`side-panel ${showPanel ? 'open' : 'collapsed'}`}>
    <div class="panel-toggle" on:click={() => (showPanel = !showPanel)}>{showPanel ? '→' : '←'}</div>
    {#if showPanel}
      <div class="panel-content">
        <section class="panel-section">
          <h2>Task properties</h2>
          {#if $selectedTask}
            <div class="field">
              <label for="status">Status</label>
              <select
                id="status"
                value={$selectedTask.statusId}
                on:change={(event) => updateStatus($selectedTask.id, (event.target as HTMLSelectElement).value)}
              >
                {#each $statuses as status}
                  <option value={status.id}>{status.name}</option>
                {/each}
              </select>
            </div>
            <div class="field">
              <label for="description">Description</label>
              <textarea
                id="description"
                rows="6"
                value={$selectedTask.description}
                on:input={(event) => updateDescription($selectedTask.id, (event.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Preview</label>
              <div class="markdown" aria-live="polite">{@html toMarkdownHtml($selectedTask.description)}</div>
            </div>
            <div class="field">
              <label>Time spent</label>
              <div class="time-value">{formatDuration($selectedTask, now)}</div>
            </div>
          {:else}
            <p>Select a task to view its details.</p>
          {/if}
        </section>

        <section class="panel-section">
          <h2>Task timer</h2>
          {#if activeTask}
            <p class="active-indicator">Tracking time on {titleForTask(activeTask)}</p>
          {/if}
          <ul class="timer-list">
            {#each $lastActivated as taskId}
              {#if findTaskInfo($tasks, taskId)?.task as timerTask}
                <li>
                  <div>
                    <button class="link" on:click={() => activateTask(timerTask)}>{titleForTask(timerTask)}</button>
                    <div class="meta">{formatDuration(timerTask, now)}</div>
                  </div>
                  <div class="timer-actions">
                    {#if activeTaskId === timerTask.id}
                      <button on:click={() => pauseTask(timerTask.id)}>Pause</button>
                    {:else}
                      <button on:click={() => resumeTask(timerTask.id)}>Resume</button>
                    {/if}
                  </div>
                </li>
              {/if}
            {/each}
          </ul>
        </section>

        <section class="panel-section">
          <h2>Tasklist data</h2>
          <div class="field inline">
            <button on:click={handleSnapshot}>Save snapshot</button>
            <button on:click={handleExport}>Export</button>
            <label class="import-button">
              Import
              <input type="file" accept="application/json" on:change={handleFileSelect} />
            </label>
          </div>
          {#if importError}
            <p class="error">{importError}</p>
          {/if}
          <h3>Backups</h3>
          <ul class="backup-list">
            {#each $backups as backup}
              <li>
                <div>
                  <div class="meta">{new Date(backup.createdAt).toLocaleString()}</div>
                  <button on:click={() => importData(JSON.stringify(backup.data))}>Restore</button>
                </div>
              </li>
            {/each}
            {#if !$backups.length}
              <li>No backups yet.</li>
            {/if}
          </ul>
        </section>
      </div>
    {/if}
  </aside>
</div>

<style>
  :global(:root) {
    --focus-color: #2563eb;
  }

  :global(body) {
    margin: 0;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f8fafc;
    color: #0f172a;
  }

  .page {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 100vh;
  }

  .board {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .board-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  button {
    background: #1d4ed8;
    color: #fff;
    border: none;
    border-radius: 0.5rem;
    padding: 0.4rem 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }

  button:hover {
    background: #1e40af;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .empty {
    color: #64748b;
  }

  .side-panel {
    position: relative;
    background: #fff;
    border-left: 1px solid #e2e8f0;
    min-width: 22rem;
    max-width: 26rem;
    transition: transform 0.3s ease;
  }

  .side-panel.collapsed {
    transform: translateX(100%);
  }

  .panel-toggle {
    position: absolute;
    top: 0.5rem;
    left: -1.5rem;
    width: 1.5rem;
    height: 1.5rem;
    background: #1d4ed8;
    color: #fff;
    border-radius: 0.75rem 0 0 0.75rem;
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .panel-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    height: 100%;
    overflow-y: auto;
  }

  .panel-section {
    background: #f8fafc;
    border-radius: 1rem;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .panel-section h2 {
    margin: 0;
    font-size: 1rem;
    color: #1e293b;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field.inline {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  label {
    font-size: 0.85rem;
    color: #475569;
  }

  select,
  textarea {
    border: 1px solid #cbd5f5;
    border-radius: 0.5rem;
    padding: 0.5rem;
    font-family: inherit;
    font-size: 0.9rem;
  }

  textarea {
    resize: vertical;
  }

  .markdown {
    background: #fff;
    border-radius: 0.5rem;
    border: 1px solid #cbd5f5;
    padding: 0.75rem;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .markdown :global(h1),
  .markdown :global(h2),
  .markdown :global(h3) {
    margin: 0.75rem 0 0.5rem;
  }

  .markdown :global(p) {
    margin: 0.4rem 0;
  }

  .markdown :global(ul) {
    margin: 0.4rem 0 0.4rem 1rem;
  }

  .markdown :global(code) {
    background: rgba(148, 163, 184, 0.2);
    padding: 0.1rem 0.35rem;
    border-radius: 0.35rem;
  }

  .time-value {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .timer-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .timer-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .timer-actions button {
    background: #0f172a;
    padding: 0.25rem 0.75rem;
  }

  .meta {
    font-size: 0.8rem;
    color: #64748b;
  }

  .link {
    background: none;
    color: #1d4ed8;
    padding: 0;
  }

  .link:hover {
    background: none;
    text-decoration: underline;
  }

  .backup-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .backup-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
    border-radius: 0.75rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid #e2e8f0;
  }

  .backup-list button {
    background: #2563eb;
  }

  .error {
    color: #dc2626;
  }

  .import-button {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #16a34a;
  }

  .import-button input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  @media (max-width: 960px) {
    .page {
      grid-template-columns: 1fr;
    }

    .side-panel {
      position: fixed;
      right: 0;
      top: 0;
      bottom: 0;
      transform: translateX(100%);
      z-index: 20;
      box-shadow: -10px 0 30px rgba(15, 23, 42, 0.2);
    }

    .side-panel.open {
      transform: translateX(0);
    }

    .panel-toggle {
      left: -2.5rem;
    }
  }
</style>
