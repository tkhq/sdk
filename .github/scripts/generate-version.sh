#!/usr/bin/env bash

# Generates a version tag based on the current year and month, 
# with an incrementing counter for multiple releases in the same month.
# 
# NOTICE: Will not run git fetch

YEAR=$(date +%Y)
MONTH=$(date +%-m)  # No leading zero
PREFIX="v${YEAR}.${MONTH}."

# Find highest existing counter for this month
HIGHEST=$(git tag -l "${PREFIX}*" | sed "s/${PREFIX}//" | sort -n | tail -1)
if [[ -z "$HIGHEST" ]]; then
    COUNTER=0
else
    COUNTER=$((HIGHEST + 1))
fi

echo "${PREFIX}${COUNTER}"