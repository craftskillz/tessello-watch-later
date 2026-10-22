// The videos and the settings of the View, as Svelte state shared by its parts, kept in the Host storage (lib/storage.ts). Each change
// is written at once, since the Host may unload the View without warning (CONVENTION.md §4). Videos that could not be
// read cannot be changed, so that an empty list never overwrites them.

import type { ConnectedModule } from "@tessello/sdk";
import { t } from "./i18n.ts";
import { reasonOf, type VideoStorage, videoStorage } from "./storage.ts";
import { type Addition, addVideos, readMetadata, removeVideo, setNote, setWatched, type Settings, type Video } from "./videos.ts";
import { oembedUrl } from "./youtube.ts";

export const videos = $state<{ list: Video[] }>({ list: [] });

export const settings = $state<Settings>({ hideWatched: true });

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
    const [stored, storedSettings] = await Promise.all([storage.read(), storage.readSettings()]);
    if (!status.saveError) {
      videos.list = stored;
      Object.assign(settings, storedSettings);
    }
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
  return queue(() => storage.write(list));
}

function saveSettings(): Promise<void> {
  const value = $state.snapshot(settings);
  return queue(() => storage.writeSettings(value));
}

function queue(write: () => Promise<void>): Promise<void> {
  writes = writes.then(async () => {
    try {
      await write();
      status.saveError = "";
    } catch (error) {
      status.saveError = (error as Error).message;
    }
  });
  return writes;
}

/**
 * Adds the video of each line of a pasted or dropped text that is a YouTube URL and saves them, then reads their title
 * and channel. Returns what was added, or null while the videos cannot be read.
 */
export function add(text: string): Addition | null {
  if (!status.loaded) return null;
  const { videos: list, ...result } = addVideos(videos.list, text, new Date());
  if (result.added.length) {
    videos.list = list;
    void save();
    for (const videoId of result.added) void fetchMetadata(videoId);
  }
  return result;
}

/** Marks a video as watched, or as to watch. */
export function markWatched(videoId: string, watched: boolean): void {
  if (!status.loaded) return;
  videos.list = setWatched(videos.list, videoId, watched, new Date());
  void save();
}

/** Writes the note of a video. Returns false, and changes nothing, when the note is too long. */
export function writeNote(videoId: string, note: string): boolean {
  if (!status.loaded) return false;
  const list = setNote(videos.list, videoId, note);
  if (!list) return false;
  const before = videos.list.find((video) => video.videoId === videoId)?.note;
  videos.list = list;
  if (list.find((video) => video.videoId === videoId)?.note !== before) void save();
  return true;
}

export function remove(videoId: string): void {
  if (!status.loaded) return;
  videos.list = removeVideo(videos.list, videoId);
  void save();
}

export function setHideWatched(hideWatched: boolean): void {
  if (!status.loaded) return;
  settings.hideWatched = hideWatched;
  void saveSettings();
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
