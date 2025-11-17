<script lang="ts">
  import {
    activeProject,
    filteredProject,
    ProjectHeader,
    SearchFilterRibbon,
    SidePanel,
    TaskTree,
  } from "$lib";

  $: project = $activeProject;
  $: visibleProject = $filteredProject ?? project;
  $: showFilteredEmpty = Boolean(
    project &&
      visibleProject &&
      project.tasks.length > 0 &&
      visibleProject.tasks.length === 0,
  );
  $: emptyMessage = showFilteredEmpty
    ? "No tasks match the current status filters."
    : "No tasks yet. Create your first task to get started.";
</script>

<main class="min-h-screen bg-slate-100 py-2">
  <div class="relative mx-auto w-full max-w-[120rem] px-2">
    <div class="flex flex-col gap-1 lg:pr-[26rem]">
      <ProjectHeader />
      <SearchFilterRibbon />

      <section
        class="rounded-xl border border-slate-200 bg-white/90 p-6 pt-4 shadow-lg shadow-slate-200/70"
      >
        <TaskTree project={visibleProject} {emptyMessage} />
      </section>

      <div class="lg:hidden">
        <SidePanel />
      </div>
    </div>

    <div class="pointer-events-none hidden lg:block">
      <div class="pointer-events-auto fixed top-2 right-6 w-[24rem]">
        <div
          class="side-panel-shell rounded-l border border-slate-200 bg-white/90 shadow-xl ring-1 shadow-slate-400/10 ring-white/70"
        >
          <div
            class="side-panel-scroll max-h-[calc(100vh-1rem)] overflow-y-auto py-4 px-0.5 pr-2"
          >
            <SidePanel />
          </div>
        </div>
      </div>
    </div>
  </div>
</main>
