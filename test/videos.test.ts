import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { setLocale } from "../src/lib/i18n.ts";
import {
  addTag,
  addVideo,
  addVideos,
  allTags,
  canMove,
  holdsVideo,
  moveSection,
  moveVideo,
  NOTE_MAX,
  newestFirst,
  readMetadata,
  readSettings,
  readVideos,
  relativeTime,
  removeTag,
  removeVideo,
  removeVideos,
  sectionVideos,
  rowsByTag,
  setNote,
  setWatched,
  shelfKey,
  shelves,
  toWatch,
  type Video,
} from "../src/lib/videos.ts";

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

describe("adding videos with the tags chosen for them", () => {
  test("each video added takes the tags, as they were first written", () => {
    const existing = [video(A, "2026-10-01T00:00:00.000Z", { tags: ["Svelte"] })];
    const result = addVideos(existing, `youtu.be/${B}\nyoutu.be/${A}`, new Date("2026-10-22T10:00:00Z"), [" svelte ", "Talks", "talks", ""]);
    assert.deepEqual(result.videos[1].tags, ["Svelte", "Talks"]);
    assert.deepEqual(result.videos[0].tags, ["Svelte"], "a video already there keeps its tags");
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

describe("marking a video as watched or to watch", () => {
  const list = [video(A, "2026-10-01T00:00:00.000Z"), video(B, "2026-10-02T00:00:00.000Z")];

  test("a video marked as watched records when", () => {
    const watched = setWatched(list, A, true, new Date("2026-10-22T10:00:00Z"));
    assert.deepEqual(watched[0], { ...list[0], watched: true, watchedAt: "2026-10-22T10:00:00.000Z" });
    assert.deepEqual(watched[1], list[1]);
  });

  test("a video marked as to watch again forgets when it was watched", () => {
    const watched = setWatched(list, A, true, new Date("2026-10-22T10:00:00Z"));
    assert.deepEqual(setWatched(watched, A, false, new Date("2026-10-23T10:00:00Z")), list);
  });
});

describe("the note of a video", () => {
  const list = [video(A, "2026-10-01T00:00:00.000Z")];

  test("is kept without the spaces around it", () => {
    assert.deepEqual(setNote(list, A, "  for the talk on Friday \n"), [{ ...list[0], note: "for the talk on Friday" }]);
  });

  test("a blank note is no note", () => {
    const noted = setNote(list, A, "something") ?? [];
    assert.deepEqual(setNote(noted, A, "   "), list);
  });

  test("a note longer than the limit is refused", () => {
    assert.equal(NOTE_MAX, 2000);
    assert.equal(setNote(list, A, "x".repeat(2001)), null);
    assert.equal(setNote(list, A, "x".repeat(2000))?.[0].note?.length, 2000);
  });
});

describe("deleting a video", () => {
  test("removes it, and only it", () => {
    const list = [video(A, "2026-10-01T00:00:00.000Z"), video(B, "2026-10-02T00:00:00.000Z")];
    assert.deepEqual(removeVideo(list, A), [list[1]]);
  });
});

describe("the tags of a video", () => {
  const list = [video(A, "2026-10-01T00:00:00.000Z", { tags: ["Svelte"] }), video(B, "2026-10-02T00:00:00.000Z")];

  test("a tag is added without the spaces in excess", () => {
    assert.deepEqual(addTag(list, B, "  machine   learning "), [list[0], { ...list[1], tags: ["machine learning"] }]);
  });

  test("a tag already used, whatever its case, keeps the case it was first written in", () => {
    assert.deepEqual(addTag(list, B, "SVELTE")[1].tags, ["Svelte"]);
  });

  test("a blank tag, or one the video has already, adds nothing", () => {
    assert.deepEqual(addTag(list, B, "   "), list);
    assert.deepEqual(addTag(list, A, "svelte"), list);
  });

  test("a tag is removed whatever its case", () => {
    assert.deepEqual(removeTag(list, A, "svelte"), [{ ...list[0], tags: [] }, list[1]]);
  });

  test("all the tags in use, in alphabetical order, once each", () => {
    const tagged = [video(A, "2026-10-01T00:00:00.000Z", { tags: ["svelte", "CSS"] }), video(B, "2026-10-02T00:00:00.000Z", { tags: ["Svelte", "ai"] })];
    assert.deepEqual(allTags(tagged), ["ai", "CSS", "svelte"]);
  });
});

describe("the rows of the View", () => {
  const C = "ccccccccccc";
  const D = "ddddddddddd";

  test("one row per tag in alphabetical order, then the videos without a tag; the newest first in each", () => {
    const list = [
      video(A, "2026-10-01T00:00:00.000Z", { tags: ["svelte", "CSS"] }),
      video(B, "2026-10-03T00:00:00.000Z", { tags: ["Svelte"] }),
      video(C, "2026-10-02T00:00:00.000Z"),
      video(D, "2026-10-04T00:00:00.000Z", { tags: ["ai"] }),
    ];
    assert.deepEqual(
      rowsByTag(list).map(({ tag, videos }) => [tag, videos.map((item) => item.videoId)]),
      [
        ["ai", [D]],
        ["CSS", [A]],
        ["svelte", [B, A]],
        [null, [C]],
      ],
    );
  });

  test("a row with no video is not shown", () => {
    assert.deepEqual(rowsByTag([]), []);
    assert.deepEqual(
      rowsByTag([video(A, "2026-10-01T00:00:00.000Z", { tags: ["x"] })]).map(({ tag }) => tag),
      ["x"],
    );
  });
});

describe("moving a video in the View", () => {
  const C = "ccccccccccc";
  const ids = (rows: ReturnType<typeof rowsByTag>) => rows.map(({ tag, videos }) => [tag, videos.map((item) => item.videoId)]);
  const list = [
    video(A, "2026-10-01T00:00:00.000Z", { tags: ["Music"] }),
    video(B, "2026-10-02T00:00:00.000Z", { tags: ["Music"] }),
    video(C, "2026-10-03T00:00:00.000Z", { tags: ["Music", "Code"] }),
  ];

  test("in its row, before another video or at the end, which the row then keeps", () => {
    const first = moveVideo(list, {}, A, "Music", "Music", C)!;
    assert.deepEqual(first.videos, list, "its tags do not change");
    assert.deepEqual(first.order, { music: [A, C, B] });
    assert.deepEqual(ids(rowsByTag(first.videos, first.order)), [
      ["Code", [C]],
      ["Music", [A, C, B]],
    ]);
    assert.deepEqual(moveVideo(list, first.order, A, "music", "MUSIC", null)!.order, { music: [C, B, A] });
    assert.deepEqual(moveVideo(list, first.order, C, "Music", "Music", C)!.order, first.order, "before itself, it stays");
  });

  test("a video the User has not moved comes first, the newest first", () => {
    const D = "ddddddddddd";
    const more = [...list, video(D, "2026-10-04T00:00:00.000Z", { tags: ["Music"] })];
    assert.deepEqual(ids(rowsByTag(more, { music: [A, C, B] }))[1], ["Music", [D, A, C, B]]);
  });

  test("to another row, it loses the tag of the row it leaves and takes the tag of the other, as first written", () => {
    const moved = moveVideo(list, { music: [A, C, B] }, A, "Music", "code", C)!;
    assert.deepEqual(moved.videos[0].tags, ["Code"]);
    assert.deepEqual(moved.order, { code: [A, C], music: [C, B] });
    assert.deepEqual(ids(rowsByTag(moved.videos, moved.order)), [
      ["Code", [A, C]],
      ["Music", [C, B]],
    ]);
  });

  test("a video already in the other row only loses the tag it leaves", () => {
    const moved = moveVideo(list, {}, C, "Code", "Music", null)!;
    assert.deepEqual(moved.videos[2].tags, ["Music"]);
    assert.deepEqual(moved.order, { music: [B, A, C] });
  });

  test("to the videos without a tag, only when it has no other tag; out of them, it takes the tag of the row", () => {
    assert.equal(canMove(list, C, "Music", null), false);
    assert.equal(moveVideo(list, {}, C, "Music", null, null), null);
    const untagged = moveVideo(list, {}, A, "Music", null, null)!;
    assert.deepEqual(untagged.videos[0].tags, []);
    assert.deepEqual(ids(rowsByTag(untagged.videos, untagged.order)).at(-1), [null, [A]]);
    assert.deepEqual(moveVideo(untagged.videos, untagged.order, A, null, "Code", null)!.videos[0].tags, ["Code"]);
    assert.equal(canMove(list, "zzzzzzzzzzz", "Music", "Code"), false);
  });

  test("the order of a row that no longer exists, or of a video no longer in it, is forgotten", () => {
    const moved = moveVideo(list, { code: [C], gone: [A], music: [A, "zzzzzzzzzzz", B] }, C, "Code", "Music", A)!;
    assert.deepEqual(moved.order, { music: [C, A, B] });
  });
});

describe("the videos of a section", () => {
  const C = "ccccccccccc";
  const D = "ddddddddddd";
  const list = [
    video(A, "2026-10-01T00:00:00.000Z", { tags: ["Music"], watched: true }),
    video(B, "2026-10-02T00:00:00.000Z", { tags: ["music/Jazz", "Code"] }),
    video(C, "2026-10-03T00:00:00.000Z", { tags: ["Musical"] }),
    video(D, "2026-10-04T00:00:00.000Z"),
  ];
  const found = (section: Parameters<typeof sectionVideos>[1]) => {
    const { videos, elsewhere } = sectionVideos(list, section);
    return [videos.map((item) => item.videoId), elsewhere];
  };

  test("a row holds the videos with its tag, whatever its case, watched or not; and those also elsewhere are counted", () => {
    assert.deepEqual(found({ tag: "MUSIC" }), [[A], 0]);
    assert.deepEqual(found({ tag: "Code" }), [[B], 1]);
    assert.deepEqual(found({ tag: null }), [[D], 0]);
  });

  test("a group holds the videos with any of its tags, its own tag too, but not a tag that only starts like it", () => {
    assert.deepEqual(found({ group: "Music" }), [[A, B], 1]);
  });

  test("they are deleted at once", () => {
    assert.deepEqual(
      removeVideos(list, [A, D]).map((item) => item.videoId),
      [B, C],
    );
  });
});

describe("moving a section in the View", () => {
  const C = "ccccccccccc";
  const D = "ddddddddddd";
  const list = [
    video(A, "2026-10-01T00:00:00.000Z", { tags: ["Ambient"] }),
    video(B, "2026-10-02T00:00:00.000Z", { tags: ["Music/Jazz", "Music/Rock"] }),
    video(C, "2026-10-03T00:00:00.000Z", { tags: ["Code"] }),
    video(D, "2026-10-04T00:00:00.000Z"),
  ];
  const layout = (sections: string[]) =>
    shelves(list, {}, sections).map((shelf) => (shelf.kind === "group" ? [shelf.group, shelf.rows.map((row) => row.tag)] : shelf.tag));

  test("a row or a group goes above or below another, and every section beside them is placed", () => {
    assert.deepEqual(layout([]), ["Ambient", "Code", ["Music", ["Music/Jazz", "Music/Rock"]], null]);
    const sections = moveSection(list, {}, [], "", "ambient", false);
    assert.deepEqual(sections, ["", "ambient", "code", "music/"]);
    assert.deepEqual(layout(sections), [null, "Ambient", "Code", ["Music", ["Music/Jazz", "Music/Rock"]]]);
    assert.deepEqual(moveSection(list, {}, sections, "music/", "ambient", true), ["", "ambient", "music/", "code"]);
  });

  test("the rows of a group go above or below one another, without changing the order around the group", () => {
    const sections = moveSection(list, {}, ["code", "music/"], "music/rock", "music/jazz", false);
    assert.deepEqual(sections, ["music/rock", "music/jazz", "code", "music/"]);
    assert.deepEqual(layout(sections), ["Code", ["Music", ["Music/Rock", "Music/Jazz"]], "Ambient", null]);
  });

  test("a section that is not beside the other, or that no longer exists, does not move, and gone keys are forgotten", () => {
    assert.deepEqual(moveSection(list, {}, ["gone", "code"], "music/rock", "ambient", false), ["code"]);
    assert.deepEqual(moveSection(list, {}, ["code"], "code", "code", true), ["code"]);
    assert.deepEqual(moveSection(list, {}, [], "gone", "code", true), []);
  });

  test("a section not yet placed comes after those placed, in its own order", () => {
    assert.deepEqual(layout(["music/", "code"]), [["Music", ["Music/Jazz", "Music/Rock"]], "Code", "Ambient", null]);
    assert.deepEqual(shelves(list).map(shelfKey), ["ambient", "code", "music/", ""]);
  });
});

describe("the groups of tags", () => {
  const C = "ccccccccccc";
  const D = "ddddddddddd";

  test("the spaces in excess around the separator are removed, and a blank side is dropped", () => {
    const list = [video(A, "2026-10-01T00:00:00.000Z")];
    assert.deepEqual(addTag(list, A, "  Music  /   jazz  rock ")[0].tags, ["Music/jazz rock"]);
    assert.deepEqual(addTag(list, A, "Music/ ")[0].tags, ["Music"]);
    assert.deepEqual(addTag(list, A, " /Jazz")[0].tags, ["Jazz"]);
    assert.deepEqual(addTag(list, A, " / "), list);
  });

  test("a group keeps the case it was first written in, in another tag of the group or as a tag of its own", () => {
    const list = [video(A, "2026-10-01T00:00:00.000Z", { tags: ["Music/Jazz"] }), video(B, "2026-10-02T00:00:00.000Z", { tags: ["Code"] })];
    assert.deepEqual(addTag(list, B, "music/Rock")[1].tags, ["Code", "Music/Rock"]);
    assert.deepEqual(addTag(list, A, "CODE/Svelte")[0].tags, ["Music/Jazz", "Code/Svelte"]);
    assert.deepEqual(addTag(list, B, "MUSIC/jazz")[1].tags, ["Code", "Music/Jazz"]);
  });

  test("the rows of a group are gathered in it, its own tag first, and the groups are in alphabetical order among the tags", () => {
    const list = [
      video(A, "2026-10-01T00:00:00.000Z", { tags: ["Music/Rock", "Music/Jazz"] }),
      video(B, "2026-10-02T00:00:00.000Z", { tags: ["Music", "Ambient"] }),
      video(C, "2026-10-03T00:00:00.000Z", { tags: ["Musical", "music/Rock"] }),
      video(D, "2026-10-04T00:00:00.000Z"),
    ];
    assert.deepEqual(
      shelves(list).map((shelf) =>
        shelf.kind === "group" ? [shelf.group, shelf.count, shelf.rows.map(({ tag, videos }) => [tag, videos.map((item) => item.videoId)])] : [shelf.tag],
      ),
      [
        ["Ambient"],
        [
          "Music",
          3,
          [
            ["Music", [B]],
            ["Music/Jazz", [A]],
            ["Music/Rock", [C, A]],
          ],
        ],
        ["Musical"],
        [null],
      ],
    );
  });

  test("a tag that is not a group stays a row, and a group with no video is not shown", () => {
    assert.deepEqual(
      shelves([video(A, "2026-10-01T00:00:00.000Z", { tags: ["Music"] })]).map((shelf) => shelf.kind),
      ["row"],
    );
    assert.deepEqual(shelves([]), []);
  });
});

describe("the videos to watch, as the Widget shows them", () => {
  test("how many are left to watch, and the most recently added of them", () => {
    const list = ["2026-10-01", "2026-10-05", "2026-10-03", "2026-10-02", "2026-10-04", "2026-10-06"].map((day, index) =>
      video(String(index).repeat(11), `${day}T00:00:00.000Z`, { watched: index === 1 }),
    );
    const { count, latest } = toWatch(list, 4);
    assert.equal(count, 5);
    assert.deepEqual(
      latest.map((item) => item.addedAt.slice(0, 10)),
      ["2026-10-06", "2026-10-04", "2026-10-03", "2026-10-02"],
    );
  });

  test("none when every video is watched", () => {
    assert.deepEqual(toWatch([video(A, "2026-10-01T00:00:00.000Z", { watched: true })], 4), { count: 0, latest: [] });
  });
});

describe("reading the settings", () => {
  test("the watched videos are hidden unless the User chose to show them", () => {
    assert.deepEqual(readSettings(null), { hideWatched: true, collapsed: [], order: {}, sections: [] });
    assert.deepEqual(readSettings({ hideWatched: "no" }), { hideWatched: true, collapsed: [], order: {}, sections: [] });
    assert.deepEqual(readSettings({ hideWatched: false }), { hideWatched: false, collapsed: [], order: {}, sections: [] });
    assert.deepEqual(readSettings({ hideWatched: true, other: 1 }), { hideWatched: true, collapsed: [], order: {}, sections: [] });
    assert.deepEqual(readSettings({ collapsed: ["Music", 3, null, "Code"] }).collapsed, ["Music", "Code"]);
    assert.deepEqual(readSettings({ collapsed: "Music" }).collapsed, []);
  });

  test("the order of the sections keeps the keys, and drops what is not one", () => {
    assert.deepEqual(readSettings({ sections: ["music/", 3, ""] }).sections, ["music/", ""]);
    assert.deepEqual(readSettings({ sections: "music/" }).sections, []);
  });

  test("the order of the rows keeps the lists of ids, and drops what is not one", () => {
    assert.deepEqual(readSettings({ order: { music: [A, 3, B], "": [B], code: "x" } }).order, { music: [A, B], "": [B] });
    assert.deepEqual(readSettings({ order: [A] }).order, {});
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
