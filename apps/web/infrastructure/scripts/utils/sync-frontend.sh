#!/bin/bash
# ============================================
# Sync frontend static files to S3 + invalidate CloudFront
# ============================================
set -euo pipefail

STACK_NAME="${STACK_NAME:-Clarity-Prod-API}"

if [ -z "${CLARITY_FRONTEND_BUCKET:-}" ]; then
  BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
    --output text)
else
  BUCKET_NAME="$CLARITY_FRONTEND_BUCKET"
fi

if [ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text)
else
  DISTRIBUTION_ID="$CLOUDFRONT_DISTRIBUTION_ID"
fi
UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$(dirname "$UTILS_DIR")")"
WEB_DIR="$(dirname "$INFRA_DIR")"
OUT_DIR="$WEB_DIR/out"

echo "[1/2] Building Next.js frontend..."
# Extract Supabase values from samconfig.toml for build-time injection
export NEXT_PUBLIC_SUPABASE_URL=$(grep -o 'SupabaseUrl=\\"[^\\"]*\\"' "$INFRA_DIR/samconfig.toml" | cut -d'=' -f2 | tr -d '\\"')
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep -o 'SupabaseAnonKey=\\"[^\\"]*\\"' "$INFRA_DIR/samconfig.toml" | cut -d'=' -f2 | tr -d '\\"')

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "ERROR: Could not extract Supabase configuration from $INFRA_DIR/samconfig.toml"
  exit 1
fi

echo "  Building with NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"
cd "$WEB_DIR" && npm run build

echo "[2/2] Syncing to S3..."

# Ensure out directory exists after build
if [ ! -d "$OUT_DIR" ]; then
  echo "ERROR: Build failed to produce output at $OUT_DIR"
  exit 1
fi

echo "  Uploading to s3://$BUCKET_NAME/ ..."
aws s3 sync "$OUT_DIR" "s3://$BUCKET_NAME/" \
  --delete \
  --cache-control "max-age=31536000,immutable" \
  --exclude "*.html" \
  --exclude "manifest.json" \
  --exclude "robots.txt"

aws s3 sync "$OUT_DIR" "s3://$BUCKET_NAME/" \
  --delete \
  --cache-control "no-cache" \
  --exclude "*" \
  --include "*.html" \
  --include "manifest.json" \
  --include "robots.txt"

echo "  Upload complete."

if [ -n "$DISTRIBUTION_ID" ]; then
  echo "  Invalidating CloudFront cache..."
  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*"
  echo "  Invalidation created."
fi
