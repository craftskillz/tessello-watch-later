<script lang="ts">
  // A row of videos, which scrolls sideways: with a trackpad, Shift and the wheel, a finger, or its ‹ › buttons. A card
  // dragged onto the row is moved there, before the card under the pointer or at the end. The row itself is dragged by
  // its header, above or below the rows or groups beside it.
  import type { Snippet } from "svelte";
  import { t } from "../lib/i18n.ts";
  import { CARD_TYPE, moving, sectionTarget, startSection } from "../lib/moving.svelte.ts";
  import { move, moveSection, videos as all } from "../lib/store.svelte.ts";
  import { canMove, rowKey, type Video } from "../lib/videos.ts";

  let {
    tag,
    group = null,
    name,
    label = name,
    heading = "h2",
    videos,
    onDelete,
    card,
  }: {
    /** The tag of the row, null for the videos without a tag. */
    tag: string | null;
    /** The key of the group of the row (videos.ts `groupKey`), null at the top of the View. */
    group?: string | null;
    name: string;
    /** What a screen reader says of the row: in a group, its whole tag, since two groups may have a tag of the same name. */
    label?: string;
    /** In a group, the row is under the heading of the group. */
    heading?: "h2" | "h3";
    videos: Video[];
    /** Deletes the videos of the row, once the User confirms it. */
    onDelete: () => void;
    card: Snippet<[Video]>;
  } = $props();

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

  /** Scrolls by the width of the row. */
  function scrollBy(direction: 1 | -1) {
    if (!scroller) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollBy({ left: direction * scroller.clientWidth, behavior: reduced ? "auto" : "smooth" });
  }

  /** Where a dragged card would land: before this video, at the end when null, nowhere when undefined. */
  let target = $state<string | null | undefined>(undefined);

  /** Where a dragged section would land, beside this row. */
  let place = $state<"before" | "after" | null>(null);
  const key = $derived(rowKey(tag));

  function dragStart(event: DragEvent, video: Video) {
    if (!event.dataTransfer) return;
    // A drag that starts on the thumbnail or a link would carry its URL, which the View would add.
    event.dataTransfer.clearData();
    event.dataTransfer.setData(CARD_TYPE, video.videoId);
    event.dataTransfer.effectAllowed = "move";
    moving.card = { videoId: video.videoId, from: tag };
  }

  function dragEnd() {
    moving.card = null;
    moving.section = null;
    target = undefined;
    place = null;
  }

  /** The card whose middle is right of the pointer, or null past the last one. */
  function cardAfter(x: number): string | null {
    const items = [...(scroller?.children ?? [])];
    const index = items.findIndex((item) => {
      const { left, width } = item.getBoundingClientRect();
      return x < left + width / 2;
    });
    return index < 0 ? null : (videos[index]?.videoId ?? null);
  }

  function dragOver(event: DragEvent) {
    if (moving.section) {
      place = sectionTarget(event, key, group);
      if (!place) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      return;
    }
    const card = moving.card;
    if (!card || !canMove(all.list, card.videoId, card.from, tag)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    target = cardAfter(event.clientX);
  }

  function dragLeave(event: DragEvent) {
    if ((event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) return;
    target = undefined;
    place = null;
  }

  function drop(event: DragEvent) {
    const section = moving.section;
    if (section && place) {
      event.preventDefault();
      event.stopPropagation();
      moveSection(section.key, key, place === "after");
      dragEnd();
      return;
    }
    const card = moving.card;
    if (!card || target === undefined) return;
    // The View would take it for a link dropped to be added.
    event.preventDefault();
    event.stopPropagation();
    move(card.videoId, card.from, tag, target);
    dragEnd();
  }
</script>

<section
  class="wl-row"
  class:wl-drop-above={moving.section && place === "before"}
  class:wl-drop-below={moving.section && place === "after"}
  aria-label={label}
  ondragover={dragOver}
  ondragleave={dragLeave}
  ondrop={drop}
>
  <!-- The mouse drags the row by its header; the keyboard does not move it. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header draggable="true" ondragstart={(event) => startSection(event, key, group)} ondragend={dragEnd}>
    <span class="wl-grip" aria-hidden="true">⠿</span>
    <svelte:element this={heading} class="wl-row-name">{name}</svelte:element>
    <span class="wl-count">{videos.length === 1 ? t("row_count_one") : t("row_count", { count: videos.length })}</span>
    <button type="button" class="wl-btn wl-delete" aria-label={t("delete_section", { name: label })} onclick={onDelete}>{t("delete")}</button>
    <span class="wl-scroll">
      <button type="button" class="wl-btn" aria-label={t("scroll_back", { row: label })} disabled={atStart} onclick={() => scrollBy(-1)}>‹</button>
      <button type="button" class="wl-btn" aria-label={t("scroll_forward", { row: label })} disabled={atEnd} onclick={() => scrollBy(1)}>›</button>
    </span>
  </header>
  <ul class="wl-cards" class:wl-drop-end={moving.card && target === null} aria-label={label} bind:this={scroller} onscroll={measure}>
    {#each videos as video (video.videoId)}
      <li
        draggable="true"
        class:wl-drop-before={moving.card && target === video.videoId}
        class:wl-moving={moving.card?.videoId === video.videoId && moving.card.from === tag}
        ondragstart={(event) => dragStart(event, video)}
        ondragend={dragEnd}
      >
        {@render card(video)}
      </li>
    {/each}
  </ul>
</section>

<style>
  .wl-row {
    position: relative;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }
  .wl-row-name,
  .wl-count {
    cursor: grab;
  }
  .wl-row-name {
    margin: 0;
    font-size: 16px;
    overflow-wrap: anywhere;
  }
  .wl-count {
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .wl-delete {
    margin-left: auto;
  }
  .wl-scroll {
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
  /* The sides leave room for the mark of where a dragged card lands. */
  .wl-cards {
    list-style: none;
    margin: 0 -8px;
    padding: 0 8px 8px;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    /* No scroll snapping: after a change, the browser would snap back to the card it had snapped to, rather than show
       a video added at the start of the row. */
    overscroll-behavior-x: contain;
  }
  .wl-cards li {
    position: relative;
    flex: 0 0 auto;
  }
  .wl-moving {
    opacity: 0.4;
  }
  .wl-drop-before::before,
  .wl-drop-end li:last-child::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 2px;
    background: var(--accent);
  }
  .wl-drop-before::before {
    left: -7.5px;
  }
  .wl-drop-end li:last-child::after {
    right: -7.5px;
  }
</style>
