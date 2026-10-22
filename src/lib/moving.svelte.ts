// What the User is dragging in the View to move it: a card of a row, or a section. A drag tells what it carries only
// on drop, so the rows and groups read here what is moved, and from where, while it is over them.

/** What a dragged card carries, so that the View tells it from a link dropped to be added. */
export const CARD_TYPE = "application/x-watch-later-video";
/** What a dragged section carries. */
export const SECTION_TYPE = "application/x-watch-later-section";

export const moving = $state<{
  card: { videoId: string; from: string | null } | null;
  /** The key of the section (videos.ts `Settings.sections`), and that of its group, null at the top of the View. */
  section: { key: string; group: string | null } | null;
}>({ card: null, section: null });

/** Whether a drag moves something of the View, rather than bringing a link to add. */
export const movesInView = (event: DragEvent) =>
  !!moving.card || !!moving.section || !!event.dataTransfer?.types.some((type) => type === CARD_TYPE || type === SECTION_TYPE);

/** Starts the drag of a section: what it carries replaces what the browser put there, such as a selected text. */
export function startSection(event: DragEvent, key: string, group: string | null): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.clearData();
  event.dataTransfer.setData(SECTION_TYPE, key);
  event.dataTransfer.effectAllowed = "move";
  moving.section = { key, group };
}

/**
 * Where a section dragged over the section `key` of the group `group` would land: before or after it, by the half of
 * it under the pointer; null when the dragged section is not beside it.
 */
export function sectionTarget(event: DragEvent, key: string, group: string | null): "before" | "after" | null {
  const section = moving.section;
  if (!section || section.group !== group || section.key === key) return null;
  const { top, height } = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return event.clientY < top + height / 2 ? "before" : "after";
}
