<script lang="ts">
	import { activeProject, filteredProject, ProjectHeader, SearchFilterRibbon, SidePanel, TaskTree } from '$lib';

	$: project = $activeProject;
	$: visibleProject = $filteredProject ?? project;
	$: showFilteredEmpty =
		Boolean(project && visibleProject && project.tasks.length > 0 && visibleProject.tasks.length === 0);
	$: emptyMessage = showFilteredEmpty
		? 'No tasks match the current status filters.'
		: 'No tasks yet. Create your first task to get started.';
</script>

<main class="min-h-screen bg-slate-100 py-12">
	<div class="mx-auto flex w-full max-w-[120rem] flex-col gap-6 px-6 lg:flex-row">
		<div class="flex-1 space-y-6">
			<ProjectHeader />
			<SearchFilterRibbon />

			<section class="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-200/70">
				<header class="mb-6 flex flex-col gap-2 border-b border-slate-200 pb-4">
					<h2 class="text-2xl font-semibold text-slate-900">
						{project ? project.title : 'Your project'}
					</h2>
					<p class="text-sm text-slate-500">
						Organize work with infinitely nested tasks. Use the play button to track time, archive items you no longer
						need, and peek into details when reviewing progress.
					</p>
				</header>

				<TaskTree project={visibleProject} {emptyMessage} />
			</section>
		</div>

		<div class="w-full lg:max-w-sm">
			<SidePanel />
		</div>
	</div>
</main>
