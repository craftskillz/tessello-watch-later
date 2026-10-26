# Watch Later

Keep the YouTube videos you want to watch later: paste a link, find it again.

Watch Later is a Module of [Tessello](https://github.com/craftskillz/tessello), a composable web app where you build your space from Modules: each one a View, and a Widget on the Home. Its Identifier is `@craftskillz/watch-later`. Everything it keeps stays in your Tessello space, on your computer.

![Watch Later icon](icon.svg)

What it does, screen by screen, is in its User guide: [guide/guide.md](guide/guide.md), also shown inside Tessello (ⓘ, then **User guide**).

## Install

- From the Marketplace of Tessello, once Watch Later is listed there: https://tessello-marketplace.pages.dev/
- Or drop a package onto Tessello: every version is published at `https://craftskillz.github.io/tessello-watch-later/<version>.zip`.

## Develop

Node 24 or later.

```sh
npm ci
npm test            # unit tests
npm run test:browser  # browser tests (builds dist/ first)
npm run typecheck
npm run build       # writes the package to dist/
npx tessello validate dist
```

With [just](https://github.com/casey/just): `just test`, `just e2e`, `just typecheck`, `just build` (builds and validates).

`dist/` can be zipped and dropped onto Tessello, or copied into your Modules folder. The Module talks to the Host through [`@tessello/sdk`](https://www.npmjs.com/package/@tessello/sdk) and follows the [Convention](https://github.com/craftskillz/tessello/blob/main/convention/CONVENTION.md).

### Browser tests

`e2e/` opens the View and the Widget of `dist/` in Chromium, through [Playwright](https://playwright.dev) and `node:test`, against the Test Host of `@tessello/sdk/testing`: an in-memory Host whose storage each test prepares and reads. YouTube (oEmbed and the thumbnails) is faked by Playwright. They prove what needs a real browser: pasting and dropping links, the dialogs, dragging cards and sections, and the Widget at its size. Rules that need none are unit tests in `test/`; whether the published package works in Tessello is proven by the Host's own contract tests.

The first time, install Chromium: `npx playwright install chromium`. Then `npm run test:browser` (or `just e2e`). `E2E_CPU_SLOWDOWN=4 npm run test:browser` runs them with a processor 4 times slower, as on a CI machine. A test waits for what it can observe, with `until` or Playwright's wait for an element, never for a fixed time.

## Release

From an up-to-date `main` with nothing to commit:

```sh
just publish minor    # or major, patch, fix
```

It checks types and tests, builds and validates the package, raises the version in `package.json`, `package-lock.json` and `manifest.json`, commits, tags `v<version>` and pushes. The Release workflow then publishes the package on GitHub Pages as `<version>.zip`; `just publish` waits for it, then offers to list that version on the [Marketplace](https://tessello-marketplace.pages.dev/). Answering yes means you accept the Marketplace's [PUBLISHING.md](https://github.com/craftskillz/tessello-marketplace/blob/main/PUBLISHING.md): it downloads the published `.zip` and runs `tessello publish`, which checks it as the Marketplace CI will and opens the pull request with the [GitHub CLI](https://cli.github.com/) (`gh auth login` first). A new Module waits for the Maintainer's Approval; a new version is merged once the CI passes.

To list the current version later, or again after a failure: `just marketplace` (`just marketplace --dry-run` only checks). A published version is never overwritten: a listing in the Marketplace is pinned to the fingerprint of its bytes.

## License

MIT
