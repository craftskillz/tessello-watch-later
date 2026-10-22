<script lang="ts">
  import { tick } from "svelte";
  import { t } from "../lib/i18n.ts";
  import { droppedText } from "../lib/drop.ts";
  import { add, load, markWatched, removeAll, setCollapsed, setHideWatched, settings, status, videos } from "../lib/store.svelte.ts";
  import { allTags, holdsVideo, sectionVideos, shelfKey, shelves, type Video, withTag } from "../lib/videos.ts";
  import { ask, pending } from "../lib/confirmation.svelte.ts";
  import { movesInView } from "../lib/moving.svelte.ts";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import DetailsDialog from "./DetailsDialog.svelte";
  import Group from "./Group.svelte";
  import Row from "./Row.svelte";
  import TagInput from "./TagInput.svelte";
  import VideoCard from "./VideoCard.svelte";

  let url = $state("");
  const shown = $derived(shelves(settings.hideWatched ? videos.list.filter((video) => !video.watched) : videos.list, settings.order, settings.sections));
  const isCollapsed = (group: string) => settings.collapsed.some((other) => other.toLowerCase() === group.toLowerCase());
  /** The tags put on the videos added next, kept until the View is closed. */
  let newTags = $state<string[]>([]);
  /** The video whose details are open; they close when it is deleted. */
  let detailsId = $state<string | null>(null);
  const details = $derived(videos.list.find((video) => video.videoId === detailsId));
  /**
   * A brief message on what a change did, with a way to undo it when it hid a video, and the videos shown because
   * they were already there.
   */
  let notice = $state("");
  let undo = $state<(() => void) | null>(null);
  let highlighted = $state<string[]>([]);
  /** The elements the drag is over: a drag over an element of the View enters it before it leaves the one under it. */
  let dragDepth = $state(0);
  /** While a dialog is open, what is dropped is not added: a link dropped in the note is typed into it. */
  const dialogOpen = $derived(!!details || !!pending.question);
  const dragging = $derived(dragDepth > 0 && status.loaded && !dialogOpen);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let highlightTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Adds the videos of a text and tells the User what it did: a summary when it held several, else whether the video
   * was already there or not a video at all. Returns true when the text held a video, added or not.
   */
  function addText(text: string): boolean {
    const result = add(text, newTags);
    if (!result) return false;
    const { added, existing, ignored } = result;
    const found = added.length + existing.length;
    if (!found && ignored) void say(t("not_youtube"));
    else if (found + ignored > 1) void say(t("added_summary", { added: added.length, existing: existing.length, ignored }));
    else if (existing.length) void say(t("already_there"));
    if (existing.length) void show(existing);
    return found > 0;
  }

  /** Empties the message before saying it, so that a screen reader says it again when it is the same. */
  async function say(message: string, undoIt: (() => void) | null = null) {
    clearNotice();
    await tick();
    notice = message;
    undo = undoIt;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(clearNotice, undoIt ? 8000 : 4000);
  }

  function clearNotice() {
    notice = "";
    undo = null;
  }

  /** Chooses a tag for the videos added next, as it was first written if it is in use. */
  const chooseTag = (tag: string) => (newTags = withTag(videos.list, newTags, tag));

  /** Marks a video as watched, or as to watch. A video it hides can be brought back from the message. */
  function toggleWatched(video: Video) {
    const watched = !video.watched;
    markWatched(video.videoId, watched);
    if (watched && settings.hideWatched) {
      void say(t("marked_watched"), () => {
        markWatched(video.videoId, false);
        clearNotice();
      });
    }
  }

  /**
   * Deletes every video of a section, watched or not, once the User confirms it, told how many go and how many leave
   * other sections too.
   */
  async function deleteSection(name: string, section: { tag: string | null } | { group: string }) {
    const { videos: found, elsewhere } = sectionVideos(videos.list, section);
    if (!found.length) return;
    const count = found.length;
    const message = count === 1 ? t("delete_section_message_one", { name }) : t("delete_section_message", { name, count });
    const also = !elsewhere ? "" : count === 1 ? t("delete_section_elsewhere_single") : t("delete_section_elsewhere", { count: elsewhere });
    if (!(await ask(t("delete_section_title"), also ? `${message} ${also}` : message))) return;
    removeAll(found.map((video) => video.videoId));
  }

  /** Highlights the cards of videos a moment, and scrolls to the first. */
  async function show(videoIds: string[]) {
    highlighted = videoIds;
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => (highlighted = []), 2000);
    await tick();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .querySelector(`[data-video-id="${videoIds[0]}"]`)
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "center" });
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (addText(url)) url = "";
  }

  /** A paste in the field adds at once, when it holds a YouTube URL; anything else is pasted as text. */
  function pasteInField(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!status.loaded || !holdsVideo(text)) return;
    event.preventDefault();
    if (addText(text)) url = "";
  }

  /** Ctrl/Cmd+V anywhere in the View but in a field, or in a dialog, adds too. */
  function pasteInPage(event: ClipboardEvent) {
    const target = event.target as HTMLElement | null;
    if (dialogOpen) return;
    if (target?.closest("input[type=text], textarea, [contenteditable]")) return;
    if (addText(event.clipboardData?.getData("text/plain") ?? "")) event.preventDefault();
  }

  /**
   * Links and text may be dropped on the View; anything else, such as a file, is refused. A card or a section moved in
   * the View is left to the rows and groups (Row.svelte, Group.svelte).
   */
  const carriesText = (event: DragEvent) =>
    !movesInView(event) && !!event.dataTransfer?.types.some((type) => type === "text/uri-list" || type === "text/plain");

  function dragEnter(event: DragEvent) {
    if (carriesText(event)) dragDepth++;
  }

  function dragLeave(event: DragEvent) {
    if (carriesText(event)) dragDepth = Math.max(0, dragDepth - 1);
  }

  /**
   * The browser's own drop, which would open what is dropped in place of the View, is always prevented, but for text
   * dropped in the note of an open dialog.
   */
  function dragOver(event: DragEvent) {
    if (movesInView(event)) return;
    if (dialogOpen && carriesText(event) && (event.target as HTMLElement | null)?.closest("textarea")) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = dragging && carriesText(event) ? "copy" : "none";
  }

  /** Text that is not a video, dropped in the field, is typed into it, as a paste is. */
  function drop(event: DragEvent) {
    dragDepth = 0;
    if (movesInView(event)) return;
    const text = event.dataTransfer ? droppedText(event.dataTransfer) : "";
    const target = event.target as HTMLElement | null;
    if (dialogOpen) {
      if (!target?.closest("textarea")) event.preventDefault();
      return;
    }
    if (target?.closest("input[type=text]") && !holdsVideo(text)) return;
    event.preventDefault();
    if (text.trim()) addText(text);
    else if (status.loaded) void say(t("not_youtube"));
  }
</script>

<svelte:document onpaste={pasteInPage} ondragenter={dragEnter} ondragover={dragOver} ondragleave={dragLeave} ondrop={drop} />

<div class="wl-root">
  {#if status.loadError}
    <div class="wl-blocked" role="alert">
      <p>{status.loadError}</p>
      <button type="button" class="wl-btn" onclick={load}>{t("load_retry")}</button>
    </div>
  {:else if !status.loaded}
    <p class="wl-message">{t("loading")}</p>
  {:else}
    <form class="wl-add" onsubmit={submit}>
      <!-- Text, not url: a URL without https://, as YouTube links are often copied, would not pass the browser's check. -->
      <input type="text" inputmode="url" autocomplete="off" aria-label={t("add_label")} placeholder={t("add_label")} bind:value={url} onpaste={pasteInField} />
    </form>
    <div class="wl-new-tags">
      <TagInput
        label={t("tags_for_new")}
        tags={newTags}
        suggestions={allTags(videos.list)}
        onAdd={chooseTag}
        onRemove={(tag) => (newTags = newTags.filter((other) => other !== tag))}
      />
    </div>
    <label class="wl-switch">
      <input type="checkbox" checked={settings.hideWatched} onchange={(event) => setHideWatched(event.currentTarget.checked)} />
      {t("hide_watched")}
    </label>
    <p class="wl-notice" role="status">
      {notice}
      {#if notice && undo}
        · <button type="button" class="wl-link" onclick={undo}>{t("undo")}</button>
      {/if}
    </p>
    {#if status.saveError}
      <p class="wl-banner" role="alert">{status.saveError}</p>
    {/if}
    {#if shown.length}
      {#snippet card(video: Video)}
        <VideoCard
          {video}
          highlighted={highlighted.includes(video.videoId)}
          onToggleWatched={toggleWatched}
          onDetails={(video) => (detailsId = video.videoId)}
        />
      {/snippet}
      {#each shown as shelf (shelfKey(shelf))}
        {#if shelf.kind === "group"}
          {@const collapsed = isCollapsed(shelf.group)}
          <Group group={shelf} {collapsed} onToggle={() => setCollapsed(shelf.group, !collapsed)} onDelete={deleteSection} {card} />
        {:else}
          {@const name = shelf.tag ?? t("row_untagged")}
          <Row tag={shelf.tag} {name} videos={shelf.videos} onDelete={() => deleteSection(name, { tag: shelf.tag })} {card} />
        {/if}
      {/each}
    {:else}
      <p class="wl-message">{videos.list.length ? t("all_watched") : t("empty")}</p>
    {/if}
  {/if}
  {#if details}
    {#key details.videoId}
      <DetailsDialog video={details} onToggleWatched={toggleWatched} onClose={() => (detailsId = null)} />
    {/key}
  {/if}
  <ConfirmDialog />
  {#if dragging}
    <div class="wl-dropzone" aria-hidden="true"><p>{t("drop_here")}</p></div>
  {/if}
</div>

<style>
  .wl-root {
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .wl-add input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--ink);
    font: inherit;
    font-size: 15px;
  }
  .wl-add input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .wl-new-tags {
    margin-top: -8px;
  }
  .wl-switch {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    cursor: pointer;
  }
  .wl-switch input {
    accent-color: var(--accent);
  }
  .wl-link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-strong);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  .wl-notice {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  /* Out of sight, but still in the page, so that a screen reader hears what is said in it. */
  .wl-notice:empty {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  /* Not a target of the drag, so that moving over it does not leave the View. */
  .wl-dropzone {
    position: fixed;
    inset: 8px;
    display: grid;
    place-items: center;
    border: 2px dashed var(--accent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    pointer-events: none;
    z-index: 10;
  }
  .wl-dropzone p {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--accent-strong);
  }
  .wl-message {
    margin: 40px auto;
    color: var(--muted);
    text-align: center;
  }
  .wl-banner,
  .wl-blocked {
    margin: 0;
    padding: 10px 14px;
    border: 1px solid var(--red);
    background: var(--red-soft);
    border-radius: 10px;
    font-size: 13px;
  }
  .wl-blocked {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .wl-blocked p {
    margin: 0;
  }
</style>
