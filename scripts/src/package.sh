#!/usr/bin/env bash
# Package action. Source this file; do not run directly.

zip_extension() {
  local out="$1"
  shift
  (cd "$SRC_DIR" && zip -qr "$out" . -x '*.test.js' 'providers/fixtures/*' 'providers/fixtures/' "$@")
}

do_package() {
  glib-compile-schemas "$SRC_DIR/schemas"
  local out="$ROOT_DIR/$UUID.zip"
  rm -f "$out"
  zip_extension "$out" '*.compiled' '__pycache__/*' '.git/*'
  echo "[package] → $out"
  echo "          gnome-extensions install --force '$out'"
}
