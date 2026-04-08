"""Optimix Payer Response Analytics routes."""

from datetime import datetime, timezone
import math
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple

from flask import Blueprint, jsonify, request
from google.cloud import bigquery
from google.oauth2 import service_account
import numpy as np
import pandas as pd

# Paths
API_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = API_DIR.parent.parent

UNKNOWN_PAYER = "Unknown"
SUPPORTED_CLIENTS = ("GIA", "AXIA")
CSV_COLUMNS = {
    "Payer_name",
    "Last_bill_date",
    "Post_Date",
    "DaysBetween",
    "Charged_Amt",
    "Billed_Amount",
    "Paid_Amount",
    "Payment_Amount",
    "Actual_Denial_Flag",
    "PP_PredictedFlag",
}


def _resolve_client_source_path(env_var: str, filename: str) -> Path:
    configured = os.getenv(env_var)
    candidates = [
        Path(configured).expanduser() if configured else None,
        ROOT_DIR / filename,
        API_DIR.parent / filename,
        Path("/app") / filename,
        Path("/mnt/agentic-ai/shivani/Final_codebase/Dev/agentic_ai_dev") / filename,
    ]
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate
    for candidate in candidates:
        if candidate is not None:
            return candidate
    return Path(filename)


CLIENT_SOURCE_CONFIG = {
    "GIA": _resolve_client_source_path("OPTIMIX_PAYER_GIA_FILE", "GIA_Data_Analysis_New.csv"),
    "AXIA": _resolve_client_source_path("OPTIMIX_PAYER_AXIA_FILE", "AXIA_Data_Analysis_New.csv"),
}

PAYER_COL = "Payer_name"
SUBMIT_COL = "Last_bill_date"
RESP_COL = "Post_Date"
RESP_DAYS_COL = "DaysBetween"
CHARGED_COL = "Billed_Amount"
PAID_COL = "Payment_Amount"
# Legacy CSV column names (for backward compatibility with existing CSV files)
CSV_CHARGED_COL = "Charged_Amt"
CSV_PAID_COL = "Paid_Amount"
ACTUAL_FLAG_COL = "Actual_Denial_Flag"
PREDICTED_FLAG_COL = "PP_PredictedFlag"
PAYER_RESPONSE_OUTPUT_TABLE = os.getenv("OPTIMIX_PAYER_RESPONSE_OUTPUT_TABLE", "iksdev.iks_dwh_gia.ITTT_PP_Output")
_response_segment_cache: Dict[str, Dict[str, Any]] = {}
_RESPONSE_SEGMENT_CACHE_TTL = int(os.getenv("OPTIMIX_PAYER_RESPONSE_CACHE_TTL", "300"))
_BQ_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]

optimix_payer_bp = Blueprint("optimix_payer", __name__, url_prefix="/api/optimix")

# Cache per client so refreshes are cheap unless the file changes.
_cached_clients: Dict[str, Dict[str, Any]] = {}


def wom_7day(dt: pd.Series) -> pd.Series:
    return ((dt.dt.day - 1) // 7 + 1).astype("Int64")


def month_lag(submit_dt: pd.Series, resp_dt: pd.Series) -> pd.Series:
    return ((resp_dt.dt.year - submit_dt.dt.year) * 12 + (resp_dt.dt.month - submit_dt.dt.month)).astype("Int64")


def _utc_iso(value: Optional[datetime] = None) -> str:
    return (value or datetime.now(timezone.utc)).isoformat()


def _to_iso_date(value: Any) -> Optional[str]:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    return str(value)


def _to_iso_datetime(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


import json
_PAYER_MAP_CACHE: dict = {}
_PAYER_MAP_LOADED: bool = False

def _get_payer_mapping() -> dict:
    global _PAYER_MAP_LOADED
    if not _PAYER_MAP_LOADED:
        try:
            wl_path = Path(__file__).resolve().parent / "npnr_payer_whitelist.json"
            if wl_path.exists():
                with open(wl_path) as f:
                    data = json.load(f)
                if isinstance(data, dict) and "optimix_to_availity" in data:
                    _PAYER_MAP_CACHE.update(data["optimix_to_availity"])
        except Exception as e:
            print(f"Failed to load payer mapping: {e}")
        _PAYER_MAP_LOADED = True
    return _PAYER_MAP_CACHE


def _clean_payer_name(value: Any) -> str:
    if value is None or pd.isna(value):
        return UNKNOWN_PAYER
    text = str(value).strip()
    if text.lower() in {"nan", "none", "null", "<na>", "nat", "n/a", "unknown"}:
        return UNKNOWN_PAYER
    if not text:
        return UNKNOWN_PAYER
    
    mapping = _get_payer_mapping()
    if not mapping:
        return text

    # If already a mapped parent (availity name), keep it
    if text in mapping.values():
        return text

    # If it's an optimix key, map it
    if text in mapping:
        return mapping[text]

    # Try case-insensitive keys just in case
    text_upper = text.upper()
    for k, v in mapping.items():
        if k.upper() == text_upper:
            return v

    return UNKNOWN_PAYER


def _clean_flag(value: Any) -> str:
    if value is None or pd.isna(value):
        return "Unknown"
    text = str(value).strip()
    if text.lower() in {"nan", "none", "null", "<na>", "nat", "n/a"}:
        return "Unknown"
    return text or "Unknown"


def _bool_arg(name: str) -> bool:
    return request.args.get(name, "false").strip().lower() in {"1", "true", "yes", "on"}


def _build_bq_client() -> Optional[bigquery.Client]:
    candidates = [
        "/app/secrets/mlflow-sa-prod.json",
        "/Users/shivaninatani/Library/Mobile Documents/com~apple~CloudDocs/Codebase/IKS/agentic_ai_dev/secrets/mlflow-sa-prod.json",
        "/Users/shivaninatani/Library/Mobile Documents/com~apple~CloudDocs/Codebase/IKS/agentic_ai_dev/secrets/key.json",
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
        "/app/secrets/agentic-ai-key.json",
    ]
    for raw_path in candidates:
        if not raw_path:
            continue
        path = Path(raw_path).expanduser()
        if not path.exists():
            continue
        try:
            creds = service_account.Credentials.from_service_account_file(str(path), scopes=_BQ_SCOPES)
            return bigquery.Client(credentials=creds, project=creds.project_id)
        except Exception as e:
            print(f"Failed to use creds at {path}: {e}")
            continue
    try:
        return bigquery.Client()
    except Exception:
        return None


def _load_client_from_bq(client: str) -> Optional[Tuple[pd.DataFrame, Dict[str, Any]]]:
    """Try loading payer response data directly from BigQuery ITTT_PP_Output."""
    bq_client = _build_bq_client()
    if bq_client is None:
        return None

    sql = f"""
        SELECT
            COALESCE(NULLIF(TRIM(CAST(Payer_name AS STRING)), ''), 'Unknown') AS Payer_name,
            DATE(Last_bill_date) AS Last_bill_date,
            COALESCE(DATE(Post_Date), PP_Post_Date) AS Post_Date,
            DATE_DIFF(COALESCE(DATE(Post_Date), PP_Post_Date), DATE(Last_bill_date), DAY) AS DaysBetween,
            COALESCE(Billed_Amount, 0) AS Billed_Amount,
            COALESCE(Payment_Amount, 0) AS Payment_Amount,
            COALESCE(NULLIF(TRIM(CAST(PP_ActualFlag AS STRING)), ''), 'Unknown') AS Actual_Denial_Flag,
            COALESCE(NULLIF(TRIM(CAST(PP_PredictedFlag AS STRING)), ''), 'Unknown') AS PP_PredictedFlag
        FROM `{PAYER_RESPONSE_OUTPUT_TABLE}`
        WHERE DATE(Last_bill_date) IS NOT NULL
          AND COALESCE(DATE(Post_Date), PP_Post_Date) IS NOT NULL
    """

    try:
        result = bq_client.query(sql).result()
        try:
            df = result.to_dataframe()
        except Exception as e:
            if "db-dtypes" in str(e):
                print(f"[optimix_payer] BQ load failed falling back to iter: {e}")
                df = pd.DataFrame([dict(r) for r in result])
            else:
                raise
        if df.empty:
            return None

        df[PAYER_COL] = df[PAYER_COL].map(_clean_payer_name)
        
        # Aggressively drop any unmapped payers to keep analytics scoped to 322 parents
        df = df[df[PAYER_COL] != UNKNOWN_PAYER].copy()
        
        df[ACTUAL_FLAG_COL] = df[ACTUAL_FLAG_COL].map(_clean_flag)
        df[PREDICTED_FLAG_COL] = df[PREDICTED_FLAG_COL].map(_clean_flag)

        df[SUBMIT_COL] = pd.to_datetime(df[SUBMIT_COL], errors="coerce")
        df[RESP_COL] = pd.to_datetime(df[RESP_COL], errors="coerce")

        df["response_days"] = pd.to_numeric(df[RESP_DAYS_COL], errors="coerce")
        df["charged_amt"] = pd.to_numeric(df[CHARGED_COL], errors="coerce").fillna(0)
        df["paid_amt"] = pd.to_numeric(df[PAID_COL], errors="coerce").fillna(0)

        df = df[df[SUBMIT_COL].notna() & df[RESP_COL].notna() & df["response_days"].notna()].copy()
        df["submit_wom"] = wom_7day(df[SUBMIT_COL])
        df["resp_wom"] = wom_7day(df[RESP_COL])
        df["month_lag"] = month_lag(df[SUBMIT_COL], df[RESP_COL])
        df["submit_month"] = df[SUBMIT_COL].dt.to_period("M").astype(str)
        df["resp_month"] = df[RESP_COL].dt.to_period("M").astype(str)
        df["week_lag"] = (df["response_days"] // 7).astype("Int64")
        df["resp_week"] = df[RESP_COL].dt.to_period("W-MON").astype(str)
        df["payer_known"] = df[PAYER_COL] != UNKNOWN_PAYER
        df["is_denial"] = (df[ACTUAL_FLAG_COL] == "Denial").astype(int)
        df["prediction_available"] = (
            (df[ACTUAL_FLAG_COL] != "Unknown") & (df[PREDICTED_FLAG_COL] != "Unknown")
        ).astype(int)
        df["prediction_match"] = (
            (df[ACTUAL_FLAG_COL] == df[PREDICTED_FLAG_COL]) & (df["prediction_available"] == 1)
        ).astype(int)

        meta = {
            "client": client,
            "source_name": f"BigQuery:{PAYER_RESPONSE_OUTPUT_TABLE}",
            "source_path": PAYER_RESPONSE_OUTPUT_TABLE,
            "source_mtime": time.time(),
            "source_last_modified": _utc_iso(),
            "loaded_at": _utc_iso(),
            "row_count": int(len(df)),
            "data_source": "bigquery",
        }

        return df, meta
    except Exception as exc:
        print(f"[optimix_payer] BQ load failed: {exc}")
        return None


def _fetch_response_segment_kpis(
    client_name: str,
    selected_payers: List[str],
    submit_start: Optional[str],
    submit_end: Optional[str],
) -> Dict[str, Any]:
    if str(client_name).strip().upper() != "GIA":
        return {}

    cache_key = "::".join([
        client_name,
        ",".join(sorted(selected_payers)) if selected_payers else "*",
        submit_start or "",
        submit_end or "",
    ])
    cached = _response_segment_cache.get(cache_key)
    now = time.time()
    if cached and (now - float(cached.get("ts", 0))) < _RESPONSE_SEGMENT_CACHE_TTL:
        return cached.get("data", {})

    bq_client = _build_bq_client()
    if bq_client is None:
        return {}

    filters = []
    params: List[Any] = []
    if submit_start:
        filters.append("DATE(Last_bill_date) >= @submit_start")
        params.append(bigquery.ScalarQueryParameter("submit_start", "DATE", submit_start))
    if submit_end:
        filters.append("DATE(Last_bill_date) <= @submit_end")
        params.append(bigquery.ScalarQueryParameter("submit_end", "DATE", submit_end))
    if selected_payers:
        filters.append("COALESCE(NULLIF(TRIM(Payer_name), ''), 'Unknown') IN UNNEST(@selected_payers)")
        params.append(bigquery.ArrayQueryParameter("selected_payers", "STRING", selected_payers))

    where_clause = ""
    if filters:
        where_clause = " AND " + " AND ".join(filters)

    sql = f"""
        WITH responded AS (
            SELECT
                CAST(Encounter_Number AS STRING) AS encounter_number,
                CAST(Person_ID AS STRING) AS person_id,
                DATE(Last_bill_date) AS submit_date,
                COALESCE(DATE(Post_Date), PP_Post_Date) AS response_date,
                UPPER(COALESCE(ITTT_PredictionLabel, '')) AS prediction_stage,
                DATE_DIFF(COALESCE(DATE(Post_Date), PP_Post_Date), DATE(Last_bill_date), DAY) AS response_days,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        CAST(Encounter_Number AS STRING),
                        CAST(Person_ID AS STRING),
                        DATE(Last_bill_date)
                    ORDER BY
                        CASE UPPER(COALESCE(ITTT_PredictionLabel, ''))
                            WHEN 'THIRD' THEN 3
                            WHEN 'SECOND' THEN 2
                            WHEN 'FIRST' THEN 1
                            ELSE 0
                        END DESC,
                        COALESCE(DATE(Post_Date), PP_Post_Date) DESC
                ) AS row_num
            FROM `{PAYER_RESPONSE_OUTPUT_TABLE}`
            WHERE DATE(Last_bill_date) IS NOT NULL
              AND COALESCE(DATE(Post_Date), PP_Post_Date) IS NOT NULL
              {where_clause}
        )
        SELECT
            ROUND(AVG(response_days), 2) AS overall_avg_response_days,
            ROUND(AVG(CASE WHEN prediction_stage = 'FIRST' THEN response_days END), 2) AS first_time_avg_response_days,
            ROUND(AVG(CASE WHEN prediction_stage IN ('SECOND', 'THIRD') THEN response_days END), 2) AS appeal_avg_response_days,
            COUNTIF(prediction_stage = 'FIRST') AS first_time_response_count,
            COUNTIF(prediction_stage IN ('SECOND', 'THIRD')) AS appeal_response_count
        FROM responded
        WHERE row_num = 1
    """

    try:
        job_config = bigquery.QueryJobConfig(query_parameters=params)
        rows = list(bq_client.query(sql, job_config=job_config).result())
        row = rows[0] if rows else None
        if row is None:
            return {}
        payload = {
            "overall_avg_response_days": float(row.overall_avg_response_days) if row.overall_avg_response_days is not None else None,
            "first_time_avg_response_days": float(row.first_time_avg_response_days) if row.first_time_avg_response_days is not None else None,
            "appeal_avg_response_days": float(row.appeal_avg_response_days) if row.appeal_avg_response_days is not None else None,
            "first_time_response_count": int(row.first_time_response_count or 0),
            "appeal_response_count": int(row.appeal_response_count or 0),
        }
        _response_segment_cache[cache_key] = {"ts": now, "data": payload}
        return payload
    except Exception:
        return {}


def _client_catalog() -> List[Dict[str, Any]]:
    catalog = []
    for client in SUPPORTED_CLIENTS:
        path = CLIENT_SOURCE_CONFIG[client]
        available = path.exists()
        stat = path.stat() if available else None
        catalog.append(
            {
                "client": client,
                "label": client,
                "available": available,
                "status": "available" if available else "awaiting_source",
                "last_modified": _to_iso_datetime(stat.st_mtime) if stat else None,
                "source_name": path.name,
            }
        )
    return catalog


def _available_clients() -> List[str]:
    return [entry["client"] for entry in _client_catalog() if entry["available"]]


def _resolve_client(requested_client: Optional[str]) -> Tuple[Optional[str], List[Dict[str, Any]], Optional[str]]:
    catalog = _client_catalog()
    available_clients = [entry["client"] for entry in catalog if entry["available"]]

    if requested_client:
        requested = requested_client.strip().upper()
        if requested not in SUPPORTED_CLIENTS:
            return None, catalog, f"Unsupported client '{requested_client}'."
        # For BQ-first mode, client is always available
        if requested not in available_clients:
            # Try BQ availability — treat as available if BQ is reachable
            bq_client = _build_bq_client()
            if bq_client is not None:
                return requested, catalog, None
            return None, catalog, f"{requested} payer data is not available yet."
        return requested, catalog, None

    if available_clients:
        return available_clients[0], catalog, None

    # No CSV available — try BQ
    bq_client = _build_bq_client()
    if bq_client is not None:
        return "GIA", catalog, None

    return None, catalog, "No payer response data sources are available."


def _load_client_dataframe(client: str, force_refresh: bool = False) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    # Try BigQuery first (live data)
    cached = _cached_clients.get(client)
    if cached and not force_refresh:
        cache_age = time.time() - cached.get("source_mtime", 0)
        if cache_age < _RESPONSE_SEGMENT_CACHE_TTL:
            return cached["df"], cached["meta"]

    bq_result = _load_client_from_bq(client)
    if bq_result is not None:
        df, meta = bq_result
        _cached_clients[client] = {
            "df": df,
            "meta": meta,
            "source_mtime": time.time(),
        }
        return df, meta

    # Fallback to CSV
    source_path = CLIENT_SOURCE_CONFIG[client]
    if not source_path.exists():
        raise FileNotFoundError(f"Could not find payer response file for {client}: {source_path}")

    stat = source_path.stat()
    if cached and not force_refresh and cached["source_mtime"] == stat.st_mtime:
        return cached["df"], cached["meta"]

    df = pd.read_csv(source_path, usecols=lambda col: str(col).strip() in CSV_COLUMNS)
    df.columns = df.columns.astype(str).str.strip()

    # Ensure expected columns exist even if a future file omits them.
    for col in CSV_COLUMNS:
        if col not in df.columns:
            df[col] = None

    # Remap legacy CSV column names to standard names
    if CSV_CHARGED_COL in df.columns and CHARGED_COL not in df.columns:
        df[CHARGED_COL] = df[CSV_CHARGED_COL]
    if CSV_PAID_COL in df.columns and PAID_COL not in df.columns:
        df[PAID_COL] = df[CSV_PAID_COL]

    df[PAYER_COL] = df[PAYER_COL].map(_clean_payer_name)
    
    # Aggressively drop any unmapped payers
    df = df[df[PAYER_COL] != UNKNOWN_PAYER].copy()
    
    df[ACTUAL_FLAG_COL] = df[ACTUAL_FLAG_COL].map(_clean_flag)
    df[PREDICTED_FLAG_COL] = df[PREDICTED_FLAG_COL].map(_clean_flag)

    df[SUBMIT_COL] = pd.to_datetime(df[SUBMIT_COL], errors="coerce")
    df[RESP_COL] = pd.to_datetime(df[RESP_COL], errors="coerce")

    if RESP_DAYS_COL in df.columns:
        df["response_days"] = pd.to_numeric(df[RESP_DAYS_COL], errors="coerce")
    else:
        df["response_days"] = (df[RESP_COL] - df[SUBMIT_COL]).dt.days

    df["charged_amt"] = pd.to_numeric(df[CHARGED_COL], errors="coerce").fillna(0)
    df["paid_amt"] = pd.to_numeric(df[PAID_COL], errors="coerce").fillna(0)

    df = df[df[SUBMIT_COL].notna() & df[RESP_COL].notna() & df["response_days"].notna()].copy()
    df["submit_wom"] = wom_7day(df[SUBMIT_COL])
    df["resp_wom"] = wom_7day(df[RESP_COL])
    df["month_lag"] = month_lag(df[SUBMIT_COL], df[RESP_COL])
    df["submit_month"] = df[SUBMIT_COL].dt.to_period("M").astype(str)
    df["resp_month"] = df[RESP_COL].dt.to_period("M").astype(str)
    df["week_lag"] = (df["response_days"] // 7).astype("Int64")
    df["resp_week"] = df[RESP_COL].dt.to_period("W-MON").astype(str)
    df["payer_known"] = df[PAYER_COL] != UNKNOWN_PAYER
    df["is_denial"] = (df[ACTUAL_FLAG_COL] == "Denial").astype(int)
    df["prediction_available"] = (
        (df[ACTUAL_FLAG_COL] != "Unknown") & (df[PREDICTED_FLAG_COL] != "Unknown")
    ).astype(int)
    df["prediction_match"] = (
        (df[ACTUAL_FLAG_COL] == df[PREDICTED_FLAG_COL]) & (df["prediction_available"] == 1)
    ).astype(int)

    meta = {
        "client": client,
        "source_name": source_path.name,
        "source_path": str(source_path),
        "source_mtime": stat.st_mtime,
        "source_last_modified": _to_iso_datetime(stat.st_mtime),
        "loaded_at": _utc_iso(),
        "row_count": int(len(df)),
        "data_source": "csv",
    }

    _cached_clients[client] = {
        "df": df,
        "meta": meta,
        "source_mtime": stat.st_mtime,
    }
    return df, meta


def _parse_requested_payers() -> List[str]:
    payers = request.args.getlist("payer")
    if not payers:
        return []

    flattened: List[str] = []
    for payer in payers:
        flattened.extend(part.strip() for part in str(payer).split(","))

    return [_clean_payer_name(payer) for payer in flattened if payer and str(payer).strip()]


def _parse_date_arg(name: str) -> Tuple[Optional[pd.Timestamp], Optional[str]]:
    raw_value = request.args.get(name, "").strip()
    if not raw_value:
        return None, None

    parsed = pd.to_datetime(raw_value, errors="coerce")
    if pd.isna(parsed):
        return None, f"Invalid {name} value '{raw_value}'. Expected YYYY-MM-DD."

    return pd.Timestamp(parsed).normalize(), None


def _build_coverage(df: pd.DataFrame) -> Dict[str, Any]:
    if df.empty:
        return {
            "submit_start": None,
            "submit_end": None,
            "response_start": None,
            "response_end": None,
        }

    return {
        "submit_start": _to_iso_date(df[SUBMIT_COL].min()),
        "submit_end": _to_iso_date(df[SUBMIT_COL].max()),
        "response_start": _to_iso_date(df[RESP_COL].min()),
        "response_end": _to_iso_date(df[RESP_COL].max()),
    }


def _clean_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {key: _clean_json(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [_clean_json(value) for value in obj]
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, (float, np.float64, np.float32)):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return float(obj)
    if isinstance(obj, (int, np.int64, np.int32)):
        return int(obj)
    return obj


def _build_empty_response(
    client: str,
    catalog: List[Dict[str, Any]],
    source_meta: Dict[str, Any],
    selected_payers: List[str],
    submit_start: Optional[str],
    submit_end: Optional[str],
    include_unknown_rankings: bool,
) -> Dict[str, Any]:
    available_clients = [entry["client"] for entry in catalog if entry["available"]]
    unavailable_clients = [entry["client"] for entry in catalog if not entry["available"]]
    return {
        "meta": {
            "client": client,
            "available_clients": available_clients,
            "unavailable_clients": unavailable_clients,
            "client_catalog": catalog,
            "source_name": source_meta.get("source_name"),
            "source_last_modified": source_meta.get("source_last_modified"),
            "loaded_at": source_meta.get("loaded_at"),
            "coverage": _build_coverage(pd.DataFrame()),
            "filtered_coverage": _build_coverage(pd.DataFrame()),
            "total_records": 0,
            "filtered_records": 0,
            "ranking_records": 0,
            "filters_applied": {
                "payers": selected_payers,
                "submit_start": submit_start,
                "submit_end": submit_end,
                "include_unknown_rankings": include_unknown_rankings,
            },
            "data_quality": {
                "missing_payer_rows": 0,
                "missing_payer_pct": 0,
                "missing_payer_charged_pct": 0,
                "missing_payer_paid_pct": 0,
                "known_payer_count": 0,
                "payment_flag_zero_paid_rows": 0,
                "denial_rows": 0,
                "prediction_rows": 0,
            },
            "notes": [
                "No rows matched the current payer filters.",
            ],
        },
        "kpis": {
            "total_claims": 0,
            "avg_payment_days": 0,
            "avg_response_days": 0,
            "median_response_days": 0,
            "p90_response_days": 0,
            "total_charged": 0,
            "total_paid": 0,
            "collection_rate": 0,
            "same_month_response_rate": 0,
            "next_month_cash_share": 0,
            "prediction_accuracy": None,
            "denial_rate": 0,
        },
        "payer_performance": {
            "by_speed": [],
            "by_slowest": [],
            "by_charged": [],
            "by_paid": [],
            "consistency": [],
            "summary_table": [],
        },
        "response_days_pattern": {
            "by_submit_wom": [],
        },
        "collection_trend": {
            "by_response_month": [],
        },
        "timing_counts": [],
        "response_receipt_pattern": [],
        "payment_timing": {
            "by_submit_month": [],
            "by_submit_wom": [],
            "by_response_week": [],
            "by_submit_wom_week_lag": [],
        },
        "filters": {
            "payers": [],
            "payer_options": [],
        },
        "planner_baseline": {
            "historical_efficiency": 0,
            "weekly_weights": [{"week": week, "weight": 0.2} for week in range(1, 6)],
            "daily_weights": [
                {"day_index": day_index, "label": label, "weight": 0.2}
                for day_index, label in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri"])
            ],
        },
    }


def _build_response(
    client_df: pd.DataFrame,
    filtered_df: pd.DataFrame,
    ranking_df: pd.DataFrame,
    source_meta: Dict[str, Any],
    catalog: List[Dict[str, Any]],
    selected_payers: List[str],
    submit_start: Optional[str],
    submit_end: Optional[str],
    include_unknown_rankings: bool,
) -> Dict[str, Any]:
    available_clients = [entry["client"] for entry in catalog if entry["available"]]
    unavailable_clients = [entry["client"] for entry in catalog if not entry["available"]]

    missing_payer_rows = int((~client_df["payer_known"]).sum())
    total_rows = int(len(client_df))
    total_charged = float(client_df["charged_amt"].sum())
    total_paid = float(client_df["paid_amt"].sum())
    missing_charged = float(client_df.loc[~client_df["payer_known"], "charged_amt"].sum())
    missing_paid = float(client_df.loc[~client_df["payer_known"], "paid_amt"].sum())

    payer_options_df = (
        client_df.groupby(PAYER_COL)
        .agg(
            claims=("response_days", "count"),
            charged_amt=("charged_amt", "sum"),
            paid_amt=("paid_amt", "sum"),
        )
        .reset_index()
    )
    payer_options_df["is_unknown"] = payer_options_df[PAYER_COL] == UNKNOWN_PAYER
    payer_options_df = payer_options_df.sort_values(
        ["is_unknown", "claims", "charged_amt", PAYER_COL],
        ascending=[True, False, False, True],
    )

    if filtered_df.empty:
        empty = _build_empty_response(
            client=source_meta["client"],
            catalog=catalog,
            source_meta=source_meta,
            selected_payers=selected_payers,
            submit_start=submit_start,
            submit_end=submit_end,
            include_unknown_rankings=include_unknown_rankings,
        )
        empty["filters"] = {
            "payers": payer_options_df[PAYER_COL].tolist(),
            "payer_options": [
                {
                    "value": row[PAYER_COL],
                    "label": "Unknown / Missing payer name" if row[PAYER_COL] == UNKNOWN_PAYER else row[PAYER_COL],
                    "claims": int(row["claims"]),
                    "charged_amt": float(row["charged_amt"]),
                    "paid_amt": float(row["paid_amt"]),
                    "is_unknown": bool(row["is_unknown"]),
                }
                for _, row in payer_options_df.iterrows()
            ],
        }
        empty["meta"]["coverage"] = _build_coverage(client_df)
        empty["meta"]["total_records"] = total_rows
        empty["meta"]["data_quality"] = {
            "missing_payer_rows": missing_payer_rows,
            "missing_payer_pct": float(missing_payer_rows / total_rows) if total_rows else 0,
            "missing_payer_charged_pct": float(missing_charged / total_charged) if total_charged else 0,
            "missing_payer_paid_pct": float(missing_paid / total_paid) if total_paid else 0,
            "known_payer_count": int(client_df.loc[client_df["payer_known"], PAYER_COL].nunique()),
            "payment_flag_zero_paid_rows": int(
                ((client_df[ACTUAL_FLAG_COL] == "Payment") & (client_df["paid_amt"] == 0)).sum()
            ),
            "denial_rows": int((client_df[ACTUAL_FLAG_COL] == "Denial").sum()),
            "prediction_rows": int(client_df["prediction_available"].sum()),
        }
        return empty

    filtered_total_charged = float(filtered_df["charged_amt"].sum())
    filtered_total_paid = float(filtered_df["paid_amt"].sum())
    prediction_rows = int(filtered_df["prediction_available"].sum())
    payment_rows = filtered_df[
        (filtered_df[ACTUAL_FLAG_COL] == "Payment") | (filtered_df["paid_amt"] > 0)
    ].copy()

    kpis = {
        "total_claims": int(len(filtered_df)),
        "avg_payment_days": float(payment_rows["response_days"].mean()) if len(payment_rows) else 0,
        "avg_response_days": float(filtered_df["response_days"].mean()) if len(filtered_df) else 0,
        "median_response_days": float(filtered_df["response_days"].median()) if len(filtered_df) else 0,
        "p90_response_days": float(filtered_df["response_days"].quantile(0.9)) if len(filtered_df) else 0,
        "total_charged": filtered_total_charged,
        "total_paid": filtered_total_paid,
        "collection_rate": float(filtered_total_paid / filtered_total_charged) if filtered_total_charged else 0,
        "same_month_response_rate": float((filtered_df["month_lag"] == 0).mean()) if len(filtered_df) else 0,
        "next_month_cash_share": float(
            filtered_df.loc[filtered_df["month_lag"] == 1, "paid_amt"].sum() / filtered_total_paid
        )
        if filtered_total_paid
        else 0,
        "prediction_accuracy": float(filtered_df["prediction_match"].sum() / prediction_rows) if prediction_rows else None,
        "denial_rate": float(filtered_df["is_denial"].mean()) if len(filtered_df) else 0,
    }
    kpis.update(
        _fetch_response_segment_kpis(
            source_meta["client"],
            selected_payers,
            submit_start,
            submit_end,
        )
    )

    payer_grp = (
        ranking_df.groupby(PAYER_COL)
        .agg(
            claims=("response_days", "count"),
            avg_days=("response_days", "mean"),
            std_days=("response_days", "std"),
            charged_amt=("charged_amt", "sum"),
            paid_amt=("paid_amt", "sum"),
            denial_count=("is_denial", "sum"),
            prediction_rows=("prediction_available", "sum"),
            prediction_matches=("prediction_match", "sum"),
        )
        .reset_index()
    )
    payer_grp["collection_rate"] = np.where(
        payer_grp["charged_amt"] > 0,
        payer_grp["paid_amt"] / payer_grp["charged_amt"],
        np.nan,
    )
    payer_grp["denial_rate"] = np.where(
        payer_grp["claims"] > 0,
        payer_grp["denial_count"] / payer_grp["claims"],
        0,
    )
    payer_grp["open_balance"] = payer_grp["charged_amt"] - payer_grp["paid_amt"]
    payer_grp["prediction_accuracy"] = np.where(
        payer_grp["prediction_rows"] > 0,
        payer_grp["prediction_matches"] / payer_grp["prediction_rows"],
        np.nan,
    )

    leaderboard_base = payer_grp[payer_grp["claims"] >= 50].copy()
    by_speed = leaderboard_base.sort_values(["avg_days", "claims"], ascending=[True, False]).head(20)
    by_slowest = leaderboard_base.sort_values(["avg_days", "claims"], ascending=[False, False]).head(20)
    by_charged = payer_grp.sort_values(["charged_amt", "claims"], ascending=[False, False]).head(20)
    by_paid = payer_grp.sort_values(["paid_amt", "claims"], ascending=[False, False]).head(20)
    consistency = payer_grp.sort_values(["claims", "charged_amt"], ascending=[False, False]).head(40)
    summary_table = payer_grp.sort_values(["open_balance", "charged_amt"], ascending=[False, False]).head(25)

    response_days_by_submit_wom = (
        filtered_df.groupby("submit_wom")
        .agg(
            claims=("response_days", "count"),
            avg_days=("response_days", "mean"),
            median_days=("response_days", "median"),
            p90_days=("response_days", lambda series: series.quantile(0.9)),
        )
        .reset_index()
        .sort_values("submit_wom")
    )

    timing_grp = filtered_df.groupby(["submit_wom", "month_lag"]).size().reset_index(name="count")
    timing_pivot = []
    for wom in sorted(filtered_df["submit_wom"].dropna().unique()):
        wom_df = timing_grp[timing_grp["submit_wom"] == wom]
        total = int(wom_df["count"].sum())
        same_month = int(wom_df[wom_df["month_lag"] == 0]["count"].sum())
        later = total - same_month
        breakdown = wom_df.sort_values("month_lag").to_dict(orient="records")
        timing_pivot.append(
            {
                "submit_wom": int(wom),
                "total": total,
                "same_month": same_month,
                "later": later,
                "same_month_pct": float(same_month / total) if total else 0,
                "breakdown": breakdown,
            }
        )

    response_receipt_pattern = (
        filtered_df.groupby("resp_wom").size().reset_index(name="count").sort_values("resp_wom")
    )
    if not response_receipt_pattern.empty:
        response_receipt_pattern["pct"] = response_receipt_pattern["count"] / response_receipt_pattern["count"].sum()

    payment_by_month = (
        filtered_df.groupby(["submit_month", "month_lag"])["paid_amt"].sum().reset_index()
    )
    payment_by_wom = (
        filtered_df.groupby(["submit_wom", "month_lag"])["paid_amt"].sum().reset_index()
    )
    payment_by_response_week = (
        filtered_df[filtered_df["paid_amt"] > 0]
        .groupby("resp_week")["paid_amt"]
        .sum()
        .reset_index()
        .sort_values("resp_week")
    )
    if not payment_by_response_week.empty:
        payment_by_response_week["pct_of_total_paid"] = (
            payment_by_response_week["paid_amt"] / payment_by_response_week["paid_amt"].sum()
        )
    collection_by_response_month = (
        filtered_df.groupby("resp_month")
        .agg(
            paid_amt=("paid_amt", "sum"),
            charged_amt=("charged_amt", "sum"),
            claims=("response_days", "size"),
        )
        .reset_index()
        .sort_values("resp_month")
    )
    if not collection_by_response_month.empty:
        collection_by_response_month["collect_rate"] = np.where(
            collection_by_response_month["charged_amt"] > 0,
            collection_by_response_month["paid_amt"] / collection_by_response_month["charged_amt"],
            np.nan,
        )

    payment_by_week_lag = (
        filtered_df[(filtered_df["paid_amt"] > 0) & filtered_df["week_lag"].notna()]
        .groupby(["submit_wom", "week_lag"])["paid_amt"]
        .sum()
        .reset_index()
    )

    weekly_volumes = filtered_df.groupby("submit_wom")["charged_amt"].sum()
    total_weekly_volume = float(weekly_volumes.sum())
    planner_weights = []
    for week in range(1, 6):
        week_amount = float(weekly_volumes.get(week, 0))
        weight = (week_amount / total_weekly_volume) if total_weekly_volume > 0 else 0.2
        planner_weights.append({"week": week, "weight": float(weight)})

    business_day_order = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    business_day_volumes = (
        filtered_df.assign(submit_dow=filtered_df[SUBMIT_COL].dt.day_name().str[:3])
        .loc[lambda df: df["submit_dow"].isin(business_day_order)]
        .groupby("submit_dow")["charged_amt"]
        .sum()
        .reindex(business_day_order, fill_value=0.0)
    )
    total_business_day_volume = float(business_day_volumes.sum())
    daily_weights = []
    for day_index, label in enumerate(business_day_order):
        day_amount = float(business_day_volumes.get(label, 0.0))
        weight = (day_amount / total_business_day_volume) if total_business_day_volume > 0 else 0.2
        daily_weights.append(
            {
                "day_index": int(day_index),
                "label": label,
                "weight": float(weight),
            }
        )

    notes = []
    if missing_payer_rows:
        notes.append("Missing payer names are excluded from payer rankings by default.")
    if unavailable_clients:
        notes.append("AXIA is wired into the client model and will appear automatically once its file is added.")
    if submit_start or submit_end:
        notes.append("Submission date filters are applied to the current scope.")

    return {
        "meta": {
            "client": source_meta["client"],
            "available_clients": available_clients,
            "unavailable_clients": unavailable_clients,
            "client_catalog": catalog,
            "source_name": source_meta.get("source_name"),
            "source_last_modified": source_meta.get("source_last_modified"),
            "loaded_at": source_meta.get("loaded_at"),
            "coverage": _build_coverage(client_df),
            "filtered_coverage": _build_coverage(filtered_df),
            "total_records": total_rows,
            "filtered_records": int(len(filtered_df)),
            "ranking_records": int(len(ranking_df)),
            "filters_applied": {
                "payers": selected_payers,
                "submit_start": submit_start,
                "submit_end": submit_end,
                "include_unknown_rankings": include_unknown_rankings,
            },
            "data_quality": {
                "missing_payer_rows": missing_payer_rows,
                "missing_payer_pct": float(missing_payer_rows / total_rows) if total_rows else 0,
                "missing_payer_charged_pct": float(missing_charged / total_charged) if total_charged else 0,
                "missing_payer_paid_pct": float(missing_paid / total_paid) if total_paid else 0,
                "known_payer_count": int(client_df.loc[client_df["payer_known"], PAYER_COL].nunique()),
                "payment_flag_zero_paid_rows": int(
                    ((client_df[ACTUAL_FLAG_COL] == "Payment") & (client_df["paid_amt"] == 0)).sum()
                ),
                "denial_rows": int((client_df[ACTUAL_FLAG_COL] == "Denial").sum()),
                "prediction_rows": int(client_df["prediction_available"].sum()),
            },
            "notes": notes,
        },
        "kpis": kpis,
        "payer_performance": {
            "by_speed": by_speed.to_dict(orient="records"),
            "by_slowest": by_slowest.to_dict(orient="records"),
            "by_charged": by_charged.to_dict(orient="records"),
            "by_paid": by_paid.to_dict(orient="records"),
            "consistency": consistency.to_dict(orient="records"),
            "summary_table": summary_table.to_dict(orient="records"),
        },
        "response_days_pattern": {
            "by_submit_wom": response_days_by_submit_wom.to_dict(orient="records"),
        },
        "collection_trend": {
            "by_response_month": collection_by_response_month.to_dict(orient="records"),
        },
        "timing_counts": timing_pivot,
        "response_receipt_pattern": response_receipt_pattern.to_dict(orient="records"),
        "payment_timing": {
            "by_submit_month": payment_by_month.to_dict(orient="records"),
            "by_submit_wom": payment_by_wom.to_dict(orient="records"),
            "by_response_week": payment_by_response_week.to_dict(orient="records"),
            "by_submit_wom_week_lag": payment_by_week_lag.to_dict(orient="records"),
        },
        "filters": {
            "payers": payer_options_df[PAYER_COL].tolist(),
            "payer_options": [
                {
                    "value": row[PAYER_COL],
                    "label": "Unknown / Missing payer name" if row[PAYER_COL] == UNKNOWN_PAYER else row[PAYER_COL],
                    "claims": int(row["claims"]),
                    "charged_amt": float(row["charged_amt"]),
                    "paid_amt": float(row["paid_amt"]),
                    "is_unknown": bool(row["is_unknown"]),
                }
                for _, row in payer_options_df.iterrows()
            ],
        },
        "planner_baseline": {
            "historical_efficiency": float(filtered_total_paid / filtered_total_charged) if filtered_total_charged else 0,
            "weekly_weights": planner_weights,
            "daily_weights": daily_weights,
        },
    }


@optimix_payer_bp.get("/payer-response-analytics")
def get_analytics():
    requested_client = request.args.get("client")
    selected_client, catalog, client_error = _resolve_client(requested_client)
    if client_error:
        status_code = 404 if requested_client and requested_client.strip().upper() in SUPPORTED_CLIENTS else 400
        if not _available_clients():
            status_code = 503
        return jsonify({"error": client_error, "meta": {"client_catalog": catalog}}), status_code

    refresh = _bool_arg("refresh")
    include_unknown_rankings = _bool_arg("include_unknown")
    selected_payers = _parse_requested_payers()
    submit_start_ts, submit_start_error = _parse_date_arg("submit_start")
    submit_end_ts, submit_end_error = _parse_date_arg("submit_end")
    if submit_start_error or submit_end_error:
        return jsonify({"error": submit_start_error or submit_end_error, "meta": {"client_catalog": catalog}}), 400
    if submit_start_ts is not None and submit_end_ts is not None and submit_start_ts > submit_end_ts:
        return jsonify({"error": "submit_start must be on or before submit_end.", "meta": {"client_catalog": catalog}}), 400

    try:
        client_df, source_meta = _load_client_dataframe(selected_client, force_refresh=refresh)
    except Exception as exc:
        return jsonify({"error": str(exc), "meta": {"client_catalog": catalog}}), 500

    filtered_df = client_df
    if selected_payers:
        filtered_df = client_df[client_df[PAYER_COL].isin(selected_payers)].copy()
    if submit_start_ts is not None:
        filtered_df = filtered_df[filtered_df[SUBMIT_COL] >= submit_start_ts].copy()
    if submit_end_ts is not None:
        filtered_df = filtered_df[filtered_df[SUBMIT_COL] < (submit_end_ts + pd.Timedelta(days=1))].copy()

    ranking_df = filtered_df
    if not selected_payers and not include_unknown_rankings:
        ranking_df = filtered_df[filtered_df["payer_known"]].copy()

    response = _build_response(
        client_df=client_df,
        filtered_df=filtered_df,
        ranking_df=ranking_df,
        source_meta=source_meta,
        catalog=catalog,
        selected_payers=selected_payers,
        submit_start=_to_iso_date(submit_start_ts),
        submit_end=_to_iso_date(submit_end_ts),
        include_unknown_rankings=include_unknown_rankings,
    )
    return jsonify(_clean_json(response))


@optimix_payer_bp.post("/payer-response-analytics/refresh")
def refresh_analytics():
    requested_client = request.args.get("client")
    selected_client, catalog, client_error = _resolve_client(requested_client)
    if client_error:
        status_code = 404 if requested_client and requested_client.strip().upper() in SUPPORTED_CLIENTS else 400
        if not _available_clients():
            status_code = 503
        return jsonify({"error": client_error, "meta": {"client_catalog": catalog}}), status_code

    try:
        _, source_meta = _load_client_dataframe(selected_client, force_refresh=True)
    except Exception as exc:
        return jsonify({"error": str(exc), "meta": {"client_catalog": catalog}}), 500

    return jsonify(
        {
            "success": True,
            "client": selected_client,
            "loaded_at": source_meta.get("loaded_at"),
            "source_last_modified": source_meta.get("source_last_modified"),
        }
    )
