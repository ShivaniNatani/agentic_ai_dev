"""Incidents routes: /api/incidents."""
from flask import Blueprint, jsonify, request

# Try to import optional modules
try:
    from incident_tracker import IncidentTracker
except Exception:
    IncidentTracker = None

incidents_bp = Blueprint('incidents', __name__, url_prefix='/api')


@incidents_bp.get("/incidents")
def api_incidents():
    if IncidentTracker is None:
        return jsonify({"error": "Incident tracker not available."}), 500
    days = int(request.args.get("days", "30"))
    tracker = IncidentTracker()
    return jsonify(
        {
            "stats": tracker.get_statistics(days),
            "timeline": tracker.get_timeline_data(days),
            "recent": tracker.get_recent_incidents(days=days, limit=30),
        }
    )


@incidents_bp.post("/incidents")
def api_incidents_create():
    if IncidentTracker is None:
        return jsonify({"error": "Incident tracker not available."}), 500
    payload = request.get_json() or {}
    tracker = IncidentTracker()
    incident_id = tracker.record_incident(
        incident_type=payload.get("category") or "incident",
        severity=payload.get("severity") or "medium",
        model_name=payload.get("model") or "Unknown",
        client_name=payload.get("client") or "Unknown",
        description=payload.get("description") or "No description",
        title=payload.get("title"),
        category=payload.get("category"),
    )
    return jsonify({"id": incident_id})


@incidents_bp.post("/incidents/<incident_id>/resolve")
def api_incidents_resolve(incident_id: str):
    if IncidentTracker is None:
        return jsonify({"error": "Incident tracker not available."}), 500
    payload = request.get_json() or {}
    tracker = IncidentTracker()
    tracker.resolve_incident(incident_id, payload.get("resolution") or "Resolved")
    return jsonify({"status": "resolved", "id": incident_id})
