#!/usr/bin/env bash
# AI Usage Bar - dev entrypoint. See scripts/README.md for full docs.
#
# Usage:
#   ./scripts/install.sh [flags]
#
# Flags:
#   -w, --watch     Watch extension/ and reinstall on change
#   -n, --nested    Launch a nested GNOME Shell (Wayland dev window; logs appear here)
#   -s, --size WxH  Nested window size, e.g. 1800x800 (use with -n)
#   -l, --logs      Stream GNOME Shell logs (main session)
#   -u, --uninstall Disable and remove the extension
#   -p, --package   Build distributable zip
#   -t, --tests     Run test suite
#
# Combinable: -w -n | -w -l

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=src/common.sh
source "$SCRIPT_DIR/src/common.sh"
source "$SCRIPT_DIR/src/uninstall.sh"
source "$SCRIPT_DIR/src/package.sh"
source "$SCRIPT_DIR/src/tests.sh"
source "$SCRIPT_DIR/src/watch.sh"
source "$SCRIPT_DIR/src/nested.sh"
source "$SCRIPT_DIR/src/logs.sh"

# Install actions --------------------------------------------------------------

do_install() {
  glib-compile-schemas "$SRC_DIR/schemas"
  rm -f "$ZIP_FILE"
  zip_extension "$ZIP_FILE"
  gnome-extensions install --force "$ZIP_FILE"
  gnome-extensions enable "$UUID" 2>/dev/null || true
  rm -f "$ZIP_FILE"
  echo "[install] installed → $DEST_DIR"
}

# Fast sync for nested mode - avoids wiping the dir while gnome-shell has it open.
do_sync() {
  glib-compile-schemas "$SRC_DIR/schemas" 2>/dev/null || true
  rsync -a --delete --exclude '*.test.js' --exclude 'providers/fixtures/' "$SRC_DIR/" "$DEST_DIR/"
  echo "[sync] synced → $DEST_DIR"
}

# Flags ------------------------------------------------------------------------

WATCH=false
NESTED=false
LOGS=false
UNINSTALL=false
PACKAGE=false
TESTS=false
NESTED_SIZE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -w|--watch)     WATCH=true;     shift ;;
    -n|--nested)    NESTED=true;    shift ;;
    -l|--logs)      LOGS=true;      shift ;;
    -u|--uninstall) UNINSTALL=true; shift ;;
    -p|--package)   PACKAGE=true;   shift ;;
    -t|--tests)     TESTS=true;     shift ;;
    -s|--size)
      [[ $# -ge 2 ]] || { echo "Missing value for $1 (expected WIDTHxHEIGHT)" >&2; exit 1; }
      NESTED_SIZE="$2"; shift 2 ;;
    --size=*)       NESTED_SIZE="${1#*=}"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -n "$NESTED_SIZE" ]]; then
  [[ "$NESTED_SIZE" =~ ^[0-9]+x[0-9]+$ ]] || { echo "Invalid size: $NESTED_SIZE (expected WIDTHxHEIGHT, e.g. 1800x800)" >&2; exit 1; }
  $NESTED || echo "[warn] --size only applies with --nested; ignoring" >&2
fi

# One-shot actions - no install needed
$UNINSTALL && { check_deps false false; do_uninstall; exit 0; }
$PACKAGE   && { check_deps false false; do_package;   exit 0; }
$TESTS     && { do_tests; exit 0; }

check_deps "$WATCH" "$NESTED"

$NESTED && do_sync || do_install

if $WATCH && $NESTED; then
  watch_loop &
  WATCH_PID=$!
  trap "kill $WATCH_PID 2>/dev/null; exit" INT TERM EXIT
  launch_nested

elif $WATCH && $LOGS; then
  watch_loop &
  WATCH_PID=$!
  trap "kill $WATCH_PID 2>/dev/null; exit" INT TERM EXIT
  stream_logs

elif $WATCH;  then watch_loop
elif $NESTED; then launch_nested
elif $LOGS;   then stream_logs
fi
