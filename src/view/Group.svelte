<script lang="ts">
  // A group of tags: the rows of its tags, under a heading that folds and unfolds them. The group is dragged by its
  // heading, above or below the rows or groups beside it; its rows, by theirs, among themselves.
  import type { Snippet } from "svelte";
  import { t } from "../lib/i18n.ts";
  import { moving, sectionTarget, startSection } from "../lib/moving.svelte.ts";
  import { moveSection } from "../lib/store.svelte.ts";
  import { groupKey, splitTag, type Group, type Video } from "../lib/videos.ts";
  import Row from "./Row.svelte";

  let {
    group,
    collapsed,
    onToggle,
    onDelete,
    card,
  }: {
    group: Group;
    collapsed: boolean;
    onToggle: () => void;
    /** Deletes the videos of the group, or of one of its rows, once the User confirms it. */
    onDelete: (name: string, section: { group: string } | { tag: string | null }) => void;
    card: Snippet<[Video]>;
  } = $props();

  const id = $props.id();
  const key = $derived(groupKey(group.group));

  /** Where a dragged section would land, beside this group. */
  let place = $state<"before" | "after" | null>(null);

  function dragOver(event: DragEvent) {
    if (!moving.section) return;
    place = sectionTarget(event, key, null);
    if (!place) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  function dragLeave(event: DragEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) place = null;
  }

  function drop(event: DragEvent) {
    const section = moving.section;
    if (!section || !place) return;
    // The View would take it for a link dropped to be added.
    event.preventDefault();
    event.stopPropagation();
    moveSection(section.key, key, place === "after");
    dragEnd();
  }

  function dragEnd() {
    moving.section = null;
    place = null;
  }
</script>

<!-- A dragged section is dropped beside the group, only with the mouse. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="wl-group"
  class:wl-drop-above={moving.section && place === "before"}
  class:wl-drop-below={moving.section && place === "after"}
  ondragover={dragOver}
  ondragleave={dragLeave}
  ondrop={drop}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="wl-head" draggable="true" ondragstart={(event) => startSection(event, key, null)} ondragend={dragEnd}>
    <h2>
      <button type="button" class="wl-toggle" aria-expanded={!collapsed} aria-controls={id} onclick={onToggle}>
        <span class="wl-grip" aria-hidden="true">⠿</span>
        <span class="wl-chevron" aria-hidden="true">▸</span>
        <span class="wl-name">{group.group}</span>
        <span class="wl-count">{group.count === 1 ? t("row_count_one") : t("row_count", { count: group.count })}</span>
      </button>
    </h2>
    <button
      type="button"
      class="wl-btn wl-delete"
      aria-label={t("delete_section", { name: group.group })}
      onclick={() => onDelete(group.group, { group: group.group })}
    >
      {t("delete")}
    </button>
  </div>
  <div {id} class="wl-rows" hidden={collapsed}>
    {#if !collapsed}
      {#each group.rows as row (row.tag)}
        <Row
          tag={row.tag}
          group={key}
          name={splitTag(row.tag ?? "").name}
          label={row.tag ?? ""}
          heading="h3"
          videos={row.videos}
          onDelete={() => onDelete(row.tag ?? "", { tag: row.tag })}
          {card}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .wl-group {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .wl-head {
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 18px;
  }
  .wl-toggle {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 6px 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .wl-toggle:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .wl-chevron {
    display: inline-block;
    width: 1em;
    color: var(--muted);
    transition: transform 0.15s;
  }
  [aria-expanded="true"] .wl-chevron {
    transform: rotate(90deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .wl-chevron {
      transition: none;
    }
  }
  .wl-name {
    overflow-wrap: anywhere;
  }
  .wl-count {
    color: var(--muted);
    font-size: 12px;
    font-weight: normal;
    white-space: nowrap;
  }
  .wl-rows {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-left: 12px;
  }
  .wl-rows[hidden] {
    display: none;
  }
</style>
