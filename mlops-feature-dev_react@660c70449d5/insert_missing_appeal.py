"""
Insert missing Appeal clients: GALEN, THC, GIA
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path
import time

creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
creds = service_account.Credentials.from_service_account_file(creds_path)
bq_client = bigquery.Client(credentials=creds, project=creds.project_id)

clients_to_insert = [
    ("GALEN", "iksgcp.iks_dwh_galen.Appeal_Prioritization_Accuracy_Table"),
    ("THC", "iksgcp.iks_dwh_thc.Appeal_Prioritization_Accuracy_Table"),
    ("GIA", "iksgcp.iks_dwh_gia.Appeal_Prioritization_Accuracy_Table"),
]

for client_name, table in clients_to_insert:
    print(f"\nInserting {client_name}...")
    
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
        print(f"✅ Inserted {job.num_dml_affected_rows:,} rows for {client_name}")
    except Exception as e:
        print(f"❌ Error inserting {client_name}: {e}")
    
    time.sleep(1)  # Small delay between inserts

# Verify final counts
print("\n" + "=" * 80)
print("FINAL VERIFICATION")
print("=" * 80)

verify_query = """
SELECT 
    client_name,
    COUNT(*) as row_count
FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name = 'Appeal Prioritization'
GROUP BY client_name
ORDER BY client_name
"""
final_counts = bq_client.query(verify_query).result().to_dataframe()
print("\nAppeal Prioritization final counts:")
print(final_counts.to_string(index=False))

total = final_counts['row_count'].sum()
print(f"\nTotal Appeal rows: {total:,}")
