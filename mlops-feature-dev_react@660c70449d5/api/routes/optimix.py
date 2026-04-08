"""Optimix routes: /api/optimix/* for GIA/AXIA client data from Google Sheets."""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import json
import os
from pathlib import Path
import io

from flask import Blueprint, jsonify, request
import pandas as pd
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession
import google.auth
import logging

# Google Sheets configuration
SPREADSHEET_ID = os.getenv("OPTIMIX_SHEET_ID", "11GX97bg2vizCIeEvQv6Fq7dg630dHqvUGYD-eYscqCM")

# Sheet GIDs (from the spreadsheet URL)
SHEET_GIDS = {
    "GIA": os.getenv("OPTIMIX_GIA_GID", "0"),
    "AXIA": os.getenv("OPTIMIX_AXIA_GID", "2146638466"),
    "Definitions": "1747978"  # From URL pattern
}

# Optional: override per-client CSV URLs (e.g., published CSV links)
PUBLISHED_CSV_URLS = {
    "GIA": os.getenv("OPTIMIX_GIA_CSV_URL"),
    "AXIA": os.getenv("OPTIMIX_AXIA_CSV_URL"),
}

# Credential resolution (local, docker secret, env)
_env_creds = os.getenv("OPTIMIX_SHEETS_CREDENTIALS_JSON") or os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")
PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _resolve_creds_path():
    """Return the first credential path that actually exists.

    The old logic returned the first *configured* path (often `/run/secrets/...`), even
    when that file was not mounted. That forced unauthenticated CSV fetches, which now
    fail with 401 and leave the Optimix dashboard empty. Matching the release-notes fix,
    we probe each candidate on disk and only return an existing path, falling back to
    the first configured value so future mounts still work.
    """

    candidates = [
        _env_creds,
        "/run/secrets/agentic-ai-key.json",
        "/app/secrets/agentic-ai-key.json",
        str(PROJECT_ROOT / "secrets/agentic-ai-key.json"),
        "secrets/agentic-ai-key.json",
        "/mnt/agentic-ai/client.json",
    ]

    for cand in candidates:
        if not cand:
            continue
        path = Path(cand).expanduser()
        if path.exists():
            return str(path)

    return next((c for c in candidates if c), None)


CREDS_PATH = _resolve_creds_path()
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

logger = logging.getLogger(__name__)
_creds_state_logged = False

# Cache for storing fetched data
_data_cache: Dict[str, Any] = {
    "GIA": None,
    "AXIA": None,
    "last_updated": None
}

# Cache file path for persistence
CACHE_FILE = Path(__file__).parent / "optimix_cache.json"

optimix_bp = Blueprint('optimix', __name__, url_prefix='/api/optimix')


def _to_number(value: Any) -> Optional[float]:
    """Best-effort numeric coercion for mixed sheet values."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if pd.isna(value):
            return None
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace('$', '').replace(',', '').replace('%', '').strip()
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except (ValueError, TypeError):
            return None
    return None


def _to_int_if_whole(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    if float(value).is_integer():
        return int(value)
    return value


def _parse_date(value: Any) -> Optional[pd.Timestamp]:
    try:
        dt = pd.to_datetime(value, errors="coerce")
        if pd.isna(dt):
            return None
        return dt
    except Exception:
        return None


def _fetch_sheet_as_csv(sheet_name: str) -> Optional[pd.DataFrame]:
    """Fetch a Google Sheet as CSV using the published CSV URL."""
    _log_credentials_state()
    try:
        override_url = PUBLISHED_CSV_URLS.get(sheet_name)
        if override_url:
            url = override_url
        else:
            gid = SHEET_GIDS.get(sheet_name, "0")
            url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv&gid={gid}"

        # If credentials are available, use an authorized session (service account file or ADC)
        authed = _authorized_session()
        if authed:
            try:
                resp = authed.get(url)
                resp.raise_for_status()
                return pd.read_csv(io.BytesIO(resp.content))
            except Exception as e:
                logger.warning("Optimix authorized fetch failed for %s: %s", sheet_name, e)

        # Public / published access
        df = pd.read_csv(url)
        return df
    except Exception as e:
        logger.warning("Optimix fetch error for %s: %s", sheet_name, e)
        return None


def _log_credentials_state() -> None:
    """Log non-sensitive info about credential availability once."""
    global _creds_state_logged
    if _creds_state_logged:
        return
    path = CREDS_PATH
    exists = Path(path).exists() if path else False
    client_email = None
    if exists:
        try:
            with open(path, "r") as f:
                data = json.load(f)
                client_email = data.get("client_email")
        except Exception:
            client_email = "unreadable"
    logger.info(
        "Optimix sheets credentials: path=%s env_set=%s exists=%s client_email=%s",
        path,
        bool(_env_creds),
        exists,
        client_email or "unknown",
    )
    _creds_state_logged = True


def _authorized_session() -> Optional[AuthorizedSession]:
    """Return an AuthorizedSession using SA file only (no ADC)."""
    if CREDS_PATH and Path(CREDS_PATH).exists():
        try:
            creds = service_account.Credentials.from_service_account_file(
                CREDS_PATH, scopes=SCOPES
            )
            return AuthorizedSession(creds)
        except Exception as exc:
            logger.warning("Optimix service account file auth failed: %s", exc)
    return None


def _parse_sheet_data(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Parse spreadsheet data into structured records."""
    if df is None or df.empty:
        return []
    
    # Clean column names
    df.columns = df.columns.str.strip()
    
    # Drop rows with no date and no values
    df = df.dropna(how="all")
    if "Date" in df.columns:
        df = df[df["Date"].notna()]
    
    # Expected columns based on the spreadsheet structure
    column_mapping = {
        'Date': 'date',
        'Total Open Claims': 'total_open_claims',
        'Total Open $AR': 'total_open_sar',
        'Model-Eligible Claims': 'model_eligible_claims',
        'Model-Eligible $AR': 'model_eligible_sar',
        'Workable Claims': 'workable_claims',
        'Workable $AR': 'workable_sar',
        '% Inventory Workable': 'pct_inventory_workable',
        '% $AR Workable': 'pct_sar_workable',
        'Claims Worked Today': 'claims_worked_today',
        '$AR Worked Today': 'sar_worked_today',
        'Workable Claims Backlog (EOD)': 'workable_claims_backlog',
        'Workable $ Backlog (EOD)': 'workable_sar_backlog',
        'Cash Collected Today': 'cash_collected_today',
        'Expected Cash from Worked Claims': 'expected_cash',
        'Workable Inventory Burn Rate': 'burn_rate'
    }
    
    # Rename columns if they exist
    for old_name, new_name in column_mapping.items():
        if old_name in df.columns:
            df = df.rename(columns={old_name: new_name})
    
    # Remove rows that are effectively empty (all numeric columns missing)
    numeric_cols = [c for c in df.columns if c != "date"]
    df = df.dropna(subset=numeric_cols, how="all")
    
    # Convert to records
    records = df.to_dict(orient='records')
    
    # Clean numeric values
    for record in records:
        for key, value in record.items():
            if isinstance(value, str):
                raw_value = value
                # Remove currency/percent symbols and commas
                cleaned = raw_value.replace('$', '').replace(',', '').replace('%', '').strip()
                try:
                    num_val = float(cleaned) if '.' in cleaned else int(cleaned)
                    # If original string had a percent sign, store as fraction
                    if '%' in raw_value:
                        num_val = num_val / 100
                    record[key] = num_val
                except (ValueError, TypeError):
                    # Leave as-is if not numeric
                    pass
            elif pd.isna(value):
                record[key] = None
    
    # Keep only rows with meaningful numeric data
    filtered = []
    primary_keys = [
        "total_open_claims", "workable_claims", "cash_collected_today", "expected_cash"
    ]
    for rec in records:
        if any(_to_number(rec.get(k)) is not None for k in primary_keys):
            filtered.append(rec)
    
    return filtered


def _load_cache() -> Dict[str, Any]:
    """Load cached data from file."""
    global _data_cache
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r') as f:
                _data_cache = json.load(f)
        except Exception:
            pass
    return _data_cache


def _save_cache():
    """Save cache to file."""
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(_data_cache, f)
    except Exception as e:
        print(f"Error saving cache: {e}")


def _refresh_data(client: str = None) -> bool:
    """Refresh data from Google Sheets."""
    global _data_cache
    
    clients_to_refresh = [client] if client else ["GIA", "AXIA"]
    success = True
    updated_any = False
    
    for c in clients_to_refresh:
        previous = _data_cache.get(c) or []
        df = _fetch_sheet_as_csv(c)

        if df is not None and not df.empty:
            parsed = _parse_sheet_data(df)
            if parsed:
                _data_cache[c] = parsed
                updated_any = True
            else:
                logger.warning("Parsed Optimix sheet for %s was empty; keeping prior cache (%d rows)", c, len(previous))
                _data_cache[c] = previous
                success = False
        else:
            logger.warning("No data fetched for %s (e.g., 401/429); keeping prior cache (%d rows)", c, len(previous))
            _data_cache[c] = previous
            success = False
    
    if updated_any:
        _data_cache["last_updated"] = datetime.now(timezone.utc).isoformat()
        _save_cache()
    return success


def _get_mock_data(client: str) -> List[Dict[str, Any]]:
    """Return mock data derived from screenshots for immediate display."""
    # Data from user screenshots (Jan 28 - Jan 31 range)
    return [
        {
            "date": "2026-01-28",
            "total_open_claims": 1000,
            "total_open_sar": 1000,
            "model_eligible_claims": 800,
            "model_eligible_sar": 800,
            "workable_claims": 250,
            "workable_sar": 250,
            "pct_inventory_workable": 0.25,
            "pct_sar_workable": 0.25,
            "claims_worked_today": 250,
            "sar_worked_today": 250,
            "workable_claims_backlog": 0,
            "workable_sar_backlog": 0,
            "cash_collected_today": 12500,
            "expected_cash": 12500,
            "burn_rate": 250
        },
        {
            "date": "2026-01-29",
            "total_open_claims": 950,
            "total_open_sar": 950,
            "model_eligible_claims": 780,
            "model_eligible_sar": 780,
            "workable_claims": 240,
            "workable_sar": 240,
            "pct_inventory_workable": 0.25,
            "pct_sar_workable": 0.25,
            "claims_worked_today": 240,
            "sar_worked_today": 240,
            "workable_claims_backlog": 10,
            "workable_sar_backlog": 10,
            "cash_collected_today": 11800,
            "expected_cash": 12000,
            "burn_rate": 240
        },
        {
            "date": "2026-01-30",
            "total_open_claims": 900,
            "total_open_sar": 900,
            "model_eligible_claims": 760,
            "model_eligible_sar": 760,
            "workable_claims": 230,
            "workable_sar": 230,
            "pct_inventory_workable": 0.25,
            "pct_sar_workable": 0.25,
            "claims_worked_today": 230,
            "sar_worked_today": 230,
            "workable_claims_backlog": 20,
            "workable_sar_backlog": 20,
            "cash_collected_today": 11200,
            "expected_cash": 11500,
            "burn_rate": 230
        },
        {
            "date": "2026-01-31",
            "total_open_claims": 850,
            "total_open_sar": 850,
            "model_eligible_claims": 740,
            "model_eligible_sar": 740,
            "workable_claims": 220,
            "workable_sar": 220,
            "pct_inventory_workable": 0.25,
            "pct_sar_workable": 0.25,
            "claims_worked_today": 35,
            "sar_worked_today": 35,
            "workable_claims_backlog": 185,
            "workable_sar_backlog": 185,
            "cash_collected_today": 1500,
            "expected_cash": 2000,
            "burn_rate": 35
        }
    ]


@optimix_bp.get("/data")
def api_optimix_data():
    """Get Optimix data for GIA and/or AXIA clients."""
    client = request.args.get("client")  # GIA, AXIA, or None for both
    refresh = request.args.get("refresh", "false").lower() in {"1", "true", "yes"}
    
    # Load cache
    _load_cache()
    
    # Refresh if requested or if cache is empty
    if refresh or not _data_cache.get("GIA") or not _data_cache.get("AXIA"):
        _refresh_data(client)
    
    # Build response
    response_data = {
        "last_updated": _data_cache.get("last_updated"),
        "clients": {}
    }
    
    if client:
        if client.upper() in ["GIA", "AXIA"]:
            response_data["clients"][client.upper()] = _data_cache.get(client.upper(), [])
    else:
        response_data["clients"]["GIA"] = _data_cache.get("GIA", [])
        response_data["clients"]["AXIA"] = _data_cache.get("AXIA", [])
    
    return jsonify(response_data)


@optimix_bp.get("/summary")
def api_optimix_summary():
    """Get summary KPIs for Optimix dashboard."""
    _load_cache()
    
    # Refresh if cache is empty
    if not _data_cache.get("GIA") or not _data_cache.get("AXIA"):
        _refresh_data()
    
    summary = {
        "last_updated": _data_cache.get("last_updated"),
        "clients": {}
    }
    
    numeric_fields = [
        "total_open_claims",
        "total_open_sar",
        "model_eligible_claims",
        "model_eligible_sar",
        "workable_claims",
        "workable_sar",
        "pct_inventory_workable",
        "pct_sar_workable",
        "claims_worked_today",
        "sar_worked_today",
        "cash_collected_today",
        "workable_claims_backlog",
        "workable_sar_backlog",
        "burn_rate",
        "expected_cash",
    ]

    for client in ["GIA", "AXIA"]:
        data = _data_cache.get(client, [])
        if not data:
            summary["clients"][client] = {"error": "No data available"}
            continue

        valid_rows = []
        for row in data:
            parsed_date = _parse_date(row.get("date"))
            if parsed_date is None:
                continue

            numeric_values = {field: _to_number(row.get(field)) for field in numeric_fields}
            if all(v is None for v in numeric_values.values()):
                continue

            normalized = dict(row)
            for field, value in numeric_values.items():
                normalized[field] = _to_int_if_whole(value)
            normalized["_parsed_date"] = parsed_date
            valid_rows.append(normalized)

        if not valid_rows:
            summary["clients"][client] = {"error": "No valid data rows available"}
            continue

        valid_rows.sort(key=lambda r: r["_parsed_date"])
        latest = valid_rows[-1]
        prev = valid_rows[-2] if len(valid_rows) > 1 else None

        latest_claims_worked = _to_number(latest.get("claims_worked_today")) or 0
        prev_claims_worked = (_to_number(prev.get("claims_worked_today")) or 0) if prev else 0
        latest_cash = _to_number(latest.get("cash_collected_today")) or 0
        prev_cash = (_to_number(prev.get("cash_collected_today")) or 0) if prev else 0

        summary["clients"][client] = {
            "latest_date": latest.get("date"),
            "total_open_claims": latest.get("total_open_claims"),
            "total_open_sar": latest.get("total_open_sar"),
            "model_eligible_claims": latest.get("model_eligible_claims"),
            "model_eligible_sar": latest.get("model_eligible_sar"),
            "workable_claims": latest.get("workable_claims"),
            "workable_sar": latest.get("workable_sar"),
            "pct_inventory_workable": latest.get("pct_inventory_workable"),
            "pct_sar_workable": latest.get("pct_sar_workable"),
            "claims_worked_today": latest.get("claims_worked_today"),
            "sar_worked_today": latest.get("sar_worked_today"),
            "cash_collected_today": latest.get("cash_collected_today"),
            "workable_claims_backlog": latest.get("workable_claims_backlog"),
            "workable_sar_backlog": latest.get("workable_sar_backlog"),
            "burn_rate": latest.get("burn_rate"),
            "expected_cash": latest.get("expected_cash"),
            "record_count": len(valid_rows),
            "trends": {
                "claims_worked_change": (latest_claims_worked - prev_claims_worked) if prev else None,
                "cash_collected_change": (latest_cash - prev_cash) if prev else None,
            }
        }
    
    return jsonify(summary)


@optimix_bp.post("/refresh")
def api_optimix_refresh():
    """Force refresh data from Google Sheets."""
    client = request.args.get("client")
    success = _refresh_data(client)
    
    return jsonify({
        "success": success,
        "last_updated": _data_cache.get("last_updated"),
        "message": "Data refreshed successfully" if success else "Some data failed to refresh"
    })


@optimix_bp.post("/webhook")
def api_optimix_webhook():
    """Webhook endpoint for Apps Script to trigger refresh or push data."""
    # Security: Verify API Key if configured
    api_key = os.environ.get("OPTIMIX_API_KEY")
    if api_key:
        auth_header = request.headers.get("X-API-KEY")
        if not auth_header or auth_header != api_key:
            return jsonify({"status": "error", "message": "Unauthorized"}), 401

    payload = request.get_json() or {}
    sheet_name = payload.get("sheet") or payload.get("client")
    
    # If direct data is provided, use it instead of fetching
    if "data" in payload and sheet_name:
        try:
            # Normalize data if needed or expect standard dict
            _data_cache[sheet_name] = payload["data"]
            _data_cache["last_updated"] = datetime.now(timezone.utc).isoformat()
            _save_cache()
            return jsonify({"status": "ok", "message": f"Data updated for {sheet_name}"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 400
    
    # Otherwise trigger fetch
    if sheet_name in ["GIA", "AXIA"]:
        _refresh_data(sheet_name)
    else:
        _refresh_data()  # Refresh all
    
    return jsonify({"status": "ok", "refreshed": sheet_name or "all"})
