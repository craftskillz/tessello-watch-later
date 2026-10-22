<script lang="ts">
  import { t } from "../lib/i18n.ts";
  import { add, load, status, videos } from "../lib/store.svelte.ts";
  import { newestFirst } from "../lib/videos.ts";
  import VideoCard from "./VideoCard.svelte";

  let url = $state("");
  const shown = $derived(newestFirst(videos.list));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (add(url)) url = "";
  }

  /** A paste in the field adds at once, when it is a YouTube URL; anything else is pasted as text. */
  function pasteInField(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (add(text)) {
      event.preventDefault();
      url = "";
    }
  }

  /** Ctrl/Cmd+V anywhere in the View but in a field adds too. */
  function pasteInPage(event: ClipboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, [contenteditable]")) return;
    if (add(event.clipboardData?.getData("text/plain") ?? "")) event.preventDefault();
  }
</script>

<svelte:document onpaste={pasteInPage} />

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
    {#if status.saveError}
      <p class="wl-banner" role="alert">{status.saveError}</p>
    {/if}
    {#if shown.length}
      <section class="wl-row" aria-label={t("row_all")}>
        <h2>{t("row_all")}</h2>
        <ul class="wl-cards" aria-label={t("videos")}>
          {#each shown as video (video.videoId)}
            <li><VideoCard {video} /></li>
          {/each}
        </ul>
      </section>
    {:else}
      <p class="wl-message">{t("empty")}</p>
    {/if}
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
  .wl-row h2 {
    margin: 0 0 8px;
    font-size: 16px;
  }
  .wl-cards {
    list-style: none;
    margin: 0;
    padding: 0 0 8px;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
  }
  .wl-cards li {
    flex: 0 0 auto;
    scroll-snap-align: start;
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
