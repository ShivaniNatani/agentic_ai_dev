"""Health routes: /api/health, /api/system-health."""
from datetime import datetime, timezone

import pandas as pd
from flask import Blueprint, jsonify

from api.core import load_data

# Try to import optional modules
try:
    from health_engine import calculate_health_score, get_status_indicator
    from anomaly_detector import detect_trend, predict_threshold_breach
except Exception:
    calculate_health_score = None
    get_status_indicator = None
    detect_trend = None
    predict_threshold_breach = None

health_bp = Blueprint('health', __name__, url_prefix='/api')


@health_bp.get("/health")
def api_health():
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()})


@health_bp.get("/system-health")
def api_system_health():
    if calculate_health_score is None or detect_trend is None:
        return jsonify({"error": "Health modules not available."}), 500

    frame, _ = load_data(refresh=False)
    model_health_data: list[dict[str, object]] = []
    
    for model in frame["model_name"].dropna().unique():
        for client in frame["client_name"].dropna().unique():
            model_client_data = frame[
                (frame["model_name"] == model) & (frame["client_name"] == client)
            ]
            if model_client_data.empty:
                continue

            recent_data = model_client_data.sort_values("date_of_model_refresh", ascending=False).head(7)
            accuracy_col = "accuracy_pct" if "accuracy_pct" in recent_data.columns else "accuracy"
            accuracy_history = recent_data[accuracy_col].dropna().tolist() if accuracy_col in recent_data.columns else []
            last_refresh = model_client_data["date_of_model_refresh"].max()
            if not accuracy_history:
                continue

            health_score, components = calculate_health_score(
                last_refresh=last_refresh,
                accuracy_history=accuracy_history,
                current_volume=len(model_client_data),
                expected_volume=max(10, len(model_client_data)),
                critical_alerts=0,
                warning_alerts=0,
                info_alerts=0,
                uptime_pct=100.0,
            )

            model_health_data.append(
                {
                    "model": model,
                    "client": client,
                    "health_score": health_score,
                    "status": get_status_indicator(health_score) if get_status_indicator else None,
                    "freshness": components.get("freshness"),
                    "stability": components.get("stability"),
                    "last_update": last_refresh.strftime("%Y-%m-%d") if pd.notna(last_refresh) else None,
                }
            )

    if not model_health_data:
        return jsonify({"health": [], "summary": None, "predictive": []})

    health_df = pd.DataFrame(model_health_data)
    avg_health = health_df["health_score"].mean()
    healthy_count = len(health_df[health_df["health_score"] >= 80])
    fresh_count = len(health_df[health_df["freshness"] >= 80])
    stable_count = len(health_df[health_df["stability"] >= 80])

    predictive_alerts = []
    for _, row in health_df.iterrows():
        model = row["model"]
        client = row["client"]
        model_data = frame[
            (frame["model_name"] == model) & (frame["client_name"] == client)
        ].sort_values("date_of_model_refresh")

        accuracy_col = "accuracy_pct" if "accuracy_pct" in model_data.columns else "accuracy"
        if accuracy_col not in model_data.columns:
            continue
        vals = model_data[accuracy_col].dropna().tolist()
        if len(vals) < 3:
            continue
        trend = detect_trend(vals, window=min(7, len(vals)))
        if trend["direction"] == "declining" and trend["strength"] in {"moderate", "strong"}:
            breach = predict_threshold_breach(vals, threshold=60.0)
            predictive_alerts.append(
                {
                    "model": model,
                    "client": client,
                    "trend": trend,
                    "breach": breach,
                }
            )

    return jsonify(
        {
            "health": model_health_data,
            "summary": {
                "avg_health": avg_health,
                "healthy_count": healthy_count,
                "fresh_count": fresh_count,
                "stable_count": stable_count,
                "total": len(health_df),
            },
            "predictive": predictive_alerts,
        }
    )
