"""
Script to clean up Appeal duplicates and re-sync data from source.
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path

def cleanup_and_resync():
    creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
    creds = service_account.Credentials.from_service_account_file(creds_path)
    client = bigquery.Client(credentials=creds, project=creds.project_id)
    
    print("=" * 100)
    print("STEP 1: DELETE ALL APPEAL PRIORITIZATION DATA")
    print("=" * 100)
    
    delete_query = """
    DELETE FROM `iksdev.Demo.model_refresh_metadata`
    WHERE model_name = 'Appeal Prioritization'
    """
    
    print("Executing DELETE for all Appeal Prioritization entries...")
    job = client.query(delete_query)
    result = job.result()
    print(f"✅ Deleted all Appeal Prioritization entries")
    
    print("\n" + "=" * 100)
    print("STEP 2: RE-SYNC APPEAL DATA FROM SOURCE")
    print("=" * 100)
    
    # Run the MERGE query for all Appeal clients
    from fetch_live_data import METADATA_REFRESH_QUERY
    
    # Extract only the Appeal portion
    appeal_start = METADATA_REFRESH_QUERY.find("-- 2. APPEAL (AXIA / GALEN / THC)")
    appeal_end = METADATA_REFRESH_QUERY.find("-- 3. ITTT")
    
    if appeal_start != -1 and appeal_end != -1:
        appeal_merge = "BEGIN TRANSACTION;\n" + METADATA_REFRESH_QUERY[appeal_start:appeal_end] + "COMMIT TRANSACTION;"
        
        print("Executing Appeal MERGE queries...")
        job = client.query(appeal_merge)
        result = job.result()
        print(f"✅ Re-synced Appeal data from source")
    
    print("\n" + "=" * 100)
    print("STEP 3: VERIFY NO DUPLICATES REMAIN")
    print("=" * 100)
    
    dup_check = """
    SELECT 
        client_name,
        date_of_model_refresh,
        COUNT(*) as count
    FROM `iksdev.Demo.model_refresh_metadata`
    WHERE model_name = 'Appeal Prioritization'
    GROUP BY client_name, date_of_model_refresh
    HAVING COUNT(*) > 1
    LIMIT 10
    """
    
    duplicates = client.query(dup_check).result().to_dataframe()
    
    if duplicates.empty:
        print("✅ No duplicates found!")
    else:
        print(f"⚠️  Still found {len(duplicates)} duplicates:")
        print(duplicates)
    
    print("\n" + "=" * 100)
    print("STEP 4: VERIFY DATA COUNTS")
    print("=" * 100)
    
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
    print("\nAppeal Prioritization data summary:")
    print(counts)

if __name__ == "__main__":
    cleanup_and_resync()
