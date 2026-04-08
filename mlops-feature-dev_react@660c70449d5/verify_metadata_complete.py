"""
Comprehensive metadata verification script to check data completeness
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path
import pandas as pd

creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
creds = service_account.Credentials.from_service_account_file(creds_path)
client = bigquery.Client(credentials=creds, project=creds.project_id)

print("=" * 100)
print("METADATA TABLE COMPREHENSIVE VERIFICATION")
print("=" * 100)

# 1. Overall row count
print("\n1️⃣ TOTAL ROW COUNT")
print("-" * 100)

total_query = """
SELECT COUNT(*) as total_rows
FROM `iksdev.Demo.model_refresh_metadata`
"""

total = client.query(total_query).result().to_dataframe()
print(f"Total rows in metadata table: {total['total_rows'].iloc[0]:,}")

# 2. Breakdown by model
print("\n\n2️⃣ ROW COUNT BY MODEL")
print("-" * 100)

model_query = """
SELECT 
    model_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT client_name) as client_count,
    MIN(date_of_model_refresh) as earliest_date,
    MAX(date_of_model_refresh) as latest_date
FROM `iksdev.Demo.model_refresh_metadata`
GROUP BY model_name
ORDER BY model_name
"""

by_model = client.query(model_query).result().to_dataframe()
print(by_model.to_string(index=False))

# 3. Breakdown by model AND client
print("\n\n3️⃣ ROW COUNT BY MODEL AND CLIENT")
print("-" * 100)

client_query = """
SELECT 
    model_name,
    client_name,
    COUNT(*) as row_count,
    MIN(date_of_model_refresh) as earliest_date,
    MAX(date_of_model_refresh) as latest_date,
    COUNT(DISTINCT date_of_model_refresh) as unique_dates
FROM `iksdev.Demo.model_refresh_metadata`
GROUP BY model_name, client_name
ORDER BY model_name, client_name
"""

by_client = client.query(client_query).result().to_dataframe()
print(by_client.to_string(index=False))

# 4. Check for duplicates
print("\n\n4️⃣ DUPLICATE CHECK (same model, client, date)")
print("-" * 100)

dup_query = """
SELECT 
    model_name,
    client_name,
    date_of_model_refresh,
    COUNT(*) as duplicate_count
FROM `iksdev.Demo.model_refresh_metadata`
GROUP BY model_name, client_name, date_of_model_refresh
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, model_name, client_name
LIMIT 20
"""

duplicates = client.query(dup_query).result().to_dataframe()
if duplicates.empty:
    print("✅ No duplicates found (same model/client/date)")
else:
    print(f"⚠️  Found {len(duplicates)} date combinations with duplicates:")
    print(duplicates.to_string(index=False))
    print(f"\nTotal duplicate rows: {duplicates['duplicate_count'].sum():,}")

# 5. Expected vs Actual clients for each model
print("\n\n5️⃣ EXPECTED VS ACTUAL CLIENTS")
print("-" * 100)

expected = {
    "Denial prediction (propensity-to-pay)": ["AXIA", "GALEN", "THC", "PDWD", "GIA"],
    "ITTT": ["AXIA", "GALEN", "THC", "PDWD", "GIA", "PHMG", "WWMG"],
    "Appeal Prioritization": ["AXIA", "GALEN", "THC", "PDWD", "GIA", "PHMG"]
}

for model_name, expected_clients in expected.items():
    actual_query = f"""
    SELECT DISTINCT UPPER(client_name) as client
    FROM `iksdev.Demo.model_refresh_metadata`
    WHERE model_name = '{model_name}'
    ORDER BY client
    """
    
    actual = client.query(actual_query).result().to_dataframe()
    actual_clients = set(actual['client'].tolist()) if not actual.empty else set()
    expected_clients_upper = set(c.upper() for c in expected_clients)
    
    missing = expected_clients_upper - actual_clients
    extra = actual_clients - expected_clients_upper
    
    print(f"\n{model_name}:")
    print(f"  Expected: {sorted(expected_clients_upper)}")
    print(f"  Actual: {sorted(actual_clients)}")
    
    if missing:
        print(f"  ❌ Missing: {sorted(missing)}")
    if extra:
        print(f"  ⚠️  Extra: {sorted(extra)}")
    if not missing and not extra:
        print(f"  ✅ All clients present")

# 6. Sample recent data
print("\n\n6️⃣ SAMPLE RECENT DATA (last 10 rows)")
print("-" * 100)

sample_query = """
SELECT 
    model_name,
    client_name,
    date_of_model_refresh,
    accuracy,
    recall
FROM `iksdev.Demo.model_refresh_metadata`
ORDER BY date_of_model_refresh DESC, model_name, client_name
LIMIT 10
"""

sample = client.query(sample_query).result().to_dataframe()
print(sample.to_string(index=False))

print("\n" + "=" * 100)
print("VERIFICATION COMPLETE")
print("=" * 100)
