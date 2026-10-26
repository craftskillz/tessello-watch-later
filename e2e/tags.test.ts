import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { card, details, field, ID, openDetails, openView, order, regions, reload, row, settingsStored, stored, storedVideo, tagField, useBrowser } from "./watch-later.ts";

useBrowser();

const OTHER = "aaaaaaaaaaa";
const THIRD = "bbbbbbbbbbb";

describe("tags", () => {
  test("two tags give two rows, a video with both is in each, and the videos without a tag are in the last row", async () => {
    // Pre-filled: this test is about the tags, not about adding the first video.
    const { page, host } = await openView({ storage: { videos: [storedVideo()] } });
    await row(page, "No tag").getByRole("article").waitFor();

    await openDetails(page);
    await tagField(page).fill("  Music ");
    await tagField(page).press("Enter");
    await tagField(page).fill("80s");
    await tagField(page).press("Enter");
    await details(page).getByRole("button", { name: "Remove the tag Music" }).waitFor();
    await details(page).getByRole("button", { name: "Close" }).click();
    await row(page, "80s").getByRole("article").waitFor();
    await row(page, "Music").getByRole("article").waitFor();
    assert.equal(await row(page, "No tag").count(), 0, "an empty row is not shown");
    assert.deepEqual(await regions(page), ["80s", "Music"]);

    // A tag chosen beside the field is put on the next videos added, as it was first written.
    const forNew = page.getByRole("combobox", { name: "Tags for new videos" });
    await forNew.fill("music");
    await forNew.press("Enter");
    await field(page).fill(`https://youtu.be/${OTHER}`);
    await field(page).press("Enter");
    await row(page, "Music").locator(`[data-video-id="${OTHER}"]`).waitFor();
    assert.equal(await row(page, "Music").getByRole("article").count(), 2);
    await row(page, "Music").getByText("2 videos", { exact: true }).waitFor();
    await stored(host, (videos) => videos.find((video) => video.videoId === OTHER)?.tags.join() === "Music");

    await row(page, "80s").getByRole("button", { name: "Details" }).click();
    await details(page).getByRole("button", { name: "Remove the tag 80s" }).click();
    await details(page).getByRole("button", { name: "Remove the tag Music" }).click();
    await details(page).getByRole("button", { name: "Close" }).click();
    await row(page, "No tag").locator(`[data-video-id="${ID}"]`).waitFor();
    assert.equal(await row(page, "80s").count(), 0);
    await stored(host, (videos) => videos.find((video) => video.videoId === ID)?.tags.length === 0);
  });

  test("the tags of a group are rows of a section, which folds, and stays folded after a reload", async () => {
    const { page, host } = await openView({
      storage: { videos: [storedVideo(ID, { tags: ["Music/Jazz", "80s"] }), storedVideo(OTHER, { tags: ["Music/Rock"] })] },
    });
    const group = page.getByRole("button", { name: /^Music \d+ videos?$/ });
    await row(page, "Music/Rock").getByRole("article").waitFor();

    // A row of the group is named by its whole tag for a screen reader, and shows the name of the tag in the group.
    await row(page, "Music/Jazz").getByRole("heading", { name: "Jazz", exact: true }).waitFor();
    await row(page, "Music/Rock").locator(`[data-video-id="${OTHER}"]`).waitFor();
    assert.deepEqual(await regions(page), ["80s", "Music/Jazz", "Music/Rock"]);
    assert.equal(await group.getAttribute("aria-expanded"), "true");
    await group.getByText("2 videos", { exact: true }).waitFor();

    await group.click();
    assert.equal(await group.getAttribute("aria-expanded"), "false");
    assert.equal(await row(page, "Music/Jazz").count(), 0, "a folded group hides its rows");
    await row(page, "80s").getByRole("article").waitFor();
    assert.deepEqual((await settingsStored(host, (settings) => settings.collapsed?.join() === "Music")).collapsed, ["Music"]);

    await reload(page);
    await row(page, "80s").getByRole("article").waitFor();
    assert.equal(await group.getAttribute("aria-expanded"), "false");
    assert.equal(await row(page, "Music/Rock").count(), 0);
    await group.click();
    await row(page, "Music/Rock").locator(`[data-video-id="${OTHER}"]`).waitFor();
  });

  test("a tag typed and left without Enter, or picked among the suggestions, is added too", async () => {
    const { page, host } = await openView({ storage: { videos: [storedVideo(ID), storedVideo(OTHER)] } });
    await card(page).waitFor();

    await openDetails(page);
    await tagField(page).fill("Music");
    await details(page).getByRole("button", { name: "Close" }).click();
    await row(page, "Music").getByRole("article").waitFor();
    await stored(host, (videos) => videos.find((video) => video.videoId === ID)?.tags.join() === "Music");

    // The browser fills the field with the suggestion picked, with an input that is not a keystroke.
    await openDetails(page, OTHER);
    await tagField(page).evaluate((input: HTMLInputElement) => {
      input.value = "Music";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await details(page).getByRole("button", { name: "Remove the tag Music" }).waitFor();
    assert.equal(await tagField(page).inputValue(), "");
    await stored(host, (videos) => videos.find((video) => video.videoId === OTHER)?.tags.join() === "Music");
  });

  test("a whole section is deleted at once, the videos it shares with other sections too, once the User confirms it", async () => {
    const { page, host } = await openView({
      storage: { videos: [storedVideo(ID, { tags: ["Music/Jazz", "80s"] }), storedVideo(OTHER, { tags: ["Music/Rock"] }), storedVideo(THIRD), storedVideo("ccccccccccc", { tags: ["Music/Pop"] })] },
    });
    const confirmation = page.getByRole("dialog", { name: "Delete this section?" });
    await row(page, "Music/Rock").getByRole("article").waitFor();

    // Cancelled, nothing is deleted.
    await row(page, "80s").getByRole("button", { name: "Delete the section 80s" }).click();
    await confirmation.getByText("The video of “80s” will be removed from your list. It is also in other sections").waitFor();
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await confirmation.waitFor({ state: "detached" });
    await row(page, "80s").getByRole("article").waitFor();
    assert.equal((await stored(host, () => true)).length, 4, "nothing is deleted");

    await row(page, "80s").getByRole("button", { name: "Delete the section 80s" }).click();
    await confirmation.getByRole("button", { name: "Delete" }).click();
    await row(page, "80s").waitFor({ state: "detached" });
    assert.equal(await row(page, "Music/Jazz").count(), 0, "the video leaves its other sections too");
    await stored(host, (videos) => videos.length === 3);

    // A group goes with every video of its rows.
    await page.getByRole("button", { name: "Delete the section Music", exact: true }).click();
    await confirmation.getByText("The 2 videos of “Music” will be removed from your list").waitFor();
    await confirmation.getByRole("button", { name: "Delete" }).click();
    await row(page, "Music/Rock").waitFor({ state: "detached" });
    await row(page, "Music/Pop").waitFor({ state: "detached" });
    await row(page, "No tag").locator(`[data-video-id="${THIRD}"]`).waitFor();
    await stored(host, (videos) => videos.map((video) => video.videoId).join() === THIRD);
    assert.deepEqual(await order(page, "No tag"), [THIRD]);
  });
});
