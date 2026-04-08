# MLOps Observatory - Quick Start

## Live Data Refresh Behavior

✅ **YES - The dashboard automatically fetches live data on every page refresh!**

### How it works:
1. When you open or refresh the dashboard, `load_data()` is called
2. `load_data()` calls `_maybe_refresh_live_data()` which:
   - Connects to BigQuery using your service account
   - Executes the metadata refresh SQL (INSERT statements)
   - Fetches the latest data
   - Saves it to `model_data2.csv`
   - Loads it into the dashboard

3. You see the most recent data every time

### Configuration:
The dashboard uses credentials in this order:
1. `mlflow-sa.json` in the app directory (default)
2. Streamlit secrets (`gcp_service_account`)
3. Environment variables (`GOOGLE_APPLICATION_CREDENTIALS`)

## Deployment Summary

### Local Development
```bash
# Run dashboard locally
# 1) Start the API server (defaults to 8510)
PORT=8510 python3 api/app.py

# 2) Start the React frontend (new terminal, default dev port 8715)
cd frontend
npm install
VITE_API_PROXY_TARGET=http://localhost:8510 npm run dev

# Run health monitor manually
python3 automated_monitor.py --days 7
```

### Production Deployment (GCP via Jenkins)

**Step 1: Prepare Code**
```bash
cd /mnt/agentic-ai/shivani/mlops
git add .
git commit -m "MLOps Observatory with automated monitoring"
git push origin main
```

**Step 2: Configure Jenkins**
1. Follow `jenkins-setup.md` to configure Jenkins
2. Update `Jenkinsfile` with your GCP project details
3. Create pipeline job in Jenkins pointing to your Bitbucket repo

**Step 3: Deploy**
- Push to Bitbucket (triggers Jenkins)
- OR manually run Jenkins pipeline
- Jenkins will:
  - Build Docker image
  - Deploy dashboard to Cloud Run
  - Create/update health monitor job
  - Setup daily scheduler

**Step 4: Access**
```bash
# Get your dashboard URL
gcloud run services describe mlops-observatory-dashboard \
  --region us-central1 \
  --format 'value(status.url)'
```

Visit that URL → Dashboard with live data!

## Key Files

| File | Purpose |
|------|---------|
| `api/app.py` | React + API server (serves frontend build + JSON endpoints) |
| `automated_monitor.py` | Headless monitoring script |
| `fetch_live_data.py` | Data fetching utilities |
| `Dockerfile` | Container configuration |
| `docker-entrypoint.sh` | Runtime mode selector |
| `Jenkinsfile` | CI/CD pipeline |
| `requirements.txt` | Python dependencies |
| `config.ini` | SMTP configuration |

## Architecture

```
┌─────────────────┐
│    Bitbucket    │
└────────┬────────┘
         │ (git push)
         ▼
┌─────────────────┐
│     Jenkins     │
└────────┬────────┘
         │ (build + deploy)
         ▼
┌─────────────────┐         ┌──────────────┐
│  Cloud Run      │◄────────┤  BigQuery    │
│  (Dashboard)    │         │  (Live Data) │
└─────────────────┘         └──────────────┘
         
┌─────────────────┐         ┌──────────────┐
│  Cloud Run Job  │◄────────┤  Scheduler   │
│  (Monitor)      │         │  (Daily 9AM) │
└────────┬────────┘         └──────────────┘
         │
         ▼
┌─────────────────┐
│  Email (SMTP)   │
└─────────────────┘
```

## Monitoring Schedule

Default: **Daily at 9 AM UTC**

Change schedule:
```bash
gcloud scheduler jobs update http mlops-monitor-daily \
  --schedule="0 */6 * * *"  # Every 6 hours
```

## Email Types

### Consolidated Email (Default)
- All models, all clients in one email
- Grouped by model, then by client
- Shows data window and metrics for each

### Client Emails (Alternative)
- Separate email per client/model combination
- More granular, easier to filter

Run manually:
```bash
python3 automated_monitor.py --days 7 --email-type consolidated
# OR
python3 automated_monitor.py --days 7 --email-type client
```

## Troubleshooting

**Q: Dashboard shows old data?**
A: Check BigQuery credentials - the app should auto-refresh on page load

**Q: Manual script fails with "No module named 'CommandNotFound'"?**  
A: Use `python3` instead of `python`:
```bash
python3 automated_monitor.py --days 7
```

**Q: Jenkins build fails?**
A: Check `jenkins-setup.md` for required plugins and credentials

**Q: Email not sending?**
A: Verify SMTP settings in `config.ini` or environment variables
