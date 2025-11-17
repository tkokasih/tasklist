<script lang="ts">
  import { onDestroy } from "svelte";
  import { formatTimestamp } from "$lib/core/time";
  import CollapsibleCard from "./CollapsibleCard.svelte";
  import { taskStore } from "$lib/stores/taskStore";

  let snapshotName = "";
  let downloadUrl: string | null = null;
  let exportLink: HTMLAnchorElement | null = null;
  let feedback = "";

  $: state = $taskStore;

  const handleSnapshot = () => {
    taskStore.saveSnapshot(snapshotName.trim() || undefined);
    snapshotName = "";
    feedback = "Snapshot saved";
    setTimeout(() => (feedback = ""), 2500);
  };

  const handleExport = () => {
    const url = taskStore.exportData();
    if (!url) {
      feedback = "Export is only available in the browser.";
      setTimeout(() => (feedback = ""), 2500);
      return;
    }

    downloadUrl = url;

    queueMicrotask(() => {
      exportLink?.click();
      feedback = "Download started";
      setTimeout(() => (feedback = ""), 2500);
    });
  };

  const handleImport = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const [file] = input.files ?? [];
    if (!file) {
      return;
    }

    try {
      await taskStore.importFile(file);
      feedback = `Imported ${file.name}`;
      setTimeout(() => (feedback = ""), 2500);
    } catch (error) {
      console.error(error);
      feedback = "Import failed. Ensure this is a valid tasklist export.";
      setTimeout(() => (feedback = ""), 3000);
    } finally {
      input.value = "";
    }
  };

  onDestroy(() => {
    taskStore.clearExportUrl();
  });
</script>

<CollapsibleCard title="Data" subtitle="Manage snapshots and backups">
  <div class="space-y-4 text-sm text-slate-600">
    <div class="flex flex-col gap-2">
      <label
        class="text-xs font-semibold tracking-wide text-slate-500 uppercase"
        for="snapshot-name">Save snapshot</label
      >
      <div class="flex flex-col gap-2 md:flex-row">
        <input
          class="flex-1 rounded border border-slate-300 px-3 py-2 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          placeholder="Snapshot name (optional)"
          id="snapshot-name"
          bind:value={snapshotName}
        />
        <button
          class="rounded border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
          type="button"
          on:click={handleSnapshot}
        >
          Save snapshot
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <p class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Import or export data
      </p>
      <div class="flex flex-wrap gap-3">
        <button
          class="rounded border border-green-500 px-4 py-2 text-sm font-semibold text-green-600 transition hover:bg-green-50"
          type="button"
          on:click={handleExport}
        >
          Export current data
        </button>
        <label
          class="flex cursor-pointer items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <input
            class="hidden"
            type="file"
            accept="application/json"
            on:change={handleImport}
          />
          Import data file
        </label>
        {#if downloadUrl}
          <a
            class="hidden"
            download={`tasklist-${new Date().toISOString()}.json`}
            href={downloadUrl}
            bind:this={exportLink}
          >
            Download
          </a>
        {/if}
      </div>
    </div>

    {#if state.data.snapshots.length > 0}
      <div class="space-y-2">
        <p class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Snapshots
        </p>
        <ul class="space-y-3">
          {#each state.data.snapshots as snapshot (snapshot.id)}
            <li
              class="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p class="font-medium text-slate-700">{snapshot.name}</p>
                <p class="text-xs text-slate-500">
                  Saved {formatTimestamp(snapshot.createdAt)}
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  class="rounded border border-blue-500 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                  type="button"
                  on:click={() => taskStore.restoreSnapshot(snapshot.id)}
                >
                  Restore
                </button>
                <button
                  class="rounded border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:bg-rose-50"
                  type="button"
                  on:click={() => taskStore.deleteSnapshot(snapshot.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <p class="text-xs text-slate-500">
        No snapshots yet. Save one to capture the current state of your
        projects.
      </p>
    {/if}

    {#if feedback}
      <p class="text-xs font-semibold text-emerald-600">{feedback}</p>
    {/if}
  </div>
</CollapsibleCard>
