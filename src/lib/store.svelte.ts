// The videos of the View, as Svelte state shared by its parts, kept in the Host storage (lib/storage.ts). Each change
// is written at once, since the Host may unload the View without warning (CONVENTION.md §4). Videos that could not be
// read cannot be changed, so that an empty list never overwrites them.

import type { ConnectedModule } from "@tessello/sdk";
import { t } from "./i18n.ts";
import { reasonOf, type VideoStorage, videoStorage } from "./storage.ts";
import { addVideo, readMetadata, type Video } from "./videos.ts";
import { oembedUrl, parseYouTubeUrl } from "./youtube.ts";

export const videos = $state<{ list: Video[] }>({ list: [] });

export const status = $state({
  /** False until the videos are read, and again while they cannot be read. */
  loaded: false,
  loadError: "",
  /** Set when the last write failed: what is on screen is not saved. */
  saveError: "",
  /** The videos whose title is being read from oEmbed, by id. */
  fetching: [] as string[],
});

let storage: VideoStorage;
/** Writes go one after the other, so that an older list never lands after a newer one. */
let writes = Promise.resolve();

export function connectStore(host: ConnectedModule): void {
  storage = videoStorage(host.storage);
}

/** Reads the videos. A list whose last change could not be saved stays as it is on screen. */
export async function load(): Promise<void> {
  try {
    const stored = await storage.read();
    if (!status.saveError) videos.list = stored;
    status.loadError = "";
    status.loaded = true;
  } catch (error) {
    status.loaded = false;
    status.loadError = t("load_error", { reason: reasonOf(error) });
  }
}

/** Writes the list now. A failure is shown to the User; the change stays on screen. */
function save(): Promise<void> {
  const list = $state.snapshot(videos.list);
  writes = writes.then(async () => {
    try {
      await storage.write(list);
      status.saveError = "";
    } catch (error) {
      status.saveError = (error as Error).message;
    }
  });
  return writes;
}

/**
 * Adds the video of a YouTube URL and saves it, then reads its title and channel. Returns false when the text is not
 * a YouTube video, or while the videos cannot be read.
 */
export function add(text: string): boolean {
  const parsed = parseYouTubeUrl(text);
  if (!status.loaded || !parsed) return false;
  const { videos: list, videoId, added } = addVideo(videos.list, parsed, new Date());
  if (!added) return true;
  videos.list = list;
  void save();
  void fetchMetadata(videoId);
  return true;
}

/** Reads the title and channel of a video from oEmbed. On failure, its URL stays its title, and the card offers to retry. */
export async function fetchMetadata(videoId: string): Promise<void> {
  if (status.fetching.includes(videoId)) return;
  status.fetching.push(videoId);
  try {
    const response = await fetch(oembedUrl(videoId));
    const metadata = response.ok ? readMetadata(await response.json()) : null;
    const video = videos.list.find((item) => item.videoId === videoId);
    if (metadata && video) {
      video.title = metadata.title;
      if (metadata.channel) video.channel = metadata.channel;
      video.metaStatus = "ok";
      await save();
    }
  } catch {
    // Offline, blocked or not JSON: the video keeps its URL as its title.
  } finally {
    status.fetching = status.fetching.filter((id) => id !== videoId);
  }
}
