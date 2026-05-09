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
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd ../../.. && pwd)/out"

if [ ! -d "$OUT_DIR" ]; then
  echo "ERROR: No build output at $OUT_DIR. Run 'npm run build' first."
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
