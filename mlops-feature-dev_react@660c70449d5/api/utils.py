"""Utility functions and classes for the Flask API."""
from __future__ import annotations

import json
from typing import Any

import numpy as np
import pandas as pd
from flask.json.provider import DefaultJSONProvider

from api.core import LoadMeta


class NumpyJSONProvider(DefaultJSONProvider):
    """Custom JSON provider that handles numpy types."""
    
    def default(self, obj):
        if isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        if isinstance(obj, (np.integer, int)):
            return int(obj)
        if isinstance(obj, (np.floating, float)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def meta_to_dict(meta: LoadMeta) -> dict[str, object]:
    """Convert LoadMeta to a JSON-serializable dictionary."""
    return {
        "data_source": meta.data_source,
        "refresh_error": meta.refresh_error,
        "source_file_mtime": meta.source_file_mtime.isoformat() if meta.source_file_mtime else None,
        "latest_data_point": meta.latest_data_point.isoformat() if meta.latest_data_point else None,
        "refreshed_at": meta.refreshed_at.isoformat() if meta.refreshed_at else None,
    }


def serialize_frame(frame) -> list[dict[str, object]]:
    """Convert pandas DataFrame to JSON-serializable list of records."""
    return json.loads(frame.to_json(orient="records", date_format="iso"))


def fmt_value(value: Any, *, signed: bool = False) -> str:
    """Format a value for display in chat context."""
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return "n/a"
        if isinstance(value, (int, float)):
            if signed:
                return f"{float(value):+0.2f}".rstrip("0").rstrip(".")
            return f"{float(value):0.2f}".rstrip("0").rstrip(".")
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)
    except Exception:
        return str(value)
