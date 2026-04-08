"""Alerts routes: /api/alerts."""
from flask import Blueprint, jsonify, request

from api.core import (
    ALERT_METRICS_BY_MODEL,
    compute_alerts,
    filter_frame,
    load_data,
)

# Try to import optional modules
try:
    from root_cause_analyzer import generate_root_cause_report
except Exception:
    generate_root_cause_report = None

alerts_bp = Blueprint('alerts', __name__, url_prefix='/api')


@alerts_bp.get("/alerts")
def api_alerts():
    model = request.args.get("model")
    client = request.args.get("client")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    include_root = request.args.get("include_root_cause", "false").lower() in {"1", "true", "yes"}

    frame, _ = load_data(refresh=False)
    filtered = filter_frame(
        frame,
        model=model,
        client=client,
        start_date=start_date,
        end_date=end_date,
        threshold_mode="All data",
    )
    alert_data = compute_alerts(filtered, model_name=model)

    root_cause_reports = []
    if include_root and generate_root_cause_report and not filtered.empty:
        high_alerts = [row for row in alert_data["rows"] if row["severity"] == "high"][:3]
        for alert in high_alerts:
            model_name = alert.get("model") or model
            client_name = alert.get("client")
            metric_name = alert.get("signal")
            history = frame[
                (frame["model_name"] == model_name)
                & (frame["client_name"] == client_name)
            ].sort_values("date_of_model_refresh")

            accuracy_col = "accuracy_pct" if "accuracy_pct" in history.columns else "accuracy"
            accuracy_history = history[accuracy_col].dropna().tolist() if accuracy_col in history.columns else []
            current_accuracy = accuracy_history[-1] if accuracy_history else None
            last_refresh = history["date_of_model_refresh"].max() if not history.empty else None

            report = generate_root_cause_report(
                model_name=model_name or "Unknown",
                client_name=client_name or "Unknown",
                alert_type=f"{metric_name} Below Threshold",
                last_refresh=last_refresh,
                current_accuracy=current_accuracy,
                historical_accuracy=accuracy_history[-30:] if len(accuracy_history) > 1 else None,
                current_volume=len(history),
                expected_volume=max(10, len(history)),
            )
            root_cause_reports.append(report)

    return jsonify(
        {
            "alerts": alert_data,
            "allowed_metrics": list(ALERT_METRICS_BY_MODEL.get(model or "", ALERT_METRICS_BY_MODEL["__default__"])),
            "root_cause": root_cause_reports,
        }
    )
