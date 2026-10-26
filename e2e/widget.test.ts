// The Widget: what it shows at its size, reading the videos again when shown, and its ways into the View. What it counts
// is a unit test (videos).

import assert from "node:assert/strict";
import { test } from "node:test";
import { until } from "@tessello/sdk/testing";
import { ID, openWidget, stored, storedVideo, TITLE, useBrowser, watchLaterHost } from "./watch-later.ts";

useBrowser();

test("the Widget shows a video added in the View until it is watched, does not scroll at its size, and + Add and Open ask for the View", async () => {
  const host = watchLaterHost();
  const { page, surface } = await openWidget({ host });
  await page.getByText("Nothing left to watch").waitFor();

  // + Add asks for the View, without params.
  await page.getByRole("button", { name: "+ Add" }).click();
  await until(() => host.openedViews.length === 1, "+ Add to open the View");
  assert.deepEqual(host.openedViews, [{}]);

  // The View, meanwhile, adds a video; the Widget, hidden behind it, reads the videos when shown again.
  surface.setVisible(false);
  await host.storage.set("videos", [{ ...storedVideo(), start: 42 }]);
  await stored(host, (videos) => videos.length === 1);
  surface.setVisible(true);
  await page.getByText("1 to watch").waitFor();
  const link = page.getByRole("link", { name: TITLE });
  assert.equal(await link.getAttribute("href"), `https://www.youtube.com/watch?v=${ID}&t=42s`);
  assert.equal(await link.getAttribute("target"), "_blank");
  assert.equal(await page.locator("img").getAttribute("src"), `https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
  assert.ok(
    await page.locator("body").evaluate((body) => body.scrollHeight <= innerHeight && body.scrollWidth <= innerWidth),
    "the Widget does not scroll",
  );

  // Open ↗ asks for the View, without params.
  await page.getByRole("button", { name: "Open ↗" }).click();
  await until(() => host.openedViews.length === 2, "Open to open the View");
  assert.deepEqual(host.openedViews, [{}, {}]);

  // Watched in the View, the video is no longer shown.
  surface.setVisible(false);
  await host.storage.set("videos", [{ ...storedVideo(), start: 42, watched: true, watchedAt: "2026-10-02T00:00:00.000Z", score: 4 }]);
  await stored(host, (videos) => videos[0]?.watched === true);
  surface.setVisible(true);
  await page.getByText("Nothing left to watch").waitFor();
  assert.equal(await page.getByRole("link").count(), 0);
});
