"""
Comprehensive data validation script to compare source vs metadata for all models.
This will help identify exactly where the data diverges.
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path
import pandas as pd
from datetime import datetime, timedelta

def validate_all_data():
    creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
    if not creds_path.exists():
        print(f"❌ Credentials not found")
        return

    creds = service_account.Credentials.from_service_account_file(creds_path)
    client = bigquery.Client(credentials=creds, project=creds.project_id)
    
    print("=" * 100)
    print("COMPREHENSIVE DATA VALIDATION REPORT")
    print("=" * 100)
    
    # Test 1: ITTT AXIA - Detailed comparison
    print("\n\n1️⃣ ITTT AXIA VALIDATION")
    print("-" * 100)
    
    ittt_source_query = """
    SELECT 
        COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) as pred_date,
        AccuracyPercentage
    FROM `iksgcp.iks_dwh_axia.ITTT_ModelAccuracy` 
    WHERE COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) 
        BETWEEN '2025-10-28' AND '2025-11-27'
    ORDER BY pred_date
    """
    
    ittt_meta_query = """
    SELECT 
        date_of_model_refresh,
        accuracy
    FROM `iksdev.Demo.model_refresh_metadata`
    WHERE model_name = 'ITTT'
      AND client_name = 'AXIA'
      AND date_of_model_refresh BETWEEN '2025-10-28' AND '2025-11-27'
    ORDER BY date_of_model_refresh
    """
    
    source_ittt = client.query(ittt_source_query).result().to_dataframe()
    meta_ittt = client.query(ittt_meta_query).result().to_dataframe()
    
    print(f"\nSource Table Rows: {len(source_ittt)}")
    print(f"Source Sum: {source_ittt['AccuracyPercentage'].sum():.2f}")
    print(f"Source Avg (sum/31): {source_ittt['AccuracyPercentage'].sum() / 31:.2f}%")
    
    print(f"\nMetadata Table Rows: {len(meta_ittt)}")
    print(f"Metadata Sum: {meta_ittt['accuracy'].sum():.2f}")
    print(f"Metadata Avg (sum/31): {meta_ittt['accuracy'].sum() / 31:.2f}%")
    
    # Show differences
    if len(source_ittt) == len(meta_ittt):
        merged = source_ittt.merge(
            meta_ittt, 
            left_on='pred_date', 
            right_on='date_of_model_refresh', 
            how='outer',
            suffixes=('_source', '_meta')
        )
        merged['diff'] = merged['AccuracyPercentage'] - merged['accuracy']
        mismatches = merged[abs(merged['diff']) > 0.01]
        if not mismatches.empty:
            print(f"\n⚠️  Found {len(mismatches)} mismatched dates:")
            print(mismatches[['pred_date', 'AccuracyPercentage', 'accuracy', 'diff']].head(10))
    else:
        print(f"\n⚠️  Row count mismatch! Cannot do 1:1 comparison")
    
    # Test 2: Appeal GALEN
    print("\n\n2️⃣ APPEAL GALEN VALIDATION")
    print("-" * 100)
    
    appeal_source_query = """
    SELECT 
        SAFE_CAST(Prediction_Date AS DATE) as pred_date,
        Accuracy,
        Recall_1
    FROM `iksdev.iks_dwh_galen.Appeal_Prioritization_Accuracy_Table`
    WHERE SAFE_CAST(Prediction_Date AS DATE) BETWEEN '2025-10-28' AND '2025-11-27'
    ORDER BY pred_date DESC
    LIMIT 10
    """
    
    appeal_meta_query = """
    SELECT 
        date_of_model_refresh,
        accuracy,
        recall
    FROM `iksdev.Demo.model_refresh_metadata`
    WHERE model_name = 'Appeal Prioritization'
      AND client_name = 'GALEN'
      AND date_of_model_refresh BETWEEN '2025-10-28' AND '2025-11-27'
    ORDER BY date_of_model_refresh DESC
    """
    
    source_appeal = client.query(appeal_source_query).result().to_dataframe()
    meta_appeal = client.query(appeal_meta_query).result().to_dataframe()
    
    print("\nSource Table (top 10):")
    print(source_appeal)
    
    print(f"\nMetadata Table Rows: {len(meta_appeal)}")
    print(meta_appeal)
    
    # Test 3: Check for duplicate dates in metadata
    print("\n\n3️⃣ DUPLICATE CHECK - All Models")
    print("-" * 100)
    
    dup_query = """
    SELECT 
        model_name,
        client_name,
        date_of_model_refresh,
        COUNT(*) as count
    FROM `iksdev.Demo.model_refresh_metadata`
    WHERE date_of_model_refresh >= '2025-10-01'
    GROUP BY model_name, client_name, date_of_model_refresh
    HAVING COUNT(*) > 1
    ORDER BY count DESC, model_name, client_name
    LIMIT 20
    """
    
    duplicates = client.query(dup_query).result().to_dataframe()
    
    if not duplicates.empty:
        print(f"⚠️  Found {len(duplicates)} duplicate date entries:")
        print(duplicates)
    else:
        print("✅ No duplicates found")
    
    # Test 4: Appeal clients available
    print("\n\n4️⃣ APPEAL CLIENTS AVAILABILITY")
    print("-" * 100)
    
    # Check which clients have source tables
    clients_to_check = ['AXIA', 'GALEN', 'THC', 'GIA', 'PDWD', 'PHMG', 'WWMG']
    
    for client in clients_to_check:
        table_name = f"iksdev.iks_dwh_{client.lower()}.Appeal_Prioritization_Accuracy_Table"
        check_query = f"""
        SELECT COUNT(*) as row_count
        FROM `{table_name}`
        LIMIT 1
        """
        try:
            result = client.query(check_query).result().to_dataframe()
            count = result['row_count'].iloc[0]
            print(f"✅ {client}: Table exists ({count} rows)")
        except Exception as e:
            print(f"❌ {client}: Table not found or error - {str(e)[:50]}")
    
    # Test 5: Denial validation
    print("\n\n5️⃣ DENIAL VALIDATION (3-month and 1-month windows)")
    print("-" * 100)
    
    end_date = datetime.now().date() - timedelta(days=15)
    start_3m = end_date - timedelta(days=90)
    start_1m = end_date - timedelta(days=30)
    
    for client in ['AXIA', 'GALEN', 'THC']:
        denial_query = f"""
        SELECT 
            '{client}' as client,
            AVG(CASE WHEN date_of_model_refresh >= '{start_3m}' THEN accuracy END) as avg_3m,
            AVG(CASE WHEN date_of_model_refresh >= '{start_1m}' THEN accuracy END) as avg_1m
        FROM `iksdev.Demo.model_refresh_metadata`
        WHERE model_name = 'Denial prediction (propensity-to-pay)'
          AND client_name = '{client}'
          AND date_of_model_refresh <= '{end_date}'
        """
        denial_result = client.query(denial_query).result().to_dataframe()
        print(f"{client}: 3-month avg = {denial_result['avg_3m'].iloc[0]:.2f}%, 1-month avg = {denial_result['avg_1m'].iloc[0]:.2f}%")

if __name__ == "__main__":
    validate_all_data()
