<script>
  import TaskItem from '$components/TaskItem.svelte';
  import { activeTaskId, focusTaskId, selectedTaskId, taskStore } from '$stores/taskStore';

  let dropTarget = null;
  let draggingId = null;

  $: state = $taskStore;
  $: tasks = state.tasks ?? [];
  $: statuses = state.statuses ?? [];
  $: activeId = $activeTaskId;

  function handleDropTarget(target) {
    dropTarget = target;
  }

  function handleDragStart(id) {
    draggingId = id;
    dropTarget = null;
  }

  function handleDragEnd() {
    draggingId = null;
    dropTarget = null;
  }

  function createRootTask() {
    const id = taskStore.addTaskAfter(null);
    if (id) {
      focusTaskId.set(id);
      selectedTaskId.set(id);
    }
  }
</script>

<section class="task-list">
  <header class="task-header">
    <h1>Tasklist</h1>
    <button class="add" type="button" on:click={createRootTask}>New Task</button>
  </header>

  {#if tasks.length === 0}
    <div class="empty-state">
      <p>No tasks yet. Press the button or use Enter on an existing task to add more.</p>
      <button class="add" type="button" on:click={createRootTask}>Create your first task</button>
    </div>
  {:else}
    <ul class="task-tree">
      {#each tasks as task (task.id)}
        <TaskItem
          {task}
          level={0}
          {statuses}
          activeTaskId={activeId}
          {draggingId}
          {dropTarget}
          onDrop={handleDropTarget}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      {/each}
    </ul>
  {/if}
</section>

<style>
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .task-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: rgba(30, 41, 59, 0.75);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .task-header h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .add {
    border: none;
    border-radius: 0.75rem;
    padding: 0.5rem 1rem;
    font-weight: 600;
    cursor: pointer;
    background: rgba(99, 102, 241, 0.2);
    color: #c7d2fe;
  }

  .task-tree {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    border-radius: 1rem;
    border: 1px dashed rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.6);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
  }
</style>
