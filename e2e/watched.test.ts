import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "playwright";
import { card, confirmWatched, details, ID, openDetails, openView, reload, row, scoreDialog, settingsStored, status, stored, storedVideo, storedVideos, TITLE, useBrowser } from "./watch-later.ts";

useBrowser();

const hideWatched = (page: Page) => page.getByRole("checkbox", { name: "Hide watched" });
const watchedButton = (page: Page, id = ID) => card(page, id).getByRole("button", { name: "Watched" });
const markAsWatched = (page: Page) => details(page).getByRole("button", { name: "Mark as watched", exact: true });
const note = (page: Page) => details(page).getByRole("textbox", { name: "Note" });
const closeDetails = async (page: Page) => {
  await details(page).getByRole("button", { name: "Close" }).click();
  await details(page).waitFor({ state: "detached" });
};

describe("watched videos", () => {
  test("a video marked as watched is hidden, comes back with Undo, shows when the watched are not hidden, and its note and that choice survive a reload", async () => {
    const { page, host } = await openView({ storage: { videos: [storedVideo()] } });
    assert.equal(await hideWatched(page).isChecked(), true, "the watched videos are hidden by default");

    await watchedButton(page).click();
    await confirmWatched(page);
    await card(page).waitFor({ state: "detached" });
    await status(page).getByText("Marked as watched").waitFor();
    await stored(host, (videos) => videos[0]?.watched === true);

    // Undo brings it back as to watch.
    await status(page).getByRole("button", { name: "Undo" }).click();
    await card(page).waitFor();
    await stored(host, (videos) => videos[0]?.watched === false);
    await watchedButton(page).click();
    await confirmWatched(page);
    await card(page).waitFor({ state: "detached" });

    await hideWatched(page).uncheck();
    await card(page).waitFor();
    assert.equal(await watchedButton(page).getAttribute("aria-pressed"), "true");
    await card(page).getByText("Watched", { exact: true }).first().waitFor();

    await openDetails(page);
    await details(page).getByText("Rick Astley").waitFor();
    assert.equal(await note(page).getAttribute("maxlength"), "2000");
    await note(page).fill("For the talk on Friday");
    // Saved when the field is left.
    await note(page).blur();
    await stored(host, (videos) => videos[0]?.note === "For the talk on Friday");
    await closeDetails(page);
    await card(page).getByRole("img", { name: "Has a note" }).waitFor();
    await settingsStored(host, (settings) => settings.hideWatched === false);

    await reload(page);
    assert.equal(await hideWatched(page).isChecked(), false, "the choice is kept");
    await openDetails(page);
    assert.equal(await note(page).inputValue(), "For the talk on Friday");
  });

  test("marking watched needs a score and is undone by Cancel, Escape and the backdrop; the score and note are kept, and edited from the details", async () => {
    const { page, host } = await openView({ storage: { videos: [storedVideo()], settings: { hideWatched: false } } });
    const dialog = scoreDialog(page);
    const mark = dialog.getByRole("button", { name: "Mark as watched", exact: true });
    const radio = (name: string) => dialog.getByRole("radio", { name, exact: true });
    const before = await storedVideos(host);

    // Every way of dismissing the dialog leaves the whole video unchanged.
    for (const dismiss of ["button", "escape", "backdrop"]) {
      await watchedButton(page).click();
      await dialog.getByText(TITLE, { exact: true }).waitFor();
      assert.equal(await mark.isDisabled(), true);
      assert.equal(await dialog.getByRole("radio", { checked: true }).count(), 0);
      await radio("4").check();
      await dialog.getByRole("textbox", { name: "Note" }).fill("Discard this draft");
      if (dismiss === "button") await dialog.getByRole("button", { name: "Cancel" }).click();
      else if (dismiss === "escape") await dialog.getByRole("textbox", { name: "Note" }).press("Escape");
      else {
        const backdrop = page.locator(".wl-modal-backdrop");
        const width = await backdrop.evaluate((element) => element.clientWidth);
        await backdrop.click({ position: { x: width / 2, y: 5 } });
      }
      await dialog.waitFor({ state: "detached" });
      assert.deepEqual(await storedVideos(host), before, dismiss);
      assert.equal(await watchedButton(page).getAttribute("aria-pressed"), "false", dismiss);
    }

    await watchedButton(page).click();
    // Native radio buttons support the keyboard, including selecting zero.
    await radio("0").focus();
    await radio("0").press("Space");
    assert.equal(await mark.isEnabled(), true);
    await radio("0").press("ArrowRight");
    assert.equal(await radio("1").isChecked(), true);
    // Clicking the selected star removes one star, including the last one for a score of zero.
    await radio("4").click();
    await radio("4").click();
    assert.equal(await radio("3").isChecked(), true);
    assert.equal(await dialog.locator(".wl-filled").count(), 3);
    await radio("1").click();
    await radio("1").click();
    assert.equal(await radio("0").isChecked(), true);
    assert.equal(await dialog.locator(".wl-filled").count(), 0);
    assert.equal(await mark.isEnabled(), true);
    await confirmWatched(page, 4, "  For the talk on Friday  ");
    await stored(host, (videos) => videos[0]?.watched === true && videos[0]?.score === 4 && videos[0]?.note === "For the talk on Friday");
    await card(page).getByRole("img", { name: "Score: 4 out of 5" }).waitFor();

    await reload(page);
    await card(page).getByRole("img", { name: "Score: 4 out of 5" }).waitFor();
    await openDetails(page);
    assert.equal(await details(page).getByRole("radio", { name: "4", exact: true }).isChecked(), true);
    assert.equal(await note(page).inputValue(), "For the talk on Friday");

    // Changing the score keeps the date it was watched.
    const watchedAt = (await storedVideos(host))[0].watchedAt;
    assert.ok(watchedAt);
    await details(page).getByRole("radio", { name: "1", exact: true }).click();
    await details(page).getByRole("radio", { name: "1", exact: true }).click();
    await stored(host, (videos) => videos[0]?.score === 0);
    assert.equal((await storedVideos(host))[0].watchedAt, watchedAt);

    // Back to watch forgets the score and the date, and asks nothing.
    await details(page).getByRole("button", { name: "Mark as to watch", exact: true }).click();
    await stored(host, (videos) => !videos[0]?.watched && videos[0]?.score === undefined && videos[0]?.watchedAt === undefined);
    assert.equal(await dialog.count(), 0, "returning to watch opens no dialog");

    // The details open the same review dialog, prefilled with the current note.
    await markAsWatched(page).click();
    assert.equal(await dialog.getByRole("textbox", { name: "Note" }).inputValue(), "For the talk on Friday");
    await dialog.getByRole("textbox", { name: "Note" }).press("Escape");
    await dialog.waitFor({ state: "detached" });
    await details(page).waitFor();
    await markAsWatched(page).click();
    await confirmWatched(page, 5, "A new review");
    assert.equal(await note(page).inputValue(), "A new review");
    await closeDetails(page);
    await stored(host, (videos) => videos[0]?.score === 5 && videos[0]?.note === "A new review");
  });

  test("watched videos lead their row by score, then the videos to watch, also after a reload; a new score reorders at once, and hiding the watched leaves the others in place", async () => {
    const ids = [ID, "aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"];
    // The most recently added first: the order of the row before any is watched.
    const videos = ids.map((id, index) => storedVideo(id, { title: `Video ${index}`, addedAt: `2026-01-0${5 - index}T00:00:00.000Z` }));
    const { page, host } = await openView({ storage: { videos } });
    const inRow = row(page, "No tag");
    const order = () => inRow.getByRole("article").evaluateAll((cards) => cards.map((element) => element.getAttribute("data-video-id")));
    await inRow.getByRole("article").first().waitFor();
    assert.deepEqual(await order(), ids);

    for (const [index, score] of [2, 5, 0].entries()) {
      await watchedButton(page, ids[index]).click();
      await confirmWatched(page, score);
    }
    await stored(host, (list) => list.filter((video) => video.watched).length === 3);
    await hideWatched(page).uncheck();
    await card(page, ids[1]).waitFor();
    assert.deepEqual(await order(), [ids[1], ids[0], ids[2], ids[3], ids[4]]);
    await settingsStored(host, (settings) => settings.hideWatched === false);

    await reload(page);
    await inRow.getByRole("article").first().waitFor();
    assert.deepEqual(await order(), [ids[1], ids[0], ids[2], ids[3], ids[4]]);

    // Changing a score reorders the row immediately.
    await openDetails(page, ids[2]);
    await details(page).getByRole("radio", { name: "4", exact: true }).check();
    await closeDetails(page);
    assert.deepEqual(await order(), [ids[1], ids[2], ids[0], ids[3], ids[4]]);
    await hideWatched(page).check();
    await card(page, ids[0]).waitFor({ state: "detached" });
    assert.deepEqual(await order(), [ids[3], ids[4]]);
  });

  test("Undo restores the previous note as well as the watch state after reviewing from the details", async () => {
    const { page, host } = await openView({ storage: { videos: [storedVideo()] } });

    await openDetails(page);
    await note(page).fill("Before watching");
    await note(page).blur();
    await stored(host, (videos) => videos[0]?.note === "Before watching");
    const before = await storedVideos(host);

    await markAsWatched(page).click();
    await confirmWatched(page, 3, "After watching");
    assert.equal(await note(page).inputValue(), "After watching");
    await closeDetails(page);
    await status(page).getByRole("button", { name: "Undo" }).click();
    await card(page).waitFor();
    await stored(host, (videos) => !videos[0]?.watched && videos[0]?.note === "Before watching");
    assert.deepEqual(await storedVideos(host), before);
  });

  test("Undo removes the note a review added when the video had none", async () => {
    const { page, host } = await openView({ storage: { videos: [storedVideo()] } });
    const before = await storedVideos(host);

    await watchedButton(page).click();
    await confirmWatched(page, 3, "Written while reviewing");
    await card(page).waitFor({ state: "detached" });
    await stored(host, (videos) => videos[0]?.note === "Written while reviewing");
    await status(page).getByRole("button", { name: "Undo" }).click();
    await card(page).waitFor();
    await stored(host, (videos) => !videos[0]?.watched && videos[0]?.note === undefined);
    assert.deepEqual(await storedVideos(host), before);
  });

  test("an older watched video without a score stays visible and can receive one", async () => {
    const { page, host } = await openView({ storage: { videos: [storedVideo(ID, { watched: true })], settings: { hideWatched: false } } });

    await card(page).waitFor();
    assert.equal(await card(page).getByRole("img", { name: /^Score:/ }).count(), 0);
    await openDetails(page);
    assert.equal(await details(page).getByRole("radio", { checked: true }).count(), 0);
    await details(page).getByRole("radio", { name: "2", exact: true }).check();
    await closeDetails(page);
    await card(page).getByRole("img", { name: "Score: 2 out of 5" }).waitFor();
    await stored(host, (videos) => videos[0]?.score === 2);
  });

  test("a video is deleted only once the User confirms it, and the list is then empty", async () => {
    const { page, host } = await openView({ storage: { videos: [storedVideo()] } });
    const confirmation = page.getByRole("dialog", { name: "Delete this video?" });

    await openDetails(page);
    await details(page).getByRole("button", { name: "Delete" }).click();
    await confirmation.waitFor();
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await confirmation.waitFor({ state: "detached" });
    await card(page).waitFor();
    assert.equal((await storedVideos(host)).length, 1);

    await details(page).getByRole("button", { name: "Delete" }).click();
    await confirmation.getByRole("button", { name: "Delete" }).click();
    await card(page).waitFor({ state: "detached" });
    await details(page).waitFor({ state: "detached" });
    await page.getByText(/^No videos yet/).waitFor();
    await stored(host, (videos) => videos.length === 0);
  });
});
