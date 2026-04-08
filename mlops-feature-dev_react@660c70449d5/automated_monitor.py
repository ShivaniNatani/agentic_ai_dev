
"""
Automated Health Monitor for ML Observatory.

This script fetches the latest data and sends a consolidated summary email.
It is designed to be run as a scheduled task (e.g., cron job).

Usage:
    python automated_monitor.py --days 7
"""




import argparse
from datetime import datetime, timedelta, timezone

from api.core import load_data, send_client_summary_emails, send_consolidated_summary_email

def main():
    parser = argparse.ArgumentParser(description="Automated Health Monitor")
    parser.add_argument("--days", type=int, default=7, help="Number of days to look back for the report window.")
    parser.add_argument("--email-type", choices=["consolidated", "client"], default="consolidated", help="Type of email to send.")
    args = parser.parse_args()

    print("Starting Automated Health Monitor...")
    
    # 1. Load Data (triggers refresh if credentials present)
    print("Loading data...")
    try:
        data, _ = load_data(refresh=True)
        print(f"Data loaded. {len(data)} rows.")
    except Exception as e:
        print(f"Error loading data: {e}")
        sys.exit(1)

    if data.empty:
        print("No data available. Exiting.")
        sys.exit(0)

    # 2. Determine Window - Show data from 15-30 days ago (30-45 days back)
    # Example: Dec 3 → Oct 17 to Nov 17 (data from 15-30 days ago)
    today = datetime.now(timezone.utc).date()
    end_date = today - timedelta(days=15)      # 15 days ago
    start_date = today - timedelta(days=45)     # 45 days ago
    period_label = f"{start_date.strftime('%b %d, %Y')} – {end_date.strftime('%b %d, %Y')}"
    
    print(f"Window: {period_label} (30-day window ending 15 days ago)")

    # 3. Identify Models
    models = sorted(data["model_name"].dropna().unique())
    print(f"Models found: {models}")

    # 4. Send Email
    print(f"Sending {args.email_type} email...")
    
    success = False
    msg = ""
    
    # We need to mock st.secrets if running headlessly and relying on env vars/config
    # dashboard_observatory._resolve_secrets_object handles this gracefully by returning None
    # and falling back to env vars or config.ini in smtp_utils.
    
    if args.email_type == "consolidated":
        success, msg = send_consolidated_summary_email(
            data=data,
            model_names=models,
            start_date=start_date,
            end_date=end_date,
            period_label=period_label,
        )
    else:
        success, msg = send_client_summary_emails(
            data=data,
            model_names=models,
            start_date=start_date,
            end_date=end_date,
            period_label=period_label,
        )

    if success:
        print(f"Success: {msg}")
    else:
        print(f"Failed: {msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
