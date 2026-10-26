// What the browser tests of Watch Later share: its built package served from dist/, its View and Widget opened in
// Chromium against the Test Host of the SDK, YouTube faked by Playwright, and the gestures of the View. Every wait goes
// through `until`, which reads again until a deadline (E2E_CPU_SLOWDOWN multiplies it), or through Playwright's own
// wait for an element, never through a fixed time.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before } from "node:test";
import { type Browser, chromium, type Locator, type Page } from "playwright";
import { createTestHost, type FolderServer, serveFolder, slowDownCpu, type TestHost, type TestHostOptions, type TestSurface, until, WIDGET_SIZES } from "@tessello/sdk/testing";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const manifest = JSON.parse(await readFile(`${DIST}manifest.json`, "utf8").catch(() => {
  throw new Error("No dist/: run `npm run build` before the browser tests.");
}));
const module = { id: manifest.id as string, version: manifest.version as string };

/** The video most tests add. */
export const ID = "dQw4w9WgXcQ";
export const TITLE = "Never Gonna Give You Up";
export const watchUrl = (id = ID) => `https://www.youtube.com/watch?v=${id}`;

let browser: Browser;
let server: FolderServer;

/** Serves dist/ and starts Chromium for the tests of the file that calls it. */
export function useBrowser(): void {
  before(async () => {
    server = await serveFolder(DIST);
    browser = await chromium.launch();
  });
  after(async () => {
    await browser?.close();
    await server?.close();
  });
}

/** A page in a new browser context, slowed down by E2E_CPU_SLOWDOWN. */
async function newPage(viewport?: { width: number; height: number }): Promise<Page> {
  const page = await (await browser.newContext(viewport ? { viewport } : {})).newPage();
  await slowDownCpu(page);
  return page;
}

export interface Opened {
  page: Page;
  host: TestHost;
  surface: TestSurface;
  /** The fake YouTube the page was opened with. */
  youtube: FakeYouTube;
}

/** A Test Host for Watch Later, under the Identifier of its Manifest. */
export const watchLaterHost = (options: Omit<TestHostOptions, "module"> = {}) => createTestHost({ module, ...options });

interface OpenOptions {
  host?: TestHost;
  storage?: TestHostOptions["storage"];
  /** The size of the page; Playwright's 1280 × 720 by default. */
  viewport?: { width: number; height: number };
  /** What the fake YouTube answers; online, with `TITLE`, by default. */
  youtube?: Partial<FakeYouTube>;
  /** Called with the page before it loads the View, such as to add more routes. */
  prepare?: (page: Page) => Promise<unknown>;
}

/** Opens the View, in English, on a Test Host of its own unless one is given, YouTube faked, and waits until it has read the videos. */
export async function openView(options: OpenOptions = {}): Promise<Opened> {
  const host = options.host ?? watchLaterHost({ storage: options.storage });
  const page = await newPage(options.viewport);
  const youtube = newYouTube(options.youtube);
  await fakeYouTube(page, youtube);
  await options.prepare?.(page);
  const surface = await host.attach(page, { surface: "view" });
  await page.goto(`${server.url}/${manifest.view.entry}`);
  await loaded(page);
  return { page, host, surface, youtube };
}

/** Opens the Widget, at the size its Manifest declares, on a Test Host of its own unless one is given. */
export async function openWidget(options: Pick<OpenOptions, "host" | "storage" | "youtube"> = {}): Promise<Opened> {
  const host = options.host ?? watchLaterHost({ storage: options.storage });
  const page = await newPage(WIDGET_SIZES[manifest.widget.size as keyof typeof WIDGET_SIZES]);
  const youtube = newYouTube(options.youtube);
  await fakeYouTube(page, youtube);
  const surface = await host.attach(page, { surface: "widget" });
  await page.goto(`${server.url}/${manifest.widget.entry}`);
  return { page, host, surface, youtube };
}

/** Waits until the View has read the videos: its field shows. */
const loaded = (page: Page) => field(page).waitFor();

/** Reloads the View, and waits until it has read the videos again. */
export async function reload(page: Page) {
  await page.reload();
  await loaded(page);
}

// YouTube, faked.

export interface FakeYouTube {
  /** False: the network is down. Read at each request, so that a test can change it. */
  online: boolean;
  /** The title oEmbed answers. */
  title: string;
  /** How many oEmbed requests were made. */
  oembed: number;
}

const newYouTube = (fake: Partial<FakeYouTube> = {}): FakeYouTube => ({ online: true, title: TITLE, oembed: 0, ...fake });

// 1×1 PNG.
const DOT = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

/** Answers for YouTube, so that the tests do not depend on it: the thumbnails, and oEmbed with `fake.title`, or as when offline. */
export async function fakeYouTube(page: Page, fake: FakeYouTube) {
  // The View is served from another origin than YouTube's, which the answer must allow.
  const headers = { "Access-Control-Allow-Origin": "*" };
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ headers, contentType: "image/png", body: DOT }));
  await page.route("https://www.youtube.com/oembed**", (route) => {
    fake.oembed++;
    if (!fake.online) return route.abort("internetdisconnected");
    const url = new URL(route.request().url());
    assert.match(url.searchParams.get("url") ?? "", /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
    assert.equal(url.searchParams.get("format"), "json");
    return route.fulfill({ headers, contentType: "application/json", body: JSON.stringify({ title: fake.title, author_name: "Rick Astley", type: "video" }) });
  });
}

// The storage, as the Test Host holds it.

export interface StoredVideo {
  videoId: string;
  title: string;
  metaStatus: string;
  watched: boolean;
  watchedAt?: string;
  score?: number;
  note?: string;
  tags: string[];
}

export interface StoredSettings {
  hideWatched: boolean;
  collapsed?: string[];
  order?: Record<string, string[]>;
  sections?: string[];
}

/** A video as the storage holds it, to open the View with: to watch, its title read, added at the time given (ISO) or long ago. */
export const storedVideo = (videoId = ID, fields: Partial<StoredVideo> & { addedAt?: string; channel?: string } = {}) =>
  ({ videoId, title: TITLE, channel: "Rick Astley", addedAt: "2026-01-01T00:00:00.000Z", watched: false, tags: [], metaStatus: "ok", ...fields }) as unknown as StoredVideo & Record<string, never>;

export const storedVideos = async (host: TestHost) => ((await host.storage.get("videos")) ?? []) as unknown as StoredVideo[];
export const storedSettings = async (host: TestHost) => (await host.storage.get("settings")) as unknown as StoredSettings | null;

/** Waits until the videos stored pass `written`, so that a reload cannot cut a write short, and returns them. */
export const stored = (host: TestHost, written: (videos: StoredVideo[]) => boolean, what = "the videos to be written") =>
  until(async () => {
    const videos = await storedVideos(host);
    return written(videos) && videos;
  }, what);

/** Waits until the settings stored pass `written`, and returns them. */
export const settingsStored = (host: TestHost, written: (settings: StoredSettings) => boolean) =>
  until(async () => {
    const settings = await storedSettings(host);
    return settings !== null && written(settings) && settings;
  }, "the settings to be written");

// The gestures of the View.

export const field = (page: Page) => page.getByRole("textbox", { name: "Paste a YouTube URL" });
export const cards = (page: Page) => page.getByRole("article");
export const card = (page: Page, id = ID) => page.locator(`[data-video-id="${id}"]`);
export const row = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
export const titleLink = (page: Page, title = TITLE) => page.getByRole("link", { name: title, exact: true });
export const status = (page: Page) => page.getByRole("status");
export const details = (page: Page) => page.getByRole("dialog");

/** Adds a video by its URL, typed in the field, and waits for its title. */
export async function addByField(page: Page, url: string, title = TITLE) {
  await field(page).fill(url);
  await field(page).press("Enter");
  await titleLink(page, title).first().waitFor();
}

/** The dialog that asks for the score of a video marked as watched. */
export const scoreDialog = (page: Page) => page.getByRole("dialog", { name: "Mark as watched", exact: true });

/** Completes the score dialog opened from a card or the details. */
export async function confirmWatched(page: Page, score = 4, note?: string) {
  const dialog = scoreDialog(page);
  const choice = dialog.getByRole("radio", { name: String(score), exact: true });
  if (score === 0) {
    await choice.focus();
    await choice.press("Space");
  } else await choice.check();
  if (note !== undefined) await dialog.getByRole("textbox", { name: "Note" }).fill(note);
  await dialog.getByRole("button", { name: "Mark as watched", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
}

/** Opens the details of a video from its card. */
export async function openDetails(page: Page, id = ID) {
  await card(page, id).getByRole("button", { name: "Details" }).click();
  await details(page).waitFor();
}

/** The field of the details to add a tag to the video. */
export const tagField = (page: Page) => details(page).getByRole("combobox", { name: "Add a tag" });

/** Gives tags to a video from its details, each with Enter, and closes them. */
export async function addTags(page: Page, id: string, ...tags: string[]) {
  await openDetails(page, id);
  for (const tag of tags) {
    await tagField(page).fill(tag);
    await tagField(page).press("Enter");
  }
  await details(page).getByRole("button", { name: `Remove the tag ${tags.at(-1)}` }).waitFor();
  await details(page).getByRole("button", { name: "Close" }).click();
  await details(page).waitFor({ state: "detached" });
}

/** The names of the rows of the View, in order. */
export const regions = (page: Page) => page.getByRole("region").evaluateAll((rows) => rows.map((region) => region.getAttribute("aria-label")));

/** The ids of the videos of a row, in order. */
export const order = (page: Page, name: string) => row(page, name).getByRole("article").evaluateAll((items) => items.map((item) => item.getAttribute("data-video-id")));

/** What a card is dragged by: the item of its row, which holds the card. */
export const slot = (page: Page, id = ID) => page.locator(`li:has([data-video-id="${id}"])`);

/**
 * Pastes text on an element of the View, as Ctrl/Cmd+V does. Resolves with whether the View took the paste, that is
 * whether it cancelled it: a paste it leaves alone would have put the text in the field.
 */
export const paste = (page: Page, selector: string, text: string) =>
  page.locator(selector).evaluate((element, text) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", text);
    return !element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  }, text);

/** Drags data over the View and, unless `release` is false, drops it, as dragging a link from a tab does. */
export const drop = (page: Page, data: Record<string, string>, release = true) =>
  page.locator("body").evaluate(
    (body, { data, release }) => {
      const dataTransfer = new DataTransfer();
      for (const [type, value] of Object.entries(data)) dataTransfer.setData(type, value);
      const fire = (type: string) => body.dispatchEvent(new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true }));
      fire("dragenter");
      fire("dragover");
      if (release) fire("drop");
    },
    { data, release },
  );

/** Ends a drag over the View without a drop, as Escape or leaving the View does. */
export const dragLeave = (page: Page) =>
  page.locator("body").evaluate((body) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/uri-list", "https://example.com");
    body.dispatchEvent(new DragEvent("dragleave", { dataTransfer, bubbles: true }));
  });

/** Whether a picture is loaded: it has a width. */
export const isLoaded = (image: Locator) => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
