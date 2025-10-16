<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Task, TaskStatus } from '$lib/stores/taskStore';
  import { formatDuration } from '$lib/utils/time';

  export let task: Task;
  export let level = 0;
  export let statuses: TaskStatus[] = [];
  export let selectedId: string | null = null;
  export let focusedId: string | null = null;
  export let activeTaskId: string | null = null;
  export let currentTime = Date.now();

  const dispatch = createEventDispatcher();

  let textarea: HTMLTextAreaElement;
  let textValue = '';
  let durationLabel = formatDuration(task, currentTime);

  $: status = statuses.find((s) => s.id === task.statusId) ?? statuses[0];
  $: isSelected = selectedId === task.id;
  $: isActive = activeTaskId === task.id;
  $: if (task.description !== textValue) {
    textValue = task.description;
  }
  $: {
    currentTime;
    durationLabel = formatDuration(task, currentTime);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      dispatch('create-after', { taskId: task.id });
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      dispatch('indent', { taskId: task.id });
      return;
    }
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      dispatch('outdent', { taskId: task.id });
      return;
    }
    if (event.key === 'Enter' && event.shiftKey) {
      event.stopPropagation();
      return;
    }
  }

  function handleDrop(event: DragEvent, type: 'before' | 'after' | 'into') {
    event.preventDefault();
    event.stopPropagation();
    const sourceId = event.dataTransfer?.getData('text/plain');
    if (!sourceId || sourceId === task.id) return;
    dispatch('drop', { sourceId, targetId: task.id, type });
  }

  function handleDragStart(event: DragEvent) {
    event.dataTransfer?.setData('text/plain', task.id);
    event.dataTransfer?.setDragImage(getDragImage(), 0, 0);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    dispatch('drag-start', { taskId: task.id });
  }

  function handleDragEnd() {
    dispatch('drag-end');
  }

  function getDragImage() {
    const el = document.createElement('div');
    el.textContent = task.description.split('\n')[0] || 'Task';
    el.style.padding = '4px 8px';
    el.style.background = '#1f2937';
    el.style.color = '#fff';
    el.style.position = 'absolute';
    el.style.top = '-9999px';
    document.body.appendChild(el);
    setTimeout(() => document.body.removeChild(el), 0);
    return el;
  }

  function handleFocus() {
    dispatch('focus', { taskId: task.id });
  }

  function handleToggleTimer() {
    dispatch('toggle-timer', { taskId: task.id });
  }

  function toggleExpanded() {
    dispatch('toggle-expanded', { taskId: task.id });
  }

  function adjustHeight() {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  $: if (textarea) {
    adjustHeight();
  }

  $: if (focusedId === task.id && textarea) {
    const end = textarea.value.length;
    textarea.focus();
    textarea.setSelectionRange(end, end);
    adjustHeight();
  }

  onMount(() => {
    if (focusedId === task.id && textarea) {
      const end = textarea.value.length;
      textarea.focus();
      textarea.setSelectionRange(end, end);
      adjustHeight();
    }
  });
</script>

<div
  class={`task-node ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
  style={`--level:${level}`}
  draggable="true"
  on:dragstart={handleDragStart}
  on:dragend={handleDragEnd}
>
  <div
    class="drop-zone before"
    on:dragover|preventDefault
    on:drop={(event) => handleDrop(event, 'before')}
  ></div>
  <div class="task-row" on:click={handleFocus}>
    <button class="expand" on:click|stopPropagation={toggleExpanded} aria-label="Toggle children">
      {#if task.children.length}
        {#if task.expanded}
          ▾
        {:else}
          ▸
        {/if}
      {:else}
        •
      {/if}
    </button>
    <div class="status-indicator" style={`background:${status?.color ?? '#888'}`}></div>
    <textarea
      bind:this={textarea}
      class="task-input"
      bind:value={textValue}
      rows="1"
      on:input={() => dispatch('update-description', { taskId: task.id, value: textValue })}
      on:keydown={handleKeydown}
      on:focus={handleFocus}
    ></textarea>
    <div class="actions">
      <span class="timer">{durationLabel}</span>
      <button class={`timer-toggle ${isActive ? 'stop' : 'start'}`} on:click|stopPropagation={handleToggleTimer}>
        {isActive ? 'Stop' : 'Start'}
      </button>
    </div>
  </div>
  {#if task.expanded && task.children.length}
    <div class="children">
      {#each task.children as child}
        <svelte:self
          task={child}
          {statuses}
          {selectedId}
          {focusedId}
          {activeTaskId}
          {currentTime}
          level={level + 1}
          on:create-after
          on:indent
          on:outdent
          on:drop
          on:drag-start
          on:drag-end
          on:focus
          on:toggle-timer
          on:update-description
          on:toggle-expanded
        />
      {/each}
    </div>
  {/if}
  <div
    class="drop-zone after"
    on:dragover|preventDefault
    on:drop={(event) => handleDrop(event, 'after')}
  ></div>
  <div
    class="drop-zone into"
    on:dragover|preventDefault
    on:drop={(event) => handleDrop(event, 'into')}
  ></div>
</div>

<style>
  .task-node {
    position: relative;
    padding-left: calc(var(--level) * 1.5rem);
  }

  .task-node.selected > .task-row {
    border-color: var(--focus-color);
    background: rgba(59, 130, 246, 0.12);
  }

  .task-node.active > .task-row {
    box-shadow: inset 0 0 0 1px #10b981;
  }

  .task-row {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.35rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .task-row:hover {
    border-color: rgba(148, 163, 184, 0.6);
  }

  .expand {
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: transparent;
    font-size: 0.75rem;
    cursor: pointer;
    color: #64748b;
  }

  .status-indicator {
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 0.45rem;
    border: 1px solid rgba(15, 23, 42, 0.08);
  }

  .task-input {
    width: 100%;
    resize: none;
    border: none;
    background: transparent;
    font-size: 0.95rem;
    line-height: 1.4;
    color: #0f172a;
    padding: 0;
    font-family: inherit;
  }

  .task-input:focus {
    outline: none;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #475569;
  }

  .timer-toggle {
    border: none;
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .timer-toggle.start {
    background: #2563eb;
    color: #fff;
  }

  .timer-toggle.stop {
    background: #dc2626;
    color: #fff;
  }

  .timer {
    font-variant-numeric: tabular-nums;
  }

  .children {
    margin-left: 1.5rem;
    border-left: 1px dashed rgba(148, 163, 184, 0.4);
  }

  .drop-zone {
    position: relative;
    height: 0.35rem;
  }

  .drop-zone.before,
  .drop-zone.after {
    margin-left: calc(var(--level) * 1.5rem);
  }

  .drop-zone.into {
    margin-left: calc((var(--level) + 1) * 1.5rem);
    height: 0.4rem;
  }

  .drop-zone::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: transparent;
    transition: background 0.15s ease;
  }

  .drop-zone:hover::after,
  .drop-zone:focus::after,
  .drop-zone:active::after {
    background: rgba(59, 130, 246, 0.2);
  }
</style>
