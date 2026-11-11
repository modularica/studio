#!/bin/sh
# Checks that the Godot rules give exactly the same numbers as the web version.
# Usage: tests/parity.sh [years] [profiles] [seeds]    (GODOT=path/to/godot)
cd "$(dirname "$0")/.." || exit 1
GODOT=${GODOT:-godot}
YEARS=${1:-12}
PROFILES=${2:-kid,avg,fast}
SEEDS=${3:-1,2,3,4,5,6}
status=0
for p in $(echo "$PROFILES" | tr ',' ' '); do
  ref=$(mktemp)
  node tests/js_dump.js "$YEARS" "$p" "$SEEDS" > "$ref" || exit 1
  "$GODOT" --headless --path . --script res://tests/bot_test.gd -- "$YEARS" "$p" "$SEEDS" "$ref" 2>&1 | grep -v '^Godot Engine' || status=1
  rm -f "$ref"
done
exit $status
