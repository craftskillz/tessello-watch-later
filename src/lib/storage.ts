// The videos in the Host storage (CONVENTION.md §6.1): the whole list under `videos`, and the settings of the View under
// `settings`. What is stored is read
// defensively (videos.ts), and a failed write comes back as a message for the User.

import type { Json, Storage } from "@tessello/sdk";
import { t } from "./i18n.ts";
import { readSettings, readVideos, type Settings, type Video } from "./videos.ts";

const VIDEOS = "videos";
const SETTINGS = "settings";

export interface VideoStorage {
  /** The videos. Throws when the Host cannot read them. */
  read(): Promise<Video[]>;
  /** Writes the videos. Throws an `Error` whose message tells the User what happened. */
  write(videos: Video[]): Promise<void>;
  /** The settings. Throws when the Host cannot read them. */
  readSettings(): Promise<Settings>;
  /** Writes the settings. Throws as `write` does. */
  writeSettings(settings: Settings): Promise<void>;
}

export function videoStorage(storage: Storage): VideoStorage {
  return {
    read: async () => readVideos(await storage.get(VIDEOS)),
    write: (videos) => set(storage, VIDEOS, videos as unknown as Exclude<Json, null>),
    readSettings: async () => readSettings(await storage.get(SETTINGS)),
    writeSettings: (settings) => set(storage, SETTINGS, { ...settings }),
  };
}

async function set(storage: Storage, key: string, value: Exclude<Json, null>): Promise<void> {
  try {
    await storage.set(key, value);
  } catch (error) {
    throw new Error(saveErrorMessage(error), { cause: error });
  }
}

/** What a failed request says, for a message: its own message, or the value thrown. */
export const reasonOf = (error: unknown) => (error instanceof Error && error.message ? error.message : String(error));

function saveErrorMessage(error: unknown): string {
  if ((error as { code?: unknown }).code === "quota_exceeded") return t("save_error_quota");
  return t("save_error", { reason: reasonOf(error) });
}
