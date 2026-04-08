# Cloud Run Deployment Instructions

## Prerequisites

1. **GCP Project**: Ensure you have a GCP project with billing enabled.
2. **APIs Enabled**:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API
   - BigQuery API
3. **Service Account**: Create a service account with:
   - BigQuery Data Viewer
   - BigQuery Job User
   - (Optional) Secret Manager Secret Accessor if using Secret Manager

## Setup

### 1. Build and Push Docker Image

```bash
# Set your GCP project
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Build using Cloud Build
gcloud builds submit --config cloudbuild.yaml .

# Or build locally and push
docker build -t gcr.io/$PROJECT_ID/mlops-observatory:latest .
docker push gcr.io/$PROJECT_ID/mlops-observatory:latest
```

### 2. Deploy Streamlit Dashboard (Cloud Run Service)

```bash
gcloud run deploy mlops-observatory-dashboard \
  --image gcr.io/$PROJECT_ID/mlops-observatory:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars RUN_MODE=dashboard \
  --service-account YOUR_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com
```

### 3. Deploy Automated Monitor (Cloud Run Job - Scheduled)

#### Option A: Using Cloud Run Jobs

```bash
# Create the job
gcloud run jobs create mlops-health-monitor \
  --image gcr.io/$PROJECT_ID/mlops-observatory:latest \
  --region us-central1 \
  --memory 2Gi \
  --cpu 1 \
  --set-env-vars RUN_MODE=monitor,MONITOR_DAYS=7,EMAIL_TYPE=consolidated \
  --service-account YOUR_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com \
  --max-retries 2

# Execute manually
gcloud run jobs execute mlops-health-monitor --region us-central1

# Schedule with Cloud Scheduler
gcloud scheduler jobs create http mlops-monitor-daily \
  --location us-central1 \
  --schedule="0 9 * * *" \
  --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/mlops-health-monitor:run" \
  --http-method POST \
  --oauth-service-account-email YOUR_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com
```

#### Option B: Using Cloud Functions (Alternative)

Create a Cloud Function that triggers the Cloud Run Job on a schedule.

## Configuration

### Environment Variables

**Dashboard Mode:**
- `RUN_MODE=dashboard`
- `PORT=8080`

**Monitor Mode:**
- `RUN_MODE=monitor`
- `MONITOR_DAYS=7` (number of days to look back)
- `EMAIL_TYPE=consolidated` or `client`

### SMTP Configuration

Configure SMTP settings via:
1. **config.ini** (baked into image)
2. **Environment variables**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   SMTP_SENDER=your-email@gmail.com
   SMTP_RECIPIENTS=recipient1@example.com,recipient2@example.com
   ```
3. **Secret Manager** (recommended for production):
   ```bash
   gcloud run jobs update mlops-health-monitor \
     --update-secrets SMTP_PASSWORD=smtp-password:latest
   ```

### BigQuery Credentials

The service account attached to the Cloud Run job should have BigQuery permissions. Alternatively, mount credentials:

```bash
gcloud run jobs update mlops-health-monitor \
  --update-secrets /app/mlflow-sa.json=mlflow-sa-key:latest
```

## Monitoring

View logs:
```bash
# Dashboard logs
gcloud run services logs read mlops-observatory-dashboard --region us-central1

# Job logs
gcloud run jobs logs read mlops-health-monitor --region us-central1
```

## Updating

```bash
# Rebuild and redeploy
gcloud builds submit --config cloudbuild.yaml .

# Update service
gcloud run services update mlops-observatory-dashboard \
  --image gcr.io/$PROJECT_ID/mlops-observatory:latest \
  --region us-central1

# Update job
gcloud run jobs update mlops-health-monitor \
  --image gcr.io/$PROJECT_ID/mlops-observatory:latest \
  --region us-central1
```
