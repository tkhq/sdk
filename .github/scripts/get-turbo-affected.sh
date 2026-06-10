#!/usr/bin/env bash

BASE=$1
COMPARE=$2

# If there is no base to compare against, we return an everything filter
# 
# This is a scenario for on: push workflow triggers where github.base_ref is empty
if [[ -z "$BASE" ]]; then
    echo "*"
    exit 0
fi

# Empty compare means the tip of the current branch
if [[ -z "$COMPARE" ]]; then
    COMPARE="HEAD"
fi

BASE_SHA=$(git rev-parse --quiet "$BASE")
COMPARE_SHA=$(git rev-parse --quiet "$COMPARE")

# We return a turbo filter for affected packages between the two branches
# 
# See https://turborepo.dev/docs/reference/run#--filter-string for more info
echo "...[$BASE...$COMPARE]"