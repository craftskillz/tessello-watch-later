<script lang="ts">
  // Tags as chips, each removed with its ×, and a field to add one, which suggests the tags in use.
  import { t } from "../lib/i18n.ts";

  let {
    label,
    tags,
    suggestions,
    onAdd,
    onRemove,
  }: { label: string; tags: readonly string[]; suggestions: readonly string[]; onAdd: (tag: string) => void; onRemove: (tag: string) => void } = $props();

  const listId = `tags-${Math.random().toString(36).slice(2)}`;
  let value = $state("");
  /** The tags in use that are not already chosen. */
  const offered = $derived(suggestions.filter((tag) => !tags.some((other) => other.toLowerCase() === tag.toLowerCase())));

  /** Adds what is typed. It is called on Enter, and when the field is left, so that a tag is never lost, as a note is not. */
  function commit() {
    if (value.trim()) onAdd(value);
    value = "";
  }

  function keydown(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  }

  /** A suggestion picked fills the field with an input that is not typed: it is added at once. */
  function input(event: Event) {
    const typed = event instanceof InputEvent && event.inputType !== "insertReplacementText";
    if (!typed && offered.includes(value)) commit();
  }
</script>

<div class="wl-tags">
  {#each tags as tag (tag)}
    <span class="wl-tag">
      {tag}
      <button type="button" aria-label={t("remove_tag", { tag })} onclick={() => onRemove(tag)}>×</button>
    </span>
  {/each}
  <input type="text" list={listId} aria-label={label} placeholder={label} autocomplete="off" bind:value onkeydown={keydown} oninput={input} onblur={commit} />
  <datalist id={listId}>
    {#each offered as tag (tag)}
      <option value={tag}></option>
    {/each}
  </datalist>
</div>

<style>
  .wl-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .wl-tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 4px 1px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-size: 12px;
  }
  .wl-tag button {
    border: 0;
    background: none;
    color: inherit;
    font-size: 14px;
    line-height: 1;
    padding: 0 4px;
    cursor: pointer;
  }
  input {
    flex: 1;
    min-width: 120px;
    padding: 5px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
  }
  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
</style>
