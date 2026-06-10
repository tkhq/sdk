#!/usr/bin/env bash

BASE=$1
COMPARE=$2

# If there is no base to compare against, we return an empty filter
# 
# This is a scenario for on: push workflow triggers where github.base_ref is empty
if [[ -z "$BASE" ]]; then
    exit 0
fi

# Empty compare means the tip of the current branch
if [[ -z "$COMPARE" ]]; then
    COMPARE="HEAD"
fi

BASE_SHA=$(git rev-parse --quiet "$BASE")
COMPARE_SHA=$(git rev-parse --quiet "$COMPARE")

# If the base and compare are the same, there are no affected packages
if [[ "$COMPARE_SHA" == "$BASE_SHA" ]]; then
    exit 0
fi

# If the base & compare are different, we return a turbo filter
echo "...[$BASE...$COMPARE]"