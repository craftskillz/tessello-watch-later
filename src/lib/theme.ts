// Follows the Host's theme (CONVENTION.md §6.2): its colors become CSS variables.

import type { Theme } from "@tessello/sdk";

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const { colors } = theme;
  root.classList.toggle("dark", theme.mode === "dark");
  root.style.colorScheme = theme.mode;
  for (const [name, value] of Object.entries({
    "--bg": colors.background,
    "--panel": colors.surface,
    "--ink": colors.text,
    "--muted": colors.textMuted,
    "--accent": colors.accent,
    "--line": colors.border,
  })) {
    root.style.setProperty(name, value);
  }
}
