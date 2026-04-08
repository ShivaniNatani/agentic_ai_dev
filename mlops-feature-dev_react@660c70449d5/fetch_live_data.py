"""Utility to refresh model data from BigQuery."""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from google.cloud import bigquery
from google.oauth2 import service_account

# Default to the existing metadata table; allow override via METADATA_TABLE.
# Denial sources still pull from iksgcp tables, but consolidated metadata stays in Demo.
METADATA_TABLE = os.getenv("METADATA_TABLE", "iksdev.Demo.model_refresh_metadata")
DEFAULT_QUERY = f"SELECT * FROM `{METADATA_TABLE}`"

METADATA_REFRESH_QUERY = """
BEGIN TRANSACTION;

-- Clear existing rows for these models so we always reload fresh values
DELETE FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name IN (
  'Denial prediction (propensity-to-pay)',
  'Appeal Prioritization',
  'ITTT'
);

-- 1. DENIAL (PROPENSITY-TO-PAY): GALEN / AXIA / THC / PDWD / WWMG / GIA
-- =========================================

-- GALEN
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) as date_of_model_refresh,
    'Denial prediction (propensity-to-pay)' as model_name,
    'GALEN' as client_name,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_galen.Denial_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Every 15 days',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- AXIA
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) as date_of_model_refresh,
    'Denial prediction (propensity-to-pay)' as model_name,
    'AXIA' as client_name,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_axia.Denial_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Every 15 days',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- THC
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) as date_of_model_refresh,
    'Denial prediction (propensity-to-pay)' as model_name,
    'THC' as client_name,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_thc.Denial_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Every 15 days',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- PDWD
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) as date_of_model_refresh,
    'Denial prediction (propensity-to-pay)' as model_name,
    'PDWD' as client_name,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_pdwd.Denial_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Every 15 days',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- WWMG
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) as date_of_model_refresh,
    'Denial prediction (propensity-to-pay)' as model_name,
    'WWMG' as client_name,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_wwmg.Denial_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Every 15 days',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- GIA
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) as date_of_model_refresh,
    'Denial prediction (propensity-to-pay)' as model_name,
    'GIA' as client_name,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy,
    SAFE_CAST(Payment_Accuracy_per AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_gia.Denial_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([
      STRUCT(S.accuracy AS value, 'Payment_Accuracy' AS metric),
      STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)
    ]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Every 15 days',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- =========================================
-- 2. APPEAL (AXIA / GALEN / THC / PDWD / GIA / PHMG)
-- =========================================
-- Strategy: DELETE + INSERT to preserve all source duplicates

-- DELETE all existing Appeal Prioritization data
DELETE FROM `iksdev.Demo.model_refresh_metadata`
WHERE model_name = 'Appeal Prioritization';

-- INSERT all data from source tables (preserves duplicates)

-- AXIA
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
  'AXIA' as client_name,
  NULL as business_metrics,
  'Accuracy, Recall' as kpis,
  TO_JSON_STRING([
    STRUCT(SAFE_CAST(Accuracy AS FLOAT64) AS value, 'Overall_Accuracy' AS metric),
    STRUCT(SAFE_CAST(Recall_1 AS FLOAT64) AS value, 'Recall' AS metric)
  ]) as model_metrics,
  80.0 as threshold,
  '{"min":60,"max":80}' as threshold_range,
  'Green : >80, Yellow : 60-80, Red : <60' as threshold_range_with_colour_tag,
  'mlops@ikshealth.com' as email_notification_list,
  'Monthly' as rolling_window,
  CURRENT_TIMESTAMP() as model_last_update_date,
  'system' as model_last_updated_by,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy,
  SAFE_CAST(Recall_1 AS FLOAT64) as recall,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy_pct
FROM `iksgcp.iks_dwh_axia.Appeal_Prioritization_Accuracy_Table`
WHERE SAFE_CAST(Accuracy_Date AS DATE) IS NOT NULL;

-- GALEN
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
  'GALEN' as client_name,
  NULL as business_metrics,
  'Accuracy, Recall' as kpis,
  TO_JSON_STRING([
    STRUCT(SAFE_CAST(Accuracy AS FLOAT64) AS value, 'Overall_Accuracy' AS metric),
    STRUCT(SAFE_CAST(Recall_1 AS FLOAT64) AS value, 'Recall' AS metric)
  ]) as model_metrics,
  80.0 as threshold,
  '{"min":60,"max":80}' as threshold_range,
  'Green : >80, Yellow : 60-80, Red : <60' as threshold_range_with_colour_tag,
  'mlops@ikshealth.com' as email_notification_list,
  'Monthly' as rolling_window,
  CURRENT_TIMESTAMP() as model_last_update_date,
  'system' as model_last_updated_by,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy,
  SAFE_CAST(Recall_1 AS FLOAT64) as recall,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy_pct
FROM `iksgcp.iks_dwh_galen.Appeal_Prioritization_Accuracy_Table`
WHERE SAFE_CAST(Accuracy_Date AS DATE) IS NOT NULL;

-- THC
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
  'THC' as client_name,
  NULL as business_metrics,
  'Accuracy, Recall' as kpis,
  TO_JSON_STRING([
    STRUCT(SAFE_CAST(Accuracy AS FLOAT64) AS value, 'Overall_Accuracy' AS metric),
    STRUCT(SAFE_CAST(Recall_1 AS FLOAT64) AS value, 'Recall' AS metric)
  ]) as model_metrics,
  80.0 as threshold,
  '{"min":60,"max":80}' as threshold_range,
  'Green : >80, Yellow : 60-80, Red : <60' as threshold_range_with_colour_tag,
  'mlops@ikshealth.com' as email_notification_list,
  'Monthly' as rolling_window,
  CURRENT_TIMESTAMP() as model_last_update_date,
  'system' as model_last_updated_by,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy,
  SAFE_CAST(Recall_1 AS FLOAT64) as recall,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy_pct
FROM `iksgcp.iks_dwh_thc.Appeal_Prioritization_Accuracy_Table`
WHERE SAFE_CAST(Accuracy_Date AS DATE) IS NOT NULL;

-- PDWD  
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
  'PDWD' as client_name,
  NULL as business_metrics,
  'Accuracy, Recall' as kpis,
  TO_JSON_STRING([
    STRUCT(SAFE_CAST(Accuracy AS FLOAT64) AS value, 'Overall_Accuracy' AS metric),
    STRUCT(SAFE_CAST(Recall_1 AS FLOAT64) AS value, 'Recall' AS metric)
  ]) as model_metrics,
  80.0 as threshold,
  '{"min":60,"max":80}' as threshold_range,
  'Green : >80, Yellow : 60-80, Red : <60' as threshold_range_with_colour_tag,
  'mlops@ikshealth.com' as email_notification_list,
  'Monthly' as rolling_window,
  CURRENT_TIMESTAMP() as model_last_update_date,
  'system' as model_last_updated_by,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy,
  SAFE_CAST(Recall_1 AS FLOAT64) as recall,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy_pct
FROM `iksgcp.iks_dwh_pdwd.Appeal_Prioritization_Accuracy_Table`
WHERE SAFE_CAST(Accuracy_Date AS DATE) IS NOT NULL;

-- GIA
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
  'GIA' as client_name,
  NULL as business_metrics,
  'Accuracy, Recall' as kpis,
  TO_JSON_STRING([
    STRUCT(SAFE_CAST(Accuracy AS FLOAT64) AS value, 'Overall_Accuracy' AS metric),
    STRUCT(SAFE_CAST(Recall_1 AS FLOAT64) AS value, 'Recall' AS metric)
  ]) as model_metrics,
  80.0 as threshold,
  '{"min":60,"max":80}' as threshold_range,
  'Green : >80, Yellow : 60-80, Red : <60' as threshold_range_with_colour_tag,
  'mlops@ikshealth.com' as email_notification_list,
  'Monthly' as rolling_window,
  CURRENT_TIMESTAMP() as model_last_update_date,
  'system' as model_last_updated_by,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy,
  SAFE_CAST(Recall_1 AS FLOAT64) as recall,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy_pct
FROM `iksgcp.iks_dwh_gia.Appeal_Prioritization_Accuracy_Table`
WHERE SAFE_CAST(Accuracy_Date AS DATE) IS NOT NULL;

-- PHMG
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
  'PHMG' as client_name,
  NULL as business_metrics,
  'Accuracy, Recall' as kpis,
  TO_JSON_STRING([
    STRUCT(SAFE_CAST(Accuracy AS FLOAT64) AS value, 'Overall_Accuracy' AS metric),
    STRUCT(SAFE_CAST(Recall_1 AS FLOAT64) AS value, 'Recall' AS metric)
  ]) as model_metrics,
  80.0 as threshold,
  '{"min":60,"max":80}' as threshold_range,
  'Green : >80, Yellow : 60-80, Red : <60' as threshold_range_with_colour_tag,
  'mlops@ikshealth.com' as email_notification_list,
  'Monthly' as rolling_window,
  CURRENT_TIMESTAMP() as model_last_update_date,
  'system' as model_last_updated_by,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy,
  SAFE_CAST(Recall_1 AS FLOAT64) as recall,
  SAFE_CAST(Accuracy AS FLOAT64) as accuracy_pct
FROM `iksgcp.iks_dwh_phmg.Appeal_Prioritization_Accuracy_Table`
WHERE SAFE_CAST(Accuracy_Date AS DATE) IS NOT NULL;

-- =========================================
-- =========================================
-- 3. ITTT (AXIA / GALEN / PDWD / THC / GIA / PHMG / WWMG)
-- =========================================

-- AXIA
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) as date_of_model_refresh,
    'ITTT' as model_name,
    'AXIA' as client_name,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_axia.ITTT_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Daily',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- GALEN
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) as date_of_model_refresh,
    'ITTT' as model_name,
    'GALEN' as client_name,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_galen.ITTT_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Daily',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- PDWD
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) as date_of_model_refresh,
    'ITTT' as model_name,
    'PDWD' as client_name,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_pdwd.ITTT_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Daily',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- THC
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) as date_of_model_refresh,
    'ITTT' as model_name,
    'THC' as client_name,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_thc.ITTT_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Daily',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- GIA
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) as date_of_model_refresh,
    'ITTT' as model_name,
    'GIA' as client_name,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_gia.ITTT_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Daily',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- PHMG
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) as date_of_model_refresh,
    'ITTT' as model_name,
    'PHMG' as client_name,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_phmg.ITTT_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Daily',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

-- WWMG
MERGE `iksdev.Demo.model_refresh_metadata` T
USING (
  SELECT
    COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) as date_of_model_refresh,
    'ITTT' as model_name,
    'WWMG' as client_name,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy,
    SAFE_CAST(AccuracyPercentage AS FLOAT64) as accuracy_pct
  FROM `iksgcp.iks_dwh_wwmg.ITTT_ModelAccuracy`
  WHERE COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) IS NOT NULL
) S
ON T.model_name = S.model_name AND T.client_name = S.client_name AND T.date_of_model_refresh = S.date_of_model_refresh
WHEN MATCHED THEN
  UPDATE SET
    model_last_update_date = CURRENT_TIMESTAMP(),
    accuracy = S.accuracy,
    accuracy_pct = S.accuracy_pct,
    model_metrics = TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)])
WHEN NOT MATCHED THEN
  INSERT (
    date_of_model_refresh, model_name, client_name,
    business_metrics, kpis, model_metrics,
    threshold, threshold_range, threshold_range_with_colour_tag,
    email_notification_list, rolling_window,
    model_last_update_date, model_last_updated_by,
    accuracy, recall, accuracy_pct
  )
  VALUES (
    S.date_of_model_refresh, S.model_name, S.client_name,
    NULL, 'Accuracy',
    TO_JSON_STRING([STRUCT(S.accuracy AS value, 'Overall_Accuracy' AS metric)]),
    80.0, '{"min":60,"max":80}', 'Green : >80, Yellow : 60-80, Red : <60',
    'mlops@ikshealth.com', 'Daily',
    CURRENT_TIMESTAMP(), 'system',
    S.accuracy, NULL, S.accuracy_pct
  );

COMMIT TRANSACTION;
"""

# Point refresh SQL to the configured metadata table (prod by default).
METADATA_REFRESH_QUERY = METADATA_REFRESH_QUERY.replace("iksdev.Demo.model_refresh_metadata", METADATA_TABLE)


def refresh_metadata(credentials: Path) -> None:
    """Execute the metadata refresh SQL query."""
    creds = service_account.Credentials.from_service_account_file(credentials)
    client = bigquery.Client(credentials=creds, project=creds.project_id)
    
    job = client.query(METADATA_REFRESH_QUERY)
    job.result()  # Wait for the query to complete


def validate_metadata(credentials: Path) -> tuple[bool, str]:
    """
    Run basic sanity checks on the metadata table:
    - Freshness by model/client (max date, row counts)
    - Duplicate dates per model/client
    - Missing accuracy/recall values
    - ITTT counts (within vs total)
    Returns (ok, message).
    """
    creds = service_account.Credentials.from_service_account_file(credentials)
    client = bigquery.Client(credentials=creds, project=creds.project_id)

    checks: list[str] = []
    ok = True

    def _query(sql: str):
        return client.query(sql).result().to_dataframe(create_bqstorage_client=False)

    freshness_sql = f"""
        SELECT model_name, client_name,
               MIN(date_of_model_refresh) AS min_date,
               MAX(date_of_model_refresh) AS max_date,
               COUNT(*) AS row_count
        FROM `{METADATA_TABLE}`
        GROUP BY 1,2
        ORDER BY 1,2
    """
    dupes_sql = f"""
        SELECT model_name, client_name, date_of_model_refresh, COUNT(*) AS dupes
        FROM `{METADATA_TABLE}`
        WHERE date_of_model_refresh IS NOT NULL
        GROUP BY 1,2,3
        HAVING COUNT(*) > 1
        ORDER BY dupes DESC, model_name, client_name
        LIMIT 50
    """
    # Only flag missing recall where it is expected (Appeal). Accuracy is expected for all.
    missing_sql = """
        WITH annotated AS (
            SELECT *,
                   LOWER(model_name) LIKE '%appeal%' AS expect_recall
            FROM `iksdev.Demo.model_refresh_metadata`
        )
        SELECT model_name, client_name,
               SUM(CASE WHEN accuracy IS NULL THEN 1 ELSE 0 END) AS null_accuracy,
               SUM(CASE WHEN expect_recall AND recall IS NULL THEN 1 ELSE 0 END) AS null_recall
        FROM annotated
        GROUP BY 1,2
        HAVING null_accuracy > 0 OR null_recall > 0
        ORDER BY model_name, client_name
        LIMIT 50
    """
    ittt_counts_sql = """
        SELECT client_name,
               SUM(ittt_within_threshold_count) AS within_total,
               SUM(ittt_total_count) AS total
        FROM `iksdev.Demo.model_refresh_metadata`
        WHERE model_name = 'ITTT'
        GROUP BY 1
        ORDER BY client_name
    """

    freshness_df = _query(freshness_sql)
    checks.append(f"Freshness summary (rows per model/client):\n{freshness_df.to_string(index=False)}")

    dupes_df = _query(dupes_sql)
    if not dupes_df.empty:
        ok = False
        checks.append(f"Duplicate date rows detected:\n{dupes_df.to_string(index=False)}")
    else:
        checks.append("Duplicate date rows detected: none")

    missing_df = _query(missing_sql)
    if not missing_df.empty:
        ok = False
        checks.append(f"Missing accuracy/recall rows:\n{missing_df.to_string(index=False)}")
    else:
        checks.append("Missing accuracy/recall rows: none")

    ittt_df = _query(ittt_counts_sql)
    checks.append(f"ITTT counts (within/total sums):\n{ittt_df.to_string(index=False)}")

    return ok, "\n\n".join(checks)


def fetch_data(credentials: Path, destination: Path, query: str = DEFAULT_QUERY) -> int:
    creds = service_account.Credentials.from_service_account_file(credentials)
    client = bigquery.Client(credentials=creds, project=creds.project_id)

    dataframe = client.query(query).result().to_dataframe()
    destination.parent.mkdir(parents=True, exist_ok=True)
    dataframe.to_csv(destination, index=False)
    return len(dataframe)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh model data from BigQuery")
    parser.add_argument(
        "--credentials",
        type=Path,
        default=Path(__file__).resolve().parent / "mlflow-sa-prod.json",
        help="Path to the service account JSON key.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "model_data2.csv",
        help="Destination CSV file path.",
    )
    parser.add_argument(
        "--query",
        type=str,
        default=DEFAULT_QUERY,
        help="Custom SQL query to execute against BigQuery.",
    )
    parser.add_argument(
        "--refresh-metadata",
        action="store_true",
        help="Execute the metadata refresh SQL before fetching data.",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate the metadata table after refresh (freshness, duplicates, missing metrics, ITTT counts).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.refresh_metadata:
        print("Refreshing metadata...")
        refresh_metadata(args.credentials)
        print("Metadata refresh complete.")
        if args.validate:
            print("Running metadata validation...")
            ok, message = validate_metadata(args.credentials)
            print(message)
            if not ok:
                raise SystemExit("Validation failed; see details above.")

    rows = fetch_data(args.credentials, args.output, args.query)
    print(f"Exported {rows} rows to {args.output}")


if __name__ == "__main__":
    main()
