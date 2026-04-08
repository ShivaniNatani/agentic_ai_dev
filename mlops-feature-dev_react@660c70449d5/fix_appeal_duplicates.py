"""
Remove duplicate Appeal rows for GALEN, GIA, THC and verify final counts
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path

creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
creds = service_account.Credentials.from_service_account_file(creds_path)
bq_client = bigquery.Client(credentials=creds, project=creds.project_id)

print("=" * 100)
print("REMOVING DUPLICATE APPEAL ROWS")
print("=" * 100)

# Delete ALL Appeal data and re-insert fresh
print("\n1️⃣ Deleting all Appeal Prioritization data...")
delete_query = """
DELETE FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name = 'Appeal Prioritization'
"""
bq_client.query(delete_query).result()
print("✅ Deleted all Appeal data")

# Re-insert from source using the queries from fetch_live_data.py
clients = [
    ("AXIA", "iksgcp.iks_dwh_axia.Appeal_Prioritization_Accuracy_Table"),
    ("GALEN", "iksgcp.iks_dwh_galen.Appeal_Prioritization_Accuracy_Table"),
    ("THC", "iksgcp.iks_dwh_thc.Appeal_Prioritization_Accuracy_Table"),
    ("PDWD", "iksgcp.iks_dwh_pdwd.Appeal_Prioritization_Accuracy_Table"),
    ("GIA", "iksgcp.iks_dwh_gia.Appeal_Prioritization_Accuracy_Table"),
    ("PHMG", "iksgcp.iks_dwh_phmg.Appeal_Prioritization_Accuracy_Table"),
]

print("\n2️⃣ Inserting fresh data from source...")
total_inserted = 0

for client_name, table in clients:
    print(f"\n  Inserting {client_name}...")
    
    query = f"""
    INSERT INTO `iksdev.Demo.model_refresh_metadata` (
      date_of_model_refresh, model_name, client_name,
      business_metrics, kpis, model_metrics,
      threshold, threshold_range, threshold_range_with_colour_tag,
      email_notification_list, rolling_window,
      model_last_update_date, model_last_updated_by,
      accuracy, recall, accuracy_pct
    )
    SELECT
      SAFE_CAST(Accuracy_Date AS DATE) as date_of_model_refresh,
      'Appeal Prioritization' as model_name,
      '{client_name}' as client_name,
      NULL as business_metrics,
      'Accuracy, Recall' as kpis,
      TO_JSON_STRING([
        STRUCT(SAFE_CAST(Accuracy AS FLOAT64) AS value, 'Overall_Accuracy' AS metric),
        STRUCT(SAFE_CAST(Recall_1 AS FLOAT64) AS value, 'Recall' AS metric)
      ]) as model_metrics,
      80.0 as threshold,
      '{{"min":60,"max":80}}' as threshold_range,
      'Green : >80, Yellow : 60-80, Red : <60' as threshold_range_with_colour_tag,
      'mlops@ikshealth.com' as email_notification_list,
      'Monthly' as rolling_window,
      CURRENT_TIMESTAMP() as model_last_update_date,
      'system' as model_last_updated_by,
      SAFE_CAST(Accuracy AS FLOAT64) as accuracy,
      SAFE_CAST(Recall_1 AS FLOAT64) as recall,
      SAFE_CAST(Accuracy AS FLOAT64) as accuracy_pct
    FROM `{table}`
    WHERE SAFE_CAST(Accuracy_Date AS DATE) IS NOT NULL
    """
    
    try:
        job = bq_client.query(query)
        result = job.result()
        rows = job.num_dml_affected_rows
        print(f"  ✅ {client_name}: {rows:,} rows")
        total_inserted += rows
    except Exception as e:
        print(f"  ❌ {client_name}: Error - {e}")

print(f"\n  Total inserted: {total_inserted:,}")

# Final verification
print("\n3️⃣ Final verification...")
verify_query = """
SELECT 
    client_name,
    COUNT(*) as metadata_count
FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name = 'Appeal Prioritization'
GROUP BY client_name
ORDER BY client_name
"""
final_counts = bq_client.query(verify_query).result().to_dataframe()

# Get source counts for comparison
source_counts = {
    "AXIA": 9491,
    "GALEN": 3867,
    "THC": 1277,
    "PDWD": 616,
    "GIA": 322,
    "PHMG": 1660
}

print("\nFinal Appeal Prioritization counts:")
print("-" * 60)
print(f"{'Client':<10} {'Source':<10} {'Metadata':<10} {'Match':<10}")
print("-" * 60)

all_match = True
for _, row in final_counts.iterrows():
    client = row['client_name']
    metadata = row['metadata_count']
    source = source_counts.get(client, 0)
    match = "✅" if source == metadata else "❌"
    if source != metadata:
        all_match = False
    print(f"{client:<10} {source:<10} {metadata:<10} {match:<10}")

total_metadata = final_counts['metadata_count'].sum()
total_source = sum(source_counts.values())
print("-" * 60)
print(f"{'TOTAL':<10} {total_source:<10} {total_metadata:<10} {'✅' if all_match else '❌':<10}")

# Overall metadata count
overall_query = "SELECT COUNT(*) as total FROM `iksdev.Demo.model_refresh_metadata`"
overall_total = bq_client.query(overall_query).result().to_dataframe()['total'].iloc[0]

print("\n" + "=" * 100)
print(f"TOTAL METADATA TABLE ROWS: {overall_total:,}")
print("=" * 100)

if all_match:
    print("\n🎉 SUCCESS! All Appeal data matches source exactly!")
else:
    print("\n⚠️  Some mismatches detected. Review above.")
