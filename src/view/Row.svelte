<script lang="ts">
  // A row of videos, which scrolls sideways: with a trackpad, Shift and the wheel, a finger, or its ‹ › buttons.
  import type { Snippet } from "svelte";
  import { t } from "../lib/i18n.ts";
  import type { Video } from "../lib/videos.ts";

  let { name, videos, card }: { name: string; videos: Video[]; card: Snippet<[Video]> } = $props();

  let scroller = $state<HTMLElement>();
  let atStart = $state(true);
  let atEnd = $state(true);

  /** Whether there is more to see on either side, once the row is drawn and each time it scrolls or changes. */
  function measure() {
    if (!scroller) return;
    atStart = scroller.scrollLeft <= 1;
    atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;
  }

  $effect(() => {
    void videos.length;
    measure();
    if (!scroller) return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  });

  /** Scrolls by the width of the row, less a card, so that the card at the edge stays in sight. */
  function scrollBy(direction: 1 | -1) {
    if (!scroller) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollBy({ left: direction * Math.max(scroller.clientWidth - 240, 240), behavior: reduced ? "auto" : "smooth" });
  }
</script>

<section class="wl-row" aria-label={name}>
  <header>
    <h2>{name}</h2>
    <span class="wl-count">{videos.length === 1 ? t("row_count_one") : t("row_count", { count: videos.length })}</span>
    <span class="wl-scroll">
      <button type="button" class="wl-btn" aria-label={t("scroll_back", { row: name })} disabled={atStart} onclick={() => scrollBy(-1)}>‹</button>
      <button type="button" class="wl-btn" aria-label={t("scroll_forward", { row: name })} disabled={atEnd} onclick={() => scrollBy(1)}>›</button>
    </span>
  </header>
  <ul class="wl-cards" aria-label={name} bind:this={scroller} onscroll={measure}>
    {#each videos as video (video.videoId)}
      <li>{@render card(video)}</li>
    {/each}
  </ul>
</section>

<style>
  header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    overflow-wrap: anywhere;
  }
  .wl-count {
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .wl-scroll {
    margin-left: auto;
    display: flex;
    gap: 4px;
  }
  .wl-scroll .wl-btn {
    padding: 2px 10px;
    font-size: 15px;
    line-height: 1.2;
  }
  /* A finger scrolls the row itself. */
  @media (hover: none) {
    .wl-scroll {
      display: none;
    }
  }
  .wl-cards {
    list-style: none;
    margin: 0;
    padding: 0 0 8px;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    /* No scroll snapping: after a change, the browser would snap back to the card it had snapped to, rather than show
       a video added at the start of the row. */
    overscroll-behavior-x: contain;
  }
  .wl-cards li {
    flex: 0 0 auto;
  }
</style>
