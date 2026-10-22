// The one confirmation of the View, asked before deleting a video, and shown by ConfirmDialog.svelte: `confirm` is
// unavailable in the sandbox (CONVENTION.md §4).

import { t } from "./i18n.ts";

interface Question {
  title: string;
  message: string;
  /** The label of the button that confirms. */
  action: string;
  resolve: (confirmed: boolean) => void;
}

/** The question waiting for an answer, if any. */
export const pending = $state<{ question: Question | null }>({ question: null });

/** Asks the User; resolves with true when they confirm. A deletion is confirmed with "Delete". */
export function ask(title: string, message: string, action = t("delete")): Promise<boolean> {
  pending.question?.resolve(false);
  return new Promise((resolve) => (pending.question = { title, message, action, resolve }));
}

export function answer(confirmed: boolean): void {
  pending.question?.resolve(confirmed);
  pending.question = null;
}
