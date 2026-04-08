from google.cloud import bigquery

client = bigquery.Client.from_service_account_json("/Users/shivaninatani/Library/Mobile Documents/com~apple~CloudDocs/Codebase/IKS/agentic_ai_dev/secrets/mlflow-sa-prod.json")

q1 = """
SELECT count(*) as c FROM iksgcp.iks_dwh_gia.T_Dwh_Patient_Encounter a
LEFT JOIN iksgcp.iks_dwh_gia.main_encounter c
    ON a.Person_id = c.Person_Number AND a.Enc_nbr = c.Encounter_Number AND DATE(a.Last_bill_date) = DATE(c.Last_Bill_Date)
WHERE a.Last_bill_date IS NOT NULL
  AND a.Last_bill_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY)
  AND a.Last_bill_date <= CURRENT_DATE()
  AND NOT EXISTS (
      SELECT 1 FROM iksgcp.iks_dwh_gia.T_Dwh_Transactions b
      WHERE a.Person_id = b.Person_ID AND a.Enc_nbr = b.Source_Number
        AND (b.Tran_Date > a.Last_bill_date OR b.Closing_Date > a.Last_bill_date)
  )
"""

q2 = """
SELECT count(*) as c FROM iksgcp.iks_dwh_gia.T_Dwh_Patient_Encounter a
LEFT JOIN iksgcp.iks_dwh_gia.main_encounter c
    ON a.Person_id = c.Person_Number AND a.Enc_nbr = c.Encounter_Number AND DATE(a.Last_bill_date) = DATE(c.Last_Bill_Date)
WHERE a.Last_bill_date IS NOT NULL
  AND a.Last_bill_date < DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY)
  AND NOT EXISTS (
      SELECT 1 FROM iksgcp.iks_dwh_gia.T_Dwh_Transactions b
      WHERE a.Person_id = b.Person_ID AND a.Enc_nbr = b.Source_Number
        AND (b.Tran_Date > a.Last_bill_date OR b.Closing_Date > a.Last_bill_date)
  )
"""

print("Count with >= 45 days (0-45 days old):", list(client.query(q1).result())[0].c)
print("Count with < 45 days (older than 45 days):", list(client.query(q2).result())[0].c)
