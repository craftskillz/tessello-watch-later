import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addByField, card, cards, drop, dragLeave, field, ID, isLoaded, openView, paste, reload, status, stored, storedVideos, TITLE, titleLink, useBrowser, watchUrl } from "./watch-later.ts";

useBrowser();

describe("adding videos to Watch Later", () => {
  test("a pasted URL shows the video with its title and channel, opens it on YouTube at its start, and is kept after a reload", async () => {
    const { page, host } = await openView();

    // Typed as a User copies it from a message: without https://.
    await field(page).fill(`youtu.be/${ID}?t=1m30s&si=share`);
    await field(page).press("Enter");
    const title = titleLink(page);
    await title.waitFor();
    await page.getByText("Rick Astley").waitFor();
    await page.getByText("just now").waitFor();
    assert.equal(await field(page).inputValue(), "", "the field is emptied for the next URL");
    assert.equal(await title.getAttribute("href"), `${watchUrl()}&t=90s`);
    assert.equal(await title.getAttribute("target"), "_blank");
    const thumbnail = page.getByRole("img", { name: `Thumbnail of ${TITLE}` });
    assert.equal(await thumbnail.getAttribute("src"), `https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
    await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
    assert.ok(await isLoaded(thumbnail), "the thumbnail is loaded");
    await stored(host, (videos) => videos.some((video) => video.videoId === ID && video.metaStatus === "ok"));

    await reload(page);
    await titleLink(page).waitFor();
    await page.getByRole("region", { name: "No tag" }).getByRole("article").waitFor();
    assert.equal((await storedVideos(host)).length, 1);
  });

  test("a URL pasted in the field or anywhere on the page is added at once, once", async () => {
    const { page, host } = await openView();

    assert.equal(await paste(page, "body", watchUrl()), true, "the View takes the paste");
    await titleLink(page).waitFor();
    await paste(page, "body", `youtube.com/shorts/${ID}`);
    assert.equal(await paste(page, "body", "not a video"), false, "a paste with no video is left alone");
    assert.equal(await paste(page, "form input", `https://youtu.be/${ID}`), true, "the View takes the paste in the field, which stays empty");
    assert.equal(await field(page).inputValue(), "");
    await stored(host, (videos) => videos.length === 1 && videos[0].metaStatus === "ok");
    assert.equal(await cards(page).count(), 1);

    // In the field, a first video is added by the paste alone, and the field stays empty.
    assert.equal(await paste(page, "form input", "https://youtu.be/aaaaaaaaaaa"), true);
    await card(page, "aaaaaaaaaaa").waitFor();
    assert.equal(await field(page).inputValue(), "");
    assert.equal(await cards(page).count(), 2);
  });

  test("a dropped link shows the zone to drop on, and tells what was added, what was there and what is not a video", async () => {
    const { page, host } = await openView();

    await drop(page, { "text/uri-list": watchUrl() }, false);
    const zone = page.getByText("Drop to add");
    await zone.waitFor();
    // Escape, or leaving the View, ends the drag.
    await dragLeave(page);
    await zone.waitFor({ state: "hidden" });

    await drop(page, { "text/uri-list": `# ${TITLE}\n${watchUrl()}`, "text/plain": TITLE });
    await titleLink(page).waitFor();
    assert.equal(await zone.count(), 0, "the drop zone is gone once dropped");
    await stored(host, (videos) => videos.length === 1 && videos[0].metaStatus === "ok");

    // Another form of the same video, at another start.
    await drop(page, { "text/plain": `https://youtu.be/${ID}?t=42` });
    await status(page).getByText("This video is already in your list").waitFor();
    assert.equal(await cards(page).count(), 1);

    await drop(page, { "text/plain": "https://example.com/not-a-video" });
    await status(page).getByText("This is not a YouTube video").waitFor();

    await drop(page, { "text/plain": `youtu.be/${ID}\nhttps://youtu.be/aaaaaaaaaaa\nnot a video` });
    await status(page).getByText("1 added, 1 already there, 1 ignored").waitFor();
    await stored(host, (videos) => videos.length === 2);
  });

  test("a video whose title cannot be read is still added, with its URL as title, and Retry reads it", async () => {
    const { page, host, youtube } = await openView({ youtube: { online: false } });

    await field(page).fill(watchUrl());
    await field(page).press("Enter");
    await titleLink(page, watchUrl()).waitFor();
    const retry = page.getByRole("button", { name: `Read the title of ${watchUrl()} again` });
    await retry.waitFor();
    const [added] = await stored(host, (videos) => videos.length === 1 && videos[0].metaStatus === "failed");
    assert.equal(added.title, watchUrl());

    youtube.online = true;
    await retry.click();
    await titleLink(page).waitFor();
    await retry.waitFor({ state: "detached" });
    assert.equal(youtube.oembed, 2);
    await stored(host, (videos) => videos[0]?.title === TITLE && videos[0].metaStatus === "ok");
  });

  test("tells the User when a change cannot be saved, and keeps it on screen", async () => {
    const { page, host } = await openView();
    host.refuseWrites({ code: "quota_exceeded" });

    await addByField(page, watchUrl());
    await page.getByRole("alert").getByText(/Your last change could not be saved: the storage of the Watch Later Module is full/).waitFor();
    await titleLink(page).waitFor();
    assert.equal(await cards(page).count(), 1);
    assert.deepEqual(await storedVideos(host), [], "nothing was saved");
  });
});
