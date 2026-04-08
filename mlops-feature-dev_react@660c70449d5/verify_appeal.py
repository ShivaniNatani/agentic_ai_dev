"""
Verify Appeal data after re-sync
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path

creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
creds = service_account.Credentials.from_service_account_file(creds_path)
client = bigquery.Client(credentials=creds, project=creds.project_id)

print("=" * 100)
print("APPEAL DATA VERIFICATION AFTER RE-SYNC")
print("=" * 100)

# Check counts
count_query = """
SELECT 
    client_name,
    COUNT(*) as total_rows,
    MIN(date_of_model_refresh) as earliest_date,
    MAX(date_of_model_refresh) as latest_date
FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name = 'Appeal Prioritization'
GROUP BY client_name
ORDER BY client_name
"""

counts = client.query(count_query).result().to_dataframe()
print("\nAppeal Prioritization clients:")
print(counts)

# Check for duplicates
dup_query = """
SELECT 
    client_name,
    date_of_model_refresh,
    COUNT(*) as count
FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name = 'Appeal Prioritization'
GROUP BY client_name, date_of_model_refresh
HAVING COUNT(*) > 1
LIMIT 5
"""

duplicates = client.query(dup_query).result().to_dataframe()

if duplicates.empty:
    print("\n✅ No duplicates found!")
else:
    print(f"\n⚠️  Found duplicates:")
    print(duplicates)

# Check GALEN specifically for the test range
galen_query = """
SELECT 
    date_of_model_refresh,
    accuracy,
    recall
FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name = 'Appeal Prioritization'
  AND client_name = 'GALEN'
  AND date_of_model_refresh BETWEEN '2025-10-28' AND '2025-11-27'
ORDER BY date_of_model_refresh DESC
LIMIT 10
"""

galen = client.query(galen_query).result().to_dataframe()
print("\nGALEN data (test range 2025-10-28 to 2025-11-27):")
print(galen)

if not galen.empty:
    print(f"\nAverage accuracy: {galen['accuracy'].mean():.2f}%")
    print(f"Average recall: {galen['recall'].mean():.2f}%")
