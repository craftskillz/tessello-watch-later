import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addTags, card, ID, openView, order, regions, reload, row, settingsStored, slot, status, stored, storedSettings, storedVideo, useBrowser } from "./watch-later.ts";

useBrowser();

const OTHER = "aaaaaaaaaaa";
const THIRD = "bbbbbbbbbbb";
const noLink = async (page: Parameters<typeof status>[0]) => assert.equal((await status(page).textContent())?.trim(), "");

describe("moving cards and sections by hand", () => {
  test("a card dragged in its row changes place, dragged to another row changes tag, and both are kept after a reload", async () => {
    // Pre-filled, the newest first: this test is about moving, not about adding.
    const { page, host } = await openView({
      storage: { videos: [storedVideo(ID), storedVideo(OTHER, { addedAt: "2026-01-02T00:00:00.000Z" }), storedVideo(THIRD, { addedAt: "2026-01-03T00:00:00.000Z" })] },
    });
    await card(page, THIRD).waitFor();
    assert.deepEqual(await order(page, "No tag"), [THIRD, OTHER, ID], "the newest first");

    // Dropped on the left half of a card, a card goes before it.
    await slot(page, ID).dragTo(slot(page, THIRD), { targetPosition: { x: 10, y: 60 } });
    assert.deepEqual(await order(page, "No tag"), [ID, THIRD, OTHER]);
    await noLink(page);
    await settingsStored(host, (settings) => settings.order?.[""]?.join() === [ID, THIRD, OTHER].join());

    await addTags(page, THIRD, "Music");
    await row(page, "Music").getByRole("article").waitFor();

    // Dropped on another row, it leaves its row and takes the tag of the other.
    await slot(page, OTHER).dragTo(slot(page, THIRD), { targetPosition: { x: 10, y: 60 } });
    assert.deepEqual(await order(page, "Music"), [OTHER, THIRD]);
    assert.deepEqual(await order(page, "No tag"), [ID]);
    await stored(host, (videos) => videos.find((video) => video.videoId === OTHER)?.tags.join() === "Music");
    await settingsStored(host, (settings) => settings.order?.music?.join() === [OTHER, THIRD].join());

    await reload(page);
    await row(page, "Music").getByRole("article").first().waitFor();
    assert.deepEqual(await order(page, "Music"), [OTHER, THIRD]);
    assert.deepEqual(await order(page, "No tag"), [ID]);
  });

  test("dragging among watched cards only places unwatched cards, while watched cards change tags at their score position", async () => {
    const [HIGH, LOW, FIRST, LAST, OTHER_ROW] = [ID, "aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"];
    const watched = { watched: true, watchedAt: "2026-10-23T00:00:00Z" };
    const { page, host } = await openView({
      viewport: { width: 1600, height: 1100 },
      storage: {
        videos: [
          storedVideo(HIGH, { title: "Video 0", addedAt: "2026-10-01T00:00:00Z", tags: ["Music"], score: 5, ...watched }),
          storedVideo(LOW, { title: "Video 1", addedAt: "2026-10-02T00:00:00Z", tags: ["Music"], score: 2, ...watched }),
          storedVideo(FIRST, { title: "Video 2", addedAt: "2026-10-03T00:00:00Z", tags: ["Music"] }),
          storedVideo(LAST, { title: "Video 3", addedAt: "2026-10-04T00:00:00Z", tags: ["Music"] }),
          storedVideo(OTHER_ROW, { title: "Video 4", addedAt: "2026-10-05T00:00:00Z", tags: ["Other"], score: 4, ...watched }),
        ],
        settings: { hideWatched: false, order: { music: [FIRST, LAST] } },
      },
    });
    await card(page, HIGH).waitFor();
    await slot(page, LOW).dragTo(slot(page, HIGH), { targetPosition: { x: 10, y: 60 } });
    assert.deepEqual(await order(page, "Music"), [HIGH, LOW, FIRST, LAST], "watched cards cannot be manually reordered");

    // Inspect the actual drop marker while dragging an unwatched card over a watched one.
    await slot(page, LAST).evaluate((element) => {
      const dataTransfer = new DataTransfer();
      element.dispatchEvent(new DragEvent("dragstart", { dataTransfer, bubbles: true }));
    });
    await slot(page, HIGH).evaluate((element) => {
      const { left, top } = element.getBoundingClientRect();
      element.dispatchEvent(new DragEvent("dragover", { clientX: left + 10, clientY: top + 60, bubbles: true, cancelable: true }));
    });
    assert.equal(await slot(page, FIRST).evaluate((element) => element.classList.contains("wl-drop-before")), true);
    assert.equal(await slot(page, HIGH).evaluate((element) => element.classList.contains("wl-drop-before")), false);
    await slot(page, HIGH).dispatchEvent("drop");
    assert.deepEqual(await order(page, "Music"), [HIGH, LOW, LAST, FIRST]);
    await slot(page, LOW).dragTo(slot(page, OTHER_ROW), { targetPosition: { x: 10, y: 60 } });
    assert.deepEqual(await order(page, "Other"), [OTHER_ROW, LOW], "the score determines the landing position");
    assert.deepEqual(await order(page, "Music"), [HIGH, LAST, FIRST]);
    await stored(host, (videos) => videos.find((video) => video.videoId === LOW)?.tags.join() === "Other");
    await settingsStored(host, (settings) => settings.order?.music?.join() === [LAST, FIRST].join());
    assert.deepEqual((await storedSettings(host))?.order, { music: [LAST, FIRST] }, "watched cards are not added to settings.order");

    await reload(page);
    await card(page, LOW).waitFor();
    assert.deepEqual(await order(page, "Other"), [OTHER_ROW, LOW]);
    assert.deepEqual(await order(page, "Music"), [HIGH, LAST, FIRST]);
  });

  test("a section dragged by its header goes above or below another, in the View or in its group, and stays there after a reload", async () => {
    // Every section in sight, so that the drag needs no scrolling.
    const { page, host } = await openView({
      viewport: { width: 1280, height: 1400 },
      storage: { videos: [storedVideo(ID, { tags: ["Music/Jazz", "80s"] }), storedVideo(OTHER, { tags: ["Music/Rock"] })] },
    });
    const group = page.locator(".wl-group");
    await row(page, "Music/Rock").getByRole("article").waitFor();
    assert.deepEqual(await regions(page), ["80s", "Music/Jazz", "Music/Rock"]);

    // Dropped on the lower half of the group, the row goes below it.
    const box = (await group.boundingBox())!;
    await row(page, "80s").locator("header").dragTo(group, { targetPosition: { x: 40, y: box.height - 10 } });
    assert.deepEqual(await regions(page), ["Music/Jazz", "Music/Rock", "80s"]);
    await noLink(page);

    // A row of the group, dropped on the lower half of the other, goes below it.
    const jazz = (await row(page, "Music/Jazz").boundingBox())!;
    await row(page, "Music/Rock").locator("header").dragTo(row(page, "Music/Jazz"), { targetPosition: { x: 40, y: jazz.height - 10 } });
    assert.deepEqual(await regions(page), ["Music/Jazz", "Music/Rock", "80s"]);
    await noLink(page);

    // On the upper half, above it.
    await row(page, "Music/Rock").locator("header").dragTo(row(page, "Music/Jazz"), { targetPosition: { x: 40, y: 10 } });
    assert.deepEqual(await regions(page), ["Music/Rock", "Music/Jazz", "80s"]);
    await noLink(page);

    // A row of a group stays in it: dropped beside a section of the View, it does not move.
    await row(page, "Music/Jazz").locator("header").dragTo(row(page, "80s"), { targetPosition: { x: 40, y: 10 } });
    assert.deepEqual(await regions(page), ["Music/Rock", "Music/Jazz", "80s"]);

    const settings = await settingsStored(host, (written) => written.sections?.join() === "music/rock,music/jazz,music/,80s");
    assert.deepEqual(settings.sections, ["music/rock", "music/jazz", "music/", "80s"]);

    await reload(page);
    await row(page, "80s").getByRole("article").waitFor();
    assert.deepEqual(await regions(page), ["Music/Rock", "Music/Jazz", "80s"]);
  });
});
