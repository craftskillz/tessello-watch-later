// The videos in the Host storage (CONVENTION.md §6.1): the whole list under `videos`. What is stored is read
// defensively (videos.ts), and a failed write comes back as a message for the User.

import type { Json, Storage } from "@tessello/sdk";
import { t } from "./i18n.ts";
import { readVideos, type Video } from "./videos.ts";

const VIDEOS = "videos";

export interface VideoStorage {
  /** The videos. Throws when the Host cannot read them. */
  read(): Promise<Video[]>;
  /** Writes the videos. Throws an `Error` whose message tells the User what happened. */
  write(videos: Video[]): Promise<void>;
}

export function videoStorage(storage: Storage): VideoStorage {
  return {
    read: async () => readVideos(await storage.get(VIDEOS)),
    write: async (videos) => {
      try {
        await storage.set(VIDEOS, videos as unknown as Exclude<Json, null>);
      } catch (error) {
        throw new Error(saveErrorMessage(error), { cause: error });
      }
    },
  };
}

/** What a failed request says, for a message: its own message, or the value thrown. */
export const reasonOf = (error: unknown) => (error instanceof Error && error.message ? error.message : String(error));

function saveErrorMessage(error: unknown): string {
  if ((error as { code?: unknown }).code === "quota_exceeded") return t("save_error_quota");
  return t("save_error", { reason: reasonOf(error) });
}
