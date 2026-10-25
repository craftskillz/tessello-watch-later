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

# Publishes a new version and lists it on the Marketplace: `just publish minor` (or major, patch, fix). See README.md
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
    # Installs exactly the locked dependencies, then checks before anything is tagged, so that a broken version is never published.
    npm ci --silent
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
    echo "v$version pushed: the Release workflow publishes it on GitHub Pages."
    # The workflow starts a few seconds after the tag arrives.
    for _ in $(seq 30); do
        run=$(gh run list --workflow release.yml --branch "v$version" --json databaseId --jq ".[0].databaseId // empty" 2>/dev/null || true)
        if [ -n "$run" ]; then break; fi
        sleep 2
    done
    if [ -n "${run:-}" ]; then
        echo "Waiting for the Release workflow…"
        gh run watch "$run" --exit-status >/dev/null || { echo "The Release workflow failed: see \`gh run view $run --log-failed\`." >&2; exit 1; }
    fi
    just marketplace

# Lists the version of manifest.json on the Marketplace, once its package is online: `just marketplace [--dry-run]`
marketplace *options:
    #!/usr/bin/env bash
    set -euo pipefail
    version=$(node -p 'require("./manifest.json").version')
    # https://<owner>.github.io/<repository>/<version>.zip, from the remote origin.
    slug=$(git remote get-url origin | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
    owner=$(echo "${slug%%/*}" | tr "[:upper:]" "[:lower:]")
    url="https://$owner.github.io/${slug#*/}/$version.zip"
    echo "Listing $version on the Marketplace means accepting its terms: https://github.com/craftskillz/tessello-marketplace/blob/main/PUBLISHING.md"
    read -r -p "Have you read them, and do you accept them? [y/N] " answer || answer=""
    case "$answer" in
        y|Y|yes|Yes) ;;
        *) echo "Not listed. Run \`just marketplace\` when you are ready."; exit 0 ;;
    esac
    # GitHub Pages serves a new file a minute or so after the workflow.
    work=$(mktemp -d)
    trap 'rm -rf "$work"' EXIT
    for tries in $(seq 60); do
        if curl -fsSLo "$work/$version.zip" "$url" 2>/dev/null; then break; fi
        if [ "$tries" -eq 60 ]; then echo "$url is not online: is the Release workflow of v$version green?" >&2; exit 1; fi
        sleep 5
    done
    # The published bytes, never a local build: the listing pins their SHA-256.
    npx tessello publish "$work/$version.zip" --url "$url" --accept-terms {{ options }}
