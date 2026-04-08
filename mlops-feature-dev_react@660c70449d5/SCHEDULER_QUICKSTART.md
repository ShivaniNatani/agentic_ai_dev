# Quick Reference: Scheduler Setup

## For You (Developer)

### Step 1: Deploy Monitor HTTP Service
```bash
export PROJECT_ID="your-project-id"
./deploy-monitor-http.sh
```

This will output a URL like:
```
https://mlops-monitor-http-xxxxx-uc.a.run.app/run-monitor
```

### Step 2: Give This Information to DevOps

**Send them:**
1. The URL from Step 1
2. The file `SCHEDULER_SETUP.md`

**Example message to DevOps:**
```
Hi [DevOps Person],

I need help setting up a scheduled job for our ML monitoring dashboard.

Monitor Endpoint URL: https://mlops-monitor-http-xxxxx-uc.a.run.app/run-monitor

Please create a Cloud Scheduler job that:
- Runs every Monday at 9 AM UTC
- POSTs to the URL above with this body: {"days": 7, "email_type": "consolidated"}
- Uses OIDC authentication with a service account that has Cloud Run Invoker role

The complete setup guide is in the attached SCHEDULER_SETUP.md file.

Let me know if you need any clarification!
```

---

## For DevOps Person

### What You Need

1. **URL to schedule**: `https://mlops-monitor-http-xxxxx-uc.a.run.app/run-monitor`
2. **Schedule**: `0 9 * * 1` (every Monday 9 AM UTC) - or customize as needed
3. **HTTP Method**: POST
4. **Request Body**: 
   ```json
   {"days": 7, "email_type": "consolidated"}
   ```

### Quick Setup (5 minutes)

```bash
# 1. Set variables
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export SERVICE_URL="https://mlops-monitor-http-xxxxx-uc.a.run.app"

# 2. Create service account
gcloud iam service-accounts create mlops-scheduler \
  --display-name="MLOps Scheduler"

# 3. Grant permission to invoke Cloud Run
gcloud run services add-iam-policy-binding mlops-monitor-http \
  --region=$REGION \
  --member="serviceAccount:mlops-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# 4. Create scheduler job (Weekly on Monday 9 AM)
gcloud scheduler jobs create http mlops-weekly-report \
  --location=$REGION \
  --schedule="0 9 * * 1" \
  --uri="$SERVICE_URL/run-monitor" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"days": 7, "email_type": "consolidated"}' \
  --oidc-service-account-email="mlops-scheduler@$PROJECT_ID.iam.gserviceaccount.com" \
  --oidc-token-audience="$SERVICE_URL"

# 5. Test it
gcloud scheduler jobs run mlops-weekly-report --location=$REGION
```

### Architecture Diagram

```
┌─────────────────────┐
│  Cloud Scheduler    │
│  (Weekly: Mon 9AM)  │
└──────────┬──────────┘
           │ HTTP POST /run-monitor
           │ {"days": 7, "email_type": "consolidated"}
           ▼
┌─────────────────────────────┐
│  Cloud Run Service          │
│  mlops-monitor-http         │
│  (Flask HTTP endpoint)      │
└──────────┬──────────────────┘
           │ Executes Python script
           ▼
┌─────────────────────────────┐
│  automated_monitor.py       │
│  - Fetches data from BQ     │
│  - Analyzes metrics         │
│  - Sends email reports      │
└─────────────────────────────┘
```

### Common Schedule Patterns

| Frequency | Cron Expression | Days Parameter |
|-----------|----------------|----------------|
| Daily 8 AM | `0 8 * * *` | `"days": 1` |
| Weekly Monday 9 AM | `0 9 * * 1` | `"days": 7` |
| Bi-weekly Monday 9 AM | `0 9 * * 1` | `"days": 14` |
| Monthly 1st at 9 AM | `0 9 1 * *` | `"days": 30` |

### Troubleshooting

**Check if scheduler is working:**
```bash
gcloud scheduler jobs list --location=$REGION
```

**View scheduler execution history:**
```bash
gcloud scheduler jobs describe mlops-weekly-report \
  --location=$REGION \
  --format="value(status.lastAttemptTime, status.state)"
```

**Check logs:**
```bash
gcloud run services logs read mlops-monitor-http \
  --region=$REGION \
  --limit=50
```

---

## How It Works

1. **Cloud Scheduler** triggers at the specified time
2. **HTTP POST** is sent to the monitor endpoint with parameters
3. **Flask app** (`monitor_http.py`) receives the request
4. **Python script** (`automated_monitor.py`) runs with the specified parameters
5. **Script** fetches data from BigQuery and sends email reports
6. **HTTP response** is returned to scheduler with status

## Email Report Contains

- Model performance metrics over the specified window
- Health status for each model/client combination
- Data availability and freshness indicators
- Alerts for any metrics below threshold

---

For full details, see: **SCHEDULER_SETUP.md**
