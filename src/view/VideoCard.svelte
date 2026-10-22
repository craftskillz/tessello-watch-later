<script lang="ts">
  import { t } from "../lib/i18n.ts";
  import { fetchMetadata, status } from "../lib/store.svelte.ts";
  import { relativeTime, type Video } from "../lib/videos.ts";
  import { thumbnailUrl, watchUrl } from "../lib/youtube.ts";

  let { video }: { video: Video } = $props();

  const href = $derived(watchUrl(video));
  const fetching = $derived(status.fetching.includes(video.videoId));
</script>

<article class="wl-card" aria-label={video.title}>
  <a class="wl-thumb" {href} target="_blank" rel="noopener" tabindex="-1">
    <img src={thumbnailUrl(video.videoId)} alt={t("thumbnail", { title: video.title })} loading="lazy" width="320" height="180" />
  </a>
  <a class="wl-title" {href} target="_blank" rel="noopener">{video.title}</a>
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
  </p>
</article>

<style>
  .wl-card {
    width: 240px;
    display: flex;
    flex-direction: column;
    gap: 4px;
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
