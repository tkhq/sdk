#!/usr/bin/env bash

# Extracts a version tag from a branch name

BRANCH=$1
VERSION="${BRANCH#release/}"

. $(dirname -- "$0")/check-version.sh "$VERSION"

echo "$VERSION"