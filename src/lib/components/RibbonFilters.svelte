<script lang="ts">
  import { DEFAULT_STATUS_FILTERS } from "$lib/core/taskTree";
  import type { TaskStatus } from "$lib/core/taskTypes";
  import { taskStore, ALL_STATUS_VALUES } from "$lib/stores/taskStore";
  import { statusFilters, focusSummary } from "$lib/stores/taskSelectors";
  import {
    reportingMode,
    activityScope,
    activityRangePreset,
    ACTIVITY_RANGE_PRESETS,
    setReportingMode,
    setActivityRangePreset,
    focusMode,
    toggleFocusMode,
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

  const findActivityRangePreset = (id: string) =>
    ACTIVITY_RANGE_PRESETS.find((preset) => preset.id === id);

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

  $: activeActivityRangePreset = findActivityRangePreset($activityRangePreset);
  $: activityWindowLabel = activeActivityRangePreset?.label ?? "selected range";

  $: focusCount = $focusSummary.count;

  const formatFocusCount = (count: number) =>
    `${count} ${count === 1 ? "task" : "tasks"}`;

  $: summaryText = (() => {
    const isAllActivity = activeActivityRangePreset?.id === "all";
    const segments = [`Showing ${statusSegment}`];
    if (!isAllActivity && $activityScope) {
      segments.push(`with activity in ${activityWindowLabel}`);
    }
    if ($focusMode) {
      segments.push(`Focused only (${formatFocusCount(focusCount)})`);
    }
    return segments.join(" • ");
  })();
</script>

<div class="space-y-3 text-sm text-slate-600">
  <div class="flex flex-wrap items-end gap-4">
    <div class="flex min-w-[16rem] flex-wrap items-center gap-3">
      <span class="text-xs font-medium tracking-wide text-slate-400 uppercase"
        >Status</span
      >
      <div
        class="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white text-slate-600 shadow-inner shadow-slate-200/50"
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

    <button
      type="button"
      class={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
        $focusMode
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
      }`}
      aria-pressed={$focusMode}
      on:click={toggleFocusMode}
    >
      <span class="whitespace-nowrap">Focus Mode</span>
      <span
        class={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          $focusMode ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
        }`}
      >
        {focusCount}
      </span>
    </button>

    <div class="flex flex-wrap items-center gap-3">
      <span class="text-xs font-medium tracking-wide text-slate-400 uppercase"
        >Activity In</span
      >
      <div
        class="flex overflow-hidden rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-600 shadow-inner shadow-slate-200/50"
        role="group"
        aria-label="Activity filter options"
      >
        {#each ACTIVITY_RANGE_PRESETS as preset}
          {@const selected = preset.id === $activityRangePreset}
          <button
            type="button"
            class={`px-3 py-1 transition-colors ${
              selected ? "bg-slate-900 text-white" : "hover:bg-slate-200/80"
            }`}
            on:click={() => setActivityRangePreset(preset.id)}
            aria-pressed={selected}
            title={preset.description}
          >
            {preset.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="flex flex-col gap-2">
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

    <div class="flex flex-col gap-2">
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

    <div class="ml-auto flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium tracking-wide text-slate-600 uppercase"
        >Reporting</span
      >
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
          class="inline-flex h-4 w-7 items-center rounded-full border border-slate-300 bg-slate-200 p-0.5 transition-all"
        >
          <span
            class={`block h-3 w-3 rounded-full bg-white shadow transition-transform ${
              $reportingMode ? "translate-x-3 bg-blue-500" : ""
            }`}
          ></span>
        </span>
        <span>{$reportingMode ? "On" : "Off"}</span>
      </button>
    </div>
  </div>

  <div
    class="inline-flex items-center rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600"
  >
    {summaryText}
  </div>
</div>
