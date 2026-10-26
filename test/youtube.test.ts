import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { oembedUrl, parseYouTubeUrl, thumbnailUrl } from "../src/lib/youtube.ts";

const ID = "dQw4w9WgXcQ";

describe("recognizing a YouTube video in what the User pastes", () => {
  test("every form of a video URL, with or without https:// and www.", () => {
    for (const url of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}`,
      `www.youtube.com/watch?v=${ID}`,
      `youtube.com/watch?v=${ID}`,
      `http://www.youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://music.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `youtu.be/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
    ]) {
      assert.deepEqual(parseYouTubeUrl(url), { videoId: ID }, url);
    }
  });

  test("ignores the other parameters, and the spaces around", () => {
    assert.deepEqual(parseYouTubeUrl(`  https://www.youtube.com/watch?list=PL123&v=${ID}&feature=share&si=abc \n`), { videoId: ID });
    assert.deepEqual(parseYouTubeUrl(`https://youtu.be/${ID}?si=xyz`), { videoId: ID });
    assert.deepEqual(parseYouTubeUrl(`https://www.youtube.com/shorts/${ID}?feature=share`), { videoId: ID });
  });

  test("reads the start, from t or start, in seconds", () => {
    assert.deepEqual(parseYouTubeUrl(`https://youtu.be/${ID}?t=90`), { videoId: ID, start: 90 });
    assert.deepEqual(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=90s`), { videoId: ID, start: 90 });
    assert.deepEqual(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1m30s`), { videoId: ID, start: 90 });
    assert.deepEqual(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`), { videoId: ID, start: 3723 });
    assert.deepEqual(parseYouTubeUrl(`https://www.youtube.com/embed/${ID}?start=42`), { videoId: ID, start: 42 });
  });

  test("a start that cannot be read, or of zero, is no start", () => {
    assert.deepEqual(parseYouTubeUrl(`https://youtu.be/${ID}?t=soon`), { videoId: ID });
    assert.deepEqual(parseYouTubeUrl(`https://youtu.be/${ID}?t=0`), { videoId: ID });
  });

  test("rejects what is not a YouTube video", () => {
    for (const text of [
      "",
      "hello",
      ID,
      "https://vimeo.com/123456789",
      `https://www.youtube.com.evil.com/watch?v=${ID}`,
      `https://notyoutube.com/watch?v=${ID}`,
      "https://www.youtube.com/",
      "https://www.youtube.com/@channel",
      "https://www.youtube.com/playlist?list=PL123",
      "https://www.youtube.com/watch?v=short",
      `https://www.youtube.com/watch?v=${ID}x`,
      "https://youtu.be/dQw4w9WgXc!",
      `https://www.youtube.com/shorts/${ID}/extra`,
      `ftp://www.youtube.com/watch?v=${ID}`,
      `see https://youtu.be/${ID}`,
    ]) {
      assert.equal(parseYouTubeUrl(text), null, text);
    }
  });
});

describe("the URLs built from the id of a video", () => {
  test("the thumbnail is the medium one of i.ytimg.com", () => {
    assert.equal(thumbnailUrl(ID), `https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
  });

  test("the oEmbed request asks for the watch URL of the video, without its start, in JSON", () => {
    const url = new URL(oembedUrl(ID));
    assert.equal(`${url.origin}${url.pathname}`, "https://www.youtube.com/oembed");
    assert.equal(url.searchParams.get("url"), `https://www.youtube.com/watch?v=${ID}`);
    assert.equal(url.searchParams.get("format"), "json");
  });
});
