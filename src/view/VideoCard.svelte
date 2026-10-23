<script lang="ts">
  import { t } from "../lib/i18n.ts";
  import { fetchMetadata, status } from "../lib/store.svelte.ts";
  import { relativeTime, type Video } from "../lib/videos.ts";
  import { thumbnailUrl, watchUrl } from "../lib/youtube.ts";

  let {
    video,
    highlighted = false,
    onToggleWatched,
    onDetails,
  }: { video: Video; highlighted?: boolean; onToggleWatched: (video: Video) => void; onDetails: (video: Video) => void } = $props();

  const href = $derived(watchUrl(video));
  const fetching = $derived(status.fetching.includes(video.videoId));

  /** A click on the card, but on its links and buttons, opens its details. */
  function clickCard(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest("a, button")) onDetails(video);
  }
</script>

<!-- The Details button opens the details from the keyboard; a click elsewhere on the card is a shortcut for the mouse. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
  class="wl-card"
  class:wl-highlighted={highlighted}
  class:wl-watched={video.watched}
  aria-label={video.title}
  data-video-id={video.videoId}
  onclick={clickCard}
>
  <!-- Not draggable on their own: a drag moves the whole card (Row.svelte). -->
  <a class="wl-thumb" {href} target="_blank" rel="noopener" tabindex="-1" draggable="false">
    <img draggable="false" src={thumbnailUrl(video.videoId)} alt={t("thumbnail", { title: video.title })} loading="lazy" width="320" height="180" />
    {#if video.watched}
      <span class="wl-badge">{t("watched")}</span>
    {/if}
  </a>
  <a class="wl-title" {href} target="_blank" rel="noopener" draggable="false">{video.title}</a>
  {#if video.watched && video.score !== undefined}
    <span class="wl-score" role="img" aria-label={t("score_label", { score: video.score })}>{"★".repeat(video.score)}{"☆".repeat(5 - video.score)}</span>
  {/if}
  {#if video.channel}
    <p class="wl-channel">{video.channel}</p>
  {/if}
  <p class="wl-meta">
    <time datetime={video.addedAt} title={new Date(video.addedAt).toLocaleString()}>{relativeTime(video.addedAt, Date.now())}</time>
    {#if fetching}
      <span>· {t("fetching")}</span>
    {:else if video.metaStatus === "failed"}
      <button type="button" class="wl-btn" aria-label={t("meta_retry_label", { title: video.title })} onclick={() => fetchMetadata(video.videoId)}>
        {t("meta_retry")}
      </button>
    {/if}
    {#if video.note}
      <span class="wl-note-icon" role="img" aria-label={t("has_note")} title={video.note}>✎</span>
    {/if}
  </p>
  <p class="wl-actions">
    <button type="button" class="wl-btn" class:wl-on={video.watched} aria-pressed={video.watched} onclick={() => onToggleWatched(video)}>
      {t("watched")}
    </button>
    <button type="button" class="wl-btn" onclick={() => onDetails(video)}>{t("details")}</button>
  </p>
</article>

<style>
  /* On a phone, a card leaves the next one peeking in, to show that the row scrolls. */
  .wl-card {
    width: min(240px, 72vw);
    display: flex;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
  }
  .wl-thumb {
    position: relative;
    display: block;
  }
  .wl-watched .wl-thumb img {
    opacity: 0.55;
  }
  .wl-badge {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 1px 8px;
    border-radius: 999px;
    background: rgb(0 0 0 / 72%);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
  }
  .wl-badge::before {
    content: "✓ ";
  }
  .wl-actions {
    margin: 2px 0 0;
    display: flex;
    gap: 6px;
  }
  .wl-on {
    border-color: var(--accent);
    color: var(--accent-strong);
    background: var(--accent-soft);
  }
  .wl-on::before {
    content: "✓ ";
  }
  .wl-note-icon {
    cursor: help;
  }
  .wl-score {
    color: var(--score-gold);
    letter-spacing: 2px;
  }
  /* The card of a video added again, shown a moment. */
  .wl-highlighted .wl-thumb img {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .wl-thumb img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 10px;
    background: var(--panel);
  }
  .wl-title {
    color: var(--ink);
    font-weight: 600;
    text-decoration: none;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .wl-title:hover {
    color: var(--accent-strong);
    text-decoration: underline;
  }
  .wl-channel,
  .wl-meta {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }
  .wl-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
