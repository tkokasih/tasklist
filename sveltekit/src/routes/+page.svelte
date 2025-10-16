<script>
  import TaskList from '$components/TaskList.svelte';
  import RightPanel from '$components/RightPanel.svelte';

  const shortcuts = [
    { combo: 'Enter', description: 'Create a new task at the same level' },
    { combo: 'Shift + Enter', description: 'Insert a newline in the description' },
    { combo: 'Tab', description: 'Indent task to become a child of the previous task' },
    { combo: 'Shift + Tab', description: 'Un-indent task to move it up a level' }
  ];
</script>

<svelte:head>
  <title>Tasklist</title>
</svelte:head>

<div class="app-shell">
  <main>
    <section class="hero">
      <div>
        <h1>Tasklist workspace</h1>
        <p>Organize infinitely nested tasks with keyboard shortcuts, drag and drop, and per-task timers.</p>
      </div>
      <div class="shortcuts">
        {#each shortcuts as shortcut}
          <div class="shortcut">
            <span class="combo">{shortcut.combo}</span>
            <span class="text">{shortcut.description}</span>
          </div>
        {/each}
      </div>
    </section>

    <TaskList />
  </main>
  <RightPanel />
</div>

<style>
  .app-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    height: 100vh;
    overflow: hidden;
  }

  main {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow-y: auto;
  }

  .hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2rem;
    padding: 1.5rem;
    border-radius: 1rem;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(129, 140, 248, 0.1));
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .hero h1 {
    margin: 0;
    font-size: 2rem;
  }

  .hero p {
    margin: 0.5rem 0 0;
    color: rgba(226, 232, 240, 0.85);
  }

  .shortcuts {
    display: grid;
    gap: 0.75rem;
  }

  .shortcut {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(15, 23, 42, 0.4);
    padding: 0.5rem 0.75rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
  }

  .combo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.6rem;
    border-radius: 0.5rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.3);
    font-family: 'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 0.85rem;
  }

  .text {
    color: rgba(226, 232, 240, 0.85);
  }

  @media (max-width: 1100px) {
    .app-shell {
      grid-template-columns: 1fr;
    }

    main {
      padding-right: 1rem;
    }
  }
</style>
