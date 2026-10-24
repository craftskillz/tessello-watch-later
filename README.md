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
npm run typecheck
npm run build       # writes the package to dist/
npx tessello validate dist
```

`dist/` can be zipped and dropped onto Tessello, or copied into your Modules folder. The Module talks to the Host through [`@tessello/sdk`](https://www.npmjs.com/package/@tessello/sdk) and follows the [Convention](https://github.com/craftskillz/tessello/blob/main/convention/CONVENTION.md).

## Release

Raise `version` in `manifest.json` and `package.json` (`npm version <major|minor|patch> --no-git-tag-version`, then the Manifest by hand), commit, then push the tag `v<version>`. The Release workflow tests and builds the package, then publishes it on GitHub Pages as `<version>.zip`. A published version is never overwritten: a listing in the Marketplace is pinned to the fingerprint of its bytes.

## License

MIT
