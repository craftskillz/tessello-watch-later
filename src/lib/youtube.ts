// What the Module knows of YouTube: which URLs are those of a video, and the URLs it builds from a video's id, to open
// it, to show its thumbnail and to read its title and channel (oEmbed, which needs no key).

export interface ParsedVideo {
  videoId: string;
  /** Where the video starts, in seconds. */
  start?: number;
}

/** The id of a video: 11 characters. */
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
/** The hosts of a `/watch?v=` or `/shorts/<id>` URL; `youtu.be` takes the id as its path. */
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
/** The paths whose second segment is the id. */
const ID_PATHS = new Set(["shorts", "live", "embed"]);

/** The video of a YouTube URL, with or without `https://` and `www.`; null for anything else. */
export function parseYouTubeUrl(text: string): ParsedVideo | null {
  const trimmed = text.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  let videoId: string | null | undefined;
  if (url.hostname === "youtu.be") {
    if (segments.length === 1) videoId = segments[0];
  } else if (HOSTS.has(url.hostname)) {
    if (segments.length === 1 && segments[0] === "watch") videoId = url.searchParams.get("v");
    else if (segments.length === 2 && ID_PATHS.has(segments[0])) videoId = segments[1];
  }
  if (!videoId || !VIDEO_ID.test(videoId)) return null;
  const start = secondsOf(url.searchParams.get("t") ?? url.searchParams.get("start"));
  return start ? { videoId, start } : { videoId };
}

/** `90`, `90s`, `1m30s` or `1h2m3s` in seconds; 0 for anything else. */
function secondsOf(value: string | null): number {
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value ?? "");
  if (!match) return 0;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/** The URL that opens the video on YouTube, at its start if it has one. */
export function watchUrl({ videoId, start }: ParsedVideo): string {
  return `https://www.youtube.com/watch?v=${videoId}${start ? `&t=${start}s` : ""}`;
}

export const thumbnailUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

export const oembedUrl = (videoId: string) => `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl({ videoId }))}&format=json`;
