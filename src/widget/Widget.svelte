<script lang="ts">
  import type { ConnectedModule } from "@tessello/sdk";
  import { onMount } from "svelte";
  import { t } from "../lib/i18n.ts";
  import { videoStorage } from "../lib/storage.ts";
  import { toWatch, type Video } from "../lib/videos.ts";
  import { thumbnailUrl, watchUrl } from "../lib/youtube.ts";

  let { host }: { host: ConnectedModule } = $props();

  const storage = $derived(videoStorage(host.storage));

  let count = $state(0);
  let latest = $state<Video[]>([]);
  let loaded = $state(false);
  let error = $state("");

  async function refresh() {
    try {
      ({ count, latest } = toWatch(await storage.read(), 4));
      loaded = true;
      error = "";
    } catch {
      error = t("widget_error");
    }
  }

  onMount(() => {
    void refresh();
    // The View may have changed the videos while the Widget was hidden behind it.
    return host.onVisibilityChange((visible) => visible && void refresh());
  });
</script>

<div class="widget">
  <header>
    <h1>{t("module_name")}</h1>
    {#if loaded && count}
      <span class="count">{t("widget_count", { count })}</span>
    {/if}
    <button type="button" class="pill" onclick={() => host.openView()}>{t("widget_open")} ↗</button>
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if loaded}
    {#if latest.length}
      <ul aria-label={t("widget_latest")}>
        {#each latest as video (video.videoId)}
          <li>
            <a href={watchUrl(video)} target="_blank" rel="noopener" title={video.title}>
              <img src={thumbnailUrl(video.videoId)} alt="" width="320" height="180" />
              <span>{video.title}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="none">
        <p>{t("widget_empty")}</p>
        <button type="button" class="pill" onclick={() => host.openView()}>{t("widget_add")}</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* The Widget fills its cell and never scrolls (CONVENTION.md §7.1): what does not fit is cut off. */
  .widget {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100vh;
    padding: 10px 12px;
    overflow: hidden;
    font-size: 12px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  h1 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .count {
    color: var(--muted);
    white-space: nowrap;
  }
  .pill {
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2px 10px;
    background: var(--panel-soft);
    color: var(--accent-strong);
    font: inherit;
    font-size: 11px;
    white-space: nowrap;
    cursor: pointer;
  }
  .pill:hover {
    border-color: var(--accent);
  }
  .error {
    margin: 0;
    color: var(--red);
  }
  /* Two columns and two rows of videos, each a thumbnail over its title, sized to the cell. */
  ul {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    min-height: 0;
  }
  a {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: var(--ink);
    text-decoration: none;
  }
  a:hover span {
    color: var(--accent-strong);
    text-decoration: underline;
  }
  img {
    width: 100%;
    min-height: 0;
    flex: 0 1 auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 8px;
    background: var(--panel);
  }
  a span {
    flex: none;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }
  .none {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--muted);
    text-align: center;
  }
  .none p {
    margin: 0;
  }
</style>
