<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
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

    const launchQueue = (
      window as typeof window & {
        launchQueue?: {
          setConsumer?: (consumer: (params: unknown) => void) => void;
        };
      }
    ).launchQueue;

    launchQueue?.setConsumer?.((params: unknown) => {
      const launchParams = params as
        | { targetURL?: string; url?: string }
        | undefined;

      try {
        window.focus?.();
      } catch {
        // no-op if the browser prevents programmatic focus
      }

      const nextUrl = launchParams?.targetURL ?? launchParams?.url;
      if (!nextUrl) {
        return;
      }

      let target: URL;
      try {
        target = new URL(nextUrl, window.location.href);
      } catch {
        return;
      }

      const nextPath = `${target.pathname}${target.search}${target.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) {
        return;
      }

      goto(nextPath, { replaceState: true });
    });
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
