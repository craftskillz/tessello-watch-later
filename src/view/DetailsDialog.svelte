<script lang="ts">
  // The details of a video: its title, channel, dates and status, its note, and its deletion.
  import { ask } from "../lib/confirmation.svelte.ts";
  import { t } from "../lib/i18n.ts";
  import { remove, tag, untag, videos, writeNote, writeScore } from "../lib/store.svelte.ts";
  import { allTags, type Video } from "../lib/videos.ts";
  import { watchUrl } from "../lib/youtube.ts";
  import Modal from "./Modal.svelte";
  import NoteInput from "./NoteInput.svelte";
  import ScoreInput from "./ScoreInput.svelte";
  import TagInput from "./TagInput.svelte";

  let { video, onToggleWatched, onClose }: { video: Video; onToggleWatched: (video: Video) => void; onClose: () => void } = $props();

  // The note being written; it is saved when the field is left, or the dialog closed.
  // svelte-ignore state_referenced_locally
  let note = $state(video.note ?? "");
  // A review dialog, or Undo, may change the saved note while these details stay open.
  const savedNote = $derived(video.note ?? "");
  $effect(() => {
    note = savedNote;
  });

  const saveNote = () => writeNote(video.videoId, note);
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString(document.documentElement.lang || undefined, { dateStyle: "long" });

  function toggleWatched() {
    saveNote();
    onToggleWatched(videos.list.find((item) => item.videoId === video.videoId) ?? video);
  }

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
      <button type="button" class="wl-btn" onclick={toggleWatched}>{video.watched ? t("mark_to_watch") : t("mark_watched")}</button>
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
  {#if video.watched}
    <div class="wl-score"><ScoreInput value={video.score} onChange={(score) => writeScore(video.videoId, score)} /></div>
  {/if}
  <NoteInput bind:value={note} onBlur={saveNote} />
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
  .wl-score {
    margin-bottom: 14px;
  }
  .wl-open {
    margin-right: auto;
    text-decoration: none;
  }
</style>
