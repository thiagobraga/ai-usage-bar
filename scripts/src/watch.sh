#!/usr/bin/env bash
# Watch action. Source this file; do not run directly.
# Requires: $NESTED (bool), $UUID, $SRC_DIR, $DEST_DIR — set by common.sh.

watch_loop() {
  echo "[watch] watching $SRC_DIR for changes..."
  while inotifywait -r -e modify,create,delete,move \
      --exclude '/schemas/' \
      "$SRC_DIR" 2>/dev/null; do
    if $NESTED; then
      do_sync
      echo "[watch] toggle in nested session:"
      echo "         gnome-extensions disable $UUID && gnome-extensions enable $UUID"
    else
      do_install
      gnome-extensions disable "$UUID" 2>/dev/null || true
      sleep 0.5
      gnome-extensions enable "$UUID" 2>/dev/null || true
      echo "[watch] reloaded"
    fi
  done
}
