#!/bin/bash

# Direct deployment test using OpenNext CLI
# This will deploy the .open-next/ directory directly to Cloudflare Workers

echo "=== Deploying cod-client using OpenNext CLI ==="
echo ""

# Make sure we're in the cod-client directory
cd "$(dirname "$0")"

# Deploy using OpenNext CLI
echo "Running: npx opennextjs-cloudflare deploy"
npx opennextjs-cloudflare deploy

echo ""
echo "=== Deployment complete ==="
echo "Check if the Worker is working at: https://app.codflow.store/"
