#!/usr/bin/env bash
# Runs the engine/SQL tests against Node's built-in SQLite (expo-sqlite is shimmed). Needs Node 22+.
set -e
cd "$(dirname "$0")/.."
npx esbuild tests/engine.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/focusmate-engine.test.cjs \
  --alias:expo-sqlite=./tests/shims/expo-sqlite.ts --log-level=error
node --no-warnings /tmp/focusmate-engine.test.cjs
