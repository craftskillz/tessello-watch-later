<script lang="ts">
  // The details of a video: its title, channel, dates and status, its note, and its deletion.
  import { ask } from "../lib/confirmation.svelte.ts";
  import { t } from "../lib/i18n.ts";
  import { remove, tag, untag, videos, writeNote } from "../lib/store.svelte.ts";
  import { allTags, NOTE_MAX, type Video } from "../lib/videos.ts";
  import { watchUrl } from "../lib/youtube.ts";
  import Modal from "./Modal.svelte";
  import TagInput from "./TagInput.svelte";

  let { video, onToggleWatched, onClose }: { video: Video; onToggleWatched: (video: Video) => void; onClose: () => void } = $props();

  // The note being written; it is saved when the field is left, or the dialog closed.
  // svelte-ignore state_referenced_locally
  let note = $state(video.note ?? "");

  const saveNote = () => writeNote(video.videoId, note);
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString(document.documentElement.lang || undefined, { dateStyle: "long" });

  function close() {
    saveNote();
    onClose();
  }

  async function confirmDelete() {
    saveNote();
    if (!(await ask(t("delete_title"), t("delete_message", { title: video.title })))) return;
    remove(video.videoId);
    onClose();
  }
</script>

<Modal open title={video.title} onClose={close}>
  <dl class="wl-facts">
    {#if video.channel}
      <dt>{t("channel")}</dt>
      <dd>{video.channel}</dd>
    {/if}
    <dt>{t("added")}</dt>
    <dd><time datetime={video.addedAt}>{dateOf(video.addedAt)}</time></dd>
    <dt>{t("status")}</dt>
    <dd>
      {#if video.watched}
        {video.watchedAt ? t("watched_on", { date: dateOf(video.watchedAt) }) : t("watched")}
      {:else}
        {t("to_watch")}
      {/if}
      <button type="button" class="wl-btn" onclick={() => onToggleWatched(video)}>{video.watched ? t("mark_to_watch") : t("mark_watched")}</button>
    </dd>
    <dt>{t("tags")}</dt>
    <dd>
      <TagInput
        label={t("add_tag")}
        tags={video.tags}
        suggestions={allTags(videos.list)}
        onAdd={(name) => tag(video.videoId, name)}
        onRemove={(name) => untag(video.videoId, name)}
      />
    </dd>
  </dl>
  <label class="wl-note">
    <span>{t("note")}</span>
    <textarea bind:value={note} maxlength={NOTE_MAX} rows="4" placeholder={t("note_placeholder")} onblur={saveNote}></textarea>
    <small>{note.length} / {NOTE_MAX}</small>
  </label>
  {#snippet actions()}
    <a class="wl-btn wl-open" href={watchUrl(video)} target="_blank" rel="noopener">{t("open_on_youtube")}</a>
    <button type="button" class="wl-btn wl-btn--danger-outline" onclick={confirmDelete}>{t("delete")}</button>
    <button type="button" class="wl-btn wl-btn--primary" onclick={close}>{t("close")}</button>
  {/snippet}
</Modal>

<style>
  .wl-facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 14px;
    margin: 0 0 14px;
    font-size: 13px;
  }
  .wl-facts dt {
    color: var(--muted);
  }
  .wl-facts dd {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .wl-note {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }
  .wl-note textarea {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    resize: vertical;
  }
  .wl-note textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .wl-note small {
    align-self: flex-end;
  }
  .wl-open {
    margin-right: auto;
    text-decoration: none;
  }
</style>
