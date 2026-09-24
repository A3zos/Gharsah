#!/usr/bin/env bash
# Build once (unless --no-build), serve statically, screenshot each preview, exit.
# usage: tool/design_compare/shoot.sh [--no-build] name=query [name=query ...]
# e.g.   tool/design_compare/shoot.sh 03-login=screen=login 03-child=screen=login-child
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; OUT="$ROOT/build/compare"; T="$ROOT/tool/design_compare"
mkdir -p "$OUT"
if [ "${1:-}" = "--no-build" ]; then shift; else
  echo "building (profile, local CanvasKit)…"
  timeout 420 flutter build web --profile --no-web-resources-cdn >"$OUT/build.log" 2>&1 || { echo "BUILD FAILED/TIMED OUT"; tail -20 "$OUT/build.log"; exit 1; }
fi
node "$T/serve.mjs" "$(cygpath -w "$ROOT/build/web")" 8790 & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
for pair in "$@"; do
  name="${pair%%=*}"; query="${pair#*=}"
  WAIT=${WAIT:-12000} timeout 90 node "$T/snap.mjs" "$(cygpath -w "$OUT/app-$name.png")" "$query" "${ACTIONS:-[]}" \
    && echo "shot $name" || echo "SKIPPED $name (failed or timed out)"
done
