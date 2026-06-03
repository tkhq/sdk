#!/usr/bin/env bash

# Extracts a version tag from a release branch name (e.g. "release/v2024.6.0" -> "v2024.6.0") 
# and checks if it matches the expected format.

BRANCH=$1
VERSION="${BRANCH#release/}"

. $(dirname -- "$0")/check-version.sh "$VERSION"

echo "$VERSION"