# The everyday commands of this Module. `just` alone lists them.

default:
    @just --list

# Unit tests (Node, a few seconds)
test:
    npm test

# Type checking
typecheck:
    npm run typecheck

# Builds the package into dist/ and validates it
build:
    npm run build
    npx tessello validate dist

# Publishes a new version: `just publish minor` (or major, patch, fix). Raises the version in package.json, package-lock.json
# and manifest.json, commits, tags v<version> and pushes: the Release workflow then publishes <version>.zip on GitHub Pages
publish bump:
    #!/usr/bin/env bash
    set -euo pipefail
    case "{{ bump }}" in
        major|minor|patch) bump="{{ bump }}" ;;
        fix) bump="patch" ;;
        *) echo "Give major, minor, patch or fix." >&2; exit 1 ;;
    esac
    if [ "$(git branch --show-current)" != "main" ]; then echo "Publish from main." >&2; exit 1; fi
    if [ -n "$(git status --porcelain)" ]; then echo "Commit or stash your changes first." >&2; exit 1; fi
    git pull --ff-only --quiet
    # Checked before anything is tagged, so that a broken version is never published.
    npm run typecheck --silent
    npm test --silent >/dev/null
    npm run build --silent
    npx tessello validate dist >/dev/null
    # package.json and package-lock.json through npm, then the Manifest, so that all three keep the same version.
    version=$(npm version "$bump" --no-git-tag-version | sed 's/^v//')
    # Only the value of "version" is replaced, so that the rest of the Manifest keeps its layout.
    node -e 'const fs = require("fs"); const [version] = process.argv.slice(1); fs.writeFileSync("manifest.json", fs.readFileSync("manifest.json", "utf8").replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`));' "$version"
    git commit --quiet -am "Release $version"
    git tag "v$version"
    git push --quiet origin main "v$version"
    echo "v$version pushed: it will be at https://craftskillz.github.io/$(basename "$(git rev-parse --show-toplevel)")/$version.zip once the Release workflow is done."
