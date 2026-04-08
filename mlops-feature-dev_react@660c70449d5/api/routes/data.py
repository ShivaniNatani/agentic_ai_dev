"""Data routes: /api/data, /api/filters, /api/refresh."""
from flask import Blueprint, jsonify, request

from api.core import (
    build_filter_options,
    filter_frame,
    load_data,
    resolve_available_metrics,
    summarize_metrics,
)
from api.utils import meta_to_dict, serialize_frame

data_bp = Blueprint('data', __name__, url_prefix='/api')


@data_bp.get("/filters")
def api_filters():
    model = request.args.get("model")
    frame, meta = load_data(refresh=False)
    return jsonify({"meta": meta_to_dict(meta), "options": build_filter_options(frame, selected_model=model)})


@data_bp.get("/data")
def api_data():
    model = request.args.get("model")
    client = request.args.get("client")
    version = request.args.get("version")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    threshold_mode = request.args.get("threshold_mode", "All data")
    ranges_raw = request.args.get("ranges", "")
    metrics_raw = request.args.get("metrics", "")
    refresh = request.args.get("refresh", "false").lower() in {"1", "true", "yes"}

    selected_ranges = [item.strip() for item in ranges_raw.split(",") if item.strip()]
    selected_metrics = [item.strip() for item in metrics_raw.split(",") if item.strip()]

    frame, meta = load_data(refresh=refresh)
    filtered = filter_frame(
        frame,
        model=model,
        client=client,
        version=version,
        start_date=start_date,
        end_date=end_date,
        threshold_mode=threshold_mode,
        selected_ranges=selected_ranges,
        metrics=selected_metrics or None,
    )

    available_metrics = []
    if model:
        available_metrics = resolve_available_metrics(frame, model, client)

    summary = summarize_metrics(filtered, selected_metrics or filtered["metric_name"].dropna().unique())
    summary_records = summary.to_dict(orient="records") if not summary.empty else []

    options = build_filter_options(frame, selected_model=model)
    return jsonify(
        {
            "meta": meta_to_dict(meta),
            "options": options,
            "available_metrics": available_metrics,
            "summary": summary_records,
            "records": serialize_frame(filtered),
        }
    )


@data_bp.post("/refresh")
def api_refresh():
    try:
        _, meta = load_data(refresh=True, refresh_metadata=True)
        return jsonify({"success": True, "meta": meta_to_dict(meta)})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
