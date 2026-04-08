"""Core data and analytics helpers for the React dashboard API."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union
import json
import os
import re

import pandas as pd

try:
    from smtp_utils import (
        resolve_smtp_settings as _resolve_smtp_settings,
        send_email_via_smtp as _send_email_via_smtp,
    )
except ImportError:  # pragma: no cover - namespace fallback
    from .smtp_utils import (  # type: ignore
        resolve_smtp_settings as _resolve_smtp_settings,
        send_email_via_smtp as _send_email_via_smtp,
    )

try:
    from fetch_live_data import METADATA_REFRESH_QUERY, METADATA_TABLE
except Exception:  # pragma: no cover - optional
    METADATA_REFRESH_QUERY = None
    METADATA_TABLE = os.getenv("METADATA_TABLE", "iksdev.Demo.model_refresh_metadata")


DATA_PATH = Path(__file__).resolve().parents[1] / "model_data2.csv"
DEFAULT_LIVE_QUERY = f"SELECT * FROM `{METADATA_TABLE}`"

ITTT_ACCURACY_TABLES: dict[str, str] = {
    "AXIA": "iksgcp.iks_dwh_axia.ITTT_ModelAccuracy",
    "GALEN": "iksgcp.iks_dwh_galen.ITTT_ModelAccuracy",
    "THC": "iksgcp.iks_dwh_thc.ITTT_ModelAccuracy",
    "PDWD": "iksgcp.iks_dwh_pdwd.ITTT_ModelAccuracy",
    "GIA": "iksgcp.iks_dwh_gia.ITTT_ModelAccuracy",
    "PHMG": "iksgcp.iks_dwh_phmg.ITTT_ModelAccuracy",
    "WWMG": "iksgcp.iks_dwh_wwmg.ITTT_ModelAccuracy",
}

DENIAL_ACCURACY_TABLES: dict[str, str] = {
    "AXIA": "iksgcp.iks_dwh_axia.Denial_ModelAccuracy",
    "GALEN": "iksgcp.iks_dwh_galen.Denial_ModelAccuracy",
    "THC": "iksgcp.iks_dwh_thc.Denial_ModelAccuracy",
    "PDWD": "iksgcp.iks_dwh_pdwd.Denial_ModelAccuracy",
    "GIA": "iksgcp.iks_dwh_gia.Denial_ModelAccuracy",
    "WWMG": "iksgcp.iks_dwh_wwmg.Denial_ModelAccuracy",
}

APPEAL_ACCURACY_TABLES: dict[str, str] = {
    "AXIA": "iksgcp.iks_dwh_axia.Appeal_Prioritization_Accuracy_Table",
    "GALEN": "iksgcp.iks_dwh_galen.Appeal_Prioritization_Accuracy_Table",
    "THC": "iksgcp.iks_dwh_thc.Appeal_Prioritization_Accuracy_Table",
    "GIA": "iksgcp.iks_dwh_gia.Appeal_Prioritization_Accuracy_Table",
    "PHMG": "iksgcp.iks_dwh_phmg.Appeal_Prioritization_Accuracy_Table",
    "PDWD": "iksgcp.iks_dwh_pdwd.Appeal_Prioritization_Accuracy_Table",
}

CLIENT_CANONICAL_NAMES: dict[str, dict[str, str]] = {
    "denial": {
        "AXIA": "AXIA",
        "THC": "THC",
        "GALEN": "GALEN",
        "GLMG": "GALEN",
        "PDWD": "PDWD",
        "GIA": "GIA",
        "WWMG": "WWMG",
    },
    "ittt": {
        "AXIA": "AXIA",
        "GALEN": "GALEN",
        "THC": "THC",
        "PDWD": "PDWD",
        "GIA": "GIA",
        "PHMG": "PHMG",
        "WWMG": "WWMG",
    },
    "appeal": {
        "AXIA": "AXIA",
        "GALEN": "GALEN",
        "THC": "THC",
        "GIA": "GIA",
        "PHMG": "PHMG",
        "PDWD": "PDWD",
    },
}

EXPECTED_CLIENTS_BY_MODEL: dict[str, list[str]] = {
    "Denial": ["AXIA", "GALEN", "THC", "PDWD", "GIA", "WWMG"],
    "ITTT": ["AXIA", "GALEN", "THC", "PDWD", "GIA", "PHMG", "WWMG"],
    "Appeal": ["AXIA", "GALEN", "THC", "PDWD", "GIA", "PHMG"],
    "Appeal Prioritization": ["AXIA", "GALEN", "THC", "GIA", "PHMG", "PDWD"],
}

METRIC_LABEL_OVERRIDES: dict[str, str] = {
    "payment_accuracy": "Propensity to Pay",
    "payment_accuracy_per": "Propensity to Pay",
    "denial_accuracy": "Propensity to Deny",
    "denial_accuracy_per": "Propensity to Deny",
}

METRIC_DESCRIPTIONS: dict[str, str] = {
    "Overall_Accuracy": "Percentage of predictions matching observed outcomes; higher values indicate better alignment with reality.",
    "Accuracy_pct": "Accuracy percentage reported directly from the source system for each refresh.",
    "Denial_Accuracy": "Propensity to Deny - correctness of predicted denials versus actual denials.",
    "Payment_Accuracy": "Propensity to Pay - correctness of predicted payments versus actual payments.",
    "NPNR_per": "Share of encounters classified as no-pay/no-response; rising values can signal aging backlog.",
    "Net_Encounter_per": "Percentage of encounters remaining after removing no-pay/no-response cases.",
    "Encounter_Count": "Total encounters evaluated for the selected filters.",
    "NPNR_Count": "Number of encounters labelled as no-pay/no-response.",
    "Net_Encounter_Count": "Encounters remaining once NPNR cases are removed.",
    "Payment_Total_Count": "Total payment-labelled encounters processed in the window.",
    "Payment_Correct_Count": "Payment encounters the model classified correctly.",
    "Denial_Total_Count": "Total denial-labelled encounters processed in the window.",
    "Denial_Correct_Count": "Denial encounters the model classified correctly.",
    "ITTT_Within_Threshold_Count": "Number of ITTT deployments operating within the configured threshold band.",
    "ITTT_Total_Count": "Total ITTT deployments monitored for the refresh window.",
    "Latency (hours)": "Elapsed time between refresh completion and data availability; lower numbers mean faster pipelines.",
    "drift": "Difference between actual and expected performance; negative drift highlights under-performance.",
    "threshold": "Configured performance target that the model is expected to meet or exceed.",
}

MODEL_METRIC_PRIORITIES: dict[str, list[str]] = {
    "denial": [
        "Overall_Accuracy",
        "Denial_Accuracy",
        "Payment_Accuracy",
        "Accuracy_pct",
        "NPNR_per",
        "Net_Encounter_per",
        "NPNR_Count",
        "Denial_Correct_Count",
        "Denial_Total_Count",
        "Payment_Total_Count",
        "Payment_Correct_Count",
    ],
    "ittt": [
        "Overall_Accuracy",
        "Accuracy_pct",
        "ITTT_Within_Threshold_Count",
        "ITTT_Total_Count",
        "Encounter_Count",
        "NPNR_Count",
        "Net_Encounter_Count",
        "NPNR_per",
        "Net_Encounter_per",
    ],
    "appeal": [
        "Overall_Accuracy",
        "Accuracy_pct",
    ],
}

BASE_DERIVED_METRICS: dict[str, str] = {
    "accuracy_pct": "Accuracy_pct",
    "overall_accuracy": "Overall_Accuracy",
}

DERIVED_METRICS_BY_MODEL: dict[str, dict[str, str]] = {
    "__default__": BASE_DERIVED_METRICS,
    "denial": {
        **BASE_DERIVED_METRICS,
        "denial_accuracy_per": "Denial_Accuracy",
        "payment_accuracy_per": "Payment_Accuracy",
        "npnr_per": "NPNR_per",
        "net_encounter_per": "Net_Encounter_per",
        "encounter_count": "Encounter_Count",
        "npnr_count": "NPNR_Count",
        "net_encounter_count": "Net_Encounter_Count",
        "payment_total_count": "Payment_Total_Count",
        "payment_correct_count": "Payment_Correct_Count",
        "denial_total_count": "Denial_Total_Count",
        "denial_correct_count": "Denial_Correct_Count",
    },
    "ittt": {
        **BASE_DERIVED_METRICS,
        "ittt_within_threshold_count": "ITTT_Within_Threshold_Count",
        "ittt_total_count": "ITTT_Total_Count",
        "encounter_count": "Encounter_Count",
        "npnr_count": "NPNR_Count",
        "net_encounter_count": "Net_Encounter_Count",
        "payment_total_count": "Payment_Total_Count",
        "payment_correct_count": "Payment_Correct_Count",
    },
    "appeal": {
        **BASE_DERIVED_METRICS,
    },
}

DRIFT_METRIC_SOURCES: dict[str, tuple[str | None, str | None]] = {
    "overall_accuracy": ("overall_accuracy_per", "overall_accuracy"),
    "accuracy_pct": ("accuracy_pct", "accuracy"),
}

ALERT_METRICS_BY_MODEL: dict[str, set[str]] = {
    "__default__": {"Overall_Accuracy", "Accuracy_pct"},
    "Denial": {"Overall_Accuracy", "Accuracy_pct"},
    "ITTT": {"Overall_Accuracy", "Accuracy_pct"},
    "Appeal": {"Overall_Accuracy", "Accuracy_pct"},
    "Appeal Prioritization": {"Overall_Accuracy", "Accuracy_pct"},
}


@dataclass
class LoadMeta:
    data_source: str
    refresh_error: Optional[str]
    source_file_mtime: Optional[datetime]
    latest_data_point: Optional[datetime]
    refreshed_at: Optional[datetime]


_DATA_CACHE: dict[str, Any] = {"frame": None, "meta": None, "mtime": None}


def _maybe_parse_json(value: str) -> Optional[dict[str, Any]]:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _resolve_credentials_info() -> tuple[Optional[dict[str, Any]], Optional[Path]]:
    json_blob = os.getenv("GCP_SERVICE_ACCOUNT_JSON") or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if json_blob:
        parsed = _maybe_parse_json(json_blob)
        if isinstance(parsed, dict):
            return parsed, None

    path_value = (
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        or os.getenv("STREAMLIT_GCP_CREDENTIALS")
        or os.getenv("GCP_CREDENTIALS_PATH")
    )
    if path_value:
        return None, Path(path_value).expanduser()
    return None, None


def _resolve_default_credentials_path(query: str | None) -> Optional[Path]:
    needs_prod = False
    if query and "iksgcp" in query.lower():
        needs_prod = True
    if METADATA_REFRESH_QUERY and "iksgcp" in METADATA_REFRESH_QUERY.lower():
        needs_prod = True

    default_name = "mlflow-sa-prod.json" if needs_prod else "mlflow-sa.json"
    candidate = Path(__file__).resolve().parents[1] / default_name
    return candidate if candidate.exists() else None


def refresh_live_data(
    destination: Path,
    *,
    query: Optional[str] = None,
    refresh_metadata: bool = True,
) -> tuple[bool, Optional[str]]:
    query = query or os.getenv("LIVE_DATA_QUERY") or DEFAULT_LIVE_QUERY
    credentials_info, credentials_path = _resolve_credentials_info()

    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
    except ModuleNotFoundError:
        return False, "Install google-cloud-bigquery to enable live refresh."

    if credentials_info:
        creds = service_account.Credentials.from_service_account_info(credentials_info)
    else:
        if credentials_path is None or not credentials_path.exists():
            credentials_path = _resolve_default_credentials_path(query)
        if credentials_path is None or not credentials_path.exists():
            return False, "No GCP credentials found."
        creds = service_account.Credentials.from_service_account_file(credentials_path)

    try:
        client = bigquery.Client(credentials=creds, project=creds.project_id)
        if refresh_metadata and METADATA_REFRESH_QUERY:
            client.query(METADATA_REFRESH_QUERY).result()
        dataframe = client.query(query).result().to_dataframe(create_bqstorage_client=False)
        destination.parent.mkdir(parents=True, exist_ok=True)
        dataframe.to_csv(destination, index=False)
        return True, None
    except Exception as exc:  # pragma: no cover - upstream
        return False, str(exc)


def _normalize_model_key(name: str | None) -> str:
    if not name:
        return ""
    text = str(name).strip().lower()
    if not text:
        return ""
    if "denial" in text:
        return "denial"
    if "ittt" in text:
        return "ittt"
    if "appeal" in text:
        return "appeal"
    return text


def _canonicalize_client(model_name: str | None, client_name: str | None) -> str | None:
    if client_name is None:
        return None
    model_key = _normalize_model_key(model_name)
    canonical_map = CLIENT_CANONICAL_NAMES.get(model_key, {})
    normalized = client_name.strip().upper()
    canonical = canonical_map.get(normalized, normalized)
    return canonical.strip().upper()


def _format_metric_label(name: str | None) -> str:
    if name is None:
        return "Metric"
    text = str(name).strip()
    if not text:
        return "Metric"
    normalized = text.lower().replace(" ", "_")
    return METRIC_LABEL_OVERRIDES.get(normalized, text.replace("_", " "))


def _metric_description(name: str | None) -> str:
    if name is None:
        return ""
    return METRIC_DESCRIPTIONS.get(str(name).strip(), "")


def _format_threshold_label(
    min_value: float | None,
    max_value: float | None,
    range_text: str | None,
    range_text_with_color: str | None,
) -> str:
    if pd.isna(min_value) and pd.isna(max_value):
        for text in (range_text, range_text_with_color):
            if isinstance(text, str) and text.strip():
                return text.strip()
        return "Unknown"
    if pd.isna(min_value):
        return f"<= {max_value:.0f}" if float(max_value).is_integer() else f"<= {max_value:.2f}"
    if pd.isna(max_value):
        return f">= {min_value:.0f}" if float(min_value).is_integer() else f">= {min_value:.2f}"

    def _fmt(value: float) -> str:
        return f"{value:.0f}" if float(value).is_integer() else f"{value:.2f}"

    return f"{_fmt(min_value)}-{_fmt(max_value)}"


def _apply_threshold_filter(frame: pd.DataFrame, mode: str) -> pd.DataFrame:
    if mode == "All data" or frame.empty:
        return frame
    mask_defined = frame["threshold"].notna() & frame["metric_value"].notna()
    if mode == "Above threshold":
        mask_keep = (~mask_defined) | (frame["metric_value"] >= frame["threshold"])
    else:
        mask_keep = (~mask_defined) | (frame["metric_value"] < frame["threshold"])
    return frame[mask_keep]


def _classify_alert(row: pd.Series) -> tuple[str, str]:
    threshold = pd.to_numeric(row.get("threshold"), errors="coerce")
    observed = pd.to_numeric(row.get("metric_value"), errors="coerce")
    if pd.isna(threshold) or pd.isna(observed) or threshold == 0:
        return "acknowledged", "low"
    gap = threshold - observed
    ratio = gap / abs(threshold)
    if ratio >= 0.2:
        return "active", "high"
    if ratio >= 0.1:
        return "acknowledged", "medium"
    return "resolved", "low"


def _resolve_imputation_step(window_series: pd.Series | None) -> int:
    if window_series is None or window_series.dropna().empty:
        return 7
    label = str(window_series.dropna().iloc[0]).strip().lower()
    if "day" in label:
        return 1
    if "week" in label:
        return 7
    if "quarter" in label:
        return 90
    if "month" in label:
        return 30
    return 7


def _impute_refresh_dates_if_missing(frame: pd.DataFrame) -> pd.DataFrame:
    if "date_of_model_refresh" not in frame.columns:
        return frame
    missing_mask = frame["date_of_model_refresh"].isna()
    if not missing_mask.any():
        return frame

    group_cols = ["model_name"]
    if "client_name" in frame.columns:
        group_cols.append("client_name")

    for _, group in frame.groupby(group_cols, dropna=False):
        group_missing = group["date_of_model_refresh"].isna()
        if not group_missing.any():
            continue
        missing_idx = group.index[group_missing].tolist()
        existing_dates = group.loc[~group_missing, "date_of_model_refresh"].dropna()
        if not existing_dates.empty:
            anchor = existing_dates.max()
        else:
            fallback_dates = (
                group["model_last_update_date"].dropna()
                if "model_last_update_date" in group
                else pd.Series(dtype="datetime64[ns]")
            )
            anchor = fallback_dates.max() if not fallback_dates.empty else pd.Timestamp(datetime.now(timezone.utc))

        if pd.isna(anchor):
            anchor = pd.Timestamp(datetime.now(timezone.utc))

        anchor = pd.to_datetime(anchor, errors="coerce")
        if pd.isna(anchor):
            anchor = pd.Timestamp(datetime.now(timezone.utc))
        if getattr(anchor, "tzinfo", None) is not None:
            anchor = anchor.tz_convert(None)

        step_days = _resolve_imputation_step(group["rolling_window"] if "rolling_window" in group else None)
        step = pd.Timedelta(days=max(step_days, 1))

        current = anchor - step if not existing_dates.empty else anchor
        for idx in reversed(missing_idx):
            frame.at[idx, "date_of_model_refresh"] = current
            current -= step

    frame["date_of_model_refresh"] = pd.to_datetime(frame["date_of_model_refresh"], errors="coerce")
    if frame["date_of_model_refresh"].dt.tz is not None:
        frame["date_of_model_refresh"] = frame["date_of_model_refresh"].dt.tz_localize(None)
    frame["date_of_model_refresh"] = frame["date_of_model_refresh"].dt.normalize()
    return frame


def _expand_wide_metrics(frame: pd.DataFrame) -> pd.DataFrame:
    records: list[dict] = []
    for row in frame.to_dict("records"):
        raw_metrics = row.get("model_metrics")
        try:
            metrics = json.loads(raw_metrics) if isinstance(raw_metrics, str) else []
        except json.JSONDecodeError:
            metrics = []

        if isinstance(metrics, dict):
            metrics = [metrics]

        raw_threshold_range = row.get("threshold_range")
        threshold_min = row.get("threshold_min")
        threshold_max = row.get("threshold_max")

        if (pd.isna(threshold_min) or pd.isna(threshold_max)) and isinstance(raw_threshold_range, str):
            parsed = _maybe_parse_json(raw_threshold_range) or {}
            if isinstance(parsed, dict):
                if pd.isna(threshold_min):
                    threshold_min = parsed.get("min")
                if pd.isna(threshold_max):
                    threshold_max = parsed.get("max")

        if not metrics:
            metrics = [{"metric": row.get("metric_name") or "Metric", "value": row.get("metric_value")}]

        existing_metric_names: set[str] = set()

        for metric in metrics:
            metric_name = metric.get("metric") or metric.get("name")
            metric_value = metric.get("value")

            expanded = dict(row)
            expanded["metric_name"] = metric_name
            expanded["metric_value"] = metric_value
            expanded["threshold_min"] = threshold_min
            expanded["threshold_max"] = threshold_max
            records.append(expanded)
            if metric_name:
                existing_metric_names.add(str(metric_name))

        model_key = _normalize_model_key(row.get("model_name"))
        derived_map = {
            **DERIVED_METRICS_BY_MODEL.get("__default__", {}),
            **DERIVED_METRICS_BY_MODEL.get(model_key, {}),
        }

        for source_column, derived_name in derived_map.items():
            if not derived_name or derived_name in existing_metric_names:
                continue
            value = row.get(source_column)
            if value is None or (isinstance(value, str) and not value.strip()):
                continue
            numeric_value = pd.to_numeric([value], errors="coerce")[0]
            if pd.isna(numeric_value):
                continue

            expanded = dict(row)
            expanded["metric_name"] = derived_name
            expanded["metric_value"] = numeric_value
            expanded["threshold_min"] = threshold_min
            expanded["threshold_max"] = threshold_max
            records.append(expanded)

    expanded_frame = pd.DataFrame.from_records(records)
    if "model_metrics" in expanded_frame:
        expanded_frame = expanded_frame.drop(columns=["model_metrics"], errors="ignore")
    if "threshold_range" in expanded_frame:
        expanded_frame = expanded_frame.drop(columns=["threshold_range"], errors="ignore")
    return expanded_frame


def _resolve_actual_predicted_series(
    frame: pd.DataFrame,
    metric_name: str | None,
) -> tuple[pd.Series, pd.Series]:
    metric_key = (metric_name or "").strip().lower()
    mapping = DRIFT_METRIC_SOURCES.get(metric_key)

    def _coerce(column: str | None) -> pd.Series | None:
        if column and column in frame:
            return pd.to_numeric(frame[column], errors="coerce")
        return None

    actual_series = _coerce(mapping[0]) if mapping else None
    predicted_series = _coerce(mapping[1]) if mapping else None

    if actual_series is None or actual_series.notna().sum() == 0:
        actual_series = pd.to_numeric(frame.get("metric_value"), errors="coerce")

    if predicted_series is None or predicted_series.notna().sum() == 0:
        if "threshold" in frame:
            predicted_series = pd.to_numeric(frame.get("threshold"), errors="coerce")
        else:
            predicted_series = pd.to_numeric(frame.get("metric_value"), errors="coerce")

    return actual_series, predicted_series


def load_data(
    *,
    path: Path = DATA_PATH,
    refresh: bool = False,
    refresh_metadata: bool = True,
    query: Optional[str] = None,
) -> tuple[pd.DataFrame, LoadMeta]:
    if refresh:
        refreshed, refresh_error = refresh_live_data(path, query=query, refresh_metadata=refresh_metadata)
    else:
        refreshed, refresh_error = False, None

    if not path.exists():
        if refresh_error:
            raise RuntimeError(f"Unable to refresh live data: {refresh_error}")
        raise FileNotFoundError(f"Expected data file at {path}")

    source_mtime = None
    try:
        source_mtime = pd.to_datetime(path.stat().st_mtime, unit="s")
    except OSError:
        source_mtime = None

    cached = _DATA_CACHE.get("frame")
    if cached is not None and not refresh and _DATA_CACHE.get("mtime") == source_mtime:
        return cached.copy(), _DATA_CACHE.get("meta")

    frame = pd.read_csv(path)
    frame["date_of_model_refresh"] = pd.to_datetime(frame["date_of_model_refresh"], errors="coerce")
    if "model_last_update_date" in frame:
        frame["model_last_update_date"] = pd.to_datetime(frame["model_last_update_date"], errors="coerce")
        frame["model_last_update_date"] = frame["model_last_update_date"].dt.tz_localize(None)

    frame = _impute_refresh_dates_if_missing(frame)

    if "metric_name" not in frame.columns and "model_metrics" in frame.columns:
        frame = _expand_wide_metrics(frame)

    for column in ["threshold", "threshold_min", "threshold_max", "metric_value", "accuracy_pct"]:
        if column in frame:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    if "client_name" in frame:
        frame["client_name"] = frame["client_name"].astype(str).str.strip().str.upper()
        frame["client_name"] = frame.apply(
            lambda row: _canonicalize_client(row.get("model_name"), row.get("client_name")),
            axis=1,
        )

    if "model_name" in frame.columns:
        frame["model_key"] = frame["model_name"].map(_normalize_model_key)
    else:
        frame["model_key"] = ""

    frame["threshold_range_label"] = frame.apply(
        lambda row: _format_threshold_label(
            row.get("threshold_min"),
            row.get("threshold_max"),
            row.get("threshold_range"),
            row.get("threshold_range_with_colour_tag"),
        ),
        axis=1,
    )

    today = pd.Timestamp(datetime.now(timezone.utc).date())
    frame = frame[
        frame["date_of_model_refresh"].notna()
        & (frame["date_of_model_refresh"] <= today)
    ]

    if "model_last_update_date" in frame and "latency_seconds" not in frame:
        latency_seconds = (frame["model_last_update_date"] - frame["date_of_model_refresh"]).dt.total_seconds()
        frame["latency_seconds"] = latency_seconds.clip(lower=0)
        frame["latency_minutes"] = frame["latency_seconds"] / 60.0
        frame["latency_hours"] = frame["latency_minutes"] / 60.0

    frame = frame.dropna(subset=["date_of_model_refresh", "metric_name"])

    latest_point = frame["date_of_model_refresh"].max() if not frame.empty else pd.NaT
    meta = LoadMeta(
        data_source="bigquery" if refreshed else "local_csv",
        refresh_error=refresh_error,
        source_file_mtime=source_mtime if pd.notna(source_mtime) else None,
        latest_data_point=latest_point if pd.notna(latest_point) else None,
        refreshed_at=datetime.now(timezone.utc) if refreshed else None,
    )
    _DATA_CACHE.update({"frame": frame.copy(), "meta": meta, "mtime": source_mtime})
    return frame, meta


def build_filter_options(frame: pd.DataFrame, *, selected_model: Optional[str] = None) -> dict[str, Any]:
    models = sorted(frame["model_name"].dropna().unique()) if "model_name" in frame else []
    clients = sorted(frame["client_name"].dropna().unique()) if "client_name" in frame else []
    versions = []
    if "model_version" in frame.columns:
        versions = sorted(frame["model_version"].dropna().unique())

    date_min = frame["date_of_model_refresh"].min().date() if not frame.empty else None
    date_max = frame["date_of_model_refresh"].max().date() if not frame.empty else None

    metrics = []
    if selected_model:
        mask = frame["model_name"] == selected_model
        metrics = sorted(frame.loc[mask, "metric_name"].dropna().unique())

    return {
        "models": models,
        "clients": clients,
        "versions": versions,
        "metrics": metrics,
        "date_min": str(date_min) if date_min else None,
        "date_max": str(date_max) if date_max else None,
    }


def filter_frame(
    frame: pd.DataFrame,
    *,
    model: Optional[str] = None,
    client: Optional[str] = None,
    version: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    threshold_mode: str = "All data",
    selected_ranges: Optional[list[str]] = None,
    metrics: Optional[list[str]] = None,
) -> pd.DataFrame:
    filtered = frame
    if model and model != "All Models":
        filtered = filtered[filtered["model_name"] == model]
    if client and client != "All Clients":
        filtered = filtered[filtered["client_name"] == client]
    if version and version not in {"All Versions", "Latest"} and "model_version" in filtered.columns:
        filtered = filtered[filtered["model_version"] == version]
    if start_date and end_date:
        start_ts = pd.to_datetime(start_date)
        end_ts = pd.to_datetime(end_date)
        filtered = filtered[filtered["date_of_model_refresh"].between(start_ts, end_ts)]

    filtered = _apply_threshold_filter(filtered, threshold_mode)

    selected_ranges = selected_ranges or []
    explicit_ranges = [choice for choice in selected_ranges if choice not in {"All ranges", "Above threshold", "Below threshold"}]
    if explicit_ranges and "threshold_range_label" in filtered.columns:
        filtered = filtered[filtered["threshold_range_label"].isin(explicit_ranges)]

    if metrics:
        filtered = filtered[filtered["metric_name"].isin(metrics)]
    return filtered


def summarize_metrics(frame: pd.DataFrame, metrics: Iterable[str]) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame()

    metric_list = list(metrics) if metrics is not None else []
    ordered = frame.sort_values("date_of_model_refresh")
    non_null = ordered.dropna(subset=["metric_value"])
    latest = non_null.groupby("metric_name").tail(1)
    prior = non_null.groupby("metric_name")["metric_value"].apply(
        lambda series: series.iloc[-2] if len(series) > 1 else pd.NA
    )

    grouped = non_null.groupby("metric_name")["metric_value"]
    summary = grouped.agg(["mean", "min", "max", "last"]).rename(columns={"last": "latest"})
    summary["delta"] = summary.index.map(lambda name: summary.loc[name, "latest"] - prior.get(name, pd.NA))

    if len(metric_list) > 0:
        summary = summary.reindex(metric_list)
    summary["metric_name"] = summary.index
    summary = summary.reset_index(drop=True)
    return summary


def resolve_available_metrics(frame: pd.DataFrame, model_name: str, client_name: Optional[str]) -> list[str]:
    if "model_key" in frame.columns:
        metrics_mask = frame["model_key"] == _normalize_model_key(model_name)
    else:
        metrics_mask = frame["model_name"].apply(_normalize_model_key) == _normalize_model_key(model_name)

    if client_name and client_name != "All Clients":
        metrics_mask &= frame["client_name"] == client_name

    dataset_metrics = sorted(frame.loc[metrics_mask, "metric_name"].dropna().unique())
    preferred_metrics = MODEL_METRIC_PRIORITIES.get(_normalize_model_key(model_name), [])
    available_metrics = [m for m in preferred_metrics if m in dataset_metrics]
    available_metrics += [m for m in dataset_metrics if m not in available_metrics]
    return available_metrics


def compute_alerts(
    frame: pd.DataFrame,
    *,
    model_name: Optional[str],
) -> dict[str, Any]:
    alerts = frame[
        (frame["threshold"].notna())
        & (frame["metric_value"].notna())
        & (frame["metric_value"] < frame["threshold"])
    ]

    allowed_metrics = ALERT_METRICS_BY_MODEL.get(model_name or "", ALERT_METRICS_BY_MODEL["__default__"])
    alerts = alerts[alerts["metric_name"].isin(allowed_metrics)]
    recent_alerts = alerts.sort_values("date_of_model_refresh", ascending=False).head(50)

    status_tally: dict[str, int] = {"active": 0, "acknowledged": 0, "resolved": 0}
    severity_tally: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
    rows: list[dict[str, Any]] = []
    deepest_breach: Optional[dict[str, Any]] = None

    for _, row in recent_alerts.iterrows():
        status_slug, severity_level = _classify_alert(row)
        status_tally[status_slug] = status_tally.get(status_slug, 0) + 1
        severity_tally[severity_level] = severity_tally.get(severity_level, 0) + 1

        observed = pd.to_numeric(row.get("metric_value"), errors="coerce")
        threshold_val = pd.to_numeric(row.get("threshold"), errors="coerce")
        if pd.notna(observed) and pd.notna(threshold_val):
            breach = float(threshold_val) - float(observed)
            if breach > 0 and (deepest_breach is None or breach > float(deepest_breach["breach"])):
                deepest_breach = {
                    "breach": breach,
                    "metric": _format_metric_label(row.get("metric_name")),
                    "model": row.get("model_name") or model_name,
                    "client": row.get("client_name") or "All clients",
                }

        rows.append(
            {
                "status": status_slug,
                "severity": severity_level,
                "signal": _format_metric_label(row.get("metric_name")),
                "signal_description": _metric_description(row.get("metric_name")),
                "model": row.get("model_name"),
                "client": row.get("client_name"),
                "observed": None if pd.isna(observed) else float(observed),
                "threshold": None if pd.isna(threshold_val) else float(threshold_val),
                "timestamp": (
                    pd.to_datetime(row.get("date_of_model_refresh"), errors="coerce").isoformat()
                    if pd.notna(row.get("date_of_model_refresh"))
                    else None
                ),
            }
        )

    return {
        "rows": rows,
        "status_tally": status_tally,
        "severity_tally": severity_tally,
        "deepest_breach": deepest_breach,
    }


def forecast_drift(drift_data: pd.DataFrame, forecast_days: int = 7) -> pd.DataFrame:
    try:
        from sklearn.linear_model import LinearRegression
        import numpy as np
    except Exception:
        return pd.DataFrame()

    if len(drift_data) < 5:
        return pd.DataFrame()

    drift_data = drift_data.sort_values("date_of_model_refresh").copy()
    drift_data = drift_data.dropna(subset=["drift", "date_of_model_refresh"])
    if len(drift_data) < 5:
        return pd.DataFrame()

    X = np.arange(len(drift_data)).reshape(-1, 1)
    y = drift_data["drift"].values
    model = LinearRegression()
    model.fit(X, y)

    future_X = np.arange(len(drift_data), len(drift_data) + forecast_days).reshape(-1, 1)
    future_y = model.predict(future_X)

    last_date = drift_data["date_of_model_refresh"].max()
    future_dates = pd.date_range(last_date + pd.Timedelta(days=1), periods=forecast_days)
    residuals = y - model.predict(X)
    std_error = float(pd.Series(residuals).std()) if len(residuals) > 1 else 0.0

    return pd.DataFrame(
        {
            "date_of_model_refresh": future_dates,
            "drift_forecast": future_y,
            "forecast_lower": future_y - 1.96 * std_error,
            "forecast_upper": future_y + 1.96 * std_error,
        }
    )


def _build_bq_client_for_table(table: str):
    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
    except ModuleNotFoundError:
        return None

    credentials_info, credentials_path = _resolve_credentials_info()
    requires_prod = "iksgcp" in table.lower()

    try:
        if credentials_info:
            creds = service_account.Credentials.from_service_account_info(credentials_info)
        else:
            if credentials_path is None or not credentials_path.exists():
                default_name = "mlflow-sa-prod.json" if requires_prod else "mlflow-sa.json"
                default_path = Path(__file__).resolve().parents[1] / default_name
                credentials_path = default_path if default_path.exists() else None
            if not credentials_path or not credentials_path.exists():
                return None
            creds = service_account.Credentials.from_service_account_file(credentials_path)
        return bigquery.Client(credentials=creds, project=creds.project_id)
    except Exception:
        return None


def _run_accuracy_avg_query(client, query: str, start_date, end_date, window_days: int):
    try:
        from google.cloud import bigquery
    except ModuleNotFoundError:
        return None

    try:
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("start_date", "DATE", pd.to_datetime(start_date).date()),
                bigquery.ScalarQueryParameter("end_date", "DATE", pd.to_datetime(end_date).date()),
                bigquery.ScalarQueryParameter("window_days", "INT64", max(int(window_days), 1)),
            ]
        )
        result = client.query(query, job_config=job_config).result()
        row = next(iter(result), None)
        if row is None:
            return None
        value = row.get("avg_accuracy")
        return float(value) if value is not None else None
    except Exception:
        return None


def _fetch_ittt_accuracy_from_bq(
    *,
    client_name: str,
    start_date: object,
    end_date: object,
    window_days: int,
) -> Optional[float]:
    table = ITTT_ACCURACY_TABLES.get(str(client_name).strip().upper())
    if not table:
        return None
    client = _build_bq_client_for_table(table)
    if client is None:
        return None

    query = f"""
        SELECT
          SUM(ittt_within_threshold_count) / SUM(ittt_total_count) * 100 AS avg_accuracy
        FROM `{table}`
        WHERE SAFE_CAST(date_of_model_refresh AS DATE) BETWEEN @start_date AND @end_date
    """
    return _run_accuracy_avg_query(client, query, start_date, end_date, window_days)


def _fetch_denial_accuracy_from_bq(
    *,
    client_name: str,
    start_date: object,
    end_date: object,
    window_days: int,
) -> Optional[float]:
    table = DENIAL_ACCURACY_TABLES.get(str(client_name).strip().upper())
    if not table:
        return None
    client = _build_bq_client_for_table(table)
    if client is None:
        return None

    query = f"""
        SELECT
          AVG(Payment_Accuracy_per) AS avg_accuracy
        FROM `{table}`
        WHERE SAFE_CAST(Predicted_Accuracy_Date AS DATE) BETWEEN @start_date AND @end_date
    """
    return _run_accuracy_avg_query(client, query, start_date, end_date, window_days)


def _fetch_appeal_accuracy_from_bq(
    *,
    client_name: str,
    canonical_client: str,
    start_date: object,
    end_date: object,
    window_days: int,
) -> Optional[dict[str, float]]:
    table = APPEAL_ACCURACY_TABLES.get(str(canonical_client).strip().upper())
    if not table:
        return None
    client = _build_bq_client_for_table(table)
    if client is None:
        return None

    query = f"""
        SELECT
          AVG(Accuracy) AS avg_accuracy,
          AVG(Recall_1) AS avg_recall
        FROM `{table}`
        WHERE SAFE_CAST(Accuracy_Date AS DATE) BETWEEN @start_date AND @end_date
    """

    try:
        from google.cloud import bigquery
    except ModuleNotFoundError:
        return None

    try:
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("start_date", "DATE", pd.to_datetime(start_date).date()),
                bigquery.ScalarQueryParameter("end_date", "DATE", pd.to_datetime(end_date).date()),
            ]
        )
        result = client.query(query, job_config=job_config).result()
        row = next(iter(result), None)
        if row is None:
            return None
        return {
            "accuracy": float(row.get("avg_accuracy")) if row.get("avg_accuracy") is not None else None,
            "recall": float(row.get("avg_recall")) if row.get("avg_recall") is not None else None,
        }
    except Exception:
        return None


def _format_metric_snapshot_row(name: str, stats: pd.Series | dict) -> str:
    latest = stats.get("latest") if isinstance(stats, (pd.Series, dict)) else None
    avg = stats.get("mean") if isinstance(stats, (pd.Series, dict)) else None
    delta = stats.get("delta") if isinstance(stats, (pd.Series, dict)) else None
    latest_txt = "n/a" if pd.isna(latest) else f"{float(latest):.2f}"
    avg_txt = "n/a" if pd.isna(avg) else f"{float(avg):.2f}"
    delta_txt = "n/a"
    if not pd.isna(delta):
        sign = "+" if float(delta) >= 0 else ""
        delta_txt = f"{sign}{float(delta):.2f}"
    return f"- {_format_metric_label(name)}: latest {latest_txt}, avg {avg_txt}, delta {delta_txt}"


def _compose_alert_summary_lines(
    *,
    model_name: str,
    client_scope: str,
    period_label: str,
    summary_rows: list[str],
) -> list[str]:
    lines = [
        f"Model: {model_name}",
        f"Client scope: {client_scope}",
        f"Window: {period_label}",
        "",
        "Performance snapshot:",
    ]
    lines.extend(summary_rows or ["- No metric summary available"])
    return lines


def send_alert_summary_email(
    *,
    model_name: str,
    client_scope: str,
    period_label: str,
    summary_rows: list[str],
    status_tally: dict[str, int] | None = None,
    severity_tally: dict[str, int] | None = None,
) -> tuple[bool, str]:
    smtp_settings = _resolve_smtp_settings()
    body_lines = _compose_alert_summary_lines(
        model_name=model_name,
        client_scope=client_scope,
        period_label=period_label,
        summary_rows=summary_rows,
    )

    if status_tally:
        body_lines.append("")
        body_lines.append(
            f"Active: {status_tally.get('active', 0)} | ACK: {status_tally.get('acknowledged', 0)} | Resolved: {status_tally.get('resolved', 0)}"
        )

    if severity_tally:
        body_lines.append(
            f"Severity mix - High: {severity_tally.get('high', 0)}, Medium: {severity_tally.get('medium', 0)}, Low: {severity_tally.get('low', 0)}"
        )

    subject = f"[Model Observatory] {model_name} summary - {period_label}"
    return _send_email_via_smtp(subject, body_lines, smtp_settings, success_message="Summary email sent.")


def _parse_json_metrics_from_row(row: pd.Series, json_cols: List[str]) -> Dict[str, Union[float, str]]:
    extracted: Dict[str, Union[float, str]] = {}
    for col in json_cols:
        json_str = row.get(col)
        if pd.isna(json_str) or not json_str:
            continue

        try:
            metric_list = json.loads(json_str)
            if not isinstance(metric_list, list):
                continue
            for item in metric_list:
                metric_name = item.get("metric")
                metric_value = item.get("value")
                if metric_name and metric_value is not None:
                    clean_name = metric_name.replace("_", " ").title()
                    try:
                        extracted[clean_name] = float(metric_value)
                    except (ValueError, TypeError):
                        extracted[clean_name] = str(metric_value)
        except json.JSONDecodeError:
            if isinstance(json_str, str) and col == "business_metrics":
                extracted["Business Metrics"] = json_str
            continue
    return extracted


def _extract_metrics_for_report(client_data: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    if client_data.empty:
        return {}

    sorted_data = client_data.sort_values("date_of_model_refresh", ascending=False)
    latest_row = sorted_data.iloc[0]

    all_metric_values: Dict[str, List[Union[float, str]]] = {}
    derived_accuracy_pct: Optional[pd.Series] = None
    if {"ittt_within_threshold_count", "ittt_total_count"}.issubset(sorted_data.columns):
        within = pd.to_numeric(sorted_data["ittt_within_threshold_count"], errors="coerce")
        total = pd.to_numeric(sorted_data["ittt_total_count"], errors="coerce")
        derived_accuracy_pct = (within / total.where(total != 0)) * 100

    simple_value_keys = [
        "accuracy_pct",
        "accuracy",
        "recall",
        "overall_accuracy",
        "overall_accuracy_per",
    ]
    for key in simple_value_keys:
        if key in sorted_data.columns:
            series = pd.to_numeric(sorted_data[key], errors="coerce")
            if key in {"accuracy_pct", "accuracy"} and derived_accuracy_pct is not None:
                series = series.where(~series.isna() & (series != 0), derived_accuracy_pct)
            clean_name = key.replace("_", " ").title()
            all_metric_values[clean_name] = [v for v in series.tolist() if pd.notna(v)]

    json_cols = ["business_metrics", "kpis", "model_metrics"]
    for _, row in sorted_data.iterrows():
        extracted_row_metrics = _parse_json_metrics_from_row(row, json_cols)
        for name, value in extracted_row_metrics.items():
            all_metric_values.setdefault(name, [])
            if pd.notna(value) and value is not None:
                all_metric_values[name].append(value)

        metric_name = row.get("metric_name")
        metric_value = row.get("metric_value")
        if pd.notna(metric_name) and metric_value is not None:
            hist_key = str(metric_name)
            try:
                metric_value = float(metric_value)
            except (TypeError, ValueError):
                pass
            all_metric_values.setdefault(hist_key, [])
            if pd.notna(metric_value):
                all_metric_values[hist_key].append(metric_value)

    latest_simple_metrics = {
        k.replace("_", " ").title(): latest_row.get(k) for k in simple_value_keys if k in latest_row
    }
    latest_json_metrics = _parse_json_metrics_from_row(latest_row, json_cols)
    latest_metric_value = {}
    if "metric_name" in latest_row and "metric_value" in latest_row:
        mname = latest_row.get("metric_name")
        mval = latest_row.get("metric_value")
        if pd.notna(mname) and mval is not None:
            latest_metric_value[str(mname)] = mval

    latest_values = {**latest_simple_metrics, **latest_json_metrics, **latest_metric_value}

    final_metrics: Dict[str, Dict[str, Any]] = {}
    for metric_name, history_list in all_metric_values.items():
        if not history_list:
            continue

        latest_value = latest_values.get(metric_name)
        numeric_history = [v for v in history_list if isinstance(v, (int, float))]
        unit = "%" if any(s in metric_name.lower() for s in ["pct", "accuracy", "per", "recall"]) else ""

        if numeric_history:
            latest_float = next(
                (v for v in history_list if isinstance(v, (int, float)) and pd.notna(v)),
                numeric_history[0],
            )
            average = sum(numeric_history) / len(numeric_history)
            delta = latest_float - average
            final_metrics[metric_name] = {"value": latest_float, "avg": average, "delta": delta, "unit": unit}
        elif latest_value is not None:
            final_metrics[metric_name] = {"value": latest_value, "avg": "N/A", "delta": "N/A", "unit": unit}

    return final_metrics


def _parse_rolling_window_days(label: str) -> int:
    label = label.lower().strip()
    if "daily" in label:
        return 1
    if "weekly" in label:
        return 7
    if "monthly" in label:
        return 30
    if "quarterly" in label:
        return 90
    if "yearly" in label:
        return 365

    match = re.search(r"(\\d+)", label)
    if match:
        val = int(match.group(1))
        if "year" in label:
            return val * 365
        if "month" in label:
            return val * 30
        if "week" in label:
            return val * 7
        return val
    return 30


def send_consolidated_summary_email(
    *,
    data: pd.DataFrame,
    model_names: Iterable[str],
    start_date: object,
    end_date: object,
    period_label: str,
) -> tuple[bool, str]:
    if data.empty:
        return False, "No data available to build consolidated email."

    latest_date = pd.to_datetime(data["date_of_model_refresh"], errors="coerce").max()
    if pd.isna(latest_date):
        return False, "No data available to build consolidated email."
    today = datetime.now(timezone.utc).date()
    anchor_date = min(latest_date.date(), today)

    actual_end_date = anchor_date - timedelta(days=15)
    actual_start_date = actual_end_date - timedelta(days=29)
    period_label = f"{actual_start_date} to {actual_end_date}"

    start_ts = pd.Timestamp(actual_start_date)
    end_ts = pd.Timestamp(actual_end_date)
    window_data = data[data["date_of_model_refresh"].between(start_ts, end_ts)].copy()
    if window_data.empty:
        return False, "No data found in the selected window."

    html_body_parts: list[str] = []
    html_body_parts.append(
        """
        <h2 style="color: #0033a0; font-family: Arial, sans-serif; text-align: center;">Consolidated ML Observatory Summary</h2>
        <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px; margin-top: 20px; box-shadow: 0 2px 15px rgba(0,0,0,0.1);">
            <thead>
                <tr style="background-color: #0033a0; color: white; text-align: left;">
                    <th style="padding: 12px; border: 1px solid #ddd;">Model</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Client</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Data Window</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Metric</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Latest</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Avg (Window)</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Delta</th>
                </tr>
            </thead>
            <tbody>
        """
    )

    available_models = {_normalize_model_key(name): name for name in pd.Series(model_names).dropna().unique()}
    target_order = ["appeal", "denial", "ittt"]
    sorted_model_keys: list[str] = []
    seen: set[str] = set()
    for key in target_order:
        if key in available_models:
            sorted_model_keys.append(available_models[key])
            seen.add(available_models[key])
    for name in sorted(available_models.values()):
        if name not in seen:
            sorted_model_keys.append(name)

    row_count = 0
    for model in sorted_model_keys:
        model_data_full = data[data["model_name"] == model]
        if model_data_full.empty:
            continue
        clients = sorted(model_data_full["client_name"].dropna().unique())

        for client in clients:
            model_key = _normalize_model_key(model)
            window_end_date = actual_end_date
            window_start_date = actual_end_date - timedelta(days=29)
            window_days = 30
            avg_window_end = window_end_date
            avg_window_start = avg_window_end - timedelta(days=89)
            data_window_str = f"{window_start_date} to {window_end_date}"

            client_full_df = data[
                (data["model_name"] == model) & (data["client_name"] == client)
            ]
            if client_full_df.empty:
                continue

            window_client_data = client_full_df[
                (client_full_df["date_of_model_refresh"].dt.date >= window_start_date)
                & (client_full_df["date_of_model_refresh"].dt.date <= window_end_date)
            ].copy()

            avg_window_client_data = client_full_df[
                (client_full_df["date_of_model_refresh"].dt.date >= avg_window_start)
                & (client_full_df["date_of_model_refresh"].dt.date <= avg_window_end)
            ].copy()

            if window_client_data.empty and avg_window_client_data.empty:
                continue

            bq_latest_metrics: dict[str, float | None] = {}
            bq_avg_metrics: dict[str, float | None] = {}
            if model_key == "ittt":
                latest_val = _fetch_ittt_accuracy_from_bq(
                    client_name=client,
                    start_date=window_start_date,
                    end_date=window_end_date,
                    window_days=window_days,
                )
                avg_val = _fetch_ittt_accuracy_from_bq(
                    client_name=client,
                    start_date=avg_window_start,
                    end_date=avg_window_end,
                    window_days=90,
                )
                if latest_val is not None:
                    bq_latest_metrics["accuracy"] = latest_val
                if avg_val is not None:
                    bq_avg_metrics["accuracy"] = avg_val
            elif model_key == "denial":
                latest_val = _fetch_denial_accuracy_from_bq(
                    client_name=client,
                    start_date=window_start_date,
                    end_date=window_end_date,
                    window_days=window_days,
                )
                avg_val = _fetch_denial_accuracy_from_bq(
                    client_name=client,
                    start_date=avg_window_start,
                    end_date=avg_window_end,
                    window_days=90,
                )
                if latest_val is not None:
                    bq_latest_metrics["accuracy"] = latest_val
                if avg_val is not None:
                    bq_avg_metrics["accuracy"] = avg_val
            elif model_key == "appeal":
                latest_vals = _fetch_appeal_accuracy_from_bq(
                    client_name=client,
                    canonical_client=client,
                    start_date=window_start_date,
                    end_date=window_end_date,
                    window_days=window_days,
                )
                avg_vals = _fetch_appeal_accuracy_from_bq(
                    client_name=client,
                    canonical_client=client,
                    start_date=avg_window_start,
                    end_date=avg_window_end,
                    window_days=90,
                )
                if latest_vals:
                    bq_latest_metrics.update({k: v for k, v in latest_vals.items() if v is not None})
                if avg_vals:
                    bq_avg_metrics.update({k: v for k, v in avg_vals.items() if v is not None})

            metrics_map = _extract_metrics_for_report(avg_window_client_data)
            if not metrics_map and not window_client_data.empty:
                metrics_map = _extract_metrics_for_report(window_client_data)
                for m in metrics_map.values():
                    m["avg"] = None

            def apply_override(target_metric: str, latest_override: float | None, avg_override: float | None) -> None:
                if target_metric not in metrics_map:
                    metrics_map[target_metric] = {"value": None, "avg": None, "delta": None, "unit": "%"}
                if latest_override is not None:
                    metrics_map[target_metric]["value"] = latest_override
                    metrics_map[target_metric]["_bq_override"] = True
                    metrics_map[target_metric]["source"] = "bq"
                if avg_override is not None:
                    metrics_map[target_metric]["avg"] = avg_override
                    metrics_map[target_metric]["_bq_override"] = True
                    metrics_map[target_metric]["source"] = "bq"
                if isinstance(metrics_map[target_metric].get("value"), (int, float)) and isinstance(
                    metrics_map[target_metric].get("avg"), (int, float)
                ):
                    metrics_map[target_metric]["delta"] = metrics_map[target_metric]["value"] - metrics_map[target_metric]["avg"]

            if model_key == "ittt":
                apply_override("accuracy", bq_latest_metrics.get("accuracy"), bq_avg_metrics.get("accuracy"))
            elif model_key == "appeal":
                apply_override("accuracy", bq_latest_metrics.get("accuracy"), bq_avg_metrics.get("accuracy"))
                apply_override("recall", bq_latest_metrics.get("recall"), bq_avg_metrics.get("recall"))
            else:
                apply_override("accuracy", bq_latest_metrics.get("accuracy"), bq_avg_metrics.get("accuracy"))

            for m in metrics_map.values():
                if not m.get("_bq_override"):
                    m["value"] = None
                    m["delta"] = None

            for metric_name, metric_dict in metrics_map.items():
                metric_col = metric_name.lower().replace(" ", "_")
                metric_dict.setdefault("source", "csv")
                if metric_dict.get("_bq_override"):
                    if isinstance(metric_dict.get("value"), (int, float)) and isinstance(metric_dict.get("avg"), (int, float)):
                        metric_dict["delta"] = metric_dict["value"] - metric_dict["avg"]
                    continue
                if metric_col in window_client_data.columns:
                    current_period_vals = window_client_data[metric_col].dropna()
                    if not current_period_vals.empty:
                        daily_means = current_period_vals.groupby(window_client_data["date_of_model_refresh"].dt.date).mean()
                        period_avg = daily_means.sum() / max(1, window_days)
                        metric_dict["value"] = period_avg
                        if isinstance(metric_dict.get("avg"), (int, float)):
                            metric_dict["delta"] = period_avg - metric_dict["avg"]

                override_latest = None
                if metric_col in {"accuracy_pct", "accuracy"}:
                    override_latest = bq_latest_metrics.get("accuracy")
                elif metric_col == "recall":
                    override_latest = bq_latest_metrics.get("recall")
                if override_latest is not None:
                    metric_dict["value"] = override_latest
                    metric_dict["_bq_override"] = True
                    metric_dict["source"] = "bq"

                override_avg = None
                if metric_col in {"accuracy_pct", "accuracy"}:
                    override_avg = bq_avg_metrics.get("accuracy")
                elif metric_col == "recall":
                    override_avg = bq_avg_metrics.get("recall")
                if override_avg is not None:
                    metric_dict["avg"] = override_avg
                    metric_dict["source"] = "bq"

                if isinstance(metric_dict.get("value"), (int, float)) and isinstance(metric_dict.get("avg"), (int, float)):
                    metric_dict["delta"] = metric_dict["value"] - metric_dict["avg"]

            if model_key == "ittt" and "accuracy" in bq_latest_metrics and not any(
                m.get("_bq_override") for m in metrics_map.values()
            ):
                metrics_map["accuracy"] = {
                    "value": bq_latest_metrics.get("accuracy"),
                    "avg": bq_avg_metrics.get("accuracy"),
                    "delta": None
                    if not (
                        isinstance(bq_latest_metrics.get("accuracy"), (int, float))
                        and isinstance(bq_avg_metrics.get("accuracy"), (int, float))
                    )
                    else bq_latest_metrics.get("accuracy") - bq_avg_metrics.get("accuracy"),
                    "_bq_override": True,
                    "source": "bq",
                    "unit": "%",
                }

            latest_only_metrics = _extract_metrics_for_report(window_client_data)
            for k, v in latest_only_metrics.items():
                if k not in metrics_map:
                    metrics_map[k] = v
                    metrics_map[k]["avg"] = None

            def _is_allowed_metric(name: str) -> bool:
                norm = str(name).lower().replace(" ", "").replace("_", "")
                return norm in {"accuracy", "accuracypct", "recall"}

            filtered_metrics = {k: v for k, v in metrics_map.items() if _is_allowed_metric(k)}
            if not filtered_metrics:
                filtered_metrics = {"Accuracy": {"value": None, "avg": None, "delta": None, "unit": "%"}}

            standardized_metrics: dict[str, dict[str, Any]] = {}
            for k, v in filtered_metrics.items():
                norm_key = k.lower().replace(" ", "").replace("_", "")
                if norm_key in {"accuracy", "accuracypct"}:
                    existing = standardized_metrics.get("Accuracy")
                    choose_new = False
                    if existing is None:
                        choose_new = True
                    else:
                        existing_override = existing.get("_bq_override")
                        new_override = v.get("_bq_override")
                        existing_val = existing.get("value")
                        new_val = v.get("value")
                        if new_override and not existing_override:
                            choose_new = True
                        elif existing_val is None and new_val is not None:
                            choose_new = True
                    if choose_new:
                        standardized_metrics["Accuracy"] = v
                elif norm_key == "recall":
                    existing = standardized_metrics.get("Recall")
                    choose_new = False
                    if existing is None:
                        choose_new = True
                    else:
                        existing_override = existing.get("_bq_override")
                        new_override = v.get("_bq_override")
                        existing_val = existing.get("value")
                        new_val = v.get("value")
                        if new_override and not existing_override:
                            choose_new = True
                        elif existing_val is None and new_val is not None:
                            choose_new = True
                    if choose_new:
                        standardized_metrics["Recall"] = v
                else:
                    standardized_metrics[k] = v

            filtered_metrics = standardized_metrics
            metric_priority = ["Accuracy", "Recall"]
            ordered_metric_names: List[str] = []
            for m in metric_priority:
                if m in filtered_metrics:
                    ordered_metric_names.append(m)
            for name in filtered_metrics.keys():
                if name not in ordered_metric_names:
                    ordered_metric_names.append(name)

            for i, metric_name in enumerate(ordered_metric_names):
                m_data = filtered_metrics[metric_name]
                latest_val = m_data.get("value")
                avg_val = m_data.get("avg")
                delta_val = m_data.get("delta")
                unit = m_data.get("unit", "")

                def fmt(v):
                    if v is None or (isinstance(v, float) and pd.isna(v)) or v == "N/A":
                        return "N/A"
                    if isinstance(v, (int, float)):
                        return f"{v:.2f}{unit}"
                    return str(v)

                latest_str = fmt(latest_val)
                avg_str = fmt(avg_val)

                delta_str = "N/A"
                delta_color = "#333"
                if delta_val is not None and isinstance(delta_val, (int, float)):
                    delta_str = f"{delta_val:.2f}"
                    if delta_val > 0:
                        delta_color = "green"
                    elif delta_val < 0:
                        delta_color = "red"
                elif delta_val == "N/A":
                    delta_str = "N/A"

                bg_color = "#f9f9f9" if row_count % 2 == 0 else "#ffffff"

                row_html = f'<tr style="background-color: {bg_color};">'
                if i == 0:
                    row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{model}</td>'
                    row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{client}</td>'
                    row_html += f'<td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">{data_window_str}</td>'
                else:
                    row_html += '<td style="padding: 8px; border: 1px solid #ddd;"></td>'
                    row_html += '<td style="padding: 8px; border: 1px solid #ddd;"></td>'
                    row_html += '<td style="padding: 8px; border: 1px solid #ddd;"></td>'

                source_badge = ""
                if m_data.get("source") == "bq":
                    source_badge = ' <span style="color:#0b8; font-size:11px;">(BQ)</span>'

                row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{metric_name}{source_badge}</td>'
                row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{latest_str}</td>'
                row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{avg_str}</td>'
                row_html += f'<td style="padding: 8px; border: 1px solid #ddd; color: {delta_color}; font-weight: bold;">{delta_str}</td>'
                row_html += "</tr>"

                html_body_parts.append(row_html)
                row_count += 1

    html_body_parts.append(
        """
            </tbody>
        </table>
        <div style="background-color: #eef; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <h3 style="margin-top: 0; color: #333;">Understanding the Metrics</h3>
            <p style="margin: 10px 0;">
                <strong>Latest:</strong> The average value calculated over the 30-day Data Window period.
            </p>
            <p style="margin: 10px 0;">
                <strong>Average (Window):</strong> Calculated over the last 90 days as the historical baseline.
            </p>
            <p style="margin: 10px 0;">
                <strong>Delta:</strong> The difference between Latest (30-day avg) and Average (Window).
            </p>
            <p style="margin: 10px 0;">
                <strong>N/A:</strong> Data Not Available.
            </p>
        </div>
        <p style="text-align: center; margin-top: 30px; font-size: 0.9em; color: #999;">
            Generated by ML Observatory System
        </p>
        """
    )

    if row_count == 0:
        return False, "No metrics found in the selected window."

    smtp_settings = _resolve_smtp_settings()
    subject = f"[Model Observatory] Consolidated summary {period_label}"
    final_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 1000px; margin: auto; background: white; padding: 30px; border-radius: 8px;">
            {''.join(html_body_parts)}
        </div>
    </body>
    </html>
    """

    return _send_email_via_smtp(
        subject=subject,
        body_lines=[final_html],
        smtp_settings=smtp_settings,
        success_message=f"Consolidated summary email sent to {', '.join(smtp_settings.get('recipients', []))}.",
        is_html=True,
    )


def send_client_summary_emails(
    *,
    data: pd.DataFrame,
    model_names: Iterable[str],
    start_date: object,
    end_date: object,
    period_label: str,
) -> tuple[bool, str]:
    if data.empty:
        return False, "No data available to build summary emails."

    smtp_settings = _resolve_smtp_settings()
    sent_count = 0
    errors: list[str] = []

    start_ts = pd.to_datetime(start_date)
    end_ts = pd.to_datetime(end_date)
    window_data = data[data["date_of_model_refresh"].between(start_ts, end_ts)].copy()
    if window_data.empty:
        return False, "No data found in the selected window."

    for model in model_names:
        model_data = window_data[window_data["model_name"] == model]
        if model_data.empty:
            continue
        clients = model_data["client_name"].dropna().unique()
        for client in clients:
            client_data = model_data[model_data["client_name"] == client]
            if client_data.empty:
                continue

            rolling_window = "Unknown"
            if "rolling_window" in client_data.columns:
                windows = client_data["rolling_window"].dropna().unique()
                if len(windows) > 0:
                    rolling_window = windows[0]

            metric_names = client_data["metric_name"].dropna().unique()
            summary = summarize_metrics(client_data, metric_names)

            summary_rows: list[str] = []
            model_key = _normalize_model_key(model)
            prioritized_metrics = MODEL_METRIC_PRIORITIES.get(model_key, [])
            ordered_metrics: list[str] = []
            for metric in prioritized_metrics:
                if metric in summary["metric_name"].values and metric not in ordered_metrics:
                    ordered_metrics.append(metric)
            for metric in summary["metric_name"].values:
                if metric not in ordered_metrics:
                    ordered_metrics.append(metric)

            for metric in ordered_metrics[:5]:
                stats_row = summary[summary["metric_name"] == metric]
                if not stats_row.empty:
                    summary_rows.append(_format_metric_snapshot_row(metric, stats_row.iloc[0]))

            body_lines = [
                f"Model: {model}",
                f"Client: {client}",
                f"Window: {period_label}",
                f"Data Availability: {rolling_window}",
                "",
                "Performance snapshot:",
            ]
            body_lines.extend(summary_rows or ["- No metric summary available"])

            subject = f"[Model Observatory] {model} - {client} Summary - {period_label}"
            success, msg = _send_email_via_smtp(subject, body_lines, smtp_settings, success_message="Sent")
            if success:
                sent_count += 1
            else:
                errors.append(f"{client}: {msg}")

    if sent_count == 0 and errors:
        return False, f"Failed to send any emails. Errors: {'; '.join(errors[:3])}..."

    return True, f"Sent {sent_count} emails. {len(errors)} errors."
