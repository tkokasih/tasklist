<script lang="ts">
  import { tick } from "svelte";
  import { APP_VERSION_DISPLAY } from "$lib/core/version";
  import { formatTimestamp } from "$lib/core/time";
  import { taskStore } from "$lib/stores/taskStore";
  import { activeProject } from "$lib/stores/taskSelectors";

  let editing = false;
  let draftTitle = "";
  let creating = false;
  let newProjectTitle = "";
  let titleInput: HTMLInputElement | null = null;
  let createInput: HTMLInputElement | null = null;

  $: project = $activeProject;
  $: state = $taskStore;

  $: if (project && !editing) {
    draftTitle = project.title;
  }

  $: if (editing) {
    tick().then(() => {
      titleInput?.focus();
      titleInput?.select();
    });
  }

  $: if (creating) {
    tick().then(() => {
      createInput?.focus();
      createInput?.select();
    });
  }

  const commitTitle = () => {
    if (!project) {
      return;
    }
    taskStore.renameProject(project.id, draftTitle);
    editing = false;
  };

  const cancelEditing = () => {
    editing = false;
    if (project) {
      draftTitle = project.title;
    }
  };

  const beginCreate = () => {
    creating = true;
    newProjectTitle = "";
  };

  const submitCreate = () => {
    taskStore.addProject(newProjectTitle.trim() || "New project");
    creating = false;
    newProjectTitle = "";
  };

  const deleteCurrent = () => {
    if (!project) {
      return;
    }

    if (state.data.projects.length <= 1) {
      return;
    }

    taskStore.deleteProject(project.id);
  };
</script>

<section
  class="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-md"
>
  <div
    class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
  >
    <div class="flex flex-col gap-2">
      {#if project}
        {#if editing}
          <input
            class="max-w-xl rounded border border-blue-300 px-3 py-2 text-2xl font-semibold text-slate-800 shadow-inner focus:ring-2 focus:ring-blue-400 focus:outline-none"
            bind:value={draftTitle}
            bind:this={titleInput}
            on:blur={commitTitle}
            on:keydown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTitle();
              }
              if (event.key === "Escape") {
                cancelEditing();
              }
            }}
          />
        {:else}
          <button
            class="text-left text-3xl font-semibold text-slate-900 hover:text-blue-600"
            type="button"
            on:click={() => (editing = true)}
          >
            {project.title}
          </button>
        {/if}
        <p class="text-sm text-slate-500">
          Last saved {state.data.lastSavedAt
            ? `on ${formatTimestamp(state.data.lastSavedAt)}`
            : "recently"}
        </p>
      {:else}
        <h1 class="text-3xl font-semibold text-slate-900">Tasklist</h1>
        <p class="text-sm text-slate-500">
          Select or create a project to begin managing tasks.
        </p>
      {/if}
      <p class="text-xs tracking-wide text-slate-400 uppercase">
        {APP_VERSION_DISPLAY}
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <select
        class="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:outline-none"
        bind:value={state.data.activeProjectId}
        on:change={(event) =>
          taskStore.setActiveProject((event.target as HTMLSelectElement).value)}
      >
        {#each state.data.projects as item (item.id)}
          <option value={item.id}>{item.title}</option>
        {/each}
      </select>

      {#if creating}
        <form
          class="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2"
          on:submit|preventDefault={submitCreate}
        >
          <input
            class="w-40 rounded border border-blue-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            placeholder="Project name"
            bind:value={newProjectTitle}
            bind:this={createInput}
          />
          <button
            class="rounded border border-blue-500 px-2 py-1 text-xs font-semibold text-blue-600"
            type="submit"
          >
            Create
          </button>
          <button
            class="rounded border border-transparent px-2 py-1 text-xs text-blue-600"
            type="button"
            on:click={() => (creating = false)}
          >
            Cancel
          </button>
        </form>
      {:else}
        <button
          class="rounded-full border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
          type="button"
          on:click={beginCreate}
        >
          + New project
        </button>
      {/if}

      <button
        class="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        type="button"
        on:click={deleteCurrent}
        disabled={state.data.projects.length <= 1}
      >
        Delete project
      </button>
    </div>
  </div>
</section>
