<script lang="ts">
  const shortcutHint = "/";
</script>

<div class="flex flex-1 flex-wrap items-center gap-3">
  <label class="relative min-w-[16rem] flex-1">
    <span
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"
    >
      <svg
        class="h-4 w-4"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M13.5 12.5L17 16"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <path
          d="M15 8.5C15 11.5376 12.5376 14 9.5 14C6.46243 14 4 11.5376 4 8.5C4 5.46243 6.46243 3 9.5 3C12.5376 3 15 5.46243 15 8.5Z"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
    </span>
    <input
      type="search"
      name="task-search"
      class="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-700 shadow-inner shadow-slate-200/60 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none"
      placeholder="Search tasks, tags, or notes (coming soon)"
      autocomplete="off"
      spellcheck="false"
      aria-label="Search tasks (placeholder)"
    />
  </label>

  <div class="flex items-center gap-2 text-xs text-slate-500">
    <span class="hidden sm:inline">Shortcut</span>
    <kbd
      class="rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-600 shadow-sm shadow-slate-200"
    >
      {shortcutHint}
    </kbd>
  </div>
</div>
