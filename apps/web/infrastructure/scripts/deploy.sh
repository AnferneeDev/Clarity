#!/bin/bash
# ============================================
# Clarity Web — Deployment Script
# Per standards: validates ChangeSet, does NOT auto-apply
# ============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
STACK_NAME="${STACK_NAME:-Clarity-Prod-API}"
ENVIRONMENT="${1:-Prod}"
DOMAIN="${DOMAIN:-claritytracker.online}"

# Support for --guided flag
GUIDED_FLAG=""
EXECUTE_CHANGESET="--no-execute-changeset"
for arg in "$@"; do
  if [ "$arg" == "--guided" ]; then
    GUIDED_FLAG="--guided"
    EXECUTE_CHANGESET=""
    echo "  [INFO] Running in GUIDED mode."
  fi
done

echo "================================================"
echo "  CLARITY WEB DEPLOYMENT"
echo "================================================"
echo ""
echo "  Stack:       $STACK_NAME"
echo "  Environment: $ENVIRONMENT"
echo "  Domain:      $DOMAIN"
echo ""

# Check for required tools
command -v sam >/dev/null 2>&1 || { echo "ERROR: AWS SAM CLI not found. Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI not found."; exit 1; }

echo "[1/5] Running tests..."
cd "$INFRA_DIR/../.." && npm run test:web

echo "[2/5] Building Lambda functions..."
"$SCRIPT_DIR/utils/build.sh"

echo "[3/5] Building Next.js frontend..."
# Extract Supabase values from samconfig.toml for build-time injection (handles escaped quotes)
export NEXT_PUBLIC_SUPABASE_URL=$(grep -o 'SupabaseUrl=\\"[^\\"]*\\"' "$INFRA_DIR/samconfig.toml" | cut -d'=' -f2 | tr -d '\\"')
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep -o 'SupabaseAnonKey=\\"[^\\"]*\\"' "$INFRA_DIR/samconfig.toml" | cut -d'=' -f2 | tr -d '\\"')

echo "  Building with NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"
cd "$INFRA_DIR/.." && npm run build

echo "[4/5] Validating SAM template..."
cd "$INFRA_DIR"
sam validate

echo "[5/5] Deploying infrastructure..."
sam deploy $GUIDED_FLAG \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  $EXECUTE_CHANGESET \
  --resolve-s3

if [ -z "$GUIDED_FLAG" ]; then
  echo ""
  echo "================================================"
  echo "  CHANGESET CREATED"
  echo "================================================"
  echo ""
  echo "  Manual review required. To apply the changeset:"
  echo "  -----------------------------------------------"
  echo "  aws cloudformation execute-change-set \\"
  echo "    --change-set-name \$(aws cloudformation describe-stacks \\"
  echo "      --stack-name $STACK_NAME --query 'Stacks[0].ChangeSetId' --output text)"
  echo ""
  echo "  Or use the AWS Console → CloudFormation → $STACK_NAME → Changesets"
else
  echo ""
  echo "================================================"
  echo "  DEPLOYMENT COMPLETE"
  echo "================================================"
fi

# Sync frontend to S3 (can run regardless of ChangeSet)
echo ""
if [ -t 0 ]; then
  read -p "Sync frontend to S3 now? (y/N): " SYNC_NOW
  if [ "$SYNC_NOW" = "y" ] || [ "$SYNC_NOW" = "Y" ]; then
    "$SCRIPT_DIR/utils/sync-frontend.sh"
  fi
else
  echo "  Non-interactive mode — skipping frontend sync prompt."
  echo "  Run manually: ./scripts/utils/sync-frontend.sh"
fi
