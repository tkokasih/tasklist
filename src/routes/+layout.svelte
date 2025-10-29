<script lang="ts">
  import { onMount } from "svelte";
  import { base } from "$app/paths";
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();

  onMount(() => {
    if ("serviceWorker" in navigator) {
      const serviceWorkerUrl = `${base}/service-worker.js`;
      navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
        console.error("Service worker registration failed", error);
      });
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
