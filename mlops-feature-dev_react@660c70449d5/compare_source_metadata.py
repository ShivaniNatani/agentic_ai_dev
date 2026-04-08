"""
Compare source tables row counts with metadata table to ensure exact match
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path
import pandas as pd

creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
creds = service_account.Credentials.from_service_account_file(creds_path)
bq_client = bigquery.Client(credentials=creds, project=creds.project_id)

print("=" * 100)
print("SOURCE vs METADATA ROW COUNT COMPARISON")
print("=" * 100)

# Define all source tables
source_tables = {
    # ITTT
    "ITTT_AXIA": "iksgcp.iks_dwh_axia.ITTT_ModelAccuracy",
    "ITTT_GALEN": "iksgcp.iks_dwh_galen.ITTT_ModelAccuracy",
    "ITTT_THC": "iksgcp.iks_dwh_thc.ITTT_ModelAccuracy",
    "ITTT_PDWD": "iksgcp.iks_dwh_pdwd.ITTT_ModelAccuracy",
    "ITTT_GIA": "iksgcp.iks_dwh_gia.ITTT_ModelAccuracy",
    "ITTT_PHMG": "iksgcp.iks_dwh_phmg.ITTT_ModelAccuracy",
    "ITTT_WWMG": "iksgcp.iks_dwh_wwmg.ITTT_ModelAccuracy",
    
    # Appeal Prioritization
    "Appeal_AXIA": "iksgcp.iks_dwh_axia.Appeal_Prioritization_Accuracy_Table",
    "Appeal_GALEN": "iksgcp.iks_dwh_galen.Appeal_Prioritization_Accuracy_Table",
    "Appeal_THC": "iksgcp.iks_dwh_thc.Appeal_Prioritization_Accuracy_Table",
    "Appeal_GIA": "iksgcp.iks_dwh_gia.Appeal_Prioritization_Accuracy_Table",
    "Appeal_PHMG": "iksgcp.iks_dwh_phmg.Appeal_Prioritization_Accuracy_Table",
    "Appeal_PDWD": "iksgcp.iks_dwh_pdwd.Appeal_Prioritization_Accuracy_Table",
    
    # Denial
    "Denial_AXIA": "iksdev.iks_dwh_axia.Denial_ModelAccuracy",
    "Denial_GALEN": "iksdev.iks_dwh_galen.Denial_ModelAccuracy",
    "Denial_THC": "iksdev.iks_dwh_thc.Denial_ModelAccuracy",
    "Denial_PDWD": "iksdev.iks_dwh_pdwd.Denial_ModelAccuracy",
    "Denial_GIA": "iksdev.iks_dwh_gia.Denial_ModelAccuracy",
}

results = []

for name, table in source_tables.items():
    model_type, client = name.split("_")
    
    # Get source count
    try:
        source_query = f"SELECT COUNT(*) as cnt FROM `{table}`"
        source_result = bq_client.query(source_query).result().to_dataframe()
        source_count = source_result['cnt'].iloc[0]
    except Exception as e:
        source_count = f"ERROR: {str(e)[:50]}"
    
    # Get metadata count
    model_name_mapping = {
        "ITTT": "ITTT",
        "Appeal": "Appeal Prioritization",
        "Denial": "Denial prediction (propensity-to-pay)"
    }
    model_name = model_name_mapping[model_type]
    
    try:
        meta_query = f"""
        SELECT COUNT(*) as cnt 
        FROM `iksdev.Demo.model_refresh_metadata`
        WHERE model_name = '{model_name}' AND client_name = '{client}'
        """
        meta_result = bq_client.query(meta_query).result().to_dataframe()
        meta_count = meta_result['cnt'].iloc[0]
    except Exception as e:
        meta_count = f"ERROR: {str(e)[:50]}"
    
    # Calculate difference
    if isinstance(source_count, int) and isinstance(meta_count, int):
        diff = source_count - meta_count
        match = "✅" if diff == 0 else "❌"
    else:
        diff = "N/A"
        match = "⚠️"
    
    results.append({
        "Table": name,
        "Source": source_count,
        "Metadata": meta_count,
        "Diff": diff,
        "Match": match
    })

df = pd.DataFrame(results)
print("\n")
print(df.to_string(index=False))

print("\n" + "=" * 100)
print("SUMMARY")
print("=" * 100)

total_source = sum(r['Source'] for r in results if isinstance(r['Source'], int))
total_meta = sum(r['Metadata'] for r in results if isinstance(r['Metadata'], int))
total_diff = total_source - total_meta

print(f"\nTotal Source Rows: {total_source:,}")
print(f"Total Metadata Rows: {total_meta:,}")
print(f"Total Difference: {total_diff:,}")

mismatches = [r for r in results if r['Match'] == "❌"]
if mismatches:
    print(f"\n⚠️  {len(mismatches)} table(s) don't match:")
    for m in mismatches:
        print(f"  - {m['Table']}: Source={m['Source']}, Metadata={m['Metadata']}, Diff={m['Diff']}")
else:
    print("\n✅ All tables match perfectly!")
