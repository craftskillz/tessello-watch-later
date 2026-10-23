<script lang="ts">
  import { t } from "../lib/i18n.ts";
  import { NOTE_MAX } from "../lib/videos.ts";

  let { value = $bindable(""), onBlur }: { value?: string; onBlur?: () => void } = $props();
</script>

<label class="wl-note">
  <span>{t("note")}</span>
  <textarea bind:value maxlength={NOTE_MAX} rows="4" placeholder={t("note_placeholder")} onblur={onBlur}></textarea>
  <small>{value.length} / {NOTE_MAX}</small>
</label>

<style>
  .wl-note {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }
  textarea {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    resize: vertical;
  }
  textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  small {
    align-self: flex-end;
  }
</style>
