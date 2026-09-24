#!/usr/bin/env bash
# Runs a test command inside the Firebase emulators on the TEST ports
# (firebase.test.json), then stops any emulator the CLI left behind on those
# ports — on Windows `emulators:exec` often leaves the Java Firestore emulator
# running. Never touches emulators on the dev ports (firebase.json).
# usage (from app/): tool/emu_test.sh firestore,storage "node tool/rules_test/rules.test.mjs"
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ONLY="$1"; shift
cd "$ROOT"
clean_test_ports() {
  powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='java.exe'\" | Where-Object { \$_.CommandLine -match 'firebase.emulators' -and \$_.CommandLine -match '--port (8180|9299) ' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" 2>/dev/null
}
clean_test_ports
timeout 300 firebase emulators:exec -c firebase.test.json --only "$ONLY" --project nibras-59284 "$*"
CODE=$?
clean_test_ports
exit $CODE
