#!/bin/bash
# ============================================
# Build Lambda functions into SAM-ready zips
# ============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDAS_DIR="$SCRIPT_DIR/../../lambdas"
BUILD_DIR="$SCRIPT_DIR/../../build/lambdas"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "  Building Lambdas..."

for fn in auth timer tasks notes; do
  echo "    → $fn"
  mkdir -p "$BUILD_DIR/$fn"

  # Copy source + package.json
  cp "$LAMBDAS_DIR/$fn/index.mjs" "$BUILD_DIR/$fn/"
  cp "$LAMBDAS_DIR/$fn/package.json" "$BUILD_DIR/$fn/"

  # Install production deps
  (cd "$BUILD_DIR/$fn" && npm install --production --no-progress)

  # Remove dev files to minimize zip size
  rm -f "$BUILD_DIR/$fn/package-lock.json"
done

echo "  Lambdas built → $BUILD_DIR"
