#!/usr/bin/env bash

# Checks if the provided version tag matches the expected format vXXXX.X{X}.X

VERSION=$1

if [[ ! "$VERSION" =~ ^v[0-9]{4}\.(([1-9])|(1[0-2]))\.[0-9]+$ ]]; then
    echo "Version does not match expected format vXXXX.X{X}.X (got: '$VERSION')"
    exit 1
fi