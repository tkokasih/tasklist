<script lang="ts">
  import RibbonFilters from "./RibbonFilters.svelte";
  import RibbonSearch from "./RibbonSearch.svelte";
</script>

<section
  class="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm shadow-slate-200/50 backdrop-blur-sm"
  aria-labelledby="tasklist-search-filter-heading"
>
  <h2 id="tasklist-search-filter-heading" class="sr-only">
    Search and filter tasks
  </h2>

  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-4">
      <RibbonSearch />
    </div>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <RibbonFilters />
    </div>
  </div>
</section>
