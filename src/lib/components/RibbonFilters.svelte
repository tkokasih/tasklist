<script lang="ts">
  import { DEFAULT_STATUS_FILTERS } from "$lib/core/taskTree";
  import type { TaskStatus } from "$lib/core/taskTypes";
  import { taskStore, ALL_STATUS_VALUES } from "$lib/stores/taskStore";
  import { statusFilters } from "$lib/stores/taskSelectors";
  import {
    reportingMode,
    reportingScope,
    reportingPreset,
    REPORTING_PRESETS,
    setReportingMode,
    toggleReportingScope,
    setReportingPreset,
  } from "$lib/stores/uiState";

  const clone = <T,>(values: Iterable<T>): T[] => Array.from(values);

  const STATUS_PRESETS: Array<{
    id: string;
    label: string;
    description: string;
    statuses: TaskStatus[];
  }> = [
    {
      id: "all",
      label: "All",
      description: "Show every task regardless of status.",
      statuses: clone(ALL_STATUS_VALUES),
    },
    {
      id: "active",
      label: "Active",
      description:
        "Idle, In progress, and Paused tasks that still need attention.",
      statuses: clone(DEFAULT_STATUS_FILTERS),
    },
    {
      id: "completed",
      label: "Completed",
      description: "Only finished tasks for quick review.",
      statuses: ["completed"],
    },
    {
      id: "archived",
      label: "Archived",
      description: "Long-term reference tasks moved out of the main flow.",
      statuses: ["archived"],
    },
  ];

  const findReportingPreset = (id: string) =>
    REPORTING_PRESETS.find((preset) => preset.id === id);

  $: statusSegment = (() => {
    if ($statusFilters.length === 0) {
      return "No statuses selected";
    }
    for (const preset of STATUS_PRESETS) {
      const matches =
        preset.statuses.length === $statusFilters.length &&
        preset.statuses.every((status) => $statusFilters.includes(status));
      if (matches) {
        return `${preset.label} tasks`;
      }
    }
    return `${$statusFilters.length} statuses selected`;
  })();

  $: activeReportingPreset = findReportingPreset($reportingPreset);
  $: reportingWindowLabel = activeReportingPreset?.label ?? "selected range";

  $: summaryText = (() => {
    if ($statusFilters.length === 0) {
      if ($reportingMode && $reportingScope) {
        return `Showing no tasks with activity in ${reportingWindowLabel}`;
      }
      return "Showing no tasks";
    }

    const base = `Showing ${statusSegment}`;
    if ($reportingMode && $reportingScope) {
      return `${base} with activity in ${reportingWindowLabel}`;
    }
    return base;
  })();
</script>

<div class="flex flex-wrap items-start gap-6 text-sm text-slate-600">
  <div class="flex min-w-[16rem] flex-col gap-2">
    <span class="text-xs tracking-wide text-slate-400 uppercase">Status</span>
    <span
      class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
    >
      {summaryText}
    </span>
    <div
      class="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white shadow-inner shadow-slate-200/50"
    >
      {#each STATUS_PRESETS as preset}
        {@const selected =
          preset.statuses.length === $statusFilters.length &&
          preset.statuses.every((status) => $statusFilters.includes(status))}
        <button
          type="button"
          class={`px-3 py-1 text-xs font-medium transition-colors ${
            selected
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          on:click={() => taskStore.setStatusFilters(preset.statuses)}
          aria-pressed={selected}
          title={preset.description}
        >
          {preset.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="ml-auto flex flex-col gap-2">
    <span class="text-xs tracking-wide text-slate-400 uppercase">Reporting</span>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
          $reportingMode
            ? "border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
        }`}
        on:click={() => setReportingMode(!$reportingMode)}
        aria-pressed={$reportingMode}
      >
        <span
          class="inline-flex h-5 w-9 items-center rounded-full bg-slate-200 p-0.5 transition-all"
        >
          <span
            class={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              $reportingMode ? "translate-x-4 bg-blue-500" : ""
            }`}
          ></span>
        </span>
        <span>{$reportingMode ? "On" : "Off"}</span>
      </button>
    </div>

    {#if $reportingMode}
      <div
        class="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs shadow-inner shadow-slate-200/50"
        role="group"
        aria-label="Reporting window options"
      >
        <div
          class="flex overflow-hidden rounded-full bg-slate-100/70 text-xs font-medium text-slate-600"
        >
          {#each REPORTING_PRESETS as preset}
            {@const selected = preset.id === $reportingPreset}
            <button
              type="button"
              class={`px-3 py-1 transition-colors ${
                selected
                  ? "bg-slate-900 text-white"
                  : "hover:bg-slate-200/80"
              }`}
              on:click={() => setReportingPreset(preset.id)}
              aria-pressed={selected}
              title={preset.description}
            >
              {preset.label}
            </button>
          {/each}
        </div>

        <span
          class="hidden h-5 w-px bg-slate-200 sm:block"
          aria-hidden="true"
        ></span>

        <button
          type="button"
          class={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold transition ${
            $reportingScope
              ? "border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
          }`}
          on:click={() => toggleReportingScope()}
          aria-pressed={$reportingScope}
          title="Show only tasks that have tracked time within the selected reporting window."
        >
          <span
            class={`h-2 w-2 rounded-full ${
              $reportingScope ? "bg-blue-500" : "bg-slate-300"
            }`}
          ></span>
          <span>{$reportingScope ? "In-window tasks" : "All tasks"}</span>
        </button>
      </div>
    {/if}
  </div>

  <div class="flex items-center gap-2 self-end">
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-700"
      aria-haspopup="listbox"
    >
      <span>Tags</span>
      <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M3 4L6 7L9 4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>

  <div class="flex items-center gap-2 self-end">
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-700"
      aria-haspopup="menu"
    >
      <span>Sort</span>
      <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M3 4L6 7L9 4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</div>
