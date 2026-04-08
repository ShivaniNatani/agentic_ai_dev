"""
Final metadata summary after Appeal sync
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path

creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
creds = service_account.Credentials.from_service_account_file(creds_path)
bq_client = bigquery.Client(credentials=creds, project=creds.project_id)

print("=" * 100)
print("FINAL METADATA TABLE SUMMARY")
print("=" * 100)

# Overall count
total_query = "SELECT COUNT(*) as total FROM `iksdev.Demo.model_refresh_metadata`"
total = bq_client.query(total_query).result().to_dataframe()['total'].iloc[0]
print(f"\nTotal rows in metadata: {total:,}")

# Breakdown by model
model_query = """
SELECT 
    model_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT client_name) as client_count
FROM `iksdev.Demo.model_refresh_metadata`
GROUP BY model_name
ORDER BY model_name
"""
model_breakdown = bq_client.query(model_query).result().to_dataframe()
print("\nBreakdown by model:")
print(model_breakdown.to_string(index=False))

print("\n" + "=" * 100)
