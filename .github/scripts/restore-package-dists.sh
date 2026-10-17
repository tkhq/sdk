#!/usr/bin/env bash
# Copy packaged dists from an artifact directory back into packages/<name>/dist.
# Fails if a published package is missing its dist.
set -euo pipefail

root="${1:?artifact directory required}"

if [ ! -d "$root" ]; then
  echo "artifact directory not found: $root"
  exit 1
fi

missing=0
for dir in packages/*; do
  [ -f "$dir/package.json" ] || continue
  name="$(basename "$dir")"
  private="$(node -p "require('./${dir}/package.json').private === true")"
  if [ "$private" = "true" ]; then
    echo "skip private ${name}"
    continue
  fi
  if [ ! -d "$root/$name/dist" ]; then
    echo "artifact missing dist for ${name}"
    missing=1
    continue
  fi
  rm -rf "$dir/dist"
  cp -a "$root/$name/dist" "$dir/dist"
  echo "restored ${name}"
done

if [ "$missing" -ne 0 ]; then
  exit 1
fi

rm -rf "$root"
