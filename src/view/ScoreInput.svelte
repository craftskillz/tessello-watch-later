<script lang="ts">
  import { tick } from "svelte";
  import { t } from "../lib/i18n.ts";

  let { value, onChange }: { value?: number; onChange: (score: number) => void } = $props();
  const name = $props.id();
  let preview = $state<number>();
  let activated = $state<number>();
  const filled = $derived(preview ?? value ?? 0);

  async function select(event: MouseEvent, score: number) {
    preview = undefined;
    activated = score;
    const next = score > 0 && value === score ? score - 1 : score;
    onChange(next);
    // Keep the native radio group's keyboard position in sync when a repeated click removes a star.
    if (next !== score) {
      const group = (event.currentTarget as HTMLElement).closest("fieldset");
      await tick();
      group?.querySelector<HTMLInputElement>(`input[value="${next}"]`)?.focus();
    }
  }
</script>

<fieldset class="wl-score-input">
  <legend>{t("score")}</legend>
  <div class="wl-score-choices" role="presentation" onpointerleave={() => { preview = undefined; activated = undefined; }}>
    {#each [0, 1, 2, 3, 4, 5] as score}
      <label
        class:wl-zero={score === 0}
        class:wl-filled={score > 0 && score <= filled}
        title={t("score_label", { score })}
        onpointerenter={() => {
          if (score !== activated) {
            activated = undefined;
            preview = score;
          }
        }}
      >
        <!-- Zero stays in the native keyboard group without a separate visible control. -->
        <input
          type="radio"
          {name}
          value={score}
          aria-label={String(score)}
          checked={value === score}
          onclick={(event) => select(event, score)}
          onchange={() => {
            preview = undefined;
            if (value !== score) onChange(score);
          }}
        />
        {#if score === 0}
          <span aria-hidden="true">0</span>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 2.5 2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55-4.76-4.64 6.58-.96Z" />
          </svg>
        {/if}
      </label>
    {/each}
    <span class="wl-score-value" aria-hidden="true">{value ?? "–"} / 5</span>
  </div>
</fieldset>

<style>
  .wl-score-input {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
    font-size: 13px;
  }
  legend {
    padding: 0;
    margin-bottom: 8px;
    color: var(--muted);
  }
  .wl-score-choices {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
  }
  label {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 40px;
    cursor: pointer;
    border-radius: 8px;
    transition: background 120ms;
  }
  label:hover {
    background: color-mix(in srgb, var(--score-fill) 14%, transparent);
  }
  label:has(:focus-visible) {
    outline: 2px solid var(--score-gold);
    outline-offset: 2px;
  }
  .wl-zero {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .wl-score-choices:has(.wl-zero :focus-visible) {
    outline: 2px solid var(--score-gold);
    outline-offset: 2px;
    border-radius: 8px;
  }
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  svg {
    width: 30px;
    height: 30px;
    fill: transparent;
    stroke: var(--score-gold);
    stroke-width: 1.4;
    stroke-linejoin: round;
    pointer-events: none;
    transition: fill 120ms;
  }
  .wl-filled svg {
    fill: var(--score-fill);
  }
  .wl-score-value {
    margin-left: 8px;
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  @media (prefers-reduced-motion: reduce) {
    label,
    svg {
      transition: none;
    }
  }
</style>
