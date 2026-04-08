"""
Comprehensive metadata validation to understand row count reduction and verify data completeness
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path
import pandas as pd

creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
creds = service_account.Credentials.from_service_account_file(creds_path)
client = bigquery.Client(credentials=creds, project=creds.project_id)

print("=" * 100)
print("METADATA TABLE COMPREHENSIVE VALIDATION")
print("=" * 100)

# 1. Overall row count
print("\n1️⃣ OVERALL ROW COUNT")
print("-" * 100)

count_query = """
SELECT COUNT(*) as total_rows
FROM `iksdev.Demo.model_refresh_metadata`
"""
total = client.query(count_query).result().to_dataframe()
print(f"Total rows in metadata table: {total['total_rows'].iloc[0]:,}")

# 2. Breakdown by model
print("\n\n2️⃣ ROW COUNT BY MODEL")
print("-" * 100)

model_count_query = """
SELECT 
    model_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT client_name) as client_count,
    COUNT(DISTINCT date_of_model_refresh) as date_count,
    MIN(date_of_model_refresh) as earliest_date,
    MAX(date_of_model_refresh) as latest_date
FROM `iksdev.Demo.model_refresh_metadata`
GROUP BY model_name
ORDER BY model_name
"""
model_breakdown = client.query(model_count_query).result().to_dataframe()
print(model_breakdown.to_string(index=False))

# 3. Breakdown by model and client
print("\n\n3️⃣ ROW COUNT BY MODEL AND CLIENT")
print("-" * 100)

client_count_query = """
SELECT 
    model_name,
    client_name,
    COUNT(*) as row_count,
    MIN(date_of_model_refresh) as earliest_date,
    MAX(date_of_model_refresh) as latest_date
FROM `iksdev.Demo.model_refresh_metadata`
GROUP BY model_name, client_name
ORDER BY model_name, client_name
"""
client_breakdown = client.query(client_count_query).result().to_dataframe()
print(client_breakdown.to_string(index=False))

# 4. Check for null dates
print("\n\n4️⃣ NULL DATE CHECK")
print("-" * 100)

null_date_query = """
SELECT 
    model_name,
    client_name,
    COUNT(*) as null_date_count
FROM `iksdev.Demo.model_refresh_metadata`
WHERE date_of_model_refresh IS NULL
GROUP BY model_name, client_name
ORDER BY null_date_count DESC
"""
null_dates = client.query(null_date_query).result().to_dataframe()

if null_dates.empty:
    print("✅ No rows with null dates")
else:
    print(f"⚠️  Found {null_dates['null_date_count'].sum()} rows with NULL dates:")
    print(null_dates.to_string(index=False))

# 5. Check duplicates per date
print("\n\n5️⃣ DUPLICATE CHECK (Rows per date)")
print("-" * 100)

dup_summary_query = """
WITH date_counts AS (
    SELECT 
        model_name,
        client_name,
        date_of_model_refresh,
        COUNT(*) as count_per_date
    FROM `iksdev.Demo.model_refresh_metadata`
    WHERE date_of_model_refresh IS NOT NULL
    GROUP BY model_name, client_name, date_of_model_refresh
)
SELECT 
    model_name,
    client_name,
    MIN(count_per_date) as min_rows_per_date,
    MAX(count_per_date) as max_rows_per_date,
    AVG(count_per_date) as avg_rows_per_date
FROM date_counts
GROUP BY model_name, client_name
ORDER BY max_rows_per_date DESC
LIMIT 10
"""
dup_summary = client.query(dup_summary_query).result().to_dataframe()
print("Top 10 model/client combinations with most duplicates per date:")
print(dup_summary.to_string(index=False))

# 6. Expected vs Actual clients
print("\n\n6️⃣ EXPECTED VS ACTUAL CLIENTS")
print("-" * 100)

expected_clients = {
    "Denial prediction (propensity-to-pay)": ["AXIA", "GALEN", "THC", "PDWD", "GIA"],
    "ITTT": ["AXIA", "GALEN", "THC", "PDWD", "GIA", "PHMG", "WWMG"],
    "Appeal Prioritization": ["AXIA", "GALEN", "THC", "PDWD", "GIA", "PHMG"]
}

actual_clients_query = """
SELECT 
    model_name,
    ARRAY_AGG(DISTINCT client_name ORDER BY client_name) as clients
FROM `iksdev.Demo.model_refresh_metadata`
GROUP BY model_name
"""
actual_clients_df = client.query(actual_clients_query).result().to_dataframe()

for _, row in actual_clients_df.iterrows():
    model = row['model_name']
    actual = set(row['clients']) if row['clients'] else set()
    
    # Find matching expected model
    expected_key = None
    if 'Denial' in model:
        expected_key = "Denial prediction (propensity-to-pay)"
    elif 'ITTT' in model:
        expected_key = "ITTT"
    elif 'Appeal' in model:
        expected_key = "Appeal Prioritization"
    
    if expected_key:
        expected = set(c.upper() for c in expected_clients[expected_key])
        actual_upper = set(c.upper() if c else 'NULL' for c in actual)
        
        missing = expected - actual_upper
        extra = actual_upper - expected
        
        print(f"\n{model}:")
        print(f"  Expected: {sorted(expected)}")
        print(f"  Actual: {sorted(actual_upper)}")
        if missing:
            print(f"  ⚠️  Missing: {sorted(missing)}")
        if extra:
            print(f"  ⚠️  Extra: {sorted(extra)}")
        if not missing and not extra:
            print(f"  ✅ All clients present")

print("\n" + "=" * 100)
print("VALIDATION COMPLETE")
print("=" * 100)
