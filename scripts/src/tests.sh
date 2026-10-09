#!/usr/bin/env bash
# Test action. Source this file; do not run directly.

do_tests() {
  echo "[tests] running test suite..."
  cd "$ROOT_DIR" && npm test
}
