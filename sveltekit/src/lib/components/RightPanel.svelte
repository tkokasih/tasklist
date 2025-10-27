<script>
  import {
    activeTaskId,
    backups,
    createSnapshot,
    dataHelpers,
    exportData,
    importData,
    restoreSnapshot,
    selectedTaskId,
    taskStore,
    timerHistory
  } from '$stores/taskStore';
  import { firstMarkdownLine, renderMarkdownBlock } from '$utils/taskUtils';

  let isOpen = true;
  let importInput;
  let descriptionDraft = '';

  $: selectedId = $selectedTaskId;
  $: activeId = $activeTaskId;
  $: currentTask = selectedId ? dataHelpers.getTaskById(selectedId) : null;
  $: statuses = dataHelpers.getStatuses();
  $: history = ($timerHistory ?? []).slice(0, 5);
  $: recentBackups = ($backups ?? []).slice(0, 5);

  $: if (currentTask) {
    descriptionDraft = currentTask.description ?? '';
  } else {
    descriptionDraft = '';
  }

  function togglePanel() {
    isOpen = !isOpen;
  }

  function updateDescription() {
    if (currentTask) {
      taskStore.updateDescription(currentTask.id, descriptionDraft);
    }
  }

  function updateStatus(event) {
    if (currentTask) {
      taskStore.updateStatus(currentTask.id, event.target.value);
    }
  }

  function handleTimerToggle(taskId) {
    taskStore.toggleTimer(taskId);
  }

  function snapshotTasks() {
    createSnapshot();
  }

  function exportTasks() {
    const payload = exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasklist-${new Date().toISOString()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function triggerImport() {
    importInput?.click();
  }

  function handleImport(event) {
    const [file] = event.target.files ?? [];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target.result);
        importData(parsed);
      } catch (error) {
        console.error('Failed to import tasklist', error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function restoreBackup(id) {
    restoreSnapshot(id);
  }
</script>

<aside class={`side-panel ${isOpen ? 'open' : 'collapsed'}`}>
  <button class="toggle" type="button" on:click={togglePanel}>
    {#if isOpen}
      ⟩
    {:else}
      ⟨
    {/if}
  </button>

  {#if isOpen}
    <div class="panel-content">
      <section class="panel-section">
        <header>
          <h2>Task properties</h2>
        </header>
        {#if currentTask}
          <div class="field">
            <label>Status</label>
            <select value={currentTask.statusId} on:change={updateStatus}>
              {#each statuses as status}
                <option value={status.id}>{status.name}</option>
              {/each}
            </select>
          </div>
          <div class="field">
            <label>Description</label>
            <textarea rows="6" bind:value={descriptionDraft} on:input={updateDescription}></textarea>
          </div>
          <div class="field">
            <label>Preview</label>
            <div class="markdown">
              {@html renderMarkdownBlock(descriptionDraft)}
            </div>
          </div>
        {:else}
          <p class="muted">Select a task to view its properties.</p>
        {/if}
      </section>

      <section class="panel-section">
        <header>
          <h2>Task timer</h2>
        </header>
        {#if history.length === 0}
          <p class="muted">No tasks have been activated yet.</p>
        {:else}
          <ul class="history">
            {#each history as entry}
              {#if dataHelpers.getTaskById(entry.taskId) as task}
                <li class={activeId === task.id ? 'active' : ''}>
                  <div class="title">{@html firstMarkdownLine(task.description || 'Untitled task')}</div>
                  <button type="button" on:click={() => handleTimerToggle(task.id)}>
                    {#if activeId === task.id}
                      Pause
                    {:else}
                      Resume
                    {/if}
                  </button>
                </li>
              {/if}
            {/each}
          </ul>
        {/if}
      </section>

      <section class="panel-section">
        <header>
          <h2>Tasklist data</h2>
        </header>
        <div class="actions">
          <button type="button" on:click={snapshotTasks}>Snapshot</button>
          <button type="button" on:click={exportTasks}>Export</button>
          <button type="button" on:click={triggerImport}>Import</button>
          <input
            type="file"
            accept="application/json"
            class="hidden"
            bind:this={importInput}
            on:change={handleImport}
          />
        </div>
        {#if recentBackups.length === 0}
          <p class="muted">No backups yet.</p>
        {:else}
          <ul class="backups">
            {#each recentBackups as snapshot}
              <li>
                <div>
                  <strong>{new Date(snapshot.createdAt).toLocaleString()}</strong>
                </div>
                <button type="button" on:click={() => restoreBackup(snapshot.id)}>Restore</button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}
</aside>

<style>
  .side-panel {
    width: 22rem;
    position: relative;
    transition: transform 0.3s ease;
    background: rgba(15, 23, 42, 0.85);
    border-left: 1px solid rgba(148, 163, 184, 0.2);
    backdrop-filter: blur(8px);
  }

  .side-panel.collapsed {
    transform: translateX(100%);
  }

  .toggle {
    position: absolute;
    top: 1rem;
    left: -1.75rem;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(148, 163, 184, 0.4);
    color: #cbd5f5;
    cursor: pointer;
  }

  .panel-content {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    height: 100%;
    overflow-y: auto;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: rgba(30, 41, 59, 0.75);
    border: 1px solid rgba(148, 163, 184, 0.15);
  }

  .panel-section header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(148, 163, 184, 0.8);
  }

  select,
  textarea,
  button {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    color: inherit;
    font: inherit;
  }

  textarea {
    resize: vertical;
    min-height: 6rem;
  }

  .markdown {
    min-height: 5rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .markdown :global(a) {
    color: #38bdf8;
  }

  .markdown :global(code) {
    background: rgba(148, 163, 184, 0.2);
    padding: 0.15rem 0.35rem;
    border-radius: 0.35rem;
  }

  .markdown :global(strong) {
    color: #f8fafc;
  }

  .markdown :global(em) {
    color: #cbd5f5;
  }

  .muted {
    color: rgba(148, 163, 184, 0.7);
    font-style: italic;
  }

  .history,
  .backups {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .history li,
  .backups li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .history li.active .title {
    color: #22c55e;
    font-weight: 600;
  }

  .history .title {
    flex: 1;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .hidden {
    display: none;
  }
</style>
