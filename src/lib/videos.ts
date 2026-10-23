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
  /** An integer from 0 to 5, only for a watched video; older watched videos may have none. */
  score?: number;
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

/** Marks a video as watched at the date `now`, or as to watch, which forgets its score and when it was watched. */
export function setWatched(videos: readonly Video[], videoId: string, watched: boolean, now: Date): Video[] {
  return videos.map((video) => {
    if (video.videoId !== videoId) return video;
    const { watchedAt, score, ...rest } = video;
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

/** A score is a number, never a numeric string, and includes zero. */
const validScore = (score: unknown): score is number => typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 5;

/** Saves a watched video's score. Invalid scores and videos still to watch cannot be rated. */
export function setScore(videos: readonly Video[], videoId: string, score: number): Video[] | null {
  if (!validScore(score)) return null;
  if (!videos.some((video) => video.videoId === videoId && video.watched)) return null;
  return videos.map((video) => (video.videoId === videoId ? { ...video, score } : video));
}

/** Marks a video watched with its score and note in one change; invalid input changes nothing. */
export function watchVideo(videos: readonly Video[], videoId: string, score: number, note: string, now: Date): Video[] | null {
  const noted = setNote(videos, videoId, note);
  return noted ? setScore(setWatched(noted, videoId, true, now), videoId, score) : null;
}

export const removeVideo = (videos: readonly Video[], videoId: string) => videos.filter((video) => video.videoId !== videoId);

export const removeVideos = (videos: readonly Video[], videoIds: readonly string[]) => videos.filter((video) => !videoIds.includes(video.videoId));

export interface Settings {
  /** Whether the watched videos are left out of the View. */
  hideWatched: boolean;
  /** The groups folded in the View, whatever their case. */
  collapsed: string[];
  /** The order the User gave the rows by moving their videos. */
  order: Order;
  /**
   * The keys of the sections the User has moved, in the order they put them: the rows (`rowKey`) and the groups
   * (`groupKey`) of the View, and the rows of each group, each compared only with those beside it.
   */
  sections: string[];
}

/**
 * The ids of the videos of each row the User has moved a video in, in the order they put them, by the key of the row
 * (`rowKey`).
 */
export type Order = Record<string, string[]>;

/** The key of a row in `Order`: its tag whatever its case, `""` for the videos without a tag, since no tag is blank. */
export const rowKey = (tag: string | null) => tag?.toLowerCase() ?? "";

/** The key of a group in `Settings.sections`: its name whatever its case, then the separator, which no tag ends with. */
export const groupKey = (group: string) => `${group.toLowerCase()}${SEPARATOR}`;

/** The settings under the key `settings`; what cannot be read takes its default. */
export function readSettings(stored: unknown): Settings {
  const value = record(stored);
  const collapsed = strings(value.collapsed);
  const order: Order = {};
  for (const [key, ids] of Object.entries(record(value.order))) if (Array.isArray(ids)) order[key] = strings(ids);
  return { hideWatched: value.hideWatched !== false, collapsed, order, sections: strings(value.sections) };
}

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

/** What separates the group of a tag from its name: `Music/Jazz` is the tag `Jazz` of the group `Music`. */
const SEPARATOR = "/";

/** The group of a tag, null when it has none, and its name in the group. */
export function splitTag(tag: string): { group: string | null; name: string } {
  const at = tag.indexOf(SEPARATOR);
  return at < 0 ? { group: null, name: tag } : { group: tag.slice(0, at), name: tag.slice(at + 1) };
}

/**
 * A tag without the spaces in excess, around its separator too; null when it is blank. A side of the separator that is
 * blank is dropped: `Music/` is the tag `Music`.
 */
export function normalizeTag(tag: string): string | null {
  const { group, name } = splitTag(tag);
  const parts = [group, name].map((part) => part?.trim().replace(/\s+/g, " ")).filter((part) => !!part);
  return parts.join(SEPARATOR) || null;
}

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * `tags` with `tag` added, as it was first written in `videos`, unless it is blank or already there. Its group is
 * written as it was first written too, in another tag of the group or as a tag of its own.
 */
export function withTag(videos: readonly Video[], tags: string[], tag: string): string[] {
  const normalized = normalizeTag(tag);
  if (!normalized) return tags;
  const inUse = allTags(videos);
  const { group, name } = splitTag(normalized);
  const spelled = group === null ? normalized : `${inUse.map(groupOf).find((other) => sameTag(other, group)) ?? group}${SEPARATOR}${name}`;
  if (tags.some((other) => sameTag(other, spelled))) return tags;
  return [...tags, inUse.find((other) => sameTag(other, spelled)) ?? spelled];
}

/** The group of a tag, or the tag itself when it has none: the tag `Music` is the first row of the group `Music`. */
const groupOf = (tag: string) => splitTag(tag).group ?? tag;

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

/**
 * One row per tag, in alphabetical order, then the videos without a tag, and no empty row. In each, the videos the User
 * has not moved come first, the newest first, then the others in the `order` they were given.
 */
export function rowsByTag(videos: readonly Video[], order: Order = {}): Row[] {
  const newest = newestFirst(videos);
  const rows: Row[] = allTags(videos).map((tag) => ({ tag, videos: newest.filter((video) => video.tags.some((other) => sameTag(other, tag))) }));
  const untagged = newest.filter((video) => !video.tags.length);
  return (untagged.length ? [...rows, { tag: null, videos: untagged }] : rows).map((row) => ({ ...row, videos: arrange(row.videos, order[rowKey(row.tag)]) }));
}

/** The videos of a row, newest first, with those never moved first, then those `placed`, in their order. */
function arrange(newest: Video[], placed: readonly string[] = []): Video[] {
  const rank = new Map(placed.map((videoId, index) => [videoId, index]));
  const ranked = newest.filter((video) => rank.has(video.videoId)).sort((a, b) => rank.get(a.videoId)! - rank.get(b.videoId)!);
  return [...newest.filter((video) => !rank.has(video.videoId)), ...ranked];
}

/**
 * Whether a video may be moved from the row of `from` to the row of `to`, a null tag being the row of the videos
 * without a tag: only a video whose sole tag is `from` may be moved there, since it keeps its other tags.
 */
export function canMove(videos: readonly Video[], videoId: string, from: string | null, to: string | null): boolean {
  const video = videos.find((item) => item.videoId === videoId);
  if (!video) return false;
  return to !== null || video.tags.every((tag) => from !== null && sameTag(tag, from));
}

/**
 * Moves a video of the row of `from` before the video `before` of the row of `to`, or at its end when `before` is
 * null. Moved to another row, the video loses the tag `from` and takes the tag `to`, as it was first written. The
 * order kept is that of the rows that still exist. Null when the move is not allowed (`canMove`).
 */
export function moveVideo(
  videos: readonly Video[],
  order: Order,
  videoId: string,
  from: string | null,
  to: string | null,
  before: string | null,
): { videos: Video[]; order: Order } | null {
  if (!canMove(videos, videoId, from, to)) return null;
  let list = [...videos];
  if (rowKey(from) !== rowKey(to)) {
    if (from !== null) list = removeTag(list, videoId, from);
    if (to !== null) list = addTag(list, videoId, to);
  }
  const rows = rowsByTag(list, order);
  const ids = rows.find((row) => rowKey(row.tag) === rowKey(to))!.videos.map((video) => video.videoId);
  const others = ids.filter((id) => id !== videoId);
  // Before itself is where it already is.
  const at = before === videoId ? ids.indexOf(videoId) : before === null ? -1 : others.indexOf(before);
  others.splice(at < 0 ? others.length : at, 0, videoId);
  const moved: Order = { ...order, [rowKey(to)]: others };
  const kept: Order = {};
  for (const { tag, videos: shown } of rows) {
    const placed = moved[rowKey(tag)];
    if (placed) kept[rowKey(tag)] = placed.filter((id) => shown.some((video) => video.videoId === id));
  }
  return { videos: list, order: kept };
}

/**
 * The videos of a section of the View, watched or not: those with the tag of a row, without a tag when it is null, or
 * with a tag of a group. `elsewhere` counts those of them that are in other sections too.
 */
export function sectionVideos(videos: readonly Video[], section: { tag: string | null } | { group: string }): { videos: Video[]; elsewhere: number } {
  const inSection = (tag: string) => ("group" in section ? sameTag(groupOf(tag), section.group) : section.tag !== null && sameTag(tag, section.tag));
  const found = videos.filter((video) => ("tag" in section && section.tag === null ? !video.tags.length : video.tags.some(inSection)));
  return { videos: found, elsewhere: found.filter((video) => !video.tags.every(inSection)).length };
}

/** A group of the View: the rows of its tags, and how many videos they hold, each counted once. */
export interface Group {
  group: string;
  rows: Row[];
  count: number;
}

/** What the View shows, from top to bottom: a row, or a group of rows. */
export type Shelf = ({ kind: "row" } & Row) | ({ kind: "group" } & Group);

/**
 * The rows of `rowsByTag`, with the rows of the tags of a group gathered in it, in the same order: the tag `Music`,
 * when there is a group `Music`, is its first row. The groups and the tags without one are thus in alphabetical order,
 * then come the videos without a tag. The videos of each row are in the `order` of `rowsByTag`.
 */
export function shelves(videos: readonly Video[], order: Order = {}, sections: readonly string[] = []): Shelf[] {
  const rows = rowsByTag(videos, order);
  const groups = new Map<string, { kind: "group" } & Group>();
  for (const { tag } of rows) {
    const group = tag === null ? null : splitTag(tag).group;
    if (group !== null && !groups.has(group.toLowerCase())) groups.set(group.toLowerCase(), { kind: "group", group, rows: [], count: 0 });
  }
  const shown: Shelf[] = [];
  for (const row of rows) {
    const group = row.tag === null ? undefined : groups.get(groupOf(row.tag).toLowerCase());
    if (!group) shown.push({ kind: "row", ...row });
    else if (group.rows.push(row) === 1) shown.push(group);
  }
  for (const group of groups.values()) {
    group.count = new Set(group.rows.flatMap((row) => row.videos.map((video) => video.videoId))).size;
    group.rows = arrangeSections(group.rows, (row) => rowKey(row.tag), sections);
  }
  return arrangeSections(shown, shelfKey, sections);
}

/** The key of a row or a group of the View in `Settings.sections`. */
export const shelfKey = (shelf: Shelf) => (shelf.kind === "group" ? groupKey(shelf.group) : rowKey(shelf.tag));

/** The sections the User has moved first, in the order they put them, then the others in their own order. */
function arrangeSections<T>(items: T[], keyOf: (item: T) => string, sections: readonly string[]): T[] {
  const rank = new Map(sections.map((key, index) => [key, index]));
  const ranked = items.filter((item) => rank.has(keyOf(item))).sort((a, b) => rank.get(keyOf(a))! - rank.get(keyOf(b))!);
  return [...ranked, ...items.filter((item) => !rank.has(keyOf(item)))];
}

/**
 * The order of the sections once the section `key` is moved before, or `after`, the section `target` beside it: two
 * rows or groups of the View, or two rows of the same group. Every section beside them is then placed, so that a
 * section that comes later lands after them. Keys of sections that no longer exist are forgotten. The order is the same
 * when the two sections are not side by side.
 */
export function moveSection(
  videos: readonly Video[],
  order: Order,
  sections: readonly string[],
  key: string,
  target: string,
  after: boolean,
): string[] {
  const shown = shelves(videos, order, sections);
  const levels = [shown.map(shelfKey), ...shown.flatMap((shelf) => (shelf.kind === "group" ? [shelf.rows.map((row) => rowKey(row.tag))] : []))];
  const existing = new Set(levels.flat());
  const kept = sections.filter((other) => existing.has(other));
  const level = levels.find((keys) => keys.includes(key));
  if (!level?.includes(target) || key === target) return kept;
  const others = level.filter((other) => other !== key);
  others.splice(others.indexOf(target) + (after ? 1 : 0), 0, key);
  return [...others, ...kept.filter((other) => !level.includes(other))];
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
    ...(value.watched === true && validScore(value.score) ? { score: value.score } : {}),
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
