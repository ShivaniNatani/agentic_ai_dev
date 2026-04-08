"""Release Notes routes: fetch release data from Google Sheets via service account.

This keeps the release notes feed in sync with the shared spreadsheet while
providing a lightweight cache and safe fallbacks when the sheet is unavailable.
"""
from __future__ import annotations

import io
import json
import os
import re
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from flask import Blueprint, jsonify, request
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account


# Configuration (env overridable for flexibility)
# Default sheet id/gid supplied by user
SHEET_ID = os.getenv("RELEASE_NOTES_SHEET_ID", "15iQmj-C9rb1FQ6Iiq9T3gLhRf2lIGM63H-AqT9jy-d4")
SHEET_GID = os.getenv("RELEASE_NOTES_SHEET_GID", "0")
CSV_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={SHEET_GID}"

CACHE_FILE = Path(__file__).parent / "releases_cache.json"
CACHE_TTL_SECONDS = int(os.getenv("RELEASE_NOTES_CACHE_TTL", "300"))  # 5 minutes default

# Allow dedicated creds path but also reuse the shared sheets credential if present
_env_creds = os.getenv("RELEASES_SHEETS_CREDENTIALS_JSON") or os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")
PROJECT_ROOT = Path(__file__).resolve().parents[3]

def _resolve_creds_path():
    """Pick the first credential file that actually exists.

    The previous logic grabbed the first non-empty candidate (often `/run/secrets/...`),
    even when it wasn't mounted in the running container. That forced unauthenticated
    fetches and caused the release feed to get stuck on stale cache data. We now scan
    the candidate list and return the first existing path, falling back to the first
    configured value if nothing is present so deployments with future mounts still work.
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
# Product buckets for UI grouping
_CATEGORY_MAP = {
    "cdphp": "Writeback",
    "orthonywritebacks": "Writeback",
    "orthonyevenotes": "Writeback",
    "writeback": "Writeback",
    "recommendednextbestaction": "Optimix",
    "denial": "Optimix",
    "appeal": "Optimix",
    "ittt": "Optimix",
    "optimix": "Optimix",
    "cmmcarelon": "Browser Agents",
    "carelon": "Browser Agents",
    "browseragent": "Browser Agents",
    "pa": "Browser Agents",
    "priorauth": "Browser Agents",
    "referral": "Browser Agents",
    "wissen": "Browser Agents",
    "pkb": "Browser Agents",
    "payersurveillance": "Browser Agents",
}


releases_bp = Blueprint("releases", __name__, url_prefix="/api/releases")
logger = logging.getLogger(__name__)

_cache: Dict[str, Any] = {
    "data": None,
    "last_updated": None,
    "fetched_at": 0,
    "source": "init",
}
_creds_state_logged = False


def _load_cache() -> None:
    if CACHE_FILE.exists():
        try:
            cached = json.loads(CACHE_FILE.read_text())
            _cache.update(cached)
        except Exception:
            pass


def _save_cache() -> None:
    try:
        CACHE_FILE.write_text(json.dumps(_cache))
    except Exception:
        # Cache failures should never break the API path
        pass


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
            with open(path, 'r') as f:
                data = json.load(f)
                client_email = data.get('client_email')
        except Exception:
            client_email = 'unreadable'
    logger.info(
        'Release sheets credentials: path=%s env_set=%s exists=%s client_email=%s',
        path,
        bool(_env_creds),
        exists,
        client_email or 'unknown',
    )
    _creds_state_logged = True


def _authorized_session() -> Optional[AuthorizedSession]:
    """Return AuthorizedSession using SA file if present (no ADC fallback)."""
    _log_credentials_state()
    if CREDS_PATH and Path(CREDS_PATH).exists():
        try:
            creds = service_account.Credentials.from_service_account_file(
                CREDS_PATH, scopes=SCOPES
            )
            return AuthorizedSession(creds)
        except Exception as exc:
            logger.warning("Release sheets: service account file auth failed: %s", exc)
    return None


def _split_list(value: Any) -> List[str]:
    """Turn semicolon/line/• separated strings into a clean list."""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if not isinstance(value, str):
        return []

    parts = re.split(r"[\n;|,\u2022]|•", value)
    return [p.strip() for p in parts if p.strip()]


def _normalize_col(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.strip().lower())


_COLUMN_MAP = {
    "id": "id",
    "projectid": "projectId",
    "project": "projectId",
    "projectmodel": "projectId",
    "agent": "agent",
    "category": "category",
    "client": "client",
    "payer": "payer",
    "minordupdates": "minorUpdates",
    "minorupdates": "minorUpdates",
    "minorversion": "minorVersion",
    "majorupdates": "majorUpdates",
    "majorversion": "majorVersion",
    "icon": "icon",
    "stage": "stage",
    "status": "stage",
    "accesstype": "accessType",
    "accessperson": "accessPerson",
    "version": "version",
    "type": "type",
    "date": "date",
    "owner": "owner",
    "title": "title",
    "description": "description",
    "comment": "comment",
    "highlights": "highlights",
    "whatsnew": "highlights",
    "fixes": "fixes",
    "bugfixes": "fixes",
    "bugs": "fixes",
    "links": "links",
}


def _format_date(raw: Any) -> Optional[str]:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    if isinstance(raw, pd.Timestamp) or isinstance(raw, datetime):
        return raw.strftime("%Y-%m-%d")
    return str(raw).strip() or None


def _parse_dataframe(df: pd.DataFrame) -> List[Dict[str, Any]]:
    if df is None or df.empty:
        return []

    df = df.dropna(how="all")
    df.columns = [_normalize_col(c) for c in df.columns]

    # Forward-fill key columns since sheet uses merged blocks
    ffill_cols = ["projectid", "project", "projectmodel", "payer", "client", "date", "owner", "accesstype", "accessperson"]
    for col in ffill_cols:
        if col in df.columns:
            df.loc[:, col] = df[col].ffill()

    releases: List[Dict[str, Any]] = []
    for idx, row in df.iterrows():
        mapped: Dict[str, Any] = {}
        for col, val in row.items():
            key = _COLUMN_MAP.get(col)
            if key:
                mapped[key] = val

        def _clean(val):
            if val is None:
                return ""
            if isinstance(val, float) and pd.isna(val):
                return ""
            return str(val).strip()

        def _first_nonempty(*vals):
            for v in vals:
                cleaned = _clean(v)
                if cleaned:
                    return cleaned
            return ""

        major_title = mapped.get("majorUpdates")
        minor_title = mapped.get("minorUpdates")
        major_version = mapped.get("majorVersion")
        minor_version = mapped.get("minorVersion")

        title = _first_nonempty(mapped.get("title"), major_title, minor_title, mapped.get("projectId"))
        if not title:
            continue

        input_type = _clean(mapped.get("type")).lower()
        rel_type = input_type if input_type in {"major", "minor", "patch"} else None

        major_present = bool(_clean(major_title) or _clean(major_version))
        if rel_type is None:
            if major_present:
                rel_type = "major"
            else:
                rel_type = "minor"

        version = _first_nonempty(mapped.get("version"), major_version, minor_version, "1.0.0")
        highlights_src = _first_nonempty(mapped.get("highlights"), major_title, minor_title)

        owner_clean = _clean(mapped.get("owner"))
        access_person_clean = _clean(mapped.get("accessPerson"))
        owner_display = owner_clean if owner_clean else ""
        if access_person_clean:
            owner_display = f"{owner_display} / {access_person_clean}" if owner_display else access_person_clean

        project_clean = _clean(mapped.get("projectId"))
        project_norm = re.sub(r"[^a-z0-9]", "", project_clean.lower()) if project_clean else ""
        
        # Auto-derive category if missing
        category = _clean(mapped.get("category"))
        if not category:
            category = _CATEGORY_MAP.get(project_norm)
        if not category and project_norm.startswith("referral"):
            category = "Browser Agents"
        if not category:
            category = project_clean or "Other Updates"

        client_clean = _clean(mapped.get("client")) or _clean(mapped.get("payer"))
        
        # Auto-derive stable ID if missing
        id_src = _clean(mapped.get("id"))
        if not id_src and project_clean and version:
            # Create a stable slug e.g. 'optimix-1-0-11'
            id_src = re.sub(r"[^a-z0-9]+", "-", f"{project_clean}-{version}".lower()).strip("-")
        if not id_src:
            id_src = f"sheet-{idx}"

        release = {
            "id": str(id_src),
            "projectId": project_clean or None,
            "agent": _clean(mapped.get("agent")) or None,
            "category": category,
            "payer": client_clean or None,
            "client": client_clean or None,
            "icon": _clean(mapped.get("icon")) or "📝",
            "stage": _clean(mapped.get("stage")) or _clean(mapped.get("accessType")) or "Live",
            "version": version,
            "type": rel_type,
            "date": _format_date(mapped.get("date")) or "",
            "owner": owner_display,
            "title": title,
            "description": _clean(mapped.get("description")) or _clean(mapped.get("comment")) or "",
            "highlights": _split_list(highlights_src),
            "fixes": _split_list(mapped.get("fixes")),
            "links": _split_list(mapped.get("links")),
        }

        releases.append(release)

    return releases


def _fetch_from_sheet() -> Optional[List[Dict[str, Any]]]:
    session = _authorized_session()
    try:
        if session:
            resp = session.get(CSV_URL)
            resp.raise_for_status()
            content = resp.content
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_csv(CSV_URL)
        return _parse_dataframe(df)
    except Exception as exc:
        logger.warning("Release sheet fetch failed (auth path): %s", exc)
        # Fallback: try public/unauthenticated fetch in case the sheet is public but creds lack access
        try:
            df = pd.read_csv(CSV_URL)
            return _parse_dataframe(df)
        except Exception as exc2:
            logger.warning("Release sheet public fetch also failed: %s", exc2)
            return None


def _get_releases(force_refresh: bool = False) -> Dict[str, Any]:
    _load_cache()
    now_ts = time.time()
    if (
        not force_refresh
        and _cache.get("data")
        and (now_ts - float(_cache.get("fetched_at", 0))) < CACHE_TTL_SECONDS
    ):
        return _cache

    data = _fetch_from_sheet()
    if data:
        _cache.update(
            {
                "data": data,
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "fetched_at": now_ts,
                "source": "sheets",
            }
        )
        _save_cache()
        return _cache

    # If fetch failed, surface cached data if available
    if _cache.get("data"):
        _cache["source"] = "cache"
        return _cache

    # Final fallback: empty list with failure source
    return {
        "data": [],
        "last_updated": None,
        "fetched_at": now_ts,
        "source": "unavailable",
    }


@releases_bp.get("")
def api_releases():
    """Return release notes from the Google Sheet (cached)."""
    force_refresh = request.args.get("refresh", "false").lower() in {"1", "true", "yes"}
    payload = _get_releases(force_refresh=force_refresh)
    return jsonify(
        {
            "releases": payload.get("data", []),
            "last_updated": payload.get("last_updated"),
            "source": payload.get("source"),
        }
    )
