"""
Delete all Appeal/Appeal Prioritization data and re-sync fresh from source
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path

creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
creds = service_account.Credentials.from_service_account_file(creds_path)
bq_client = bigquery.Client(credentials=creds, project=creds.project_id)

print("=" * 100)
print("FULL APPEAL DATA CLEANUP AND RE-SYNC")
print("=" * 100)

# Step 1: Delete ALL Appeal entries (both old and new)
print("\n1️⃣ Deleting all Appeal data...")
delete_query = """
DELETE FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name IN ('Appeal', 'Appeal Prioritization')
"""

job = bq_client.query(delete_query)
result = job.result()
print(f"✅ Deleted all Appeal data")

# Step 2: Verify deletion
count_query = """
SELECT COUNT(*) as count
FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name IN ('Appeal', 'Appeal Prioritization')
"""
count = bq_client.query(count_query).result().to_dataframe()['count'].iloc[0]
print(f"Remaining Appeal rows: {count}")

# Step 3: Re-run MERGE from fetch_live_data
print("\n2️⃣ Running MERGE to sync from source...")
from fetch_live_data import refresh_metadata

refresh_metadata(creds_path)
print("✅ MERGE completed")

# Step 4: Verify new counts
print("\n3️⃣ Verifying new data...")
verify_query = """
SELECT 
    model_name,
    client_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT date_of_model_refresh) as date_count,
    MIN(date_of_model_refresh) as min_date,
    MAX(date_of_model_refresh) as max_date
FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name = 'Appeal Prioritization'
GROUP BY model_name, client_name
ORDER BY client_name
"""
verification = bq_client.query(verify_query).result().to_dataframe()
print("\nAppeal Prioritization data after re-sync:")
print(verification.to_string(index=False))

total = verification['row_count'].sum()
print(f"\nTotal Appeal Prioritization rows: {total:,}")

print("\n" + "=" * 100)
print("COMPLETE")
print("=" * 100)
