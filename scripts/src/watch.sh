#!/usr/bin/env bash
# Watch action. Source this file; do not run directly.
# Requires: $NESTED (bool), $UUID, $SRC_DIR, $DEST_DIR - set by common.sh.
# Nested mode also calls nested_reload_extension() from nested.sh.

watch_loop() {
  echo "[watch] watching $SRC_DIR for changes..."
  while inotifywait -r -e modify,create,delete,move \
      --exclude '/schemas/' \
      "$SRC_DIR" 2>/dev/null; do
    if $NESTED; then
      do_sync
      if nested_reload_extension; then
        echo "[watch] reloaded in nested session"
      else
        echo "[watch] nested session not reachable - toggle the extension there manually"
      fi
    else
      do_install
      gnome-extensions disable "$UUID" 2>/dev/null || true
      sleep 0.5
      gnome-extensions enable "$UUID" 2>/dev/null || true
      echo "[watch] reloaded"
    fi
  done
}
