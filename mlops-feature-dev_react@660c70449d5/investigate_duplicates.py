"""
Script to understand and fix the Appeal duplicate issue.
"""
from google.cloud import bigquery
from google.oauth2 import service_account
from pathlib import Path
import pandas as pd

def investigate_duplicates():
    creds_path = Path("/mnt/agentic-ai/shivani/mlops/mlflow-sa-prod.json")
    creds = service_account.Credentials.from_service_account_file(creds_path)
    client = bigquery.Client(credentials=creds, project=creds.project_id)
    
    print("=" * 100)
    print("APPEAL DUPLICATE INVESTIGATION")
    print("=" * 100)
    
    # Check one specific date to see what the duplicates look like
    sample_query = """
    SELECT *
    FROM `iksdev.Demo.model_refresh_metadata`
    WHERE model_name = 'Appeal Prioritization'
      AND client_name = 'GALEN'
      AND date_of_model_refresh = '2025-11-27'
    LIMIT 100
    """
    
    sample = client.query(sample_query).result().to_dataframe()
    print(f"\nSample of duplicates for GALEN on 2025-11-27:")
    print(f"Total rows: {len(sample)}")
    print(f"\nAccuracy values: {sample['accuracy'].unique()}")
    print(f"Recall values: {sample['recall'].unique()}")
    
    # Check the email calculation impact
    print(f"\nIf we average these {len(sample)} duplicate rows:")
    print(f"Mean accuracy: {sample['accuracy'].mean():.2f}%")
    print(f"Mean recall: {sample['recall'].mean():.2f}%")
    
    # Now check what proper calculation would be (taking unique values)
    unique_vals = sample.drop_duplicates(subset=['date_of_model_refresh', 'accuracy', 'recall'])
    if len(unique_vals) > 0:
        print(f"\nUnique accuracy/recall combinations: {len(unique_vals)}")
        print(f"Mean of unique values - Accuracy: {unique_vals['accuracy'].mean():.2f}%, Recall: {unique_vals['recall'].mean():.2f}%")
    
    # Check ITTT user's exact query
    print("\n\n" + "=" * 100)
    print("ITTT AXIA - EXACT USER QUERY REPLICATION")
    print("=" * 100)
    
    user_query = """
    SELECT sum(AccuracyPercentage)/31 as avg_accuracy
    FROM `iksgcp.iks_dwh_axia.ITTT_ModelAccuracy` 
    WHERE Prediction_Date >= '2025/10/28' AND Prediction_Date <= '2025/11/27'
    """
    
    user_result = client.query(user_query).result().to_dataframe()
    print(f"\nUser's exact query result: {user_result['avg_accuracy'].iloc[0]:.4f}%")
    
    # Now count how many rows that actually returns
    count_query = """
    SELECT COUNT(*) as row_count,
           SUM(AccuracyPercentage) as total_accuracy
    FROM `iksgcp.iks_dwh_axia.ITTT_ModelAccuracy` 
    WHERE Prediction_Date >= '2025/10/28' AND Prediction_Date <= '2025/11/27'
    """
    
    count_result = client.query(count_query).result().to_dataframe()
    print(f"Rows returned: {count_result['row_count'].iloc[0]}")
    print(f"Total accuracy sum: {count_result['total_accuracy'].iloc[0]:.2f}")
    print(f"Calculated (sum/{count_result['row_count'].iloc[0]}): {count_result['total_accuracy'].iloc[0] / count_result['row_count'].iloc[0]:.4f}%")
    
    # Check our metadata for same range
    our_query = """
    SELECT COUNT(*) as row_count,
           SUM(accuracy) as total_accuracy
    FROM `iksdev.Demo.model_refresh_metadata`
    WHERE model_name = 'ITTT'
      AND client_name = 'AXIA'
      AND date_of_model_refresh BETWEEN '2025-10-28' AND '2025-11-27'
    """
    
    our_result = client.query(our_query).result().to_dataframe()
    print(f"\nOur metadata:")
    print(f"Rows: {our_result['row_count'].iloc[0]}")
    print(f"Total accuracy sum: {our_result['total_accuracy'].iloc[0]:.2f}")
    print(f"Our calculation (sum/31): {our_result['total_accuracy'].iloc[0] / 31:.4f}%")

if __name__ == "__main__":
    investigate_duplicates()
