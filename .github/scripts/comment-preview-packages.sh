#!/usr/bin/env bash

set -euo pipefail

comment_file="$RUNNER_TEMP/preview-packages-comment.md"
tarballs=("$PREVIEW_DIRECTORY"/*.tgz)
example_tarballs=("$PREVIEW_DIRECTORY"/turnkey-sdk-server-*.tgz)
example_tarball="$(basename "${example_tarballs[0]}")"

{
  printf '%s\n\n' '## Preview packages'
  printf 'Built from %s.\n\n' "${HEAD_SHA:0:7}"
  printf '[Download all package tarballs](%s). The artifact expires after 30 days.\n\n' "$ARTIFACT_URL"
  printf '%s\n\n' 'Extract the downloaded ZIP file, then install the required tarball:'
  printf '%s\n' '```sh' "npm install ./$example_tarball" '```' ''
  printf '%s\n' '| Package | Version | Tarball |' '| --- | --- | --- |'

  for tarball in "${tarballs[@]}"; do
    package_json="$(tar -xOf "$tarball" package/package.json)"
    package_name="$(jq -r '.name' <<< "$package_json")"
    package_version="$(jq -r '.version' <<< "$package_json")"
    printf '| %s | %s | %s |\n' "$package_name" "$package_version" "$(basename "$tarball")"
  done
} > "$comment_file"

gh pr comment "$PR_NUMBER" --body-file "$comment_file"
