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

<main class="min-h-screen bg-slate-100 py-12">
  <div class="relative mx-auto w-full max-w-[120rem] px-6">
    <div class="flex flex-col gap-6 lg:pr-[26rem]">
      <ProjectHeader />
      <SearchFilterRibbon />

      <section
        class="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-200/70"
      >
        <header class="mb-6 flex flex-col gap-2 border-b border-slate-200 pb-4">
          <h2 class="text-2xl font-semibold text-slate-900">
            {project ? project.title : "Your project"}
          </h2>
          <p class="text-sm text-slate-500">
            Organize work with infinitely nested tasks. Use the play button to
            track time, archive items you no longer need, and peek into details
            when reviewing progress.
          </p>
        </header>

        <TaskTree project={visibleProject} {emptyMessage} />
      </section>

      <div class="lg:hidden">
        <SidePanel />
      </div>
    </div>

    <div class="pointer-events-none hidden lg:block">
      <div class="pointer-events-auto fixed top-24 right-6 w-[24rem]">
        <div
          class="side-panel-shell rounded-3xl border border-slate-200 bg-white/90 shadow-xl ring-1 shadow-slate-400/10 ring-white/70"
        >
          <div
            class="side-panel-scroll max-h-[calc(100vh-6rem)] overflow-y-auto py-6 pr-4 pl-6"
          >
            <SidePanel />
          </div>
        </div>
      </div>
    </div>
  </div>
</main>
