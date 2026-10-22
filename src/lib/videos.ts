// The model of the videos the User keeps. What the Host storage holds is read defensively, since an older version, an
// import or a hand-edited file may have written it: what cannot be read is skipped, and a missing value takes its
// creation value. The model is the whole one of the spec, so that what later versions store is read back without loss.

import { t } from "./i18n.ts";
import { type ParsedVideo, parseYouTubeUrl, VIDEO_ID, watchUrl } from "./youtube.ts";

export interface Video {
  /** The key of a video: there is never two with the same. */
  videoId: string;
  /** Where the video starts, in seconds. */
  start?: number;
  /** The title from oEmbed; the URL of the video until it is read. */
  title: string;
  channel?: string;
  /** ISO date. */
  addedAt: string;
  watched: boolean;
  watchedAt?: string;
  note?: string;
  /** Without duplicates, compared regardless of case. */
  tags: string[];
  /** `failed` until the title and channel are read: the card then offers to read them again. */
  metaStatus: "ok" | "failed";
}

/**
 * Adds a video at the date `now`, with `tags`, unless one with the same id is already there. `videoId` is the video
 * to show: the one added, or the one that was there.
 */
export function addVideo(
  videos: readonly Video[],
  parsed: ParsedVideo,
  now: Date,
  tags: readonly string[] = [],
): { videos: Video[]; videoId: string; added: boolean } {
  if (videos.some((video) => video.videoId === parsed.videoId)) return { videos: [...videos], videoId: parsed.videoId, added: false };
  const video: Video = {
    videoId: parsed.videoId,
    ...(parsed.start ? { start: parsed.start } : {}),
    title: watchUrl(parsed),
    addedAt: now.toISOString(),
    watched: false,
    tags: tags.reduce<string[]>((kept, tag) => withTag(videos, kept, tag), []),
    metaStatus: "failed",
  };
  return { videos: [...videos, video], videoId: video.videoId, added: true };
}

/** What adding a text did: the ids of the videos added and of those already there, and how many lines were not videos. */
export interface Addition {
  added: string[];
  existing: string[];
  ignored: number;
}

/**
 * Adds the video of each line of a pasted or dropped text that is a YouTube URL, with `tags`. Blank lines are not
 * counted.
 */
export function addVideos(videos: readonly Video[], text: string, now: Date, tags: readonly string[] = []): Addition & { videos: Video[] } {
  const result = { videos: [...videos], added: [] as string[], existing: [] as string[], ignored: 0 };
  for (const line of lines(text)) {
    if (!line.trim()) continue;
    const parsed = parseYouTubeUrl(line);
    if (!parsed) {
      result.ignored++;
      continue;
    }
    const { videos: list, videoId, added } = addVideo(result.videos, parsed, now, tags);
    result.videos = list;
    if (added) result.added.push(videoId);
    else if (!result.added.includes(videoId) && !result.existing.includes(videoId)) result.existing.push(videoId);
  }
  return result;
}

/** Whether a line of a text is a YouTube video. */
export const holdsVideo = (text: string) => lines(text).some((line) => parseYouTubeUrl(line));

const lines = (text: string) => text.split(/\r?\n/);

/** The title and channel in an answer of oEmbed; null when it has no title. */
export function readMetadata(answer: unknown): { title: string; channel?: string } | null {
  const value = record(answer);
  const title = text(value.title)?.trim();
  if (!title) return null;
  const channel = text(value.author_name)?.trim();
  return channel ? { title, channel } : { title };
}

/** Marks a video as watched at the date `now`, or as to watch, which forgets when it was watched. */
export function setWatched(videos: readonly Video[], videoId: string, watched: boolean, now: Date): Video[] {
  return videos.map((video) => {
    if (video.videoId !== videoId) return video;
    const { watchedAt, ...rest } = video;
    return watched ? { ...rest, watched, watchedAt: now.toISOString() } : { ...rest, watched };
  });
}

/** The longest note the View accepts. */
export const NOTE_MAX = 2000;

/** Writes the note of a video, without the spaces around it; a blank note is none. Null when the note is too long. */
export function setNote(videos: readonly Video[], videoId: string, note: string): Video[] | null {
  const trimmed = note.trim();
  if (trimmed.length > NOTE_MAX) return null;
  return videos.map((video) => {
    if (video.videoId !== videoId) return video;
    const { note: _, ...rest } = video;
    return trimmed ? { ...rest, note: trimmed } : rest;
  });
}

export const removeVideo = (videos: readonly Video[], videoId: string) => videos.filter((video) => video.videoId !== videoId);

export interface Settings {
  /** Whether the watched videos are left out of the View. */
  hideWatched: boolean;
}

/** The settings under the key `settings`; what cannot be read takes its default. */
export function readSettings(stored: unknown): Settings {
  return { hideWatched: record(stored).hideWatched !== false };
}

/** A tag without the spaces in excess; null when it is blank. */
export function normalizeTag(tag: string): string | null {
  return tag.trim().replace(/\s+/g, " ") || null;
}

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** `tags` with `tag` added, as it was first written in `videos`, unless it is blank or already there. */
function withTag(videos: readonly Video[], tags: string[], tag: string): string[] {
  const normalized = normalizeTag(tag);
  if (!normalized || tags.some((other) => sameTag(other, normalized))) return tags;
  return [...tags, allTags(videos).find((other) => sameTag(other, normalized)) ?? normalized];
}

/** Adds a tag to a video, as it was first written, unless it is blank or the video has it. */
export function addTag(videos: readonly Video[], videoId: string, tag: string): Video[] {
  return videos.map((video) => (video.videoId === videoId ? { ...video, tags: withTag(videos, video.tags, tag) } : video));
}

/** Removes a tag from a video, whatever its case. */
export function removeTag(videos: readonly Video[], videoId: string, tag: string): Video[] {
  return videos.map((video) => (video.videoId === videoId ? { ...video, tags: video.tags.filter((other) => !sameTag(other, tag)) } : video));
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** The tags in use, in alphabetical order, each as it was first written. */
export function allTags(videos: readonly Video[]): string[] {
  const tags: string[] = [];
  for (const video of videos) for (const tag of video.tags) if (!tags.some((other) => sameTag(other, tag))) tags.push(tag);
  return tags.sort(byName);
}

/** A row of the View: the videos with a tag, or without any when `tag` is null. */
export interface Row {
  tag: string | null;
  videos: Video[];
}

/** One row per tag, in alphabetical order, then the videos without a tag; the newest first in each, and no empty row. */
export function rowsByTag(videos: readonly Video[]): Row[] {
  const newest = newestFirst(videos);
  const rows: Row[] = allTags(videos).map((tag) => ({ tag, videos: newest.filter((video) => video.tags.some((other) => sameTag(other, tag))) }));
  const untagged = newest.filter((video) => !video.tags.length);
  return untagged.length ? [...rows, { tag: null, videos: untagged }] : rows;
}

/** How many videos are left to watch, and the `limit` of them added last, the newest first. */
export function toWatch(videos: readonly Video[], limit: number): { count: number; latest: Video[] } {
  const left = videos.filter((video) => !video.watched);
  return { count: left.length, latest: newestFirst(left).slice(0, limit) };
}

/** The most recently added first. */
export function newestFirst(videos: readonly Video[]): Video[] {
  return [...videos].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/** The videos under the key `videos`; null, or anything but a list, is none. */
export function readVideos(stored: unknown): Video[] {
  if (!Array.isArray(stored)) return [];
  const videos: Video[] = [];
  for (const item of stored) {
    const video = readVideo(item);
    if (video && !videos.some((other) => other.videoId === video.videoId)) videos.push(video);
  }
  return videos;
}

function readVideo(stored: unknown): Video | null {
  const value = record(stored);
  const videoId = text(value.videoId);
  if (!videoId || !VIDEO_ID.test(videoId)) return null;
  const start = typeof value.start === "number" && Number.isInteger(value.start) && value.start > 0 ? value.start : undefined;
  const channel = text(value.channel);
  const watchedAt = date(value.watchedAt);
  const note = text(value.note);
  return {
    videoId,
    ...(start ? { start } : {}),
    title: text(value.title) ?? watchUrl({ videoId, start }),
    ...(channel ? { channel } : {}),
    addedAt: date(value.addedAt) ?? new Date(0).toISOString(),
    watched: value.watched === true,
    ...(watchedAt ? { watchedAt } : {}),
    ...(note ? { note } : {}),
    tags: readTags(value.tags),
    metaStatus: value.metaStatus === "ok" ? "ok" : "failed",
  };
}

function readTags(stored: unknown): string[] {
  if (!Array.isArray(stored)) return [];
  return stored.reduce<string[]>((tags, tag) => (typeof tag === "string" ? withTag([], tags, tag) : tags), []);
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
const text = (value: unknown) => (typeof value === "string" ? value : undefined);
const date = (value: unknown) => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : undefined);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** When a video added at `addedAt` was added, seen at `now`; a date ahead of `now` is "just now". */
export function relativeTime(addedAt: string, now: number): string {
  const elapsed = now - Date.parse(addedAt);
  if (elapsed < MINUTE) return t("added_now");
  if (elapsed < HOUR) return t("added_minutes", { count: Math.floor(elapsed / MINUTE) });
  if (elapsed < DAY) return t("added_hours", { count: Math.floor(elapsed / HOUR) });
  if (elapsed < 2 * DAY) return t("added_yesterday");
  return t("added_days", { count: Math.floor(elapsed / DAY) });
}
