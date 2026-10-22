<script lang="ts">
  // A dialog drawn in the page: `confirm` and `alert` are unavailable in the sandbox (CONVENTION.md §4).
  import type { Snippet } from "svelte";

  let {
    open = false,
    title = "",
    onClose,
    children,
    actions,
  }: {
    open?: boolean;
    title?: string;
    onClose: () => void;
    children: Snippet;
    /** The buttons at the bottom of the dialog. */
    actions: Snippet;
  } = $props();

  const titleId = `modal-${Math.random().toString(36).slice(2)}`;
  let dialog = $state<HTMLElement>();

  // Puts the focus on the first field, or on the button that confirms.
  $effect(() => {
    if (open && dialog) dialog.querySelector<HTMLElement>("textarea, input, .wl-btn--primary")?.focus();
  });

  function onBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  /** Escape closes the dialog on top, when one opens over another. */
  function onKey(event: KeyboardEvent) {
    if (!open || event.key !== "Escape" || !dialog) return;
    const dialogs = document.querySelectorAll("[role=dialog]");
    if (dialogs[dialogs.length - 1] === dialog) onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if open}
  <div class="wl-modal-backdrop" role="presentation" onclick={onBackdrop}>
    <div class="wl-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} bind:this={dialog}>
      <h3 class="wl-modal-title" id={titleId}>{title}</h3>
      <div class="wl-modal-body">
        {@render children()}
      </div>
      <div class="wl-modal-actions">
        {@render actions()}
      </div>
    </div>
  </div>
{/if}

<style>
  .wl-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgb(15 23 42 / 45%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }
  .wl-modal {
    width: 100%;
    max-width: 480px;
    max-height: 100%;
    overflow-y: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 12px 40px rgb(15 23 42 / 25%);
    padding: 20px 22px;
  }
  .wl-modal-title {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .wl-modal-body :global(p) {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .wl-modal-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
</style>
