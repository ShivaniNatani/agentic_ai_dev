"""Email routes: /api/email/*."""
from flask import Blueprint, jsonify, request

from api.core import (
    compute_alerts,
    filter_frame,
    load_data,
    send_alert_summary_email,
    send_client_summary_emails,
    send_consolidated_summary_email,
    summarize_metrics,
    _format_metric_snapshot_row,
)

email_bp = Blueprint('email', __name__, url_prefix='/api/email')


@email_bp.post("/summary")
def api_email_summary():
    payload = request.get_json() or {}
    model_name = payload.get("model")
    client_name = payload.get("client")
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")

    frame, _ = load_data(refresh=False)
    filtered = filter_frame(
        frame,
        model=model_name,
        client=client_name,
        start_date=start_date,
        end_date=end_date,
        threshold_mode="All data",
    )

    metric_names = filtered["metric_name"].dropna().unique()
    summary = summarize_metrics(filtered, metric_names)
    summary_rows = []
    for _, row in summary.head(5).iterrows():
        summary_rows.append(_format_metric_snapshot_row(row["metric_name"], row))

    alerts = compute_alerts(filtered, model_name=model_name)
    period_label = payload.get("period_label") or f"{start_date} to {end_date}"

    success, msg = send_alert_summary_email(
        model_name=model_name or "Model",
        client_scope=client_name or "All Clients",
        period_label=period_label,
        summary_rows=summary_rows,
        status_tally=alerts.get("status_tally"),
        severity_tally=alerts.get("severity_tally"),
    )
    status_code = 200 if success else 400
    return jsonify({"success": success, "message": msg}), status_code


@email_bp.post("/client")
def api_email_client():
    payload = request.get_json() or {}
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    period_label = payload.get("period_label") or f"{start_date} to {end_date}"

    frame, _ = load_data(refresh=False)
    models = sorted(frame["model_name"].dropna().unique())
    success, msg = send_client_summary_emails(
        data=frame,
        model_names=models,
        start_date=start_date,
        end_date=end_date,
        period_label=period_label,
    )
    status_code = 200 if success else 400
    return jsonify({"success": success, "message": msg}), status_code


@email_bp.post("/consolidated")
def api_email_consolidated():
    payload = request.get_json() or {}
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    period_label = payload.get("period_label") or f"{start_date} to {end_date}"

    frame, _ = load_data(refresh=False)
    models = sorted(frame["model_name"].dropna().unique())
    success, msg = send_consolidated_summary_email(
        data=frame,
        model_names=models,
        start_date=start_date,
        end_date=end_date,
        period_label=period_label,
    )
    status_code = 200 if success else 400
    return jsonify({"success": success, "message": msg}), status_code
