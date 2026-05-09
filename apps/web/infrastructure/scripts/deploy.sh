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

echo "[1/4] Building Lambda functions..."
"$SCRIPT_DIR/utils/build.sh"

echo "[2/4] Building Next.js frontend..."
cd "$INFRA_DIR/../.." && npm run build

echo "[3/4] Validating SAM template..."
sam validate --template-file "$INFRA_DIR/template.yaml"

echo "[4/4] Creating ChangeSet (NOT applying)..."
sam deploy \
  --template-file "$INFRA_DIR/template.yaml" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    DomainName="$DOMAIN" \
    HostedZoneId="${HOSTED_ZONE_ID:-}" \
    SupabaseUrl="${SUPABASE_URL:-}" \
    SupabaseAnonKey="${SUPABASE_ANON_KEY:-}" \
  --no-execute-changeset \
  --resolve-s3

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
echo ""
echo "================================================"

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
