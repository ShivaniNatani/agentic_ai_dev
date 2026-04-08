from google.cloud import bigquery
import sys

client = bigquery.Client.from_service_account_json("/Users/shivaninatani/Library/Mobile Documents/com~apple~CloudDocs/Codebase/IKS/agentic_ai_dev/secrets/mlflow-sa-prod.json")

# I need to see what optimix_iks.py is actually doing...
# Let's import it and call the function with a mock request context
import sys
sys.path.insert(0, "/Users/shivaninatani/Library/Mobile Documents/com~apple~CloudDocs/Codebase/IKS/agentic_ai_dev/mlops-feature-dev_react@660c70449d5")

from flask import Flask
from api.routes.optimix_iks import optimix_iks_bp, _NPNR_PAYER_SQL_IN

app = Flask(__name__)
app.register_blueprint(optimix_iks_bp)

with app.test_request_context('/api/optimix/iks/npnr-data'):
    from api.routes.optimix_iks import api_npnr_data
    # I want to see the error, so I'll patch the logger or just run the query myself
    pass

payer_filter_sql = f"AND c.Payer_Name IN ({_NPNR_PAYER_SQL_IN})" if _NPNR_PAYER_SQL_IN else ""

base_detail_cte = f"""
    npnr_live_detail AS (
        SELECT
            CAST(a.Person_id AS STRING) AS person_id,
            CAST(a.Enc_nbr AS STRING) AS encounter_number,
            CAST(c.Encounter_Number AS STRING) AS enc_from_main_encounter,
            DATE(a.Last_bill_date) AS last_bill_date,
            SAFE_CAST(a.Amt AS FLOAT64) AS amount,
            SAFE_CAST(COALESCE(c.Responsible_Entity, 0) AS INT64) AS responsible_entity,
            CAST(c.Payer_Id AS STRING) AS payer_id,
            COALESCE(NULLIF(c.Payer_Name, ''), 'Unknown') AS payer_name,
            COALESCE(NULLIF(c.Payer_Subgrouping, ''), 'Unknown') AS payer_subgrouping,
            COALESCE(NULLIF(c.Payer_Subgrouping_2, ''), 'Unknown') AS payer_subgrouping_2,
            COALESCE(NULLIF(c.Financial_Class, ''), 'Unknown') AS financial_class,
            COALESCE(NULLIF(c.Financial_Class_2, ''), 'Unknown') AS financial_class_2,
            DATE_DIFF(CURRENT_DATE(), DATE(a.Last_bill_date), DAY) AS claim_age_in_days,
            CAST(NULL AS DATE) AS last_activity_date,
            CAST(NULL AS STRING) AS last_status_code,
            CAST(NULL AS STRING) AS last_action_code
        FROM `iksgcp.iks_dwh_gia.T_Dwh_Patient_Encounter` a
        LEFT JOIN `iksgcp.iks_dwh_gia.main_encounter` c
            ON CAST(a.Person_id AS STRING) = CAST(c.Person_Number AS STRING)
           AND CAST(a.Enc_nbr AS STRING) = CAST(c.Encounter_Number AS STRING)
           AND DATE(a.Last_bill_date) = DATE(c.Last_Bill_Date)
        WHERE a.Last_bill_date IS NOT NULL
          AND DATE(a.Last_bill_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY)
          AND DATE(a.Last_bill_date) <= CURRENT_DATE()
          {payer_filter_sql}
          AND NOT EXISTS (
              SELECT 1
              FROM `iksgcp.iks_dwh_gia.T_Dwh_Transactions` b
              WHERE CAST(a.Person_id AS STRING) = CAST(b.Person_ID AS STRING)
                AND CAST(a.Enc_nbr AS STRING) = CAST(b.Source_Number AS STRING)
                AND (
                     DATE(b.Tran_Date) > DATE(a.Last_bill_date)
                  OR DATE(b.Closing_Date) > DATE(a.Last_bill_date)
                )
          )
        QUALIFY ROW_NUMBER() OVER (
            PARTITION BY CAST(a.Person_id AS STRING), CAST(a.Enc_nbr AS STRING), DATE(a.Last_bill_date)
            ORDER BY a.Modify_timestamp DESC
        ) = 1
    )
"""

sql = f"""
WITH {base_detail_cte}
SELECT count(*) FROM npnr_live_detail
"""

try:
    print(list(client.query(sql).result()))
except Exception as e:
    print("ERROR:", e)
