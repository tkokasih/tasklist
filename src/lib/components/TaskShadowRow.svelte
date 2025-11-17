<script lang="ts">
  const clampIndent = (depth: number) => Math.min(depth * 0.1, 0.4);

  export let depth = 0;

  const indent = clampIndent(depth);
</script>

<div class="mb-0 space-y-0" style={`margin-left: ${indent}rem`}>
  <div class="task-shadow-row" aria-hidden="true">
    <div class="task-shadow-row__track">
      <div class="task-shadow-row__pill task-shadow-row__pill--wide"></div>
      <div class="task-shadow-row__pill task-shadow-row__pill--narrow"></div>
    </div>
  </div>
</div>
