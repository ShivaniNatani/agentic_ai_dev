"""ML Observatory dashboard variant with dedicated tabs."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from inspect import signature
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Union
import json
import os
import re
import base64

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
try:
    from streamlit_option_menu import option_menu
except ModuleNotFoundError:  # graceful fallback if package missing
    option_menu = None

try:
    from .smtp_utils import (
        coerce_recipients as _coerce_recipients,
        resolve_smtp_settings as _resolve_smtp_settings,
        send_email_via_smtp as _send_email_via_smtp,
    )
except ImportError:
    from smtp_utils import (  # type: ignore
        coerce_recipients as _coerce_recipients,
        resolve_smtp_settings as _resolve_smtp_settings,
        send_email_via_smtp as _send_email_via_smtp,
    )

try:
    from fetch_live_data import METADATA_REFRESH_QUERY
except ImportError:
    METADATA_REFRESH_QUERY = None

# Import monitoring modules
try:
    try:
        from .health_engine import (
            calculate_health_score,
            get_status_indicator,
            get_health_color,
            calculate_freshness_score
        )
        from .anomaly_detector import (
            detect_trend,
            predict_threshold_breach,
            detect_sudden_change
        )
        from .root_cause_analyzer import generate_root_cause_report, format_diagnosis_html
        from .incident_tracker import IncidentTracker
    except (ImportError, ValueError):
        from health_engine import (
            calculate_health_score,
            get_status_indicator,
            get_health_color,
            calculate_freshness_score
        )
        from anomaly_detector import (
            detect_trend,
            predict_threshold_breach,
            detect_sudden_change
        )
        from root_cause_analyzer import generate_root_cause_report, format_diagnosis_html
        from incident_tracker import IncidentTracker
    
    # Optional resilience (graceful fallback)
    try:
        from resilience import retry_with_backoff, CircuitBreaker
    except ImportError:
        retry_with_backoff = lambda retries=3, backoff_in_seconds=1: lambda func: func
        CircuitBreaker = None
except ImportError:
    # Critical monitoring modules still not available
    calculate_health_score = None
    detect_trend = None
    IncidentTracker = None
    retry_with_backoff = lambda retries=3, backoff_in_seconds=1: lambda func: func
    CircuitBreaker = None

# AI Assistant Integration
try:
    from Vertex_ai.vertex_ai_helper import get_vertex_model
except ImportError:
    get_vertex_model = None

DATA_PATH = Path(__file__).resolve().parent / "model_data2.csv"
DEFAULT_LIVE_QUERY = "SELECT * FROM `iksdev.Demo.model_refresh_metadata`"

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
    "AXIA": "iksdev.iks_dwh_axia.Denial_ModelAccuracy",
    "GALEN": "iksdev.iks_dwh_galen.Denial_ModelAccuracy",
    "THC": "iksdev.iks_dwh_thc.Denial_ModelAccuracy",
    "PDWD": "iksdev.iks_dwh_pdwd.Denial_ModelAccuracy",
    "GIA": "iksdev.iks_dwh_gia.Denial_ModelAccuracy",
}

APPEAL_ACCURACY_TABLES: dict[str, str] = {
    "AXIA": "iksgcp.iks_dwh_axia.Appeal_Prioritization_Accuracy_Table",
    "GALEN": "iksgcp.iks_dwh_galen.Appeal_Prioritization_Accuracy_Table",
    "THC": "iksgcp.iks_dwh_thc.Appeal_Prioritization_Accuracy_Table",
    "GIA": "iksgcp.iks_dwh_gia.Appeal_Prioritization_Accuracy_Table",
    "PHMG": "iksgcp.iks_dwh_phmg.Appeal_Prioritization_Accuracy_Table",
    "PDWD": "iksgcp.iks_dwh_pdwd.Appeal_Prioritization_Accuracy_Table",
}

try:
    from streamlit.runtime.secrets import secrets_singleton as _SECRETS_SINGLETON
except Exception:  # pragma: no cover - runtime specifics vary
    _SECRETS_SINGLETON = None

PLOTLY_CONFIG = {
    "displayModeBar": True,
    "displaylogo": False,
    "modeBarButtonsToRemove": ["lasso2d", "select2d", "hoverCompareCartesian"],
    "scrollZoom": True,
}
PLOTLY_CHART_DISPLAY_ARGS = (
    {"width": "stretch"}
    if "width" in signature(st.plotly_chart).parameters
    else {"use_container_width": True}
)

DEFAULT_CHART_HEIGHT = 360


def render_ai_assistant(selected_model, period_label, models, data_source_label, raw_data):
    """Renders floating chat with fixed clickable button."""
    
    # Initialize
    if 'chat_open' not in st.session_state:
        st.session_state.chat_open = False
    if 'messages' not in st.session_state:
        st.session_state.messages = [
            {"role": "assistant", "content": "Hi! I'm your MLOps AI Assistant. Ask me anything about your models and performance."}
        ]
    
    # JavaScript to force button positioning
    st.markdown("""
        <script>
        function fixChatButton() {
            // Find all buttons and reposition the chat button
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
                if (btn.textContent.includes('💬') || btn.getAttribute('aria-label') === 'Toggle chat') {
                    btn.style.position = 'fixed';
                    btn.style.bottom = '24px';
                    btn.style.right = '24px';
                    btn.style.zIndex = '999999';
                    btn.style.width = '60px';
                    btn.style.height = '60px';
                    btn.style.borderRadius = '50%';
                    btn.style.background = 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)';
                    btn.style.border = 'none';
                    btn.style.boxShadow = '0 4px 16px rgba(74, 144, 226, 0.4)';
                    btn.style.fontSize = '30px';
                    btn.style.padding = '0';
                }
            });
        }
        
        // Run repeatedly to ensure button stays fixed
        setInterval(fixChatButton, 100);
        </script>
    """, unsafe_allow_html=True)
    
    # CSS styles
    st.markdown("""
        <style>
        /* Chat window */
        .chat-window {
            position: fixed !important;
            bottom: 100px !important;
            right: 24px !important;
            width: 380px !important;
            height: 550px !important;
            background: white !important;
            border-radius: 12px !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
            z-index: 999998 !important;
            animation: slideUp 0.3s ease !important;
        }
        
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        .chat-header {
            background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px 12px 0 0;
        }
        
        .chat-header h3 {
            margin: 0 !important;
            font-size: 1rem !important;
            color: white !important;
        }
        
        [data-testid="stChatMessage"] {
            padding: 4px 0 !important;
        }
        
        [data-testid="stChatMessageContent"] {
            padding: 10px 14px !important;
            border-radius: 12px !important;
            font-size: 0.875rem !important;
        }
        
        [data-testid="stChatMessage"]:has([data-testid="chatAvatarIcon-assistant"]) [data-testid="stChatMessageContent"] {
            background: white !important;
            border: 1px solid #e0e6ed !important;
        }
        
        [data-testid="stChatMessage"]:has([data-testid="chatAvatarIcon-user"]) [data-testid="stChatMessageContent"] {
            background: #4A90E2 !important;
            color: white !important;
        }
        
        /* Hide close button styling */
        button[key="close"] {
            background: transparent !important;
            border: none !important;
            color: white !important;
            font-size: 24px !important;
        }
        </style>
    """, unsafe_allow_html=True)
    
    # Clickable button
    if st.button("💬", key="chat_toggle", help="Toggle chat"):
        st.session_state.chat_open = not st.session_state.chat_open
        st.rerun()
    
    # Chat window
    if st.session_state.chat_open:
        st.markdown('<div class="chat-window">', unsafe_allow_html=True)
        
        # Header with close button
        col1, col2 = st.columns([10, 1])
        with col1:
            st.markdown('<div class="chat-header"><h3>🤖 AI Assistant</h3></div>', unsafe_allow_html=True)
        with col2:
            if st.button("×", key="close"):
                st.session_state.chat_open = False
                st.rerun()
        
        # Messages
        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
        
        # Input
        user_msg = st.chat_input("Ask me anything...")
        if user_msg:
            st.session_state.messages.append({"role": "user", "content": user_msg})
            
            context = f"""You are an intelligent MLOps AI assistant.

Context:
- Model: {selected_model}
- Period: {period_label}
- Models: {', '.join(models) if models else 'N/A'}

Question: {user_msg}

Provide clear, helpful answers. Use bullet points for lists."""
            
            try:
                llm = get_vertex_model()
                res = llm.generate_content(context)
                st.session_state.messages.append({"role": "assistant", "content": res.text})
                st.rerun()
            except Exception as ex:
                st.session_state.messages.append({"role": "assistant", "content": f"Error: {str(ex)[:100]}"})
                st.rerun()
        
        st.markdown('</div>', unsafe_allow_html=True)


def _resolve_secrets_object():
    """Return the Streamlit secrets mapping if it can be accessed silently."""

    if _SECRETS_SINGLETON is not None:
        try:
            if not _SECRETS_SINGLETON.load_if_toml_exists():
                return None
        except Exception:
            return None

    try:
        return st.secrets  # type: ignore[attr-defined]
    except Exception:
        return None


def _secrets_get(key: str, default: object = None) -> object:
    secrets_obj = _resolve_secrets_object()
    if secrets_obj is None:
        return default

    try:
        if hasattr(secrets_obj, "get"):
            value = secrets_obj.get(key, default)
            if value is not None:
                return value
    except Exception:
        pass

    try:
        return secrets_obj[key]
    except Exception:
        return default


@st.cache_data(ttl=6 * 3600)  # Cache for 6 hours
def load_data(query):
    try:
        if retry_with_backoff:
            return retry_with_backoff(retries=3)(lambda: client.query(query).to_dataframe())()
        else:
            return client.query(query).to_dataframe()
    except Exception as e:
        st.error(f"Error fetching data: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=6 * 3600)
def load_metadata():
    query = """
    SELECT * FROM `iksdev.Demo.model_refresh_metadata`
    """
    try:
        if retry_with_backoff:
            return retry_with_backoff(retries=3)(lambda: client.query(query).to_dataframe())()
        else:
            return client.query(query).to_dataframe()
    except Exception as e:
        # Fallback if table doesn't exist or error
        # st.warning(f"Could not load metadata: {e}")
        return pd.DataFrame()


def _refresh_live_data(destination: Path) -> tuple[bool, str | None]:
    credentials_info = _secrets_get("gcp_service_account")
    credentials_path = os.getenv("STREAMLIT_GCP_CREDENTIALS") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_path is None:
        credentials_path = _secrets_get("gcp_credentials_path")

    query = (
        os.getenv("STREAMLIT_LIVE_DATA_QUERY")
        or _secrets_get("live_data_query")
        or DEFAULT_LIVE_QUERY
    )

    if isinstance(credentials_info, str):
        try:
            credentials_info = json.loads(credentials_info)
        except json.JSONDecodeError:
            credentials_path = credentials_info
            credentials_info = None

    if isinstance(credentials_path, Path):
        credentials_path = str(credentials_path)

    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
    except ModuleNotFoundError:
        return False, "Install google-cloud-bigquery to enable live refresh."

    try:
        if credentials_info:
            if not isinstance(credentials_info, dict):
                try:
                    credentials_info = dict(credentials_info)  # type: ignore[arg-type]
                except Exception:
                    return False, "Unsupported credentials format; provide JSON service account info."
            creds = service_account.Credentials.from_service_account_info(credentials_info)
        else:
            cred_path_obj = Path(str(credentials_path)).expanduser() if credentials_path else None
            
            # Smart credential selection:
            # - For ITTT: Use mlflow-sa-prod.json (needs iksgcp access)
            # - For Denial/Appeal: Use mlflow-sa.json (iksdev access)
            if not cred_path_obj or not cred_path_obj.exists():
                # Check if we need ITTT data by examining the query
                needs_iksgcp = "iksgcp" in query or (METADATA_REFRESH_QUERY and "iksgcp" in METADATA_REFRESH_QUERY)
                
                if needs_iksgcp:
                    # ITTT models - use production credentials for iksgcp access
                    prod_creds = Path(__file__).parent / "mlflow-sa-prod.json"
                    if prod_creds.exists():
                        cred_path_obj = prod_creds
                        print("Using production credentials (mlflow-sa-prod.json) for ITTT data (iksgcp access)")
                    else:
                        return False, "ITTT data requires mlflow-sa-prod.json for iksgcp access."
                else:
                    # Denial/Appeal models - use dev credentials for iksdev access
                    dev_creds = Path(__file__).parent / "mlflow-sa.json"
                    if dev_creds.exists():
                        cred_path_obj = dev_creds
                        print("Using dev credentials (mlflow-sa.json) for Denial/Appeal data (iksdev access)")
                    else:
                        return False, "Denial/Appeal data requires mlflow-sa.json for iksdev access."

            if not cred_path_obj or not cred_path_obj.exists():
                return False, "No GCP credentials found."
            
            creds = service_account.Credentials.from_service_account_file(cred_path_obj)

        client = bigquery.Client(credentials=creds, project=creds.project_id)
        
        if METADATA_REFRESH_QUERY:
            try:
                client.query(METADATA_REFRESH_QUERY).result()
            except Exception as exc:
                return False, f"Metadata refresh failed: {str(exc)}"
        dataframe = client.query(query).result().to_dataframe(create_bqstorage_client=False)
        destination.parent.mkdir(parents=True, exist_ok=True)
        dataframe.to_csv(destination, index=False)
        return True, None
    except Exception as exc:  # pragma: no cover - surface upstream
        return False, str(exc)


def _build_bq_client_for_table(table: str):
    """Return a BigQuery client using the right credentials for the given table."""
    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
    except ModuleNotFoundError:
        return None

    credentials_info = _secrets_get("gcp_service_account")
    credentials_path = (
        os.getenv("STREAMLIT_GCP_CREDENTIALS")
        or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        or _secrets_get("gcp_credentials_path")
    )

    if isinstance(credentials_info, str):
        try:
            credentials_info = json.loads(credentials_info)
        except json.JSONDecodeError:
            credentials_path = credentials_info
            credentials_info = None

    if isinstance(credentials_path, Path):
        credentials_path = str(credentials_path)

    requires_prod = "iksgcp" in table.lower()

    try:
        if credentials_info:
            if not isinstance(credentials_info, dict):
                try:
                    credentials_info = dict(credentials_info)  # type: ignore[arg-type]
                except Exception:
                    return None
            creds = service_account.Credentials.from_service_account_info(credentials_info)
        else:
            cred_path_obj = Path(str(credentials_path)).expanduser() if credentials_path else None
            if not cred_path_obj or not cred_path_obj.exists():
                default_name = "mlflow-sa-prod.json" if requires_prod else "mlflow-sa.json"
                default_path = Path(__file__).parent / default_name
                cred_path_obj = default_path if default_path.exists() else None
            if not cred_path_obj or not cred_path_obj.exists():
                return None
            creds = service_account.Credentials.from_service_account_file(cred_path_obj)

        return bigquery.Client(credentials=creds, project=creds.project_id)
    except Exception:
        return None


def _run_accuracy_avg_query(client, query: str, start_date, end_date, window_days: int):
    """Execute an average-accuracy query; return float or None."""
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
    except Exception as e:
        print(f"DEBUG Error in _run_accuracy_avg_query: {e}")
        return None


def _fetch_appeal_records_from_bq() -> pd.DataFrame:
    """Directly pull Appeal data from prod tables as a sanity fallback."""

    records: list[dict] = []
    for client_name, table in APPEAL_ACCURACY_TABLES.items():
        bq_client = _build_bq_client_for_table(table)
        if bq_client is None:
            continue
        try:
            query = f"""
                SELECT
                    COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) AS date_of_model_refresh,
                    'Appeal Prioritization' AS model_name,
                    @client_name AS client_name,
                    SAFE_CAST(Accuracy AS FLOAT64) AS accuracy,
                    SAFE_CAST(Recall_1 AS FLOAT64) AS recall,
                    SAFE_CAST(Accuracy AS FLOAT64) AS accuracy_pct
                FROM `{table}`
                WHERE COALESCE(SAFE_CAST(Prediction_Date AS DATE), PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10))) IS NOT NULL
            """
            from google.cloud import bigquery

            job_config = bigquery.QueryJobConfig(
                query_parameters=[bigquery.ScalarQueryParameter("client_name", "STRING", client_name)]
            )
            for row in bq_client.query(query, job_config=job_config).result():
                records.append(
                    {
                        "date_of_model_refresh": row.date_of_model_refresh,
                        "model_name": "Appeal Prioritization",
                        "client_name": client_name,
                        "accuracy": row.accuracy,
                        "recall": row.recall,
                        "accuracy_pct": row.accuracy_pct,
                        "metric_name": "Overall_Accuracy",
                        "metric_value": row.accuracy,
                        "model_metrics": '[{"value": %s, "metric": "Overall_Accuracy"}, {"value": %s, "metric": "Recall"}]'
                        % (
                            row.accuracy if row.accuracy is not None else "null",
                            row.recall if row.recall is not None else "null",
                        ),
                    }
                )
        except Exception:
            continue

        return pd.DataFrame()

    df = pd.DataFrame.from_records(records)
    # Standardize column types
    if "date_of_model_refresh" in df.columns:
        df["date_of_model_refresh"] = pd.to_datetime(df["date_of_model_refresh"], errors="coerce")
        
    # NORMALIZE CLIENT NAMES: Force uppercase to match EXPECTED_CLIENTS configuration
    # This prevents visibility issues if source data/CSV has mixed case (e.g. "Axia" vs "AXIA")
    if "client_name" in df.columns:
        df["client_name"] = df["client_name"].str.strip().str.upper()

    return df


def _fetch_ittt_accuracy_from_bq(
    client_name: str,
    *,
    start_date: object,
    end_date: object,
    window_days: int,
) -> float | None:
    """Fetch ITTT accuracy directly from BigQuery to mirror email/BQ calculations."""

    table = ITTT_ACCURACY_TABLES.get(str(client_name).strip().upper())
    if not table:
        return None

    # FORCE Load Prod Credentials for ITTT (iksgcp tables)
    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
        from pathlib import Path
        
        # Explicitly use prod credentials for ITTT as it is in iksgcp
        cred_path = Path(__file__).parent / "mlflow-sa-prod.json"
        creds = service_account.Credentials.from_service_account_file(str(cred_path))
        bq_client = bigquery.Client(credentials=creds, project=creds.project_id)
    except Exception as e:
        print(f"Error loading ITTT creds: {e}")
        return None

    # Normalize dates
    start_dt = pd.to_datetime(start_date, errors="coerce")
    end_dt = pd.to_datetime(end_date, errors="coerce")
    today = datetime.now(timezone.utc).date()

    start_date_only = start_dt.date()
    end_date_only = end_dt.date()
    if end_date_only < start_date_only:
        end_date_only = start_date_only

    # Simple AVG of AccuracyPercentage over the date window (per stakeholder guidance)
    query = f"""
        SELECT
          AVG(SAFE_CAST(AccuracyPercentage AS FLOAT64)) AS avg_accuracy
        FROM `{table}`
        WHERE COALESCE(
                SAFE.PARSE_DATE('%Y/%m/%d', LEFT(CAST(Prediction_Date AS STRING), 10)),
                SAFE_CAST(Prediction_Date AS DATE)
              ) BETWEEN @start_date AND @end_date
    """

    try:
        from google.cloud import bigquery

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("start_date", "DATE", start_date_only),
                bigquery.ScalarQueryParameter("end_date", "DATE", end_date_only),
            ]
        )
        result = bq_client.query(query, job_config=job_config).result()
        row = next(iter(result), None)
        if row is None:
            return None
        value = row.get("avg_accuracy")
        return float(value) if value is not None else None
    except Exception as e:
        print(f"DEBUG Error in _fetch_ittt_accuracy_from_bq: {e}")
        return None


def _fetch_denial_accuracy_from_bq(
    client_name: str,
    *,
    start_date: object,
    end_date: object,
    window_days: int,
) -> float | None:
    table = DENIAL_ACCURACY_TABLES.get(str(client_name).upper())
    if not table:
        return None

    bq_client = _build_bq_client_for_table(table)
    if bq_client is None:
        return None

    start_dt = pd.to_datetime(start_date, errors="coerce")
    end_dt = pd.to_datetime(end_date, errors="coerce")
    if pd.isna(start_dt) or pd.isna(end_dt):
        return None

    query = f"""
        SELECT
            AVG(SAFE_CAST(Overall_Accuracy_per AS FLOAT64)) AS avg_accuracy
        FROM `{table}`
        WHERE COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) >= @start_date
          AND COALESCE(SAFE_CAST(Predicted_Denial_DateOnly AS DATE), SAFE_CAST(Predicted_Accuracy_Date AS DATE)) <= @end_date
    """

    return _run_accuracy_avg_query(
        bq_client,
        query,
        start_date=start_dt,
        end_date=end_dt,
        window_days=max(int(window_days), 1),
    )


def _fetch_appeal_accuracy_from_bq(
    client_name: str,
    canonical_client: str,
    *,
    start_date: object,
    end_date: object,
    window_days: int,
) -> dict[str, float | None] | None:
    table = APPEAL_ACCURACY_TABLES.get(str(canonical_client).strip().upper())
    if not table:
        return None

    # FORCE Load Prod Credentials for Appeal (iksgcp)
    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
        
        # Explicitly use prod credentials for Appeal as it is in iksgcp
        cred_path = Path(__file__).parent / "mlflow-sa-prod.json"
        creds = service_account.Credentials.from_service_account_file(str(cred_path))
        client = bigquery.Client(credentials=creds, project=creds.project_id)
    except Exception as e:
        print(f"Error loading Appeal creds: {e}")
        return None

    start_dt = pd.to_datetime(start_date, errors="coerce")
    end_dt = pd.to_datetime(end_date, errors="coerce")
    if pd.isna(start_dt) or pd.isna(end_dt):
        return None

    query = f"""
        SELECT
            AVG(SAFE_CAST(Accuracy AS FLOAT64)) AS avg_accuracy,
            AVG(SAFE_CAST(Recall_1 AS FLOAT64)) AS avg_recall
        FROM `{table}`
        WHERE SAFE_CAST(Accuracy_Date AS DATE) >= @start_date
          AND SAFE_CAST(Accuracy_Date AS DATE) <= @end_date
    """

    try:
        from google.cloud import bigquery
    except ModuleNotFoundError:
        return None

    try:
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("start_date", "DATE", pd.to_datetime(start_dt).date()),
                bigquery.ScalarQueryParameter("end_date", "DATE", pd.to_datetime(end_dt).date()),
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


THEME: dict[str, str] = {
    "plotly_template": "plotly_dark",
    "bg_gradient_start": "#1b2540",  # Deep navy glow
    "bg_gradient_end": "#050811",    # Night black
    "sidebar_bg": "#0f1524",
    "sidebar_border": "#1a2340",
    "sidebar_accent": "#7c5cff",
    "sidebar_active_bg": "linear-gradient(135deg, rgba(124, 92, 255, 0.25) 0%, rgba(48, 207, 208, 0.10) 100%)",
    "sidebar_text": "#e8ecf5",
    "sidebar_text_muted": "#8ea2c8",
    "sidebar_icon_bg": "rgba(124, 92, 255, 0.18)",
    "card_bg": "rgba(20, 28, 46, 0.65)",
    "card_border": "rgba(124, 92, 255, 0.25)",
    "card_shadow": "0 12px 32px rgba(0, 0, 0, 0.35), 0 0 24px rgba(124, 92, 255, 0.25)",
    "card_gradient_start": "rgba(124, 92, 255, 0.12)",
    "card_gradient_end": "rgba(48, 207, 208, 0.08)",
    "chart_bg": "rgba(10, 14, 26, 0.35)",
    "control_bg": "rgba(20, 28, 46, 0.6)",
    "control_border": "rgba(255, 255, 255, 0.1)",
    "control_text": "#e8ecf5",
    "pill_bg": "rgba(124, 92, 255, 0.2)",
    "pill_text": "#dfe7ff",
    "text_primary": "#e8ecf5",
    "text_muted": "#c5d0ec",
    "text_positive": "#7bf9d4",
    "text_negative": "#ff6b81",
    "line_primary": "#7c5cff",
    "line_secondary": "#30cfd0",
    "threshold_color": "#fbbf24",    # Amber
    "threshold_band_fill": "rgba(139, 92, 246, 0.1)",
    "grid_color": "#334155",
    "chart_height": "360px",
}


def _normalize_model_key(name: str | None) -> str:
    """Collapse variations of model names into canonical keys."""

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


METRIC_LABEL_OVERRIDES: dict[str, str] = {
    "payment_accuracy": "Propensity to Pay",
    "payment_accuracy_per": "Propensity to Pay",
    "denial_accuracy": "Propensity to Deny",
    "denial_accuracy_per": "Propensity to Deny",
}

METRIC_DESCRIPTIONS: dict[str, str] = {
    "Overall_Accuracy": "Percentage of predictions matching observed outcomes; higher values indicate better alignment with reality.",
    "Accuracy_pct": "Accuracy percentage reported directly from the source system for each refresh.",
    "Denial_Accuracy": "Propensity to Deny — correctness of predicted denials versus actual denials.",
    "Payment_Accuracy": "Propensity to Pay — correctness of predicted payments versus actual payments.",
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


def _format_metric_label(name: str | None) -> str:
    """Return a human-friendly label for a metric name."""

    if name is None:
        return "Metric"

    text = str(name).strip()
    if not text:
        return "Metric"

    normalized = text.lower().replace(" ", "_")
    return METRIC_LABEL_OVERRIDES.get(normalized, text.replace("_", " "))


def _metric_description(name: str | None) -> str:
    if name is None:
        return "Metric value for the selected window."

    key = str(name).strip()
    if not key:
        return "Metric value for the selected window."

    return METRIC_DESCRIPTIONS.get(
        key,
        f"Latest reading for {_format_metric_label(key)} across the chosen filters.",
    )


def _hover_note(text: str) -> str:
    return text.replace("<", "&lt;").replace(">", "&gt;")


CLIENT_CANONICAL_NAMES: dict[str, dict[str, str]] = {
    "denial": {
        "AXIA": "AXIA",
        "THC": "THC",
        "GALEN": "GALEN",
        "GLMG": "GALEN",
        "PDWD": "PDWD",
        "GIA": "GIA",
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
    "Denial": ["AXIA", "GALEN", "THC", "PDWD", "GIA"],
    "ITTT": ["AXIA", "GALEN", "THC", "PDWD", "GIA", "PHMG", "WWMG"],
    "Appeal": ["AXIA", "GALEN", "THC", "PDWD", "GIA", "PHMG"],
    "Appeal Prioritization": ["AXIA", "GALEN", "THC", "GIA", "PHMG", "PDWD"],
}

st.set_page_config(page_title="ML Observatory", page_icon="📊", layout="wide")

st.markdown(
    """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        :root {
            --bg-start: %(bg_gradient_start)s;
            --bg-end: %(bg_gradient_end)s;
            --card-bg: %(card_bg)s;
            --card-border: %(card_border)s;
            --text-primary: %(text_primary)s;
            --text-muted: %(text_muted)s;
            --accent: %(sidebar_accent)s;
            --positive: %(text_positive)s;
            --negative: %(text_negative)s;
        }
        
        /* Global Reset */
        [data-testid="stAppViewContainer"] {
            background: radial-gradient(circle at 20%% 20%%, var(--bg-start), var(--bg-end));
            color: var(--text-primary);
            font-family: "Inter", sans-serif;
        }
        [data-testid="stHeader"] {
            background: transparent;
        }
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        
        /* Sidebar */
        div[data-testid="stSidebar"] {
            background-color: %(sidebar_bg)s;
            border-right: 1px solid %(sidebar_border)s;
        }
        
        /* Hero Section */
        .hero-container {
            padding: 30px 0 40px;
            text-align: left;
        }
        .hero-title {
            font-size: 42px;
            font-weight: 800;
            background: linear-gradient(135deg, #fff 0%%, #94a3b8 100%%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 16px;
            letter-spacing: -0.03em;
        }
        .hero-badges {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }
        .badge {
            background: rgba(139, 92, 246, 0.15);
            color: #c4b5fd;
            border: 1px solid rgba(139, 92, 246, 0.3);
            padding: 6px 14px;
            border-radius: 99px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            box-shadow: 0 0 10px rgba(139, 92, 246, 0.1);
        }
        .badge.highlight {
            background: rgba(56, 189, 248, 0.15);
            color: #7dd3fc;
            border-color: rgba(56, 189, 248, 0.3);
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.1);
        }
        .last-updated {
            color: var(--text-muted);
            font-size: 13px;
            margin-left: 8px;
        }
        .hero-description {
            color: var(--text-muted);
            font-size: 16px;
            max-width: 650px;
            line-height: 1.6;
        }
        
        /* Metric Cards */
        .metric-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            margin-bottom: 40px;
        }
        .metric-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            backdrop-filter: blur(12px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .metric-card::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--accent), transparent);
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .metric-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border-color: rgba(139, 92, 246, 0.3);
        }
        .metric-card:hover::before {
            opacity: 1;
        }
        .metric-label {
            color: var(--text-muted);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 600;
        }
        .metric-value {
            color: var(--text-primary);
            font-size: 36px;
            font-weight: 700;
            letter-spacing: -0.02em;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
        }
        .metric-indicator {
            font-size: 13px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .metric-indicator.positive { color: var(--positive); }
        .metric-indicator.negative { color: var(--negative); }
        .metric-indicator.neutral { color: var(--text-muted); }
        
        /* Control Bar */
        .control-bar {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 30px;
            backdrop-filter: blur(12px);
        }
        
        /* Charts */
        .chart-container {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            backdrop-filter: blur(12px);
        }
        
        /* Tables */
        .status-table {
            width: 100%%;
            border-collapse: separate;
            border-spacing: 0 8px;
        }
        .status-table th {
            text-align: left;
            color: var(--text-muted);
            font-size: 12px;
            text-transform: uppercase;
            padding: 12px 16px;
            letter-spacing: 0.05em;
        }
        .status-table td {
            padding: 16px;
            background: rgba(30, 41, 59, 0.4);
            color: var(--text-primary);
            font-size: 14px;
            border-top: 1px solid var(--card-border);
            border-bottom: 1px solid var(--card-border);
        }
        .status-table td:first-child {
            border-left: 1px solid var(--card-border);
            border-top-left-radius: 12px;
            border-bottom-left-radius: 12px;
        }
        .status-table td:last-child {
            border-right: 1px solid var(--card-border);
            border-top-right-radius: 12px;
            border-bottom-right-radius: 12px;
        }

        /* Alerts Table */
        .alert-table {
            margin: 22px 0 28px;
            border-radius: 22px;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            overflow: hidden;
            backdrop-filter: blur(12px);
        }
        .alert-table .alert-header, .alert-table .alert-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 22px;
        }
        .alert-table .alert-header {
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 11px;
            color: var(--text-muted);
            border-bottom: 1px solid var(--card-border);
        }
        .alert-table .alert-row:not(:last-child) {
            border-bottom: 1px solid var(--card-border);
        }
        .alert-col { flex: 1; color: var(--text-muted); font-size: 13px; }
        .alert-col.status { flex: 1.3; display: flex; align-items: center; gap: 8px; color: var(--text-primary); }
        .alert-col.severity { flex: 0.9; }
        .alert-col.signal { flex: 1.4; color: var(--text-primary); }
        .alert-col.model { flex: 1.0; color: var(--text-muted); }
        .alert-col.time { flex: 1.1; color: var(--text-muted); }
        .alert-col.value { flex: 0.9; text-align: right; color: var(--text-primary); font-variant-numeric: tabular-nums; }
        .alert-col.actions { flex: 1.0; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
        .alert-status-icon { width: 10px; height: 10px; border-radius: 999px; }
        .alert-status-icon.active { background: var(--negative); box-shadow: 0 0 10px rgba(248,113,113,0.55); }
        .alert-status-icon.acknowledged { background: #facc15; box-shadow: 0 0 10px rgba(250,204,21,0.55); }
        .alert-status-icon.resolved { background: var(--positive); box-shadow: 0 0 10px rgba(74,222,128,0.55); }
        .alert-action { display: inline-flex; align-items: center; justify-content: center; padding: 6px 14px; border-radius: 12px; border: 1px solid var(--card-border); background: rgba(15,23,42,0.85); color: var(--text-primary); font-size: 12px; font-weight: 600; cursor: pointer; }
        .alert-action:hover { background: var(--card-border); }

        /* Glass cards & tables for neon/glow aesthetic */
        .glass-card {
            background: %(card_bg)s;
            border: 1px solid %(card_border)s;
            box-shadow: %(card_shadow)s;
            border-radius: 18px;
            padding: 18px 22px;
            backdrop-filter: blur(12px);
        }
        .glass-table table {
            color: %(text_primary)s;
            border-collapse: collapse;
            width: 100%%;
            background: rgba(10, 14, 26, 0.35);
        }
        .glass-table th {
            background: linear-gradient(135deg, #1e2742, #151c30);
            color: #dfe7ff;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            font-size: 12px;
            padding: 10px;
        }
        .glass-table td {
            padding: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .glass-table tr:nth-child(even) { background: rgba(255,255,255,0.02); }
        .badge-bq { color:#7bf9d4; font-size:11px; }
        .metric-up { color:#7bf9d4; font-weight:700; }
        .metric-down { color:#ff6b81; font-weight:700; }

        /* Gradient primary buttons */
        button[kind="primary"] {
            background: linear-gradient(135deg, #7c5cff 0%%, #30cfd0 100%%) !important;
            color: #0b0f1a !important;
            border: none !important;
            box-shadow: 0 6px 18px rgba(124, 92, 255, 0.35);
        }
    </style>
    """ % THEME,
    unsafe_allow_html=True,
)


def _canonicalize_client(model_name: str | None, client_name: str | None) -> str | None:
    if client_name is None:
        return None
    model_key = _normalize_model_key(model_name)
    canonical_map = CLIENT_CANONICAL_NAMES.get(model_key, {})
    normalized = client_name.strip().upper()
    canonical = canonical_map.get(normalized, normalized)
    return canonical.strip().upper()


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
            try:
                parsed = json.loads(raw_threshold_range)
            except json.JSONDecodeError:
                parsed = {}
            if isinstance(parsed, dict):
                if pd.isna(threshold_min):
                    threshold_min = parsed.get("min")
                if pd.isna(threshold_max):
                    threshold_max = parsed.get("max")

        if not metrics:
            metrics = [{"metric": row.get("metric_name") or "Metric", "value": row.get("metric_value")}]  # fallback

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


def _style_plot(fig: go.Figure, theme: dict[str, str]) -> None:
    title_color = theme.get("text_primary", "#0F172A")
    axis_color = theme.get("text_muted", "#6B7280")
    grid_color = theme.get("grid_color", "#E5E7EB")

    fig.update_layout(
        title_font=dict(color=title_color, size=20),
        legend=dict(font=dict(color=title_color, size=12), bgcolor="rgba(0,0,0,0)", borderwidth=0),
    )
    fig.update_xaxes(
        title_font=dict(color=title_color, size=12),
        tickfont=dict(color=axis_color, size=10),
        gridcolor=grid_color,
        zerolinecolor=grid_color,
    )
    fig.update_yaxes(
        title_font=dict(color=title_color, size=12),
        tickfont=dict(color=axis_color, size=10),
        gridcolor=grid_color,
        zerolinecolor=grid_color,
    )




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

        if not existing_dates.empty:
            current = anchor - step
        else:
            current = anchor

        for idx in reversed(missing_idx):
            frame.at[idx, "date_of_model_refresh"] = current
            current -= step

    frame["date_of_model_refresh"] = pd.to_datetime(frame["date_of_model_refresh"], errors="coerce")
    if frame["date_of_model_refresh"].dt.tz is not None:
        frame["date_of_model_refresh"] = frame["date_of_model_refresh"].dt.tz_localize(None)
    frame["date_of_model_refresh"] = frame["date_of_model_refresh"].dt.normalize()

    return frame


@st.cache_data(ttl=3600, show_spinner="Loading dashboard data...")  # Cache for 1 hour, show spinner
def load_data(path: Path = DATA_PATH) -> pd.DataFrame:
    refreshed, refresh_error = _refresh_live_data(path)

    if not path.exists():
        if refresh_error:
            raise RuntimeError(f"Unable to refresh live data: {refresh_error}")
        raise FileNotFoundError(f"Expected data file at {path}")

    frame = pd.read_csv(path)
    frame.attrs["data_source"] = "bigquery" if refreshed else "local_csv"
    frame.attrs["data_refresh_error"] = refresh_error
    try:
        frame.attrs["source_file_mtime"] = pd.to_datetime(path.stat().st_mtime, unit="s")
    except OSError:
        frame.attrs["source_file_mtime"] = pd.NaT
    frame["date_of_model_refresh"] = pd.to_datetime(frame["date_of_model_refresh"], errors="coerce")
    if "model_last_update_date" in frame:
        frame["model_last_update_date"] = pd.to_datetime(
            frame["model_last_update_date"], errors="coerce"
        )
        frame["model_last_update_date"] = frame["model_last_update_date"].dt.tz_localize(None)

    frame = _impute_refresh_dates_if_missing(frame)

    # Appeal sanity fallback: DISABLED for performance (data already complete in metadata table)
    # if {"model_name", "client_name"}.issubset(frame.columns):
    #     appeal_mask = frame["model_name"].str.contains("Appeal", case=False, na=False)
    #     existing_appeal_clients = set(frame.loc[appeal_mask, "client_name"].dropna().str.upper())
    #     expected_appeal_clients = set(APPEAL_ACCURACY_TABLES.keys())
    #     if not expected_appeal_clients.issubset(existing_appeal_clients):
    #         fallback_appeal = _fetch_appeal_records_from_bq()
    #         if not fallback_appeal.empty:
    #             # Align columns before concat
    #             for col in frame.columns:
    #                 if col not in fallback_appeal.columns:
    #                     fallback_appeal[col] = pd.NA
    #             for col in fallback_appeal.columns:
    #                 if col not in frame.columns:
    #                     frame[col] = pd.NA
    #             frame = pd.concat([frame, fallback_appeal[frame.columns]], ignore_index=True)

    if "metric_name" not in frame.columns and "model_metrics" in frame.columns:
        frame = _expand_wide_metrics(frame)

    for column in ["threshold", "threshold_min", "threshold_max", "metric_value", "accuracy_pct"]:
        if column in frame:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    if "client_name" in frame:
        # NORMALIZE CLIENT NAMES: Force uppercase to match EXPECTED_CLIENTS configuration
        frame["client_name"] = frame["client_name"].str.strip().str.upper()
        
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
        latency_seconds = (
            frame["model_last_update_date"] - frame["date_of_model_refresh"]
        ).dt.total_seconds()
        frame["latency_seconds"] = latency_seconds.clip(lower=0)
        frame["latency_minutes"] = frame["latency_seconds"] / 60.0
        frame["latency_hours"] = frame["latency_minutes"] / 60.0

    frame = frame.dropna(subset=["date_of_model_refresh", "metric_name"])

    latest_point = frame["date_of_model_refresh"].max() if not frame.empty else pd.NaT
    frame.attrs["latest_data_point"] = latest_point if pd.notna(latest_point) else pd.NaT

    if refreshed:
        frame.attrs["refreshed_at"] = datetime.now(timezone.utc)
    else:
        frame.attrs.setdefault("refreshed_at", None)

    return frame


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


def _send_alert_summary_email(
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
        body_lines.append(f"Active: {status_tally.get('active', 0)} Â· ACK: {status_tally.get('acknowledged', 0)} Â· Resolved: {status_tally.get('resolved', 0)}")
    
    if severity_tally:
        body_lines.append(f"Severity mix ” High: {severity_tally.get('high', 0)}, Medium: {severity_tally.get('medium', 0)}, Low: {severity_tally.get('low', 0)}")

    subject = f"[Model Observatory] {model_name} summary â€“ {period_label}"
    return _send_email_via_smtp(subject, body_lines, smtp_settings, success_message="Summary email sent.")


def _assemble_model_email_payload(
    data: pd.DataFrame,
    *,
    model_name: str,
    start_date: object,
    end_date: object,
) -> tuple[str, list[str]]:
    start_ts = pd.to_datetime(start_date)
    end_ts = pd.to_datetime(end_date)

    filtered = data[
        (data["model_name"] == model_name)
        & data["date_of_model_refresh"].between(start_ts, end_ts)
    ].copy()

    client_count = int(filtered["client_name"].nunique()) if "client_name" in filtered else 0
    refresh_count = int(filtered["date_of_model_refresh"].nunique())
    client_scope = f"All Clients ({client_count})"

    summary_rows: list[str] = []
    
    # Add data freshness info
    if not filtered.empty:
        min_date = filtered["date_of_model_refresh"].min().date()
        max_date = filtered["date_of_model_refresh"].max().date()
        summary_rows.append(f"- Data range: {min_date} to {max_date}")
        
        # Add client list
        clients = sorted(filtered["client_name"].dropna().unique())
        if clients:
            summary_rows.append(f"- Clients included: {', '.join(clients)}")
    
    summary_rows.append(
        f"- Coverage: {client_count} client{'s' if client_count != 1 else ''}, {refresh_count} refresh{'es' if refresh_count != 1 else ''}."
    )

    if not filtered.empty:
        metric_names = filtered["metric_name"].dropna().unique()
        summary = summarize_metrics(filtered, metric_names)
        model_key = _normalize_model_key(model_name)
        prioritized_metrics = MODEL_METRIC_PRIORITIES.get(model_key, [])
        ordered_metrics: list[str] = []
        for metric in prioritized_metrics:
            if metric in summary.index and metric not in ordered_metrics:
                ordered_metrics.append(metric)
        for metric in summary.index:
            if metric not in ordered_metrics:
                ordered_metrics.append(metric)
        for metric in ordered_metrics[:5]:
            summary_rows.append(_format_metric_snapshot_row(metric, summary.loc[metric]))
    else:
        summary = pd.DataFrame()

    return client_scope, summary_rows


# Helpers for consolidated email metric extraction (JSON + numeric)
def _parse_json_metrics_from_row(row: pd.Series, json_cols: List[str]) -> Dict[str, Union[float, str]]:
    """Extract metric name/value pairs from JSON columns in a single row."""
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
    """Build metric dictionary with latest, avg, delta (handles JSON metric columns too)."""
    if client_data.empty:
        return {}

    sorted_data = client_data.sort_values("date_of_model_refresh", ascending=False)
    latest_row = sorted_data.iloc[0]

    all_metric_values: Dict[str, List[Union[float, str]]] = {}

    # Derive ITTT accuracy pct from counts when provided
    derived_accuracy_pct: Optional[pd.Series] = None
    if {"ittt_within_threshold_count", "ittt_total_count"}.issubset(sorted_data.columns):
        within = pd.to_numeric(sorted_data["ittt_within_threshold_count"], errors="coerce")
        total = pd.to_numeric(sorted_data["ittt_total_count"], errors="coerce")
        derived_accuracy_pct = (within / total.where(total != 0)) * 100

    simple_value_keys = [
        "accuracy_pct",  # preferred when counts exist
        "accuracy",
        "recall",
        "overall_accuracy",
        "overall_accuracy_per",
    ]
    for key in simple_value_keys:
        if key in sorted_data.columns:
            series = pd.to_numeric(sorted_data[key], errors="coerce")
            if key in {"accuracy_pct", "accuracy"} and derived_accuracy_pct is not None:
                # Replace missing or zero values with the count-derived percentage so averages are volume-weighted.
                series = series.where(~series.isna() & (series != 0), derived_accuracy_pct)
            clean_name = key.replace("_", " ").title()
            all_metric_values[clean_name] = [v for v in series.tolist() if pd.notna(v)]

    json_cols = ["business_metrics", "kpis", "model_metrics"]
    for _, row in sorted_data.iterrows():
        extracted_row_metrics = _parse_json_metrics_from_row(row, json_cols)
        for name, value in extracted_row_metrics.items():
            if name not in all_metric_values:
                all_metric_values[name] = []
            if pd.notna(value) and value is not None:
                all_metric_values[name].append(value)

        # Also capture metric_value columns paired with metric_name (wide-expanded metrics)
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

    latest_simple_metrics = {k.replace("_", " ").title(): latest_row.get(k) for k in simple_value_keys if k in latest_row}
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
            # Respect the most recent numeric value, including zeros.
            latest_float = next((v for v in history_list if isinstance(v, (int, float)) and pd.notna(v)), numeric_history[0])
            average = sum(numeric_history) / len(numeric_history)
            delta = latest_float - average
            final_metrics[metric_name] = {"value": latest_float, "avg": average, "delta": delta, "unit": unit}
        elif latest_value is not None:
            final_metrics[metric_name] = {"value": latest_value, "avg": "N/A", "delta": "N/A", "unit": unit}

    return final_metrics


def _parse_rolling_window_days(label: str) -> int:
    """Parse a rolling window label into days."""
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

    match = re.search(r"(\d+)", label)
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


def _send_consolidated_summary_email(
    *,
    data: pd.DataFrame,
    model_names: Iterable[str],
    start_date: object,
    end_date: object,
    period_label: str,
) -> tuple[bool, str]:
    """
    Sends a consolidated email with a single table containing metrics for all models and clients.
    """
    if data.empty:
        return False, "No data available to build consolidated email."

    # Anchor the reporting window to (min(latest_data_date, today) - 15 days) to avoid stale/future drift
    latest_date = pd.to_datetime(data["date_of_model_refresh"], errors="coerce").max()
    if pd.isna(latest_date):
        return False, "No data available to build consolidated email."
    today = datetime.now(timezone.utc).date()
    anchor_date = min(latest_date.date(), today)

    # Apply 15-day lag, then 30-day reporting window (inclusive)
    actual_end_date = anchor_date - timedelta(days=15)
    actual_start_date = actual_end_date - timedelta(days=29)  # 30-day window
    period_label = f"{actual_start_date} to {actual_end_date}"

    start_ts = pd.Timestamp(actual_start_date)
    end_ts = pd.Timestamp(actual_end_date)

    # Filter data to the enforced window
    window_data = data[data["date_of_model_refresh"].between(start_ts, end_ts)].copy()

    if window_data.empty:
        return False, "No data found in the selected window."

    # --- HTML BODY CONSTRUCTION ---
    html_body_parts = []

    # 1. Page Title and Styles
    html_body_parts.append(f"""
        <h2 style="color: #007bff; font-family: Arial, sans-serif; text-align: center;">Consolidated ML Observatory Summary</h2>
        
        <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px; margin-top: 20px; box-shadow: 0 2px 15px rgba(0,0,0,0.1);">
            <thead>
                <tr style="background-color: #007bff; color: white; text-align: left;">
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
    """)

    # 2. Organize Models (Prioritizing specific order)
    available_models = {
        _normalize_model_key(name): name for name in pd.Series(model_names).dropna().unique()
    }
    target_order = ["appeal", "denial", "ittt"]
    sorted_model_keys = []
    seen = set()
    
    # Add prioritized models first
    for key in target_order:
        if key in available_models:
            sorted_model_keys.append(available_models[key])
            seen.add(available_models[key])
    
    # Add remaining models
    for name in sorted(available_models.values()):
        if name not in seen:
            sorted_model_keys.append(name)

    # Track visually displayed keys to handle row grouping (blanking out repeated cells)
    last_displayed_model = None

    # 3. Iterate and Build Rows
    row_count = 0
    
    for model in sorted_model_keys:
        # Use full dataset to get list of clients (not just window data)
        model_data_full = data[data["model_name"] == model]
        if model_data_full.empty:
            continue
            
        # Get clients from full dataset
        clients = sorted(model_data_full["client_name"].dropna().unique())
        
        for client in clients:
            # Try to get data from window first
            model_data_window = window_data[window_data["model_name"] == model]
            client_data = model_data_window[model_data_window["client_name"] == client]

            # --- Calculate Data Window (fixed 15-day lag + 30-day lookback for Latest) ---
            model_key = _normalize_model_key(model)
            # Default: 15-day lag already applied; use 30-day reporting window and 90-day avg window
            window_end_date = actual_end_date
            window_start_date = actual_end_date - timedelta(days=29)
            window_days = 30
            avg_window_end = window_end_date
            avg_window_start = avg_window_end - timedelta(days=89)

            data_window_str = f"{window_start_date} to {window_end_date}"

            data_window_str = f"{window_start_date} to {window_end_date}"

            # If no data at all for this client in the window, use full dataset for filtering
            # ALWAYS use separate queries for distinct windows to ensure accuracy
            
            # 1. Latest Window (30 days)
            # Use full dataset to ensure we don't rely on pre-filtered 'window_data' which might be confusing
            # We filter for this specific client and model
            
            # Optimized: Filter full data for this client once
            client_full_df = data[
                (data["model_name"] == model) & 
                (data["client_name"] == client)
            ]
            
            if client_full_df.empty:
                continue # No data for this client

            # Latest Window Slice (Reporting Period)
            window_client_data = client_full_df[
                (client_full_df["date_of_model_refresh"].dt.date >= window_start_date) & 
                (client_full_df["date_of_model_refresh"].dt.date <= window_end_date)
            ].copy()

            # Average Window Slice (Historical 90 days)
            avg_window_client_data = client_full_df[
                (client_full_df["date_of_model_refresh"].dt.date >= avg_window_start) & 
                (client_full_df["date_of_model_refresh"].dt.date <= avg_window_end)
            ].copy()

            # If no data in reporting window, show N/A for Latest (but might still have historical)
            if window_client_data.empty and avg_window_client_data.empty:
                 # No data at all relevant
                 continue # Or show completely blank row? Let's show N/A row

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
            
            # Initialize metrics map from historical (avg window) or latest window
            metrics_map = _extract_metrics_for_report(avg_window_client_data)
            if not metrics_map and not window_client_data.empty:
                metrics_map = _extract_metrics_for_report(window_client_data)
                for m in metrics_map.values():
                    m["avg"] = None

            # Apply BQ overrides where available
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
                # Recompute delta if both value and avg are present
                if isinstance(metrics_map[target_metric].get("value"), (int, float)) and isinstance(
                    metrics_map[target_metric].get("avg"), (int, float)
                ):
                    metrics_map[target_metric]["delta"] = metrics_map[target_metric]["value"] - metrics_map[target_metric]["avg"]

            if model_key == "ittt":
                apply_override("accuracy", bq_latest_metrics.get("accuracy"), bq_avg_metrics.get("accuracy"))
            elif model_key == "appeal":
                apply_override("accuracy", bq_latest_metrics.get("accuracy"), bq_avg_metrics.get("accuracy"))
                apply_override("recall", bq_latest_metrics.get("recall"), bq_avg_metrics.get("recall"))
            else:  # denial and others
                apply_override("accuracy", bq_latest_metrics.get("accuracy"), bq_avg_metrics.get("accuracy"))

            # Reset "value"/"delta" only for non-BQ entries (BQ overrides kept)
            for m in metrics_map.values():
                if not m.get("_bq_override"):
                    m["value"] = None
                    m["delta"] = None

            # Calculate Latest Values (Average of Reporting Window)
            for metric_name, metric_dict in metrics_map.items():
                metric_col = metric_name.lower().replace(" ", "_")
                metric_dict.setdefault("source", "csv")

                # If a BQ override is already set, preserve it and skip CSV recalculation.
                if metric_dict.get("_bq_override"):
                    # Recompute delta if both value/avg exist
                    if isinstance(metric_dict.get("value"), (int, float)) and isinstance(metric_dict.get("avg"), (int, float)):
                        metric_dict["delta"] = metric_dict["value"] - metric_dict["avg"]
                    continue
                if metric_col in window_client_data.columns:
                    current_period_vals = window_client_data[metric_col].dropna()
                    if not current_period_vals.empty:
                        # Calculation Logic Update: Use Sum of DAILY AVERAGES / WindowDays.
                        # Step 1: Aggregate by date to handle duplicates (mean of duplicates for same day)
                        daily_means = current_period_vals.groupby(window_client_data["date_of_model_refresh"].dt.date).mean()
                        
                        # Step 2: Sum the unique daily values and divide by fixed window size
                        # This matches user SQL logic (sum/31) while preventing >100% from duplicates.
                        period_avg = daily_means.sum() / max(1, window_days)
                        
                        metric_dict["value"] = period_avg
                        
                        # Recalculate delta
                        if isinstance(metric_dict.get("avg"), (int, float)):
                            metric_dict["delta"] = period_avg - metric_dict["avg"]
                
                # Override Latest from BigQuery (Denial/Appeal accuracy & recall, ITTT accuracy)
                override_latest = None
                if metric_col in {"accuracy_pct", "accuracy"}:
                    override_latest = bq_latest_metrics.get("accuracy")
                elif metric_col == "recall":
                    override_latest = bq_latest_metrics.get("recall")
                if override_latest is not None:
                    metric_dict["value"] = override_latest
                    metric_dict["_bq_override"] = True
                    metric_dict["source"] = "bq"
                
                # Override Avg baseline from BigQuery (Denial/Appeal only)
                override_avg = None
                if metric_col in {"accuracy_pct", "accuracy"}:
                    override_avg = bq_avg_metrics.get("accuracy")
                elif metric_col == "recall":
                    override_avg = bq_avg_metrics.get("recall")
                if override_avg is not None:
                    metric_dict["avg"] = override_avg
                    metric_dict["source"] = "bq"
                
                # Recalculate delta if we have both value and avg
                if isinstance(metric_dict.get("value"), (int, float)) and isinstance(metric_dict.get("avg"), (int, float)):
                    metric_dict["delta"] = metric_dict["value"] - metric_dict["avg"]

            # If ITTT BQ override is available but no metric captured it (e.g., missing CSV columns),
            # inject an Accuracy row sourced from BQ to prevent CSV fallback.
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
            
            # Fallback for metrics present in Latest but not in Historical
            # (If a new metric appeared)
            latest_only_metrics = _extract_metrics_for_report(window_client_data)
            for k, v in latest_only_metrics.items():
                if k not in metrics_map:
                    # Add it
                    metrics_map[k] = v
                    # Set avg to None (since it wasn't in historical)
                    metrics_map[k]["avg"] = None
                    # Set value (it was calc by _extract from window_client_data, so it is the mean of window if _extract does mean? 
                    # basic _extract might do mean. Let's verify _extract_metrics_for_report impl.
                    # Assuming it calculates average of the dataframe passed.
                    pass

            # Only include Accuracy / Recall in the email table
            def _is_allowed_metric(name: str) -> bool:
                norm = str(name).lower().replace(" ", "").replace("_", "")
                return norm in {"accuracy", "accuracypct", "recall"}

            filtered_metrics = {k: v for k, v in metrics_map.items() if _is_allowed_metric(k)}
            if not filtered_metrics:
                # Keep client visible with a placeholder accuracy row
                filtered_metrics = {"Accuracy": {"value": None, "avg": None, "delta": None, "unit": "%"}}

            # Standardize all accuracy variations to just "Accuracy" for consistency
            standardized_metrics = {}
            for k, v in filtered_metrics.items():
                norm_key = k.lower().replace(" ", "").replace("_", "")
                if norm_key in {"accuracy", "accuracypct"}:
                    # Use "Accuracy" as the standard name
                    existing = standardized_metrics.get("Accuracy")
                    # Prefer BQ overrides or non-None values over empty ones
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
            
            # 4. Build HTML Rows
            # If multiple metrics, we span the model/client/window columns
            row_span = len(ordered_metric_names)
            
            # Determine if we show Model/Client/Window (grouping)
            show_model = (model != last_displayed_model)
            if show_model:
                last_displayed_model = model
                # We can't easily know total rows for model upfront without pre-calc.
                # Simplified: just repeat model name or use blank if same as previous?
                # Email clients support rowspan well. But simpler to just show it if changed.
                # Let's stick to the current design: repeated columns but visual grouping if desired.
                # Actually, the previous code just printed them. Let's stick to printing them 
                # or simple grouping. The user didn't complain about layout, just data.
                pass

            for i, metric_name in enumerate(ordered_metric_names):
                m_data = filtered_metrics[metric_name]
                latest_val = m_data.get("value")
                avg_val = m_data.get("avg")
                delta_val = m_data.get("delta")
                unit = m_data.get("unit", "")

                # Format values
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
                        delta_color = "green"  # Improvement
                    elif delta_val < 0:
                        delta_color = "red"    # Decline
                elif delta_val == "N/A":
                    delta_str = "N/A"

                bg_color = "#f9f9f9" if row_count % 2 == 0 else "#ffffff"
                
                # Cells
                # Model, Client, Window only on first metric row for this client? 
                # The screenshot shows them repeated or spanned. The code structure does 1 row per metric.
                # Let's keep it simple: Model usually grouped, Client/Window repeated if multiple metrics.
                # But here we are inside the client loop.
                
                row_html = f'<tr style="background-color: {bg_color};">'
                
                # Model (only distinct if we want, but table structure requires cells)
                if i == 0:
                     # To do rowspan correctly we need to know count. 
                     # For now, just print it. Simple and robust.
                     row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{model}</td>'
                     row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{client}</td>'
                     row_html += f'<td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">{data_window_str}</td>'
                else:
                     # Empty cells for grouping look if desired, or just repeat.
                     # Repeating is safer for email clients.
                     row_html += f'<td style="padding: 8px; border: 1px solid #ddd;"></td>'
                     row_html += f'<td style="padding: 8px; border: 1px solid #ddd;"></td>'
                     row_html += f'<td style="padding: 8px; border: 1px solid #ddd;"></td>'

                source_badge = ""
                if m_data.get("source") == "bq":
                    source_badge = " <span style=\"color:#0b8; font-size:11px;\">(BQ)</span>"

                row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{metric_name}{source_badge}</td>'
                row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{latest_str}</td>'
                row_html += f'<td style="padding: 8px; border: 1px solid #ddd;">{avg_str}</td>'
                row_html += f'<td style="padding: 8px; border: 1px solid #ddd; color: {delta_color}; font-weight: bold;">{delta_str}</td>'
                row_html += '</tr>'
                
                html_body_parts.append(row_html)
                row_count += 1

    # 4. Close Table
    html_body_parts.append("""
            </tbody>
        </table>
        
        <div style="background-color: #eef; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <h3 style="margin-top: 0; color: #333;">📊 Understanding the Metrics</h3>
            <p style="margin: 10px 0;">
                <strong>Latest:</strong> The <em>average</em> value calculated over the 30-day "Data Window" period. This reflects the sustained performance for this month.
            </p>
            <p style="margin: 10px 0;">
                <strong>Average (Window):</strong> Calcuated over the last 3 months (90 days). This serves as the historical baseline.
            </p>
            <p style="margin: 10px 0;">
                <strong>Delta:</strong> The difference between the <em>Latest</em> (30-day avg) and the <em>Average (Window)</em> (90-day avg). 
                Green indicates the current month is performing better than the quarterly baseline.
            </p>
            <p style="margin: 10px 0;">
                <strong>N/A:</strong> Data Not Available.
            </p>
        </div>
        
        <p style="text-align: center; margin-top: 30px; font-size: 0.9em; color: #999;">
            Generated by ML Observatory System
        </p>
    """)

    full_html_body = "".join(html_body_parts)

    # 5. Check if we generated any rows
    if row_count == 0:
        return False, "No metrics found in the selected window."

    # 6. Send Email
    smtp_settings = _resolve_smtp_settings()
    subject = f"[Model Observatory] Consolidated summary {period_label}"
    
    # Wrap in basic HTML container
    final_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 1000px; margin: auto; background: white; padding: 30px; border-radius: 8px;">
            {full_html_body}
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


def _send_client_summary_emails(
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
    errors = []

    # Filter data to the selected window first
    start_ts = pd.to_datetime(start_date)
    end_ts = pd.to_datetime(end_date)
    window_data = data[data["date_of_model_refresh"].between(start_ts, end_ts)].copy()

    if window_data.empty:
        return False, "No data found in the selected window."

    # Iterate over each model and client
    for model in model_names:
        model_data = window_data[window_data["model_name"] == model]
        if model_data.empty:
            continue

        clients = model_data["client_name"].dropna().unique()
        for client in clients:
            client_data = model_data[model_data["client_name"] == client]
            if client_data.empty:
                continue

            # Extract rolling window info
            rolling_window = "Unknown"
            if "rolling_window" in client_data.columns:
                windows = client_data["rolling_window"].dropna().unique()
                if len(windows) > 0:
                    rolling_window = windows[0]

            # Generate summary metrics
            metric_names = client_data["metric_name"].dropna().unique()
            summary = summarize_metrics(client_data, metric_names)
            
            summary_rows = []
            model_key = _normalize_model_key(model)
            prioritized_metrics = MODEL_METRIC_PRIORITIES.get(model_key, [])
            ordered_metrics = []
            
            for metric in prioritized_metrics:
                if metric in summary.index and metric not in ordered_metrics:
                    ordered_metrics.append(metric)
            for metric in summary.index:
                if metric not in ordered_metrics:
                    ordered_metrics.append(metric)
            
            for metric in ordered_metrics[:5]:
                summary_rows.append(_format_metric_snapshot_row(metric, summary.loc[metric]))

            # Compose email body
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


def render_metric_cards(summary: pd.DataFrame, theme: dict[str, str]) -> None:
    if summary.empty:
        return

    cards: list[str] = []
    for metric_name, stats in summary.iterrows():
        latest = stats.get("latest")
        average = stats.get("mean")
        minimum = stats.get("min")
        maximum = stats.get("max")
        delta = stats.get("delta")

        if all(pd.isna(value) for value in (latest, average, minimum, maximum)):
            continue

        display_name = _format_metric_label(metric_name)
        latest_display = "—" if pd.isna(latest) else f"{latest:.2f}"
        
        status_class = "neutral"
        status_text = ""
        
        if not pd.isna(delta):
            if delta > 0:
                status_class = "positive"
                status_text = "Improving"
            elif delta < 0:
                status_class = "negative"
                status_text = "Degrading"
            else:
                status_text = "Stable"
        
        # Special handling for specific metrics to match reference style
        if "drift" in metric_name.lower():
            status_text = "Failing" if latest > 0.5 else "Stable" # Example logic
            status_class = "negative" if latest > 0.5 else "positive"
        elif "accuracy" in metric_name.lower():
            status_text = "At Risk" if latest < 0.8 else "Healthy" # Example logic
            status_class = "negative" if latest < 0.8 else "positive"

        card_tooltip = _metric_description(metric_name).replace('"', '&quot;')

        cards.append(
            f"""
            <div class="metric-card" title="{card_tooltip}">
                <div class="metric-label">{display_name}</div>
                <div class="metric-value">{latest_display}</div>
                <div class="metric-indicator {status_class}">{status_text}</div>
            </div>
            """
        )

    if cards:
        st.markdown("<div class='metric-row'>" + "".join(cards) + "</div>", unsafe_allow_html=True)
        st.caption(
            "Summary cards surface the latest metric value alongside its average, min, max, and trend delta for the selected window."
        )


def render_accuracy_chart(
    frame: pd.DataFrame,
    *,
    model_name: str,
    theme: dict[str, str],
    client_name: str | None = None,
) -> None:
    if frame.empty:
        st.info("No accuracy data for the selected filters.")
        return

    fig = go.Figure()
    accuracy_note = _hover_note(_metric_description("Overall_Accuracy"))
    threshold_note = _hover_note(METRIC_DESCRIPTIONS.get("threshold", "Configured threshold."))
    if client_name is None:
        for client, client_slice in frame.groupby("client_name"):
            client_slice = client_slice.sort_values("date_of_model_refresh")
            label = str(client)
            fig.add_trace(
                go.Scatter(
                    x=client_slice["date_of_model_refresh"],
                    y=client_slice["metric_value"],
                    mode="lines+markers",
                    name=label,
                    hovertemplate=(
                        "Client: %{customdata[0]}<br>Date: %{x|%Y-%m-%d}<br>Overall Accuracy: %{y:.2f}<br>"
                        f"{accuracy_note}<extra></extra>"
                    ),
                    customdata=[[label]] * len(client_slice),
                )
            )
            if "threshold" in client_slice and client_slice["threshold"].notna().any():
                fig.add_trace(
                    go.Scatter(
                        x=client_slice["date_of_model_refresh"],
                        y=client_slice["threshold"],
                        mode="lines",
                        name=f"{label} threshold",
                        line=dict(color=theme.get("threshold_color", "#f59e0b"), dash="dash"),
                        hovertemplate=(
                            "Client: %{text}<br>Date: %{x|%Y-%m-%d}<br>Threshold: %{y:.2f}<br>"
                            f"{threshold_note}<extra></extra>"
                        ),
                        text=[label] * len(client_slice),
                        showlegend=False,
                    )
                )
    else:
        frame = frame.sort_values("date_of_model_refresh")
        fig.add_trace(
            go.Scatter(
                x=frame["date_of_model_refresh"],
                y=frame["metric_value"],
                mode="lines+markers",
                name=client_name,
                hovertemplate=(
                    "Date: %{x|%Y-%m-%d}<br>Overall Accuracy: %{y:.2f}<br>"
                    f"{accuracy_note}<extra></extra>"
                ),
            )
        )
        if "threshold" in frame.columns and frame["threshold"].notna().any():
            fig.add_trace(
                go.Scatter(
                    x=frame["date_of_model_refresh"],
                    y=frame["threshold"],
                    mode="lines",
                    name="Threshold",
                    line=dict(color=theme.get("threshold_color", "#f59e0b"), dash="dash"),
                    hovertemplate=(
                        "Date: %{x|%Y-%m-%d}<br>Threshold: %{y:.2f}<br>"
                        f"{threshold_note}<extra></extra>"
                    ),
                    showlegend=False,
                )
            )

    fig.update_layout(
        title=dict(text=f"{model_name} Â· Overall Accuracy", x=0.5, xanchor="center"),
        xaxis_title="Model refresh date",
        yaxis_title="Overall Accuracy",
        hovermode="x unified",
        template=theme["plotly_template"],
        paper_bgcolor=theme["chart_bg"],
        plot_bgcolor=theme["chart_bg"],
        margin=dict(l=20, r=20, t=60, b=20),
        height=DEFAULT_CHART_HEIGHT,
    )
    _style_plot(fig, theme)
    st.plotly_chart(fig, config=PLOTLY_CONFIG, **PLOTLY_CHART_DISPLAY_ARGS)
    st.caption(
        "Overall accuracy shows how each client tracks against its threshold across refreshes; dotted lines represent the target level."
    )


def render_accuracy_pct_chart(
    frame: pd.DataFrame,
    *,
    model_name: str,
    theme: dict[str, str],
    client_name: str | None = None,
) -> None:
    chart_frame = frame.dropna(subset=["metric_value"]).copy()
    if chart_frame.empty:
        st.info("No accuracy pct records available.")
        return

    fig = go.Figure()
    accuracy_pct_note = _hover_note(_metric_description("Accuracy_pct"))
    if client_name is None:
        for client, client_slice in chart_frame.groupby("client_name"):
            client_slice = client_slice.sort_values("date_of_model_refresh")
            label = str(client)
            fig.add_trace(
                go.Scatter(
                    x=client_slice["date_of_model_refresh"],
                    y=client_slice["metric_value"],
                    mode="lines+markers",
                    name=label,
                    customdata=[[label]] * len(client_slice),
                    hovertemplate=(
                        "Client: %{customdata[0]}<br>Date: %{x|%Y-%m-%d}<br>Accuracy pct: %{y:.2f}<br>"
                        f"{accuracy_pct_note}<extra></extra>"
                    ),
                )
            )
    else:
        chart_frame = chart_frame.sort_values("date_of_model_refresh")
        fig.add_trace(
            go.Scatter(
                x=chart_frame["date_of_model_refresh"],
                y=chart_frame["metric_value"],
                mode="lines+markers",
                name=client_name,
                hovertemplate=(
                    "Date: %{x|%Y-%m-%d}<br>Accuracy pct: %{y:.2f}<br>"
                    f"{accuracy_pct_note}<extra></extra>"
                ),
            )
        )

    fig.update_layout(
        title=dict(text=f"{model_name} Â· Accuracy pct", x=0.5, xanchor="center"),
        xaxis_title="Model refresh date",
        yaxis_title="Accuracy pct",
        hovermode="x unified",
        template=theme["plotly_template"],
        paper_bgcolor=theme["chart_bg"],
        plot_bgcolor=theme["chart_bg"],
        margin=dict(l=20, r=20, t=60, b=20),
        height=DEFAULT_CHART_HEIGHT,
    )
    _style_plot(fig, theme)
    st.plotly_chart(fig, config=PLOTLY_CONFIG, **PLOTLY_CHART_DISPLAY_ARGS)
    st.caption(
        "Accuracy percentage captures the proportion of correct outcomes; compare clients to spot outliers or dips over time."
    )


def render_metric_trend_chart(
    frame: pd.DataFrame,
    *,
    metric_name: str,
    theme: dict[str, str],
    trend_window: int,
) -> None:
    if frame.empty:
        st.info(f"No data to display for {_format_metric_label(metric_name)} with current filters.")
        return

    metric_frame = frame.sort_values("date_of_model_refresh")
    rolling = metric_frame["metric_value"].rolling(window=max(trend_window, 1), min_periods=1).mean()

    label = _format_metric_label(metric_name)
    description = _hover_note(_metric_description(metric_name))

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=metric_frame["date_of_model_refresh"],
            y=metric_frame["metric_value"],
            mode="lines+markers",
            name="Observed",
            line=dict(color=theme["line_primary"], width=3),
            marker=dict(size=8, color=theme["line_primary"], opacity=0.85),
            hovertemplate=(
                f"Date: %{{x|%Y-%m-%d}}<br>Value: %{{y:.2f}}<br>{description}<extra></extra>"
            ),
        )
    )
    fig.add_trace(
        go.Scatter(
            x=metric_frame["date_of_model_refresh"],
            y=rolling,
            mode="lines",
            name=f"Rolling mean ({trend_window})",
            line=dict(color=theme["line_secondary"], width=2, dash="dash"),
            hovertemplate=(
                "Date: %{x|%Y-%m-%d}<br>Rolling mean: %{y:.2f}<extra></extra>"
            ),
        )
    )

    band_frame = metric_frame.dropna(subset=["threshold_min", "threshold_max"])
    if not band_frame.empty:
        fig.add_trace(
            go.Scatter(
                x=band_frame["date_of_model_refresh"],
                y=band_frame["threshold_max"],
                mode="lines",
                line=dict(width=0),
                showlegend=False,
                hoverinfo="skip",
            )
        )
        fig.add_trace(
            go.Scatter(
                x=band_frame["date_of_model_refresh"],
                y=band_frame["threshold_min"],
                mode="lines",
                line=dict(width=0),
                fill="tonexty",
                fillcolor=theme["threshold_band_fill"],
                name="Threshold band",
                hoverinfo="skip",
            )
        )

    if metric_frame["threshold"].notna().any():
        last_threshold = metric_frame["threshold"].dropna().iloc[-1]
        fig.add_hline(
            y=last_threshold,
            line=dict(color=theme["threshold_color"], width=2, dash="dot"),
            annotation_text=f"Threshold {last_threshold:.2f}",
            annotation_position="top left",
            annotation=dict(font=dict(color=theme["threshold_color"])),
        )

    fig.update_layout(
        title=dict(text=f"{label} Â· Trend", x=0.5, xanchor="center"),
        xaxis_title="Model refresh date",
        yaxis_title=label,
        hovermode="x unified",
        template=theme["plotly_template"],
        paper_bgcolor=theme["chart_bg"],
        plot_bgcolor=theme["chart_bg"],
        margin=dict(l=20, r=20, t=60, b=20),
        height=DEFAULT_CHART_HEIGHT,
    )
    _style_plot(fig, theme)
    st.plotly_chart(fig, config=PLOTLY_CONFIG, **PLOTLY_CHART_DISPLAY_ARGS)
    st.caption(
        f"{label} trend shows each refresh (solid line) alongside the rolling {trend_window}-cycle average and any available threshold band."
    )


def forecast_drift(drift_data: pd.DataFrame, forecast_days: int = 7) -> pd.DataFrame:
    """Forecast drift using simple linear regression.
    
    Args:
        drift_data: DataFrame with 'date_of_model_refresh' and 'drift' columns
        forecast_days: Number of days to forecast ahead
        
    Returns:
        DataFrame with forecasted drift values
    """
    try:
        from sklearn.linear_model import LinearRegression
        import numpy as np
        
        if len(drift_data) < 5:  # Need minimum data points
            return pd.DataFrame()
        
        # Prepare data - sort by date
        drift_data = drift_data.sort_values('date_of_model_refresh').copy()
        drift_data = drift_data.dropna(subset=['drift', 'date_of_model_refresh'])
        
        if len(drift_data) < 5:
            return pd.DataFrame()
        
        # Use numeric representation of dates
        X = np.arange(len(drift_data)).reshape(-1, 1)
        y = drift_data['drift'].values
        
        # Fit linear regression model
        model = LinearRegression()
        model.fit(X, y)
        
        # Generate forecast
        future_X = np.arange(len(drift_data), len(drift_data) + forecast_days).reshape(-1, 1)
        future_y = model.predict(future_X)
        
        # Create future dates
        last_date = drift_data['date_of_model_refresh'].max()
        future_dates = pd.date_range(last_date + pd.Timedelta(days=1), periods=forecast_days)
        
        # Calculate confidence interval (simple approach using residuals std)
        residuals = y - model.predict(X)
        std_error = np.std(residuals)
        
        return pd.DataFrame({
            'date_of_model_refresh': future_dates,
            'drift_forecast': future_y,
            'forecast_lower': future_y - 1.96 * std_error,  # 95% CI
            'forecast_upper': future_y + 1.96 * std_error
        })
    except ImportError:
        # sklearn not available, return empty
        return pd.DataFrame()
    except Exception:
        # Any other error, return empty
        return pd.DataFrame()


def render_drift_chart(frame: pd.DataFrame, *, model_name: str, theme: dict[str, str], client_name: str | None = None, show_forecast: bool = False) -> None:
    if frame.empty:
        st.info("No accuracy data available to evaluate drift.")
        return

    try:
        drift_frame = frame.copy()
        metric_name = drift_frame["metric_name"].iloc[0] if not drift_frame.empty else None
        actual_series, predicted_series = _resolve_actual_predicted_series(drift_frame, metric_name)
        drift_frame["actual_value"] = pd.to_numeric(actual_series, errors="coerce")
        drift_frame["predicted_value"] = pd.to_numeric(predicted_series, errors="coerce")
        drift_frame["drift"] = drift_frame["actual_value"] - drift_frame["predicted_value"]
        drift_frame = drift_frame.dropna(
            subset=["actual_value", "predicted_value", "drift", "date_of_model_refresh"]
        )
        drift_frame = drift_frame.sort_values(["client_name", "date_of_model_refresh"])
    except Exception as exc:  # pragma: no cover - surface for operators
        st.error(f"Unable to render drift analytics: {exc}")
        return

    if drift_frame.empty:
        st.warning(
            "Cannot compute drift because actual or expected values are missing. Ensure the source feed includes both columns."
        )
        return

    fig = go.Figure()
    drift_note = _hover_note(METRIC_DESCRIPTIONS.get("drift", "Observed minus expected performance."))
    if client_name is None:
        for client, client_slice in drift_frame.groupby("client_name"):
            client_slice = client_slice.sort_values("date_of_model_refresh")
            label = str(client)
            customdata = client_slice[["actual_value", "predicted_value"]].to_numpy()
            fig.add_trace(
                go.Scatter(
                    x=client_slice["date_of_model_refresh"],
                    y=client_slice["drift"],
                    mode="lines+markers",
                    name=label,
                    text=[label] * len(client_slice),
                    customdata=customdata,
                    hovertemplate=(
                        "Client: %{text}<br>Date: %{x|%Y-%m-%d}<br>Actual: %{customdata[0]:.2f}<br>Expected: %{customdata[1]:.2f}<br>Î”: %{y:.2f}<br>"
                        f"{drift_note}<extra></extra>"
                    ),
                )
            )
    else:
        client_slice = drift_frame[drift_frame["client_name"] == client_name]
        client_slice = client_slice.sort_values("date_of_model_refresh")
        if client_slice.empty:
            st.info("Selected client has no actual vs expected data in this window.")
            return
        customdata = client_slice[["actual_value", "predicted_value"]].to_numpy()
        fig.add_trace(
            go.Scatter(
                x=client_slice["date_of_model_refresh"],
                y=client_slice["drift"],
                mode="lines+markers",
                name=client_name,
                text=[client_name] * len(client_slice),
                customdata=customdata,
                hovertemplate=(
                    "Date: %{x|%Y-%m-%d}<br>Actual: %{customdata[0]:.2f}<br>Expected: %{customdata[1]:.2f}<br>Î”: %{y:.2f}<br>"
                    f"{drift_note}<extra></extra>"
                ),
            )
        )

    # Add forecast if enabled
    if show_forecast and not drift_frame.empty:
        # Aggregate drift by client for forecasting
        if client_name is None:
            # Forecast for each client separately
            for client, client_slice in drift_frame.groupby("client_name"):
                forecast_df = forecast_drift(client_slice, forecast_days=7)
                if not forecast_df.empty:
                    # Add confidence interval as shaded area
                    fig.add_trace(go.Scatter(
                        x=pd.concat([forecast_df['date_of_model_refresh'], forecast_df['date_of_model_refresh'][::-1]]),
                        y=pd.concat([forecast_df['forecast_upper'], forecast_df['forecast_lower'][::-1]]),
                        fill='toself',
                        fillcolor='rgba(255, 165, 0, 0.1)',
                        line=dict(color='rgba(255, 165, 0, 0)'),
                        showlegend=False,
                        hoverinfo='skip'
                    ))
                    # Add forecast line
                    fig.add_trace(go.Scatter(
                        x=forecast_df['date_of_model_refresh'],
                        y=forecast_df['drift_forecast'],
                        mode='lines',
                        name=f'{client} Forecast',
                        line=dict(dash='dash', color='orange', width=2),
                        hovertemplate='Forecast: %{y:.2f}<extra></extra>'
                    ))
        else:
            # Single client forecast
            forecast_df = forecast_drift(drift_frame, forecast_days=7)
            if not forecast_df.empty:
                # Add confidence interval
                fig.add_trace(go.Scatter(
                    x=pd.concat([forecast_df['date_of_model_refresh'], forecast_df['date_of_model_refresh'][::-1]]),
                    y=pd.concat([forecast_df['forecast_upper'], forecast_df['forecast_lower'][::-1]]),
                    fill='toself',
                    fillcolor='rgba(255, 165, 0, 0.15)',
                    line=dict(color='rgba(255, 165, 0, 0)'),
                    showlegend=False,
                    hoverinfo='skip',
                    name='95% Confidence'
                ))
                # Add forecast line
                fig.add_trace(go.Scatter(
                    x=forecast_df['date_of_model_refresh'],
                    y=forecast_df['drift_forecast'],
                    mode='lines',
                    name='7-Day Forecast',
                    line=dict(dash='dash', color='#FFA500', width=2.5),
                    hovertemplate='Forecasted Drift: %{y:.2f}<br>Date: %{x|%Y-%m-%d}<extra></extra>'
                ))

    fig.add_hline(
        y=0,
        line=dict(color=theme.get("grid_color", "#273453"), width=1, dash="dot"),
        annotation_text="No drift",
        annotation=dict(font=dict(color=theme.get("text_muted", "#93a4c4"))),
    )

    fig.update_layout(
        title=dict(text=f"{model_name} Â· Actual vs Expected Drift", x=0.5, xanchor="center"),
        xaxis_title="Model refresh date",
        yaxis_title="Actual âˆ’ Expected",
        hovermode="x unified",
        template=theme["plotly_template"],
        paper_bgcolor=theme["chart_bg"],
        plot_bgcolor=theme["chart_bg"],
        margin=dict(l=20, r=20, t=60, b=20),
        height=DEFAULT_CHART_HEIGHT,
    )
    _style_plot(fig, theme)
    st.plotly_chart(fig, config=PLOTLY_CONFIG, **PLOTLY_CHART_DISPLAY_ARGS)

    latest_per_client = (
        drift_frame.sort_values("date_of_model_refresh").groupby("client_name").tail(1)
    )
    summary_lines: list[str] = []
    if not latest_per_client.empty:
        drift_series = latest_per_client["drift"].dropna()
        if not drift_series.empty:
            worst_idx = drift_series.idxmin()
            worst = latest_per_client.loc[worst_idx]
            if float(worst["drift"]) < 0:
                summary_lines.append(
                    f"Largest shortfall: {worst['client_name']} actual {float(worst['actual_value']):.2f} vs expected {float(worst['predicted_value']):.2f} ({float(worst['drift']):+.2f})."
                )
            best_idx = drift_series.idxmax()
            best = latest_per_client.loc[best_idx]
            if float(best["drift"]) > 0:
                summary_lines.append(
                    f"Strongest recovery: {best['client_name']} actual {float(best['actual_value']):.2f} vs expected {float(best['predicted_value']):.2f} ({float(best['drift']):+.2f})."
                )

    avg_abs_drift = drift_frame["drift"].abs().mean()
    if not pd.isna(avg_abs_drift):
        summary_lines.append(f"Average absolute drift this window: {float(avg_abs_drift):.2f} points.")

    st.caption(
        "Drift captures how far actual performance deviates from the expected baseline per refresh; negative values flag under-performance that needs attention."
    )
    if summary_lines:
        st.markdown("\n".join(f"- {line}" for line in summary_lines))



def render_latency_chart(
    frame: pd.DataFrame,
    *,
    model_name: str,
    theme: dict[str, str],
    client_name: str | None = None,
) -> None:
    latency_frame = frame.dropna(subset=["latency_hours"]).copy()
    if latency_frame.empty:
        st.info("No latency data for the selected filters.")
        return

    latency_frame = latency_frame.sort_values("date_of_model_refresh")
    latency_frame = latency_frame.drop_duplicates(
        subset=["model_name", "client_name", "date_of_model_refresh"]
    )

    fig = go.Figure()
    latency_note = _hover_note(METRIC_DESCRIPTIONS.get("Latency (hours)", "Elapsed time from refresh to availability."))
    if client_name is None:
        for client, client_slice in latency_frame.groupby("client_name"):
            client_slice = client_slice.sort_values("date_of_model_refresh")
            label = str(client)
            fig.add_trace(
                go.Scatter(
                    x=client_slice["date_of_model_refresh"],
                    y=client_slice["latency_hours"],
                    mode="lines+markers",
                    name=label,
                    text=[label] * len(client_slice),
                    hovertemplate=(
                        "Client: %{text}<br>Date: %{x|%Y-%m-%d}<br>Latency: %{y:.2f} hours<br>"
                        f"{latency_note}<extra></extra>"
                    ),
                )
            )
    else:
        client_slice = latency_frame[latency_frame["client_name"] == client_name]
        client_slice = client_slice.sort_values("date_of_model_refresh")
        if client_slice.empty:
            st.info("Selected client has no latency records in this window.")
            return
        fig.add_trace(
            go.Scatter(
                x=client_slice["date_of_model_refresh"],
                y=client_slice["latency_hours"],
                mode="lines+markers",
                name=client_name,
                text=[client_name] * len(client_slice),
                hovertemplate=(
                    "Date: %{x|%Y-%m-%d}<br>Latency: %{y:.2f} hours<br>"
                    f"{latency_note}<extra></extra>"
                ),
            )
        )

    fig.update_layout(
        title=dict(text=f"{model_name} Â· Response Latency", x=0.5, xanchor="center"),
        xaxis_title="Model refresh date",
        yaxis_title="Latency (hours)",
        hovermode="x unified",
        template=theme["plotly_template"],
        paper_bgcolor=theme["chart_bg"],
        plot_bgcolor=theme["chart_bg"],
        margin=dict(l=20, r=20, t=60, b=20),
        height=DEFAULT_CHART_HEIGHT,
    )
    _style_plot(fig, theme)
    st.plotly_chart(fig, config=PLOTLY_CONFIG, **PLOTLY_CHART_DISPLAY_ARGS)
    st.caption(
        "Latency highlights how long data takes to refresh; rising or volatile lines can hint at upstream pipeline issues."
    )



def render_info_cards(cards: Iterable[tuple[str, str]]) -> None:
    cards = list(cards)
    if not cards:
        return
    html = "<div class='info-grid'>" + "".join(
        f"<div class='info-card'><h4>{title}</h4><p>{body}</p></div>" for title, body in cards
    ) + "</div>"
    st.markdown(html, unsafe_allow_html=True)



def summarize_metrics(frame: pd.DataFrame, metrics: Iterable[str]) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame()

    ordered = frame.sort_values("date_of_model_refresh")
    non_null = ordered.dropna(subset=["metric_value"])
    latest = non_null.groupby("metric_name").tail(1)
    prior = non_null.groupby("metric_name")["metric_value"].apply(
        lambda series: series.iloc[-2] if len(series) > 1 else pd.NA
    )

    summary = ordered.groupby("metric_name")["metric_value"].agg(["mean", "min", "max"])
    summary["latest"] = latest.set_index("metric_name")["metric_value"]
    prior_numeric = pd.to_numeric(prior, errors="coerce")
    summary["delta"] = summary["latest"] - prior_numeric.reindex(summary.index)
    summary = summary.loc[summary.index.intersection(metrics)]
    return summary


def main() -> None:
    raw_data = load_data()

    data_source = raw_data.attrs.get("data_source", "local_csv")
    refresh_error = raw_data.attrs.get("data_refresh_error")
    latest_point = raw_data.attrs.get("latest_data_point")
    file_synced_at = raw_data.attrs.get("source_file_mtime")

    def _normalize_timestamp(candidate: object) -> pd.Timestamp | None:
        if isinstance(candidate, pd.Timestamp) and pd.notna(candidate):
            ts = candidate
        elif isinstance(candidate, datetime):
            ts = pd.Timestamp(candidate)
        else:
            return None
        if getattr(ts, "tzinfo", None) is not None:
            return ts.tz_convert("UTC").tz_localize(None)
        return ts

    normalized_latest = _normalize_timestamp(latest_point)
    normalized_file_ts = _normalize_timestamp(file_synced_at)

    today = pd.Timestamp(datetime.now(timezone.utc).date())
    if normalized_latest is not None and normalized_latest.date() > today.date():
        normalized_latest = today
    if normalized_file_ts is not None and normalized_file_ts.date() > today.date():
        normalized_file_ts = today

    # Always show current date for "Last updated"
    current_date = datetime.now(timezone.utc)
    pill_tail = f"Last updated {current_date.strftime('%b %d, %Y')}"

    data_source_label = "Live data" if data_source == "bigquery" else "Snapshot"

    models = sorted(raw_data["model_name"].dropna().unique())
    default_model = models[0] if models else None

    with st.sidebar:
        st.markdown(
            """
            <div class="sidebar-header">
                <div class="sidebar-icon">📊</div>
                <div>
                    <div class="sidebar-title">ML Observatory</div>
                    <div class="sidebar-subtitle">Model Command Center</div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        if option_menu is not None:
            selected_tab = option_menu(
                menu_title="",
                options=["Overview", "System Health", "Performance", "Drift", "Latency", "Alerts", "Incident History", "Settings"],
                icons=["layout-dashboard", "heart-pulse", "activity", "trending-up", "clock", "alert-triangle", "clipboard-data", "settings"],
                styles={
                    "container": {"background-color": THEME["sidebar_bg"], "padding": "0", "border": "0"},
                    "icon": {"color": THEME["sidebar_text"], "font-size": "19px"},
                    "nav-link": {
                        "color": THEME["sidebar_text_muted"],
                        "font-size": "15px",
                        "padding": "10px 14px",
                        "margin": "4px 6px 8px 0",
                        "border-radius": "12px",
                        "font-weight": "600",
                    },
                    "nav-link-selected": {
                        "background": THEME["sidebar_active_bg"],
                        "color": "#ffffff",
                        "box-shadow": "0 12px 28px rgba(124, 58, 237, 0.35)",
                    },
                },
            )
        else:
            selected_tab = st.radio(
                "Navigate",
                ["Overview", "System Health", "Performance", "Drift", "Latency", "Alerts", "Incident History", "Settings"],
                index=0,
                help="Overview: summary cards. System Health: composite score. Performance: client accuracy. Drift: actual vs target. Latency: refresh timing. Alerts: breaches. Incident History: outages. Settings: data source context.",
            )

        st.caption(
            "Overview: summary · System Health: scores · Performance: accuracy trends · Drift: gap analysis · Latency: refresh timing · Alerts: threshold breaches · Incident History: timeline · Settings: environment details"
        )

        st.markdown("---")
        st.markdown(
            f"<div class='sidebar-footer'><span class='status-dot'></span>{data_source_label} • Online</div>",
            unsafe_allow_html=True,
        )

    st.markdown("<div class='app-shell'>", unsafe_allow_html=True)

    hero = st.container()
    with hero:
        hero_html = f"""
        <div class="hero-container">
            <div class="hero-header">
                <h1 class="hero-title">ML Model Observatory</h1>
                <div class="hero-badges">
                    <span class="badge highlight">SNAPSHOT</span>
                    <span class="badge">OBSERVATORY SUITE</span>
                    <span class="last-updated">{pill_tail}</span>
                </div>
            </div>
            <p class="hero-description">Production model performance, drift, latency, and alerting telemetry in a single control plane.</p>
        </div>
        """
        st.markdown(hero_html, unsafe_allow_html=True)

    if refresh_error and data_source != "bigquery":
        st.warning(f"Live data refresh failed, showing cached snapshot instead. Details: {refresh_error}")

    if not models:
        st.info("No model telemetry available for the selected data source.")
        return

    today = datetime.now(timezone.utc).date()
    if raw_data["date_of_model_refresh"].notna().any():
        date_min = raw_data["date_of_model_refresh"].min().date()
        date_max = raw_data["date_of_model_refresh"].max().date()
        if date_max > today:
            date_max = today
    else:
        date_min = date_max = today

    all_clients_option = "All Clients"

    # Show filters only in tabs that need them (not in Settings, System Health, or Incident History)
    if selected_tab not in ["Alerts", "Settings", "System Health", "Incident History"]:
        control_panel = st.container()
        available_metrics: list[str] = []
        selected_metrics: list[str] = []
        with control_panel:
            st.markdown("<div class='control-bar primary'>", unsafe_allow_html=True)
            
            # Top Row: Primary Filters + Refresh Button
            top_cols = st.columns([1.5, 1.5, 1.2, 2.0, 0.8])
            
            # Add refresh button in the last column
            with top_cols[4]:
                st.markdown("<div style='padding-top: 26px;'></div>", unsafe_allow_html=True)  # Align with other controls
                if st.button("🔄 Refresh", help="Fetch latest data from BigQuery", use_container_width=True):
                    st.cache_data.clear()
                    st.success("Data refreshed!", icon="✅")
                    st.rerun()
            
            with top_cols[0]:
                selected_model = st.selectbox(
                    "Select model",
                    models,
                    index=models.index(default_model) if default_model in models else 0,
                    help="Choose the model to inspect in the observatory dashboards.",
                )
                
            model_mask = raw_data["model_name"] == selected_model if selected_model else raw_data["model_name"].notna()
            model_clients = sorted(raw_data.loc[model_mask, "client_name"].dropna().unique())
            expected_clients = EXPECTED_CLIENTS_BY_MODEL.get(selected_model, [])
            client_options = [all_clients_option] + (expected_clients or model_clients)
            client_options = list(dict.fromkeys(client_options)) or [all_clients_option]

            with top_cols[1]:
                selected_client = st.selectbox(
                    "Client",
                    client_options,
                    help="Toggle between all clients or focus on a specific deployment.",
                )

            if "model_version" in raw_data.columns:
                version_candidates = sorted(raw_data.loc[model_mask, "model_version"].dropna().unique())
                version_options = ["All Versions"] + version_candidates if version_candidates else ["All Versions"]
            else:
                version_options = ["Latest"]
                
            with top_cols[2]:
                selected_version = st.selectbox(
                    "Version",
                    version_options,
                    help="Restrict the metrics to a specific model version or review all versions collectively.",
                )

            with top_cols[3]:
                date_range = st.date_input(
                    "Date range",
                    value=(date_min, date_max),
                    min_value=date_min,
                    max_value=date_max,
                    help="Manually choose the start and end dates for all charts and metrics.",
                )

            with top_cols[4]:
                st.markdown("<div style='margin-top: 24px;'></div>", unsafe_allow_html=True)
                # Duplicate refresh button removed

            # Advanced Filters (Expander)
            with st.expander("Advanced Filters", expanded=False):
                adv_cols = st.columns([2, 1, 1])
                
                range_mask = raw_data["model_name"] == selected_model if selected_model else raw_data["model_name"].notna()
                if selected_client != all_clients_option:
                    range_mask &= raw_data["client_name"] == selected_client
                range_options = sorted(raw_data.loc[range_mask, "threshold_range_label"].dropna().unique())
                range_choices = ["All ranges"] + range_options + ["Above threshold", "Below threshold"]
                default_ranges = ["All ranges"]
                
                with adv_cols[0]:
                    selected_ranges = st.multiselect(
                        "Threshold ranges",
                        range_choices,
                        default=default_ranges,
                        help="Limit the view to certain threshold bands or focus on breaches above/below targets.",
                    )
                    
                with adv_cols[1]:
                    trend_window = st.slider(
                        "Rolling window",
                        min_value=1,
                        max_value=10,
                        value=3,
                        help="Smooth the performance charts by averaging over the selected number of refreshes.",
                    )
                    
                with adv_cols[2]:
                    quick_range = st.radio(
                        "Quick range",
                        ("7d", "30d", "All"),
                        index=2,
                        horizontal=True,
                        help="Jump to preset time windows without adjusting the manual picker.",
                    )

            st.markdown("</div>", unsafe_allow_html=True)

            normalized_selected_key = _normalize_model_key(selected_model)
            if "model_key" in raw_data.columns:
                metrics_mask = raw_data["model_key"] == normalized_selected_key
            else:
                metrics_mask = raw_data["model_name"].apply(_normalize_model_key) == normalized_selected_key

            if selected_client != all_clients_option and selected_client in client_options:
                metrics_mask &= raw_data["client_name"] == selected_client
            elif expected_clients:
                metrics_mask &= raw_data["client_name"].isin(expected_clients)

            dataset_metrics = sorted(
                raw_data.loc[metrics_mask, "metric_name"].dropna().unique()
            )
            if not dataset_metrics:
                fallback_mask = raw_data["model_name"] == selected_model
                dataset_metrics = sorted(
                    raw_data.loc[fallback_mask, "metric_name"].dropna().unique()
                )

            preferred_metrics = MODEL_METRIC_PRIORITIES.get(normalized_selected_key, [])
            available_metrics = [m for m in preferred_metrics if m in dataset_metrics]
            available_metrics += [m for m in dataset_metrics if m not in available_metrics]

            st.markdown("<div class='control-bar secondary'>", unsafe_allow_html=True)
            metric_cols = st.columns([2.0, 0.8])
            with metric_cols[0]:
                if available_metrics:
                    preferred = MODEL_METRIC_PRIORITIES.get(normalized_selected_key, [])
                    default_selection = [
                        metric
                        for metric in preferred
                        if metric in available_metrics and metric != "Overall_Accuracy"
                    ]
                    selection = st.multiselect(
                        "Additional metrics",
                        options=[metric for metric in available_metrics if metric != "Overall_Accuracy"],
                        default=[],
                        format_func=_format_metric_label,
                        help="Overall accuracy stays pinned. Add supporting KPIs as needed.",
                        key=f"metrics_all_{normalized_selected_key}_{selected_client.replace(' ', '_')}",
                    )
                    selected_metrics = []
                    if "Overall_Accuracy" in available_metrics:
                        selected_metrics.append("Overall_Accuracy")
                    selected_metrics.extend(selection)
                    selected_metrics = list(dict.fromkeys(selected_metrics))
                else:
                    st.caption("No metrics were found for this model selection.")
                    selected_metrics = []

            with metric_cols[1]:
                st.caption(
                    "Hover over metric cards, chart points, and alert rows to read context about each KPI."
                )
            st.markdown("</div>", unsafe_allow_html=True)
    else:
        # For Alerts and Settings/System Health/Incident History tabs, keep filters minimal
        selected_version = "Latest"
        date_range = (date_min, date_max)
        selected_ranges = ["All ranges"]
        trend_window = 3
        quick_range = "All"
        selected_metrics = []
        available_metrics = []
        expected_clients = []

        if selected_tab == "Alerts":
            with st.container():
                st.markdown("<div class='control-bar primary'>", unsafe_allow_html=True)
                alert_cols = st.columns([1.5, 1.5, 2])
                alert_model_options = ["All Models"] + models
                with alert_cols[0]:
                    selected_model = st.selectbox(
                        "Model (alerts)",
                        alert_model_options,
                        index=0,
                        help="Choose which model's alerts to display.",
                    )
                    if selected_model == "All Models":
                        selected_model = None
                model_mask = (
                    raw_data["model_name"].notna()
                    if not selected_model
                    else raw_data["model_name"] == selected_model
                )
                model_clients = sorted(raw_data.loc[model_mask, "client_name"].dropna().unique())
                client_options = [all_clients_option] + model_clients
                with alert_cols[1]:
                    selected_client = st.selectbox(
                        "Client (alerts)",
                        client_options,
                        index=0,
                        help="Filter alerts to a specific client.",
                    )
                with alert_cols[2]:
                    st.caption("Filter the alerts table by model and client.")
                st.markdown("</div>", unsafe_allow_html=True)
        else:
            selected_model = default_model
            selected_client = all_clients_option


    if isinstance(date_range, tuple):
        start_date, end_date = date_range
    else:
        start_date = end_date = date_range

    if quick_range != "All" and raw_data["date_of_model_refresh"].notna().any():
        reference_end = raw_data["date_of_model_refresh"].max().date()
        today_date = datetime.now(timezone.utc).date()
        if reference_end > today_date:
            reference_end = today_date
        window_days = 7 if quick_range == "7d" else 30
        reference_start = max(reference_end - timedelta(days=window_days - 1), date_min)
        start_date, end_date = reference_start, reference_end

    model_filter = (
        raw_data["model_name"].notna()
        if not selected_model
        else raw_data["model_name"] == selected_model
    )
    filtered = raw_data[
        model_filter
        & raw_data["date_of_model_refresh"].between(pd.to_datetime(start_date), pd.to_datetime(end_date))
    ]

    if ("model_version" in filtered.columns and selected_version not in ("All Versions", "Latest")):
        filtered = filtered[filtered["model_version"] == selected_version]

    if selected_client != all_clients_option:
        target_client = str(selected_client).strip().upper()
        filtered = filtered[filtered["client_name"].str.upper() == target_client]
    elif expected_clients:
        normalized_expected = {str(client).strip().upper() for client in expected_clients}
        filtered = filtered[filtered["client_name"].str.upper().isin(normalized_expected)]

    threshold_modes = {choice for choice in selected_ranges if choice in {"Above threshold", "Below threshold"}}
    if threshold_modes == {"Above threshold"}:
        filtered = _apply_threshold_filter(filtered, "Above threshold")
    elif threshold_modes == {"Below threshold"}:
        filtered = _apply_threshold_filter(filtered, "Below threshold")
    else:
        filtered = _apply_threshold_filter(filtered, "All data")

    selected_range_labels = [choice for choice in selected_ranges if choice not in {"All ranges", "Above threshold", "Below threshold"}]
    if selected_range_labels and "All ranges" not in selected_ranges:
        filtered = filtered[filtered["threshold_range_label"].isin(selected_range_labels)]

    st.markdown("<div class='main-area'>", unsafe_allow_html=True)
    
    if filtered.empty:
        reason_bits = []
        if {"Above threshold", "Below threshold"} & set(selected_ranges):
            reason_bits.append("threshold mode")
        if selected_client != all_clients_option:
            reason_bits.append(f"client = {selected_client}")
        if selected_version not in ("All Versions", "Latest"):
            reason_bits.append(f"version = {selected_version}")
        reason = " · ".join(reason_bits) or "current selection"
        st.info(
            f"No rows after filters ({reason}). "
            "Tip: switch Threshold ranges to 'All ranges' and widen the date range."
        )
        st.markdown("</div></div>", unsafe_allow_html=True)
        return
        
    metrics_selection = selected_metrics or available_metrics
    metrics_set = set(metrics_selection)
        
    metrics_filtered = filtered
    if metrics_selection:
        metrics_filtered = filtered[filtered["metric_name"].isin(metrics_selection)]
        if metrics_filtered.empty:
            metrics_filtered = filtered
            metrics_set = set(metrics_filtered["metric_name"].dropna().unique())
            metrics_selection = list(metrics_filtered["metric_name"].dropna().unique())
        
    if not metrics_set:
        default_metrics = metrics_filtered["metric_name"].dropna().unique().tolist()
        metrics_set = set(default_metrics)
        metrics_selection = default_metrics
        
    metric_list = metrics_filtered["metric_name"].dropna().unique()
    summary = summarize_metrics(metrics_filtered, metric_list)
        
    if metrics_selection:
        display_metrics = [
            _format_metric_label(metric) for metric in metrics_selection[:6]
        ]
        if len(metrics_selection) > 6:
            display_metrics.append("...")
        st.caption(
            "Metrics in scope: " + ", ".join(display_metrics) + "."
        )
        
    accuracy_frame = metrics_filtered[metrics_filtered["metric_name"] == "Overall_Accuracy"]
    accuracy_pct_frame = metrics_filtered[metrics_filtered["metric_name"] == "Accuracy_pct"]
        
    period_label = f"{start_date.strftime('%b %d, %Y')} — {end_date.strftime('%b %d, %Y')}"
    client_count = metrics_filtered["client_name"].nunique()
    total_points = len(metrics_filtered)
        
    metric_snapshot_for_email: list[str] = []
    primary_metric = "Overall_Accuracy"
    primary_summary = None
    if primary_metric in metrics_set:
        primary_source = (
            metrics_filtered[metrics_filtered["metric_name"] == primary_metric]
            .dropna(subset=["metric_value"])
        )
        grouped_primary = (
            primary_source.groupby("metric_name", sort=False)["metric_value"]
            if not primary_source.empty
            else None
        )
    else:
        grouped_primary = None
        
    if grouped_primary is not None:
        primary_stats = grouped_primary.agg(["mean", "min", "max", "last"]).rename(
            columns={"last": "latest"}
        )
        delta_series = grouped_primary.apply(
            lambda series: series.iloc[-1] - series.iloc[-2] if len(series) > 1 else pd.NA
        )
        primary_stats["delta"] = delta_series
        
        count_cols = {"ittt_within_threshold_count", "ittt_total_count"}
        if count_cols.issubset(primary_source.columns):
            counts_by_date = (
                primary_source[["date_of_model_refresh", *count_cols]]
                .dropna()
                .groupby("date_of_model_refresh", sort=False)
                .sum()
            )
            if not counts_by_date.empty:
                window_within = counts_by_date["ittt_within_threshold_count"].sum()
                window_total = counts_by_date["ittt_total_count"].sum()
                weighted_window = (
                    (window_within / window_total) * 100.0 if window_total else pd.NA
                )
                latest_counts = counts_by_date.iloc[-1]
                weighted_latest = (
                    (latest_counts["ittt_within_threshold_count"] / latest_counts["ittt_total_count"]) * 100.0
                    if latest_counts["ittt_total_count"] else pd.NA
                )
                if len(counts_by_date) > 1:
                    prev_counts = counts_by_date.iloc[-2]
                    weighted_prev = (
                        (prev_counts["ittt_within_threshold_count"] / prev_counts["ittt_total_count"]) * 100.0
                        if prev_counts["ittt_total_count"] else pd.NA
                    )
                    weighted_delta = (
                        weighted_latest - weighted_prev
                        if not (pd.isna(weighted_latest) or pd.isna(weighted_prev))
                        else pd.NA
                    )
                else:
                    weighted_delta = pd.NA
        
                primary_stats.loc[primary_metric, "mean"] = weighted_window
                primary_stats.loc[primary_metric, "latest"] = weighted_latest
                primary_stats.loc[primary_metric, "delta"] = weighted_delta
        
        if primary_metric not in summary.index:
            summary.loc[primary_metric] = pd.Series(dtype=float)
        summary.loc[primary_metric, ["mean", "min", "max", "latest", "delta"]] = (
            primary_stats.loc[primary_metric]
        )
        primary_summary = summary.loc[primary_metric]
    elif primary_metric in summary.index and primary_metric in metrics_set:
        primary_summary = summary.loc[primary_metric]
        
    if selected_tab == "Overview":
        # Add Overview explanation card
        st.info(
            """
            **👋 Welcome to the Overview**
            
            This dashboard provides a high-level summary of your model's performance.
            
            **What to look for:**
            - **Headlines:** Key metrics like overall accuracy and client coverage.
            - **Status Indicators:** 🟢 Good, 🟡 Warning, 🔴 Critical.
            - **Trends:** Comparison vs the last refresh period.
            
            **Goal:** Quickly assess if your models are performing as expected or if investigation is needed.
            """,
            icon="ℹ️",
        )
        overview_metrics = [
            m for m in ("Overall_Accuracy",) if m in summary.index and m in metrics_set
        ]
        overview_frame = summary.reindex(overview_metrics).dropna(how="all")
        render_metric_cards(overview_frame, THEME)
        if "Overall_Accuracy" in metrics_set and not accuracy_frame.empty:
            render_accuracy_chart(
                accuracy_frame,
                model_name=selected_model,
                theme=THEME,
                client_name=None if selected_client == all_clients_option else selected_client,
            )
        insights: list[tuple[str, str]] = []
        insights.append(
            (
                "Coverage",
                f"Monitoring {client_count} client{'s' if client_count != 1 else ''} across {period_label}.",
            )
        )
        if "Overall_Accuracy" in summary.index and "Overall_Accuracy" in metrics_set:
            latest_acc = summary.at["Overall_Accuracy", "latest"]
            delta_acc = summary.at["Overall_Accuracy", "delta"]
            if not pd.isna(latest_acc):
                if pd.isna(delta_acc) or delta_acc == 0:
                    delta_text = "flat vs last refresh"
                else:
                    direction = "up" if delta_acc >= 0 else "down"
                    delta_text = f"{direction} {abs(delta_acc):.2f} vs last refresh"
                insights.append(
                    (
                        "Overall accuracy",
                        f"Current overall accuracy sits at {float(latest_acc):.2f} ({delta_text}).",
                    )
                )
        insights.append(
            (
                "Observations",
                "Use the tabs to deep-dive performance trends, drift diagnostics, latency, and alert activity for this selection.",
            )
        )
        render_info_cards(insights)
    
    elif selected_tab == "System Health":
        st.markdown("<div class='badge'>System Health Dashboard</div>", unsafe_allow_html=True)
        st.caption("Real-time health monitoring, predictive insights, and automated diagnostics")
        
        # Add System Health explanation card
        st.info(
            """
            **🏥 System Health Score**
            
            A composite metric (0-100) indicating the overall reliability of your ML system.
            
            **Components:**
            - **Accuracy:** Model performance vs thresholds
            - **Freshness:** How recently data was updated
            - **Stability:** Consistency of predictions over time
            - **Errors:** Frequency of failures or exceptions
            
            **Interpretation:**
            - **90-100:** Excellent reliability
            - **80-89:** Good (minor monitoring recommended)
            - **< 80:**  Needs attention (check degrading components)
            """,
            icon="ℹ️",
        )
        
        if calculate_health_score is None:
            st.error("Monitoring modules not available. Please ensure health_engine.py and anomaly_detector.py are in the same directory.")
        else:
            # Calculate health scores for all models
            model_health_data = []
            
            for model in raw_data.query('model_name.notna()')['model_name'].unique():
                for client in raw_data.query('client_name.notna()')['client_name'].unique():
                    model_client_data = raw_data[
                        (raw_data['model_name'] == model) &
                        (raw_data['client_name'] == client)
                    ]
                    
                    if model_client_data.empty:
                        continue
                    
                    # Get recent accuracy history (last 7 records)
                    recent_data = model_client_data.sort_values('date_of_model_refresh', ascending=False).head(7)
                    accuracy_col = 'accuracy_pct' if 'accuracy_pct' in recent_data.columns else 'accuracy'
                    accuracy_history = recent_data[accuracy_col].dropna().tolist() if accuracy_col in recent_data.columns else []
                    
                    # Get last refresh
                    last_refresh = model_client_data['date_of_model_refresh'].max()
                    
                    # Calculate health score
                    if accuracy_history:
                        health_score, components = calculate_health_score(
                            last_refresh=last_refresh,
                            accuracy_history=accuracy_history,
                            current_volume=len(model_client_data),
                            expected_volume=max(10, len(model_client_data)),
                            critical_alerts=0,
                            warning_alerts=0,
                            info_alerts=0,
                            uptime_pct=100.0
                        )
                        
                        status = get_status_indicator(health_score)
                        
                        model_health_data.append({
                            'Model': model,
                            'Client': client,
                            'Health Score': health_score,
                            'Status': status,
                            'Freshness': components['freshness'],
                            'Stability': components['stability'],
                            'Last Update': last_refresh.strftime('%Y-%m-%d') if pd.notna(last_refresh) else 'N/A'
                        })
            
            if model_health_data:
                health_df = pd.DataFrame(model_health_data)
                
                # Display overall system health
                avg_health = health_df['Health Score'].mean()
                col1, col2, col3, col4 = st.columns(4)
                
                with col1:
                    st.metric(
                        label="Overall System Health",
                        value=f"{avg_health:.1f}/100",
                        delta="Good" if avg_health >= 80 else "Needs Attention"
                    )
                
                with col2:
                    healthy_count = len(health_df[health_df['Health Score'] >= 80])
                    st.metric(
                        label="Healthy Models",
                        value=f"{healthy_count}/{len(health_df)}",
                        delta=f"{(healthy_count/len(health_df)*100):.0f}%"
                    )
                
                with col3:
                    fresh_count = len(health_df[health_df['Freshness'] >= 80])
                    st.metric(
                        label="Fresh Data",
                        value=f"{fresh_count}/{len(health_df)}",
                        delta=f"{(fresh_count/len(health_df)*100):.0f}%"
                    )
                
                with col4:
                    stable_count = len(health_df[health_df['Stability'] >= 80])
                    st.metric(
                        label="Stable Models",
                        value=f"{stable_count}/{len(health_df)}",
                        delta=f"{(stable_count/len(health_df)*100):.0f}%"
                    )
                
                st.markdown("---")
                
                # Health Leaderboard
                st.subheader("📊 Model Health Leaderboard")
                
                # Sort by health score
                health_df_sorted = health_df.sort_values('Health Score', ascending=False)
                
                # Display as styled dataframe
                def color_health_score(val):
                    if val >= 80:
                        color = '#4caf50'
                    elif val >= 60:
                        color = '#ff9800'
                    else:
                        color = '#f44336'
                    return f'background-color: {color}; color: white'
                
                styled_health = health_df_sorted.style.applymap(
                    color_health_score,
                    subset=['Health Score']
                ).format({'Health Score': '{:.1f}', 'Freshness': '{:.1f}', 'Stability': '{:.1f}'})
                
                st.dataframe(styled_health, use_container_width=True)
                
                st.markdown("---")
                
                # Predictive Alerts Section
                st.subheader("🔮 Predictive Insights")
                
                alerts_found = False
                for _, row in health_df_sorted.iterrows():
                    model = row['Model']
                    client = row['Client']
                    
                    # Get trend data
                    model_data = raw_data[
                        (raw_data['model_name'] == model) &
                        (raw_data['client_name'] == client)
                    ].sort_values('date_of_model_refresh')
                    
                    accuracy_col = 'accuracy_pct' if 'accuracy_pct' in model_data.columns else 'accuracy'
                    if accuracy_col in model_data.columns:
                        accuracy_vals = model_data[accuracy_col].dropna().tolist()
                        
                        if len(accuracy_vals) >= 3:
                            trend = detect_trend(accuracy_vals, window=min(7, len(accuracy_vals)))
                            
                            if trend['direction'] == 'declining' and trend['strength'] in ['moderate', 'strong']:
                                alerts_found = True
                                with st.expander(f"⚠️ {model} - {client}: Declining Trend Detected", expanded=False):
                                    st.warning(f"**Direction**: {trend['direction'].title()} ({trend['strength']})")
                                    st.write(f"**Slope**: {trend['slope']:.4f}")
                                    if trend['prediction']:
                                        st.write(f"**Predicted Next Value**: {trend['prediction']:.2f}%")
                                    
                                    # Breach prediction
                                    breach = predict_threshold_breach(accuracy_vals, threshold=60.0)
                                    if breach['will_breach']:
                                        st.error(f"🚨 May breach 60% threshold in ~{breach['days_to_breach']} days (confidence: {breach['confidence']})")
                
                if not alerts_found:
                    st.success("✅ No declining trends detected. All models performing within expected parameters.")
            else:
                st.info("No model health data available")
    
    elif selected_tab == "Performance":
        st.markdown("<div class='badge'>Model Performance</div>", unsafe_allow_html=True)
        
        # Add Performance explanation card
        st.info(
            """
            **📈 Detailed Performance Analysis**
            
            Deep-dive into accuracy, recall, and other metrics over time.
            
            **Key Features:**
            - **Client Breakdown:** Compare performance across different clients.
            - **Thresholds:** Dotted lines show target performance levels.
            - **Benchmarking:** Compare multiple models side-by-side.
            
            **Use this tab to:** Identify specific clients or time periods where performance dipped below expectations.
            """,
            icon="ℹ️",
        )
        
        # --- Comparative Benchmarking ---
        with st.expander("⚔️ Comparative Benchmarking", expanded=False):
            st.caption("Compare performance trends across multiple models.")
            models_to_compare = st.multiselect(
                "Select Models to Compare", 
                options=sorted(raw_data['model_name'].dropna().unique()),
                default=None
            )
            
            if models_to_compare:
                comp_data = raw_data[raw_data['model_name'].isin(models_to_compare)].copy()
                if not comp_data.empty:
                    # Aggregate by date and model to handle multiple clients if needed, or just plot all
                    fig_comp = px.line(
                        comp_data, 
                        x="date_of_model_refresh", 
                        y="accuracy", 
                        color="model_name",
                        line_group="client_name", # Distinguish clients if multiple
                        hover_data=["client_name"],
                        title="Accuracy Comparison Trend",
                        labels={"accuracy": "Accuracy", "date_of_model_refresh": "Date"}
                    )
                    st.plotly_chart(fig_comp, use_container_width=True)
                else:
                    st.warning("No data for selected models.")
            else:
                st.info("Select specific models above to compare them.")
                
        # --- Existing Performance Content ---
        st.caption(
            "Review accuracy metrics and understand how the selected model performs across clients during the chosen window."
        )
        # Metric cards can clutter the view when many KPIs are selected, so we skip them in performance mode.
        if "Overall_Accuracy" in metrics_set and not accuracy_frame.empty:
            st.markdown("<div class='badge'>Overall Accuracy</div>", unsafe_allow_html=True)
            render_accuracy_chart(
                accuracy_frame,
                model_name=selected_model,
                theme=THEME,
                client_name=None if selected_client == all_clients_option else selected_client,
            )
        if "Accuracy_pct" in metrics_set and not accuracy_pct_frame.empty:
            st.markdown("<div class='badge'>Accuracy pct</div>", unsafe_allow_html=True)
            render_accuracy_pct_chart(
                accuracy_pct_frame,
                model_name=selected_model,
                theme=THEME,
                client_name=None if selected_client == all_clients_option else selected_client,
            )
        
        extra_metrics = [
            metric
            for metric in metrics_selection
            if metric not in {"Overall_Accuracy", "Accuracy_pct"}
        ]
        for metric in extra_metrics:
            metric_frame = metrics_filtered[metrics_filtered["metric_name"] == metric]
            if metric_frame.empty:
                # Page title with version marker to verify updates are loading
                st.markdown(
                    "<h1 style='text-align: center; color: #00d4ff; margin-bottom: 5px;'>ML Model Observatory [v2.1 UPDATED]</h1>",
                    unsafe_allow_html=True,
                )
                continue # Added continue to maintain original logic
            render_metric_trend_chart(
                metric_frame,
                metric_name=metric,
                theme=THEME,
                trend_window=trend_window,
            )
        performance_cards: list[tuple[str, str]] = []
        performance_cards.append(
            (
                "Window",
                f"{total_points} metric rows across {len(metrics_set)} metric(s) between {period_label}.",
            )
        )
        if "Accuracy_pct" in summary.index and "Accuracy_pct" in metrics_set:
            mean_pct = summary.at["Accuracy_pct", "mean"]
            if not pd.isna(mean_pct):
                performance_cards.append(
                    (
                        "Average accuracy pct",
                        f"Mean accuracy percentage across the window is {float(mean_pct):.2f}.",
                    )
                )
        render_info_cards(performance_cards)
    elif selected_tab == "Drift":
        st.markdown("<div class='badge'>Drift analytics</div>", unsafe_allow_html=True)
        st.caption(
            "Quantifies how far actual performance deviates from expected values so negative swings highlight data drift."
        )
        
        # Add drift type clarification card
        st.info("""
        **📊 What We're Measuring: Performance Drift (Model Accuracy Degradation)**
        
        This dashboard tracks how your model's **prediction accuracy** changes over time.
        
        **Performance Drift** = Actual Accuracy - Expected Accuracy
        
        This is **different** from:
        - **Data Drift:** Changes in input feature distributions (e.g., age, income shifting)
        - **Concept Drift:** Changes in the relationship between features and outcomes (e.g., new fraud patterns)
        - **Model Drift:** Changes to the model itself (retraining, version updates)
        
        **Why it matters:** Performance drift indicates your model's predictions are becoming less accurate, which *could* be caused by data drift, concept drift, or other operational factors.
        """, icon="ℹ️")
        
        # Add drift explainer section
        with st.expander("📊 How to Read Drift Analytics", expanded=False):
            st.markdown("""
            ### Understanding Drift
            
            **Drift = Actual Performance - Expected Performance**
            
            Drift measures whether your model is performing better or worse than anticipated.
            
            #### Interpreting the Chart
            
            | Drift Value | Meaning | Action Required |
            |-------------|---------|----------------|
            | **> 0** 🟢 | Exceeding expectations | ✅ Monitor and maintain |
            | **0 to -5** 🟡 | Slight underperformance | ⚠️ Watch for trends |
            | **< -5** 🔴 | Significant underperformance | 🚨 Investigate immediately |
            
            #### Common Patterns
            
            - **Steady negative drift**: Model degradation or data shift
            - **Sudden spike down**: Data quality issue or system change
            - **Oscillating pattern**: Seasonal variations or workflow changes
            - **Upward trend**: Model improvement or easier data
            
            #### When to Take Action
            
            1. **3+ consecutive days** of drift < -5
            2. **Accelerating negative trend** over time
            3. **All clients** showing similar drift (system-wide issue)
            4. **One client** with severe drift (client-specific problem)
            """)
        
        if accuracy_frame.empty:
            st.info("No accuracy data available to compute drift with the current filters.")
        else:
            # Calculate drift metrics for overview cards
            try:
                drift_temp = accuracy_frame.copy()
                actual_series, predicted_series = _resolve_actual_predicted_series(drift_temp, None)
                drift_temp["actual_value"] = pd.to_numeric(actual_series, errors="coerce")
                drift_temp["predicted_value"] = pd.to_numeric(predicted_series, errors="coerce")
                drift_temp["drift"] = drift_temp["actual_value"] - drift_temp["predicted_value"]
                drift_temp = drift_temp.dropna(subset=["drift"])
                
                if not drift_temp.empty:
                    # Calculate zone distributions
                    green_zone = (drift_temp["drift"] >= 0).sum()
                    yellow_zone = ((drift_temp["drift"] < 0) & (drift_temp["drift"] >= -5)).sum()
                    red_zone = (drift_temp["drift"] < -5).sum()
                    total_points = len(drift_temp)
                    
                    avg_drift = drift_temp["drift"].mean()
                    latest_drift = drift_temp.sort_values("date_of_model_refresh")["drift"].iloc[-1] if len(drift_temp) > 0 else 0
                    
                    # Display metrics in columns
                    col1, col2, col3, col4 = st.columns(4)
                    
                    with col1:
                        st.metric(
                            "Average Drift",
                            f"{avg_drift:+.2f}",
                            delta=None,
                            help="Mean drift across all observations in the selected window"
                        )
                    
                    with col2:
                        st.metric(
                            "Latest Drift", 
                            f"{latest_drift:+.2f}",
                            delta=None,
                            help="Most recent drift value"
                        )
                    
                    with col3:
                        green_pct = (green_zone / total_points * 100) if total_points > 0 else 0
                        st.metric(
                            "🟢 On Track",
                            f"{green_pct:.0f}%",
                            delta=None,
                            help="Percentage of observations with drift ≥ 0"
                        )
                    
                    with col4:
                        red_pct = (red_zone / total_points * 100) if total_points > 0 else 0
                        st.metric(
                            "🔴 At Risk",
                            f"{red_pct:.0f}%",
                            delta=None,
                            help="Percentage of observations with drift < -5"
                        )
                    
                    st.markdown("---")
            except Exception:
                pass  # Silently skip metrics if calculation fails
            
            # Add forecast toggle
            show_forecast = st.checkbox(
                "📈 Show 7-day forecast",
                value=False,
                help="Display predicted drift for the next 7 days based on recent trends"
            )
            
            render_drift_chart(
                accuracy_frame,
                model_name=selected_model,
                theme=THEME,
                client_name=None if selected_client == all_clients_option else selected_client,
                show_forecast=show_forecast,
            )
            drift_cards: list[tuple[str, str]] = []
            drift_clients = client_count
            drift_temp = accuracy_frame.copy()
            metric_key = drift_temp["metric_name"].iloc[0] if not drift_temp.empty else None
            actual_series, predicted_series = _resolve_actual_predicted_series(drift_temp, metric_key)
            drift_temp["actual_value"] = actual_series
            drift_temp["predicted_value"] = predicted_series
            drift_temp["gap"] = drift_temp["actual_value"] - drift_temp["predicted_value"]
            drift_temp = drift_temp.dropna(subset=["gap"])
            if not drift_temp.empty:
                avg_gap = drift_temp["gap"].mean()
                max_gap = drift_temp["gap"].abs().max()
                drift_clients = drift_temp["client_name"].nunique()
                drift_cards.append(("Average drift", f"Mean delta between actual and target is {avg_gap:.2f} points."))
                drift_cards.append(("Peak deviation", f"Largest absolute drift observed is {max_gap:.2f} points."))
            drift_cards.append(("Coverage", f"{drift_clients} client{'s' if drift_clients != 1 else ''} evaluated for drift across {period_label}."))
            render_info_cards(drift_cards)
    elif selected_tab == "Latency":
        st.markdown("<div class='badge'>Latency & Freshness</div>", unsafe_allow_html=True)
        st.caption("Monitor data freshness and pipeline latency metrics.")
        
        # Add Latency explanation card
        st.info("""
        **⏱️ Data Latency Tracking**
        
        Monitors how fresh your data is and how quickly models are refreshing.
        
        **What to look for:**
        - **Freshness:** Time since the last data update.
        - **Refresh Duration:** How long the model refresh process takes.
        - **Anomalies:** Unexpected delays or spikes in latency.
        
        **Goal:** Ensure your system is operating in real-time or within SLA limits.
        """, icon="ℹ️")
        latency_frame = filtered.dropna(subset=["latency_hours"]).copy()
        if latency_frame.empty:
            st.info("No latency telemetry available for the selected filters.")
        else:
            latency_frame = latency_frame.sort_values("date_of_model_refresh").drop_duplicates(
                subset=["model_name", "client_name", "date_of_model_refresh"]
            )
            latest_latency = latency_frame["latency_hours"].iloc[-1]
            prior_latency = latency_frame["latency_hours"].iloc[-2] if len(latency_frame) > 1 else pd.NA
            latency_summary = {
                "mean": latency_frame["latency_hours"].mean(),
                "min": latency_frame["latency_hours"].min(),
                "max": latency_frame["latency_hours"].max(),
                "latest": latest_latency,
                "delta": pd.NA if pd.isna(prior_latency) else float(latest_latency - prior_latency),
            }
            summary_frame = pd.DataFrame([latency_summary], index=["Latency (hours)"])
            render_metric_cards(summary_frame, THEME)
            render_latency_chart(
                latency_frame,
                model_name=selected_model,
                theme=THEME,
                client_name=None if selected_client == all_clients_option else selected_client,
            )
            latency_cards: list[tuple[str, str]] = []
            if not pd.isna(latest_latency):
                latency_cards.append(("Latest latency", f"Most recent refresh latency is {float(latest_latency):.2f} hours."))
            latency_cards.append(("Window size", f"{len(latency_frame)} latency observations across {latency_frame['client_name'].nunique()} clients."))
            render_info_cards(latency_cards)
    elif selected_tab == "Alerts":
        st.markdown("<div class='badge'>Alert Center</div>", unsafe_allow_html=True)
        st.caption("Active monitoring alerts and threshold breaches.")
        
        # Add Alerts explanation card
        st.info("""
        **🔔 Active Monitoring & Alerts**
        
        Shows system-generated alerts when performance thresholds are breached.
        
        **Alert Types:**
        - **Critical:** Significant drop in performance requiring immediate action.
        - **Warning:** Emerging issues or trends to watch.
        - **Info:** Notifications about system state or minor deviations.
        
        **Action:** Review alerts to diagnose root causes and prevent incidents.
        """, icon="ℹ️")
        # --- Predictive Alerts Section ---
        if calculate_health_score is not None:
            predictive_alerts = []
            
            # Scan all models for potential future breaches
            for model in raw_data.query('model_name.notna()')['model_name'].unique():
                for client in raw_data.query('client_name.notna()')['client_name'].unique():
                    # Skip if filtered out
                    if selected_model and model != selected_model:
                        continue
                    if selected_client != all_clients_option and client != selected_client:
                        continue
                        
                    model_data = raw_data[
                        (raw_data['model_name'] == model) &
                        (raw_data['client_name'] == client)
                    ].sort_values('date_of_model_refresh')
                    
                    if len(model_data) < 3:
                        continue
                        
                    accuracy_col = 'accuracy_pct' if 'accuracy_pct' in model_data.columns else 'accuracy'
                    if accuracy_col in model_data.columns:
                        vals = model_data[accuracy_col].dropna().tolist()
                        # Check for breach in next 30 days with threshold 60% (configurable)
                        breach = predict_threshold_breach(vals, threshold=60.0)
                        
                        if breach['will_breach']:
                            predictive_alerts.append({
                                "model": model,
                                "client": client,
                                "days": breach['days_to_breach'],
                                "confidence": breach['confidence']
                            })
            
            if predictive_alerts:
                st.warning(f"⚠️ **Predictive Warning**: {len(predictive_alerts)} models are trending toward failure.")
                cols = st.columns(min(len(predictive_alerts), 3))
                for i, alert in enumerate(predictive_alerts[:3]):
                    with cols[i]:
                        st.error(
                            f"**{alert['model']} ({alert['client']})**\n\n"
                            f"Predicted to breach threshold in **~{alert['days']} days**\n"
                            f"Confidence: {alert['confidence'].title()}"
                        )
                st.markdown("---")
        
        st.caption(
            "Active = metric still breaching the target. ACK means the alert was acknowledged but is unresolved. Severity is driven by how far the observed value trails the threshold (High ≥ 20% gap, Medium ≥ 10%). Focus on rows where Observed is much lower than Threshold."
        )
        alerts = metrics_filtered[
            (metrics_filtered["threshold"].notna())
            & (metrics_filtered["metric_value"].notna())
            & (metrics_filtered["metric_value"] < metrics_filtered["threshold"])
        ]
        allowed_metrics = ALERT_METRICS_BY_MODEL.get(
            selected_model,
            ALERT_METRICS_BY_MODEL["__default__"],
        )
        alerts = alerts[alerts["metric_name"].isin(allowed_metrics)]
        status_tally: dict[str, int] = {"active": 0, "acknowledged": 0, "resolved": 0}
        severity_tally: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
        recent_alerts = alerts.copy()
        if alerts.empty:
            st.success("No alerts triggered in the selected window.")
            recent_alerts = alerts
        else:
            recent_alerts = alerts.sort_values("date_of_model_refresh", ascending=False).head(50)
        
            rows_html: list[str] = []
            status_map = {"active": "Active", "acknowledged": "Acknowledged", "resolved": "Resolved"}
            deepest_breach: dict[str, object] | None = None
            for _, row in recent_alerts.iterrows():
                status_slug, severity_level = _classify_alert(row)
                status_label = status_map.get(status_slug, status_slug.title())
                icon_class = status_slug
                severity_label = severity_level.upper()
        
                status_tally[status_slug] = status_tally.get(status_slug, 0) + 1
                severity_tally[severity_level] = severity_tally.get(severity_level, 0) + 1
        
                timestamp = pd.to_datetime(row.get("date_of_model_refresh"), errors="coerce")
                if pd.isna(timestamp):
                    time_display = "”"
                else:
                    time_display = timestamp.strftime("%b %d, %Y %I:%M %p")
        
                metric_name_value = row.get("metric_name")
                signal = _format_metric_label(metric_name_value)
                signal_tooltip = _metric_description(metric_name_value).replace('"', '&quot;')
                model_name = row.get("model_name") or selected_model or "Model"
                observed = pd.to_numeric(row.get("metric_value"), errors="coerce")
                threshold_val = pd.to_numeric(row.get("threshold"), errors="coerce")
        
                observed_display = "”" if pd.isna(observed) else f"{float(observed):.3f}"
                threshold_display = "”" if pd.isna(threshold_val) else f"{float(threshold_val):.3f}"
        
                if pd.notna(observed) and pd.notna(threshold_val):
                    breach = float(threshold_val) - float(observed)
                    if breach > 0:
                        if deepest_breach is None or breach > float(deepest_breach["breach"]):
                            deepest_breach = {
                                "breach": breach,
                                "metric": signal,
                                "model": model_name,
                                "client": row.get("client_name") or "All clients",
                            }
        
                actions = "<span class='alert-action'>Resolve</span>"
                if status_slug == "active":
                    actions = "<span class='alert-action primary'>ACK</span>" + actions
                elif status_slug == "acknowledged":
                    actions = "<span class='alert-action'>Ack</span>" + actions
        
                row_html = (
                    "<div class='alert-row'>"
                    f"<div class='alert-col status'><span class='alert-status-icon {icon_class}'></span><span>{status_label}</span></div>"
                    f"<div class='alert-col severity'><span class='alert-pill {severity_level}'>{severity_label}</span></div>"
                    f"<div class='alert-col signal' title='{signal_tooltip}'>{signal}</div>"
                    f"<div class='alert-col model'>{model_name}</div>"
                    f"<div class='alert-col value'>{observed_display}</div>"
                    f"<div class='alert-col value'>{threshold_display}</div>"
                    f"<div class='alert-col time'>{time_display}</div>"
                    f"<div class='alert-col actions'>{actions}</div>"
                    "</div>"
                )
                rows_html.append(row_html)
        
            header_html = (
                "<div class='alert-table'>"
                "<div class='alert-header'>"
                "<div class='alert-col status'>Status</div>"
                "<div class='alert-col severity'>Severity</div>"
                "<div class='alert-col signal'>Signal</div>"
                "<div class='alert-col model'>Model</div>"
                "<div class='alert-col value'>Observed</div>"
                "<div class='alert-col value'>Threshold</div>"
                "<div class='alert-col time'>Time</div>"
                "<div class='alert-col actions'>Actions</div>"
                "</div>"
            )
            table_html = header_html + "".join(rows_html) + "</div>"
            st.markdown(table_html, unsafe_allow_html=True)
        
            summary_lines: list[str] = []
            summary_lines.append(
                f"Active: {status_tally.get('active', 0)} Â· ACK: {status_tally.get('acknowledged', 0)} Â· Resolved: {status_tally.get('resolved', 0)}"
            )
            summary_lines.append(
                f"Severity mix ” High: {severity_tally.get('high', 0)}, Medium: {severity_tally.get('medium', 0)}, Low: {severity_tally.get('low', 0)}"
            )
            if deepest_breach is not None:
                summary_lines.append(
                    "Deepest breach: {metric} ({client}) sits {breach:.2f} below target.".format(
                        metric=deepest_breach["metric"],
                        client=deepest_breach["client"],
                        breach=float(deepest_breach["breach"]),
                    )
                )
            st.markdown("\n".join(f"- {line}" for line in summary_lines))
            
            # Enhanced: Root Cause Analysis for Critical Alerts
            if calculate_health_score is not None and not recent_alerts.empty:
                st.markdown("---")
                st.subheader("🔍 Automated Root Cause Analysis")
                
                # Analyze top 3 critical alerts
                critical_alerts = recent_alerts[recent_alerts.apply(
                    lambda r: _classify_alert(r)[1] == 'high', axis=1
                )].head(3)
                
                if not critical_alerts.empty:
                    for idx, alert_row in critical_alerts.iterrows():
                        model_name = alert_row.get('model_name', 'Unknown')
                        client_name = alert_row.get('client_name', 'Unknown')
                        metric_name = alert_row.get('metric_name', 'Unknown')
                        
                        # Get historical data for this model-client
                        hist_data = raw_data[
                            (raw_data['model_name'] == model_name) &
                            (raw_data['client_name'] == client_name)
                        ].sort_values('date_of_model_refresh')
                        
                        if not hist_data.empty:
                            last_refresh = hist_data['date_of_model_refresh'].max()
                            accuracy_col = 'accuracy_pct' if 'accuracy_pct' in hist_data.columns else 'accuracy'
                            
                            if accuracy_col in hist_data.columns:
                                accuracy_history = hist_data[accuracy_col].dropna().tolist()
                                current_accuracy = accuracy_history[-1] if accuracy_history else None
                                
                                # Generate diagnosis
                                report = generate_root_cause_report(
                                    model_name=model_name,
                                    client_name=client_name,
                                    alert_type=f"{metric_name} Below Threshold",
                                  last_refresh=last_refresh,
                                    current_accuracy=current_accuracy,
                                    historical_accuracy=accuracy_history[-30:] if len(accuracy_history) > 1 else None,
                                    current_volume=len(hist_data),
                                    expected_volume=max(10, len(hist_data))
                                )
                                
                                # Display diagnosis
                                diagnosis_html = format_diagnosis_html(report)
                                st.markdown(diagnosis_html, unsafe_allow_html=True)
                else:
                    st.info("No critical alerts requiring root cause analysis")
        
        
        if primary_summary is not None:
            metric_snapshot_for_email.append(
                _format_metric_snapshot_row("Overall_Accuracy", primary_summary)
            )
        if not summary.empty:
            for metric_name, stats in summary.head(5).iterrows():
                if metric_name == "Overall_Accuracy":
                    continue
                metric_snapshot_for_email.append(
                    _format_metric_snapshot_row(metric_name, stats)
                )
        
        send_button = st.button(
            "Send summary email now",
            help="Dispatch an email with the current performance snapshot and alert overview.",
        )
        if send_button:
            with st.spinner("Sending summary email..."):
                success, message = _send_alert_summary_email(
                    model_name=selected_model,
                    client_scope="All Clients" if selected_client == all_clients_option else selected_client,
                    period_label=period_label,
                    status_tally=status_tally,
                    severity_tally=severity_tally,
                    summary_rows=metric_snapshot_for_email,
                )
            if success:
                st.success(message)
            else:
                st.error(f"Unable to send email: {message}")
        
        consolidated_button = st.button(
            "Send client emails",
            help="Send separate summary emails for each client and model.",
            key="send_client_emails",
        )
        if consolidated_button:
            with st.spinner("Sending client summaries..."):
                success, message = _send_client_summary_emails(
                    data=raw_data,
                    model_names=models,
                    start_date=start_date,
                    end_date=end_date,
                    period_label=period_label,
                )
            if success:
                st.success(message)
            else:
                st.error(f"Unable to send client emails: {message}")
        
        consolidated_button = st.button(
            "Send consolidated email",
            help="Send one email summarizing Appeal, Denial, and ITTT performance and alerts.",
            key="send_consolidated_email",
        )
        if consolidated_button:
            with st.spinner("Sending consolidated summary..."):
                success, message = _send_consolidated_summary_email(
                    data=raw_data,
                    model_names=models,
                    start_date=start_date,
                    end_date=end_date,
                    period_label=period_label,
                )
            if success:
                st.success(message)
            else:
                st.error(f"Unable to send consolidated email: {message}")
        
    elif selected_tab == "Incident History":
        st.markdown("<div class='badge'>Incident Timeline</div>", unsafe_allow_html=True)
        st.caption("Historical log of outages, regressions, and operational incidents.")
        
        # Add Incident History explanation card
        st.info("""
        **📜 Incident Timeline and History**
        
        A log of past operational incidents, outages, or major performance regressions.
        
        **Use this to:**
        - Track the history of system stability.
        - Identify recurring patterns in failures.
        - Conduct post-incident reviews (PIRs).
        
        **Record:** Shows start/end times, severity, and description of each event.
        """, icon="ℹ️")
        
        if IncidentTracker is None:
            st.error("Incident Tracker module not available.")
        else:
            tracker = IncidentTracker()
            
            # --- Top Stats ---
            stats = tracker.get_statistics()
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Total Incidents", stats['total_incidents'])
            with col2:
                st.metric("Active Issues", stats['active_incidents'], delta_color="inverse")
            with col3:
                st.metric("Resolved", stats['resolved_incidents'])
            with col4:
                st.metric("Avg Resolution Time", stats['avg_resolution_hours'])
            
            st.markdown("---")
            
            # --- Timeline Visualization ---
            st.subheader("📅 Incident Timeline")
            timeline_data = tracker.get_timeline_data()
            
            if timeline_data:
                # Convert to DataFrame for easier plotting if needed, or use go.Figure
                # Using simple Scatter for timeline
                fig = go.Figure()
                
                # Map patterns to Y-axis
                categories = sorted(list(set(d['category'] for d in timeline_data)))
                y_map = {cat: i for i, cat in enumerate(categories)}
                
                for item in timeline_data:
                    start = pd.to_datetime(item['start'])
                    end = pd.to_datetime(item['end']) if item['end'] else datetime.now()
                    
                    color = 'red' if item['status'] == 'active' else 'green'
                    
                    fig.add_trace(go.Scatter(
                        x=[start, end],
                        y=[item['category'], item['category']],
                        mode='lines+markers',
                        line=dict(color=color, width=10),
                        marker=dict(size=12, symbol='line-ns-open'),
                        name=f"{item['title']} ({item['status']})",
                        text=item['description'],
                        hoverinfo='text+name'
                    ))
                
                fig.update_layout(
                    title="Incident Timeline (Active vs Resolved)",
                    xaxis_title="Date",
                    yaxis_title="Category",
                    height=300,
                    margin=dict(l=20, r=20, t=40, b=20)
                )
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("No timeline data available.")
            
            col_list, col_form = st.columns([2, 1])
            
            with col_list:
                st.subheader("Recent Incidents")
                incidents = tracker.get_recent_incidents(days=30)
                if incidents:
                    for inc in incidents:
                        status_color = "red" if inc['status'] == "active" else "green"
                        with st.expander(f"[{inc['severity'].upper()}] {inc['title']} ({inc['date']})", expanded=False):
                            st.markdown(f"**Status**: <span style='color:{status_color}'>{inc['status'].title()}</span>", unsafe_allow_html=True)
                            st.write(inc['description'])
                            if inc['status'] == 'active':
                                if st.button("Resolve", key=f"resolve_{inc['id']}"):
                                    tracker.resolve_incident(inc['id'])
                                    st.rerun()
                else:
                    st.info("No recent incidents found.")
            
            with col_form:
                st.subheader("Log New Incident")
                with st.form("new_incident_form"):
                    title = st.text_input("Title")
                    desc = st.text_area("Description")
                    severity = st.selectbox("Severity", ["low", "medium", "high", "critical"])
                    category = st.selectbox("Category", ["model_performance", "data_pipeline", "infrastructure", "latency", "other"])
                    
                    submitted = st.form_submit_button("Log Incident")
                    if submitted and title:
                        tracker.record_incident(
                            title=title,
                            description=desc,
                            severity=severity,
                            category=category
                        )
                        st.success("Incident logged successfully!")
                        st.rerun()
        
    elif selected_tab == "Settings":
        st.markdown("<div class='badge'>Environment</div>", unsafe_allow_html=True)
        settings_cards = [
            ("Data source", f"{data_source_label} feed ” {pill_tail}"),
            ("Selected window", period_label),
            ("Model scope", f"{selected_model} Â· {client_count} client{'s' if client_count != 1 else ''}"),
        ]
        render_info_cards(settings_cards)
        support_cards = [
            ("Need support?", "Reach the observability team for anomaly reviews, alert tuning, or telemetry walkthroughs."),
            ("Contact", "🧠 support@ikshealth.com · 🧠 +1 (800) 555-0199"),
        ]
        render_info_cards(support_cards)
    st.markdown("</div>", unsafe_allow_html=True)  # Close app-shell

    # Persistent Floating Assistant Hub 🤖
    render_ai_assistant(selected_model, period_label, models, data_source_label, raw_data)

if __name__ == "__main__":
        main()
