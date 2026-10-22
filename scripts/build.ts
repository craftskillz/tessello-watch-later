// Builds the Watch Later Module into a package: manifest.json, icon.svg, the User guide, and the page, script and stylesheet
// of the View, with Svelte and the SDK bundled in. Run with `npm run build` in this folder; the
// package is written to `dist/`, ready to be zipped or placed in a Modules folder.

import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import esbuildSvelte from "esbuild-svelte";

// The types of esbuild-svelte describe an ES module, but Node loads its CommonJS build, whose export is the plugin.
const sveltePlugin = esbuildSvelte as unknown as typeof esbuildSvelte.default;

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export const DIST = at("../dist");

/** Writes the package into `out` (by default `dist/`), replacing what was there. */
export async function buildPackage(out = DIST): Promise<string> {
  await rm(out, { recursive: true, force: true });
  for (const surface of ["view"]) {
    await mkdir(`${out}/${surface}`, { recursive: true });
    await build({
      entryPoints: { app: at(`../src/${surface}/main.ts`) },
      outdir: `${out}/${surface}`,
      bundle: true,
      format: "esm",
      target: "es2022",
      minify: true,
      conditions: ["svelte", "browser"],
      mainFields: ["svelte", "browser", "module", "main"],
      plugins: [sveltePlugin({ compilerOptions: { css: "external" } })],
      logLevel: "warning",
    });
    await copyFile(at(`../src/${surface}/index.html`), `${out}/${surface}/index.html`);
  }
  await copyFile(at("../manifest.json"), `${out}/manifest.json`);
  await copyFile(at("../icon.svg"), `${out}/icon.svg`);
  await cp(at("../guide"), `${out}/guide`, { recursive: true });
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildPackage();
