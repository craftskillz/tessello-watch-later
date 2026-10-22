<script lang="ts">
  // Shows the question asked with `ask` (lib/confirmation.svelte.ts).
  import { answer, pending } from "../lib/confirmation.svelte.ts";
  import { t } from "../lib/i18n.ts";
  import Modal from "./Modal.svelte";
</script>

<Modal open={pending.question !== null} title={pending.question?.title} onClose={() => answer(false)}>
  <p>{pending.question?.message}</p>
  {#snippet actions()}
    <button type="button" class="wl-btn" onclick={() => answer(false)}>{t("cancel")}</button>
    <button type="button" class="wl-btn wl-btn--primary wl-btn--danger" onclick={() => answer(true)}>{pending.question?.action}</button>
  {/snippet}
</Modal>
