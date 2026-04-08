#!/bin/bash
# Quick deployment script for monitor HTTP service
# Run this after deploying the main dashboard

set -e

echo "🚀 Deploying MLOps Monitor HTTP Service for Scheduler"
echo "======================================================"
echo ""

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: PROJECT_ID environment variable not set"
    echo "Please run: export PROJECT_ID=your-gcp-project-id"
    exit 1
fi

REGION="${REGION:-us-central1}"

echo "📋 Configuration:"
echo "  Project: $PROJECT_ID"
echo "  Region: $REGION"
echo ""

# Deploy the monitor HTTP service
echo "🔨 Deploying monitor HTTP endpoint..."
gcloud run deploy mlops-monitor-http \
  --image gcr.io/$PROJECT_ID/mlops-observatory:latest \
  --platform managed \
  --region $REGION \
  --set-env-vars RUN_MODE=monitor-http \
  --no-allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --timeout 600 \
  --quiet

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

# Get service URL
echo ""
echo "📍 Getting service URL..."
SERVICE_URL=$(gcloud run services describe mlops-monitor-http \
  --region $REGION \
  --format 'value(status.url)')

if [ -z "$SERVICE_URL" ]; then
    echo "❌ Failed to get service URL"
    exit 1
fi

echo ""
echo "✅ Deployment successful!"
echo ""
echo "======================================================"
echo "📝 GIVE THIS URL TO YOUR DEVOPS PERSON:"
echo ""
echo "    $SERVICE_URL/run-monitor"
echo ""
echo "======================================================"
echo ""
echo "They will use this URL to configure Cloud Scheduler."
echo "Full setup instructions are in SCHEDULER_SETUP.md"
echo ""
echo "🧪 To test the endpoint manually:"
echo "  gcloud scheduler jobs run mlops-weekly-report --location=$REGION"
echo ""
