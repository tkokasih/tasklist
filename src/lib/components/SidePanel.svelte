<script lang="ts">
  import ActiveTasksCard from "./ActiveTasksCard.svelte";
  import TaskDetailsCard from "./TaskDetailsCard.svelte";
  import DataCard from "./DataCard.svelte";
</script>

<aside class="flex flex-col gap-2">
  <DataCard />
  <TaskDetailsCard />
  <ActiveTasksCard />
</aside>
