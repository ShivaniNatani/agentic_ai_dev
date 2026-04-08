# Health Monitoring Scheduler Setup Guide

## For DevOps Team: Setting Up Automated Email Reports

This guide explains how to configure automated health monitoring emails that run on a schedule (e.g., daily, weekly).

## Architecture Overview

```
Cloud Scheduler → HTTP POST → Cloud Run Service (monitor-http) → Runs monitor script → Sends emails
```

## Two Deployment Options

### Option 1: HTTP Endpoint (Recommended) ✅

Deploy a separate Cloud Run service that exposes an HTTP endpoint. Cloud Scheduler will hit this endpoint to trigger monitoring.

**Pros:**
- Simple to set up
- Easy to test manually
- Cloud Scheduler has built-in retries
- Can pass parameters in request body

**Cons:**
- Requires one extra Cloud Run service

### Option 2: Cloud Run Jobs (Alternative)

Use Cloud Run Jobs which are designed for one-off batch tasks.

**Pros:**
- Designed specifically for batch/scheduled workloads
- No need for HTTP wrapper

**Cons:**
- Slightly more complex setup

---

## Option 1: HTTP Endpoint Setup (Recommended)

### Step 1: Deploy the Monitor Service

```bash
# Set your GCP project
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Build and push the image (if not already done)
gcloud builds submit --config cloudbuild.yaml

# Deploy the monitoring HTTP endpoint service
gcloud run deploy mlops-monitor-http \
  --image gcr.io/$PROJECT_ID/mlops-observatory:latest \
  --platform managed \
  --region $REGION \
  --set-env-vars RUN_MODE=monitor-http \
  --no-allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --timeout 600
```

**Important Environment Variables:**
- `RUN_MODE=monitor-http` - Runs the Flask HTTP endpoint instead of the dashboard

### Step 2: Get the Service URL

```bash
# Get the deployed service URL
SERVICE_URL=$(gcloud run services describe mlops-monitor-http \
  --region $REGION \
  --format 'value(status.url)')

echo "Monitor HTTP Endpoint: $SERVICE_URL/run-monitor"
```

Example URL: `https://mlops-monitor-http-xxxxx-uc.a.run.app/run-monitor`

### Step 3: Create a Service Account for Scheduler

```bash
# Create service account
gcloud iam service-accounts create mlops-scheduler \
  --display-name="MLOps Scheduler Service Account"

# Grant permission to invoke Cloud Run
gcloud run services add-iam-policy-binding mlops-monitor-http \
  --region=$REGION \
  --member="serviceAccount:mlops-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### Step 4: Create Cloud Scheduler Job

```bash
# Create a weekly scheduler (every Monday at 9 AM UTC)
gcloud scheduler jobs create http mlops-weekly-report \
  --location=$REGION \
  --schedule="0 9 * * 1" \
  --uri="$SERVICE_URL/run-monitor" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"days": 7, "email_type": "consolidated"}' \
  --oidc-service-account-email="mlops-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --oidc-token-audience="$SERVICE_URL"

# Or create a daily scheduler (every day at 8 AM UTC)
gcloud scheduler jobs create http mlops-daily-report \
  --location=$REGION \
  --schedule="0 8 * * *" \
  --uri="$SERVICE_URL/run-monitor" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"days": 1, "email_type": "consolidated"}' \
  --oidc-service-account-email="mlops-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --oidc-token-audience="$SERVICE_URL"
```

### Step 5: Test the Scheduler Manually

```bash
# Trigger the job manually (without waiting for schedule)
gcloud scheduler jobs run mlops-weekly-report --location=$REGION

# Check the logs
gcloud run services logs read mlops-monitor-http \
  --region=$REGION \
  --limit=50
```

### Step 6: Test via Direct HTTP Call (Optional)

```bash
# Get an identity token for authentication
TOKEN=$(gcloud auth print-identity-token)

# Trigger the monitor endpoint directly
curl -X POST "$SERVICE_URL/run-monitor" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 7, "email_type": "consolidated"}'
```

Expected response:
```json
{
  "status": "success",
  "message": "Monitoring job completed successfully",
  "days": 7,
  "email_type": "consolidated",
  "output": "..."
}
```

---

## Schedule Configuration Examples

### Cron Schedule Format
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, both 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Schedules

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Daily at 8 AM UTC | `0 8 * * *` | Every day at 8:00 AM |
| Weekly on Monday 9 AM | `0 9 * * 1` | Every Monday at 9:00 AM |
| Bi-weekly (every 2 weeks) | `0 9 * * 1` with custom logic | Mondays at 9 AM (filter in script) |
| Monthly (1st of month) | `0 9 1 * *` | 1st of every month at 9 AM |
| Every 6 hours | `0 */6 * * *` | 12 AM, 6 AM, 12 PM, 6 PM |

### Request Body Parameters

```json
{
  "days": 7,           // Lookback window (default: 7)
  "email_type": "consolidated"  // "consolidated" or "client" (default: "consolidated")
}
```

**Email Types:**
- `consolidated` - Single email with all models and clients
- `client` - Separate emails per client

---

## Option 2: Cloud Run Jobs Setup (Alternative)

### Step 1: Create Cloud Run Job

```bash
# Create a Cloud Run Job
gcloud run jobs create mlops-monitor-job \
  --image gcr.io/$PROJECT_ID/mlops-observatory:latest \
  --region $REGION \
  --set-env-vars RUN_MODE=monitor,MONITOR_DAYS=7,EMAIL_TYPE=consolidated \
  --execute-now \
  --wait
```

### Step 2: Schedule with Cloud Scheduler

```bash
# Create scheduler to trigger the job
gcloud scheduler jobs create http mlops-weekly-job-trigger \
  --location=$REGION \
  --schedule="0 9 * * 1" \
  --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/mlops-monitor-job:run" \
  --http-method=POST \
  --oauth-service-account-email="mlops-scheduler@$PROJECT_ID.iam.gserviceaccount.com"
```

---

## Monitoring and Troubleshooting

### Check Scheduler Job Status

```bash
# List all scheduler jobs
gcloud scheduler jobs list --location=$REGION

# View job details
gcloud scheduler jobs describe mlops-weekly-report --location=$REGION

# View execution history
gcloud scheduler jobs describe mlops-weekly-report \
  --location=$REGION \
  --format="table(status.lastAttemptTime, status.state)"
```

### Check Cloud Run Service Logs

```bash
# View recent logs
gcloud run services logs read mlops-monitor-http \
  --region=$REGION \
  --limit=100

# Follow logs in real-time
gcloud run services logs tail mlops-monitor-http --region=$REGION

# Filter for errors
gcloud run services logs read mlops-monitor-http \
  --region=$REGION \
  --filter="severity>=ERROR"
```

### Common Issues

**Issue 1: 403 Permission Denied**
```
Error: The caller does not have permission
```
**Solution:** Ensure the scheduler service account has `roles/run.invoker` permission:
```bash
gcloud run services add-iam-policy-binding mlops-monitor-http \
  --region=$REGION \
  --member="serviceAccount:mlops-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

**Issue 2: Timeout**
```
Error: Deadline exceeded
```
**Solution:** Increase Cloud Run timeout:
```bash
gcloud run services update mlops-monitor-http \
  --region=$REGION \
  --timeout=600
```

**Issue 3: SMTP/Email Sending Fails**
- Check `config.ini` has correct SMTP settings
- Verify SMTP credentials are valid
- Check Cloud Run service has environment variables for SMTP settings

---

## Quick Reference for DevOps

### URLs Needed for Scheduler:

After deployment, you'll have:

1. **Dashboard URL** (for users to access):
   ```
   https://mlops-dashboard-xxxxx-uc.a.run.app
   ```

2. **Monitor HTTP Endpoint URL** (for Cloud Scheduler):
   ```
   https://mlops-monitor-http-xxxxx-uc.a.run.app/run-monitor
   ```

### Complete Setup Commands (Copy-Paste Ready)

```bash
#!/bin/bash
# MLOps Scheduler Setup Script

# Configuration
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="us-central1"

# 1. Build and push image
gcloud builds submit --config cloudbuild.yaml

# 2. Deploy monitor HTTP service
gcloud run deploy mlops-monitor-http \
  --image gcr.io/$PROJECT_ID/mlops-observatory:latest \
  --platform managed \
  --region $REGION \
  --set-env-vars RUN_MODE=monitor-http \
  --no-allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --timeout 600

# 3. Get service URL
SERVICE_URL=$(gcloud run services describe mlops-monitor-http \
  --region $REGION \
  --format 'value(status.url)')

# 4. Create service account
gcloud iam service-accounts create mlops-scheduler \
  --display-name="MLOps Scheduler Service Account"

# 5. Grant permissions
gcloud run services add-iam-policy-binding mlops-monitor-http \
  --region=$REGION \
  --member="serviceAccount:mlops-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# 6. Create weekly scheduler (Monday 9 AM)
gcloud scheduler jobs create http mlops-weekly-report \
  --location=$REGION \
  --schedule="0 9 * * 1" \
  --uri="$SERVICE_URL/run-monitor" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"days": 7, "email_type": "consolidated"}' \
  --oidc-service-account-email="mlops-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --oidc-token-audience="$SERVICE_URL"

# 7. Test the scheduler
gcloud scheduler jobs run mlops-weekly-report --location=$REGION

echo "✅ Setup complete!"
echo "Monitor URL: $SERVICE_URL/run-monitor"
echo "Check logs: gcloud run services logs read mlops-monitor-http --region=$REGION"
```

---

## Summary for DevOps

**What you need to do:**

1. ✅ Deploy the monitor HTTP service with `RUN_MODE=monitor-http`
2. ✅ Get the service URL: `https://mlops-monitor-http-xxxxx.run.app/run-monitor`
3. ✅ Create Cloud Scheduler job pointing to this URL
4. ✅ Set the schedule (e.g., `0 9 * * 1` for weekly Monday 9 AM)
5. ✅ Test by running the scheduler job manually

**The URL for Cloud Scheduler is:**
```
https://mlops-monitor-http-xxxxx-uc.a.run.app/run-monitor
```

This endpoint accepts POST requests with optional JSON body to configure the monitoring parameters.
