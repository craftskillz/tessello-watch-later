import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { type Json, type Storage, TesselloError } from "@tessello/sdk";
import { videoStorage } from "../src/lib/storage.ts";

/** The Host storage of the Module, in memory; `failWith` makes every write fail. */
function memoryStorage(failWith?: Error) {
  const values = new Map<string, Json>();
  const storage: Storage = {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      if (failWith) throw failWith;
      values.set(key, structuredClone(value));
    },
    delete: async (key) => void values.delete(key),
    keys: async () => [...values.keys()],
  };
  return { storage, values };
}

const video = { videoId: "dQw4w9WgXcQ", title: "A video", addedAt: "2026-01-01T00:00:00.000Z", watched: false, tags: [], metaStatus: "failed" as const };

describe("the videos in the Host storage", () => {
  test("reads back the videos it wrote", async () => {
    const { storage } = memoryStorage();
    await videoStorage(storage).write([video]);
    assert.deepEqual(await videoStorage(storage).read(), [video]);
  });

  test("a full storage is a message for the User, for the videos and for the settings", async () => {
    const { storage } = memoryStorage(new TesselloError("quota_exceeded", "The storage is full."));
    const message = { message: "Your last change could not be saved: the storage of the Watch Later Module is full. It is still on screen, but will be lost when you leave." };
    await assert.rejects(videoStorage(storage).write([video]), message);
    await assert.rejects(videoStorage(storage).writeSettings({ ...(await videoStorage(storage).readSettings()) }), message);
  });

  test("any other failure is a message for the User, with its reason, for the videos and for the settings", async () => {
    const { storage } = memoryStorage(new TesselloError("internal", "disk unplugged"));
    const message = { message: "Your last change could not be saved (disk unplugged). It is still on screen, but will be lost when you leave." };
    await assert.rejects(videoStorage(storage).write([video]), message);
    await assert.rejects(videoStorage(storage).writeSettings({ ...(await videoStorage(storage).readSettings()) }), message);
  });

  test("keeps the failure of the Host as the cause of the message", async () => {
    const failure = new TesselloError("internal", "disk unplugged");
    const { storage } = memoryStorage(failure);
    await assert.rejects(videoStorage(storage).write([video]), (error: Error) => error.cause === failure);
  });
});
