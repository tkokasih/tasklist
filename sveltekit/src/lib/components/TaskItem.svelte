<script>
  import { onMount, tick } from 'svelte';
  import { focusTaskId, now, selectedTaskId, taskStore } from '$stores/taskStore';
  import { computeTotalTime, firstMarkdownLine, formatDuration } from '$utils/taskUtils';

  export let task;
  export let level = 0;
  export let statuses = [];
  export let activeTaskId = null;
  export let draggingId = null;
  export let dropTarget = null;
  export let onDrop;
  export let onDragStart;
  export let onDragEnd;

  let editor;
  let expanded = true;
  let descriptionValue = task.description ?? '';

  $: shouldFocus = $focusTaskId === task.id;
  $: if (shouldFocus && editor) {
    tick().then(() => {
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
      focusTaskId.set(null);
    });
  }

  $: totalMs = computeTotalTime(task.timer, $now);
  $: totalFormatted = formatDuration(totalMs);
  $: firstLineHtml = firstMarkdownLine(task.description || '');
  $: status = statuses.find((item) => item.id === task.statusId) ?? statuses[0];
  $: isSelected = $selectedTaskId === task.id;
  $: isActive = activeTaskId === task.id;

  $: if (task.description !== descriptionValue) {
    descriptionValue = task.description ?? '';
    adjustHeight();
  }

  onMount(() => {
    adjustHeight();
  });

  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const newId = taskStore.addTaskAfter(task.id);
      tick().then(() => {
        if (newId) {
          focusTaskId.set(newId);
        }
      });
    } else if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      taskStore.indentTask(task.id);
    } else if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      taskStore.unindentTask(task.id);
    }
  }

  function handleInput() {
    taskStore.updateDescription(task.id, descriptionValue);
    adjustHeight();
  }

  function selectTask() {
    selectedTaskId.set(task.id);
  }

  function toggleTimer() {
    taskStore.toggleTimer(task.id);
  }

  function handleStatusChange(event) {
    taskStore.updateStatus(task.id, event.target.value);
  }

  function toggleCollapse() {
    expanded = !expanded;
  }

  function handleDragStart(event) {
    onDragStart(task.id);
    event.dataTransfer?.setData('text/plain', task.id);
    const el = event.currentTarget.closest('.task-item');
    if (el && event.dataTransfer?.setDragImage) {
      event.dataTransfer.setDragImage(el, 16, 16);
    }
  }

  function handleDragOver(position, event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    onDrop({ taskId: task.id, position });
  }

  function handleDrop(position, event) {
    event.preventDefault();
    if (draggingId) {
      taskStore.moveTask(draggingId, task.id, position);
    }
    onDragEnd();
  }

  function adjustHeight() {
    if (!editor) return;
    editor.style.height = 'auto';
    const minHeight = 32;
    editor.style.height = `${Math.max(editor.scrollHeight, minHeight)}px`;
  }
</script>

<li
  class={`task-item level-${level} ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
  draggable="true"
  on:dragstart={handleDragStart}
  on:dragend={onDragEnd}
>
  <div
    class={`drop-zone before ${dropTarget?.taskId === task.id && dropTarget?.position === 'before' ? 'over' : ''}`}
    on:dragover={(event) => handleDragOver('before', event)}
    on:drop={(event) => handleDrop('before', event)}
  ></div>

  <div class="task-row">
    <button type="button" class="collapse" on:click={toggleCollapse} aria-label="Toggle children">
      {#if task.children.length > 0}
        {#if expanded}
          −
        {:else}
          +
        {/if}
      {:else}
        ·
      {/if}
    </button>
    <div class="status-indicator" style={`background:${status?.color ?? '#64748b'}`}></div>
    <select class="status-select" value={task.statusId} on:change={handleStatusChange}>
      {#each statuses as s}
        <option value={s.id}>{s.name}</option>
      {/each}
    </select>
    <div class="description">
      <textarea
        bind:this={editor}
        class="task-input"
        rows="1"
        bind:value={descriptionValue}
        on:keydown={handleKeydown}
        on:input={handleInput}
        on:focus={selectTask}
      ></textarea>
      <div class="preview" class:empty={!task.description}>
        {@html firstLineHtml || '<span class="placeholder">New task</span>'}
      </div>
    </div>
    <div class="timer">
      <button type="button" class={`timer-button ${isActive ? 'stop' : 'start'}`} on:click={toggleTimer}>
        {#if isActive}
          Stop
        {:else}
          Start
        {/if}
      </button>
      <span class="elapsed">{totalFormatted}</span>
    </div>
  </div>

  <div
    class={`drop-zone inside ${dropTarget?.taskId === task.id && dropTarget?.position === 'inside' ? 'over' : ''}`}
    on:dragover={(event) => handleDragOver('inside', event)}
    on:drop={(event) => handleDrop('inside', event)}
  ></div>

  <div
    class={`drop-zone after ${dropTarget?.taskId === task.id && dropTarget?.position === 'after' ? 'over' : ''}`}
    on:dragover={(event) => handleDragOver('after', event)}
    on:drop={(event) => handleDrop('after', event)}
  ></div>

  {#if expanded && task.children?.length}
    <ul class="children">
      {#each task.children as child}
        <svelte:self
          task={child}
          level={level + 1}
          {statuses}
          {activeTaskId}
          {draggingId}
          {dropTarget}
          {onDrop}
          {onDragStart}
          {onDragEnd}
        />
      {/each}
    </ul>
  {/if}
</li>

<style>
  :global(body) {
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f172a;
    color: #e2e8f0;
  }

  .task-item {
    list-style: none;
    border-radius: 0.5rem;
    margin-bottom: 0.25rem;
    background: rgba(30, 41, 59, 0.85);
    padding: 0.25rem 0;
    border: 1px solid rgba(148, 163, 184, 0.1);
  }

  .task-item.selected {
    outline: 2px solid #6366f1;
  }

  .task-item.active {
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.4);
  }

  .task-row {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.25rem 0.5rem;
  }

  .collapse {
    border: none;
    background: transparent;
    color: #cbd5f5;
    cursor: pointer;
    width: 1.5rem;
    font-size: 0.8rem;
  }

  .status-indicator {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .status-select {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 0.85rem;
    min-width: 7rem;
  }

  .description {
    position: relative;
    flex: 1;
  }

  .task-input {
    position: absolute;
    inset: 0;
    width: 100%;
    resize: none;
    padding: 0.5rem 0.75rem 0.5rem 0;
    border: none;
    background: transparent;
    color: transparent;
    caret-color: #f8fafc;
    font: inherit;
    line-height: 1.4;
    z-index: 2;
  }

  .task-input:focus {
    outline: none;
    color: #f8fafc;
    background: rgba(15, 23, 42, 0.65);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
  }

  .task-input:focus + .preview {
    display: none;
  }

  .preview {
    min-height: 1.4rem;
    padding-right: 0.75rem;
    color: #f9fafb;
    line-height: 1.4;
    pointer-events: none;
    position: relative;
    z-index: 1;
  }

  .preview.empty {
    color: rgba(148, 163, 184, 0.7);
    font-style: italic;
  }

  .preview :global(a) {
    color: #38bdf8;
  }

  .preview :global(code) {
    background: rgba(148, 163, 184, 0.15);
    padding: 0.1rem 0.3rem;
    border-radius: 0.25rem;
  }

  .placeholder {
    color: rgba(148, 163, 184, 0.6);
  }

  .timer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .timer-button {
    border: none;
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .timer-button.start {
    background: rgba(56, 189, 248, 0.2);
    color: #38bdf8;
  }

  .timer-button.stop {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .elapsed {
    font-family: 'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 0.8rem;
    color: #cbd5f5;
  }

  .children {
    margin: 0;
    padding: 0.25rem 0 0.25rem 1.5rem;
  }

  .drop-zone {
    height: 0.35rem;
    margin: 0 0.5rem;
  }

  .drop-zone.over {
    background: rgba(129, 140, 248, 0.35);
    border-radius: 999px;
  }

  .drop-zone.inside {
    height: 0.5rem;
  }
</style>
