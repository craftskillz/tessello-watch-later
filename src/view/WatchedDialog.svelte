<script lang="ts">
  import { t } from "../lib/i18n.ts";
  import { NOTE_MAX, type Video } from "../lib/videos.ts";
  import Modal from "./Modal.svelte";
  import NoteInput from "./NoteInput.svelte";
  import ScoreInput from "./ScoreInput.svelte";

  let { video, onSave, onClose }: { video: Video; onSave: (score: number, note: string) => void; onClose: () => void } = $props();
  let score = $state<number>();
  // The dialog keeps its draft local: cancelling never writes the note or watch state.
  // svelte-ignore state_referenced_locally
  let note = $state(video.note ?? "");
</script>

<Modal open title={t("mark_watched")} {onClose}>
  <div class="wl-review">
    <p>{video.title}</p>
    <ScoreInput value={score} onChange={(value) => (score = value)} />
    <NoteInput bind:value={note} />
  </div>
  {#snippet actions()}
    <button type="button" class="wl-btn" onclick={onClose}>{t("cancel")}</button>
    <button
      type="button"
      class="wl-btn wl-btn--primary"
      disabled={score === undefined || note.trim().length > NOTE_MAX}
      onclick={() => score !== undefined && onSave(score, note)}
    >{t("mark_watched")}</button>
  {/snippet}
</Modal>

<style>
  .wl-review {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .wl-review p {
    overflow-wrap: anywhere;
  }
</style>
