<script lang="ts">
  import { t } from "../lib/i18n.ts";

  let { value, onChange }: { value?: number; onChange: (score: number) => void } = $props();
  const name = $props.id();
</script>

<fieldset class="wl-score-input">
  <legend>{t("score")}</legend>
  <div>
    {#each [0, 1, 2, 3, 4, 5] as score}
      <label>
        <input type="radio" {name} value={score} checked={value === score} onchange={() => onChange(score)} />
        {score}
      </label>
    {/each}
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
  .wl-score-input div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  label:has(:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  input {
    accent-color: var(--accent);
    margin: 0;
  }
</style>
