import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { setLocale } from "../src/lib/i18n.ts";
import { addVideo, addVideos, holdsVideo, newestFirst, readMetadata, readVideos, relativeTime, type Video } from "../src/lib/videos.ts";

const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";

const video = (videoId: string, addedAt: string, rest: Partial<Video> = {}): Video => ({
  videoId,
  title: `Title ${videoId}`,
  addedAt,
  watched: false,
  tags: [],
  metaStatus: "ok",
  ...rest,
});

describe("adding a video", () => {
  test("a new video waits for its title: its URL stands in for it until oEmbed answers", () => {
    const { videos, videoId, added } = addVideo([], { videoId: A, start: 90 }, new Date("2026-10-22T10:00:00Z"));
    assert.equal(added, true);
    assert.equal(videoId, A);
    assert.deepEqual(videos, [
      {
        videoId: A,
        start: 90,
        title: `https://www.youtube.com/watch?v=${A}&t=90s`,
        addedAt: "2026-10-22T10:00:00.000Z",
        watched: false,
        tags: [],
        metaStatus: "failed",
      },
    ]);
  });

  test("a video already there is not added again, and is the one shown", () => {
    const existing = [video(A, "2026-10-01T00:00:00.000Z", { start: 10 })];
    const { videos, videoId, added } = addVideo(existing, { videoId: A, start: 90 }, new Date("2026-10-22T10:00:00Z"));
    assert.equal(added, false);
    assert.equal(videoId, A);
    assert.deepEqual(videos, existing);
  });
});

describe("adding what the User pastes or drops", () => {
  const now = new Date("2026-10-22T10:00:00Z");
  const C = "ccccccccccc";

  test("each line that is a YouTube video is added; the others are ignored, and blank lines are not counted", () => {
    const text = `https://youtu.be/${A}\n\n  not a video \r\nyoutube.com/shorts/${B}\nhttps://example.com\n`;
    const result = addVideos([], text, now);
    assert.deepEqual(
      result.videos.map((item) => item.videoId),
      [A, B],
    );
    assert.deepEqual(result.added, [A, B]);
    assert.deepEqual(result.existing, []);
    assert.equal(result.ignored, 2);
  });

  test("a video already there, or twice in the same text, is added once", () => {
    const existing = [video(A, "2026-10-01T00:00:00.000Z")];
    const result = addVideos(existing, `https://www.youtube.com/watch?v=${A}&t=30\nyoutu.be/${C}\nhttps://www.youtube.com/embed/${C}`, now);
    assert.deepEqual(
      result.videos.map((item) => item.videoId),
      [A, C],
    );
    assert.deepEqual(result.added, [C]);
    assert.deepEqual(result.existing, [A]);
    assert.equal(result.ignored, 0);
  });

  test("text with no video adds nothing", () => {
    assert.deepEqual(addVideos([], "  ", now), { videos: [], added: [], existing: [], ignored: 0 });
    assert.deepEqual(addVideos([], "hello", now), { videos: [], added: [], existing: [], ignored: 1 });
  });
});

describe("whether a text holds a video", () => {
  test("it does when one of its lines is one", () => {
    assert.equal(holdsVideo(`see this:\nyoutu.be/${A}`), true);
    assert.equal(holdsVideo("see this:\nhttps://example.com"), false);
  });
});

describe("the title and channel from oEmbed", () => {
  test("are read from its answer", () => {
    assert.deepEqual(readMetadata({ title: "Never Gonna Give You Up", author_name: "Rick Astley", type: "video" }), {
      title: "Never Gonna Give You Up",
      channel: "Rick Astley",
    });
  });

  test("an answer without a title cannot be read", () => {
    assert.equal(readMetadata({ author_name: "Rick Astley" }), null);
    assert.equal(readMetadata({ title: "  " }), null);
    assert.equal(readMetadata("Not Found"), null);
    assert.equal(readMetadata(null), null);
  });

  test("a missing channel is no channel", () => {
    assert.deepEqual(readMetadata({ title: "T", author_name: 3 }), { title: "T" });
  });
});

describe("the list as the View shows it", () => {
  test("the most recently added first", () => {
    const list = [video(A, "2026-10-01T00:00:00.000Z"), video(B, "2026-10-20T00:00:00.000Z")];
    assert.deepEqual(
      newestFirst(list).map((item) => item.videoId),
      [B, A],
    );
  });
});

describe("reading what the storage holds", () => {
  test("nothing stored is no video", () => {
    assert.deepEqual(readVideos(null), []);
  });

  test("a video is read back as it was written", () => {
    const full = video(A, "2026-10-01T00:00:00.000Z", {
      start: 5,
      channel: "C",
      watched: true,
      watchedAt: "2026-10-02T00:00:00.000Z",
      note: "for later",
      tags: ["svelte"],
      metaStatus: "failed",
    });
    assert.deepEqual(readVideos([full]), [full]);
  });

  test("what cannot be read is skipped, a missing value takes its default, and a duplicate is dropped", () => {
    assert.deepEqual(
      readVideos([
        { videoId: A },
        "junk",
        { videoId: "not an id" },
        { videoId: A, title: "second" },
        { videoId: B, title: 3, addedAt: "never", watched: "yes", tags: ["x", 2, "X", "y"], metaStatus: "maybe", start: -4 },
      ]),
      [
        { videoId: A, title: `https://www.youtube.com/watch?v=${A}`, addedAt: new Date(0).toISOString(), watched: false, tags: [], metaStatus: "failed" },
        { videoId: B, title: `https://www.youtube.com/watch?v=${B}`, addedAt: new Date(0).toISOString(), watched: false, tags: ["x", "y"], metaStatus: "failed" },
      ],
    );
  });

  test("a value that is not a list is no video", () => {
    assert.deepEqual(readVideos({ videoId: A }), []);
  });
});

describe("when a video was added, as the card says it", () => {
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const now = 1_000 * DAY;
  const at = (elapsed: number) => new Date(now - elapsed).toISOString();
  afterEach(() => setLocale("en"));

  test("in English", () => {
    assert.equal(relativeTime(at(20_000), now), "just now");
    assert.equal(relativeTime(at(5 * MIN), now), "5 min ago");
    assert.equal(relativeTime(at(3 * HOUR), now), "3 h ago");
    assert.equal(relativeTime(at(30 * HOUR), now), "yesterday");
    assert.equal(relativeTime(at(3 * DAY), now), "3 days ago");
  });

  test("in French", () => {
    setLocale("fr-FR");
    assert.equal(relativeTime(at(20_000), now), "à l'instant");
    assert.equal(relativeTime(at(5 * MIN), now), "il y a 5 min");
    assert.equal(relativeTime(at(3 * HOUR), now), "il y a 3 h");
    assert.equal(relativeTime(at(30 * HOUR), now), "hier");
    assert.equal(relativeTime(at(3 * DAY), now), "il y a 3 jours");
  });

  test("a date ahead of the clock is just now", () => {
    assert.equal(relativeTime(at(-5 * MIN), now), "just now");
  });
});
