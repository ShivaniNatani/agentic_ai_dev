"""Incident tracking and timeline management.

Records and tracks all system events, alerts, and incidents.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import json
from pathlib import Path


class IncidentTracker:
    """Track incidents and system events."""
    
    def __init__(self, storage_path: Optional[Path] = None):
        """Initialize incident tracker.
        
        Args:
            storage_path: Path to store incident history (JSON file)
        """
        self.storage_path = storage_path or Path(__file__).parent / "incidents.json"
        self.incidents: List[Dict] = self._load_incidents()
    
    def _load_incidents(self) -> List[Dict]:
        """Load incidents from storage."""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r') as f:
                    return json.load(f)
            except Exception:
                return []
        return []
    
    def _save_incidents(self):
        """Save incidents to storage."""
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_path, 'w') as f:
                json.dump(self.incidents, f, indent=2, default=str)
        except Exception as e:
            print(f"Failed to save incidents: {e}")
    
    def record_incident(
        self,
        incident_type: Optional[str] = None,
        severity: str = "medium",
        model_name: Optional[str] = None,
        client_name: Optional[str] = None,
        description: str = "",
        metadata: Optional[Dict] = None,
        *,
        title: Optional[str] = None,
        category: Optional[str] = None
    ) -> str:
        """Record a new incident.
        
        Args:
            incident_type: Type of incident (alert, error, warning, etc.)
            severity: Severity level (critical, warning, info)
            model_name: Affected model
            client_name: Affected client
            description: Incident description
            metadata: Additional metadata
            
        Returns:
            Incident ID
        """
        incident_id = f"INC-{len(self.incidents) + 1:06d}"
        resolved_type = incident_type or category or "incident"
        resolved_model = model_name or "Unknown"
        resolved_client = client_name or "Unknown"
        resolved_title = title or f"{resolved_type.title()} event"
        
        incident = {
            "id": incident_id,
            "type": resolved_type,
            "category": category or resolved_type,
            "title": resolved_title,
            "severity": severity,
            "model": resolved_model,
            "client": resolved_client,
            "description": description,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "open",
            "metadata": metadata or {},
            "resolution": None,
            "resolved_at": None
        }
        
        self.incidents.append(incident)
        self._save_incidents()
        
        return incident_id
    
    def resolve_incident(self, incident_id: str, resolution: str):
        """Mark incident as resolved.
        
        Args:
            incident_id: ID of incident to resolve
            resolution: Resolution description
        """
        for incident in self.incidents:
            if incident["id"] == incident_id:
                incident["status"] = "resolved"
                incident["resolution"] = resolution
                incident["resolved_at"] = datetime.now(timezone.utc).isoformat()
                self._save_incidents()
                return
    
    def get_recent_incidents(self, days: int = 7, severity: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
        """Get recent incidents.
        
        Args:
            days: Number of days to look back
            severity: Filter by severity (optional)
            limit: Optional max number of incidents to return
            
        Returns:
            List of incident dicts
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        
        filtered = []
        for incident in self.incidents:
            incident_time = datetime.fromisoformat(incident["timestamp"].replace('Z', '+00:00'))
            if incident_time >= cutoff:
                if severity is None or incident["severity"] == severity:
                    filtered.append(incident)
        
        sorted_incidents = sorted(filtered, key=lambda x: x["timestamp"], reverse=True)
        if limit is not None:
            sorted_incidents = sorted_incidents[:limit]
        return sorted_incidents
    
    def get_timeline_data(self, days: int = 30) -> List[Dict]:
        """Get timeline data for visualization.
        
        Args:
            days: Number of days to include
            
        Returns:
            List of timeline events
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        
        timeline = []
        for incident in self.incidents:
            incident_time = datetime.fromisoformat(incident["timestamp"].replace('Z', '+00:00'))
            if incident_time >= cutoff:
                timeline.append({
                    "timestamp": incident["timestamp"],
                    "type": incident["type"],
                    "title": incident.get("title") or incident.get("type"),
                    "category": incident.get("category") or incident.get("type"),
                    "severity": incident["severity"],
                    "model": incident["model"],
                    "client": incident["client"],
                    "description": incident["description"],
                    "status": incident["status"]
                })
        
        return sorted(timeline, key=lambda x: x["timestamp"])
    
    def get_statistics(self, days: int = 30) -> Dict[str, any]:
        """Get incident statistics for the last N days."""
        recent = self.get_recent_incidents(days)
        
        if not recent:
            return {
                # legacy keys
                "total": 0,
                "by_severity": {},
                "by_model": {},
                "by_type": {},
                "resolution_rate": 0.0,
                "avg_resolution_time_hours": 0.0,
                # UI-friendly keys
                "total_incidents": 0,
                "active_incidents": 0,
                "resolved_incidents": 0,
                "avg_resolution_hours": 0.0,
            }
        
        by_severity = {}
        by_model = {}
        by_type = {}
        resolved_count = 0
        open_count = 0
        total_resolution_time = 0.0
        
        for incident in recent:
            # Count by severity
            sev = incident.get("severity", "unknown")
            by_severity[sev] = by_severity.get(sev, 0) + 1
            
            # Count by model
            model = incident.get("model", "unknown")
            by_model[model] = by_model.get(model, 0) + 1
            
            # Count by type
            itype = incident.get("type", "unknown")
            by_type[itype] = by_type.get(itype, 0) + 1
            
            status = incident.get("status")
            if status == "resolved":
                resolved_count += 1
                if incident.get("resolved_at"):
                    start = datetime.fromisoformat(incident["timestamp"].replace('Z', '+00:00'))
                    end = datetime.fromisoformat(incident["resolved_at"].replace('Z', '+00:00'))
                    resolution_hours = (end - start).total_seconds() / 3600
                    total_resolution_time += resolution_hours
            else:
                open_count += 1
        
        resolution_rate = (resolved_count / len(recent)) * 100 if recent else 0.0
        avg_resolution_time = total_resolution_time / resolved_count if resolved_count > 0 else 0.0
        
        return {
            # legacy keys for compatibility
            "total": len(recent),
            "by_severity": by_severity,
            "by_model": by_model,
            "by_type": by_type,
            "resolution_rate": resolution_rate,
            "avg_resolution_time_hours": avg_resolution_time,
            # keys used by the UI
            "total_incidents": len(recent),
            "active_incidents": open_count,
            "resolved_incidents": resolved_count,
            "avg_resolution_hours": avg_resolution_time,
        }
    
    def detect_patterns(self, days: int = 30) -> List[Dict[str, any]]:
        """Detect recurring patterns in incidents.
        
        Args:
            days: Number of days to analyze
            
        Returns:
            List of detected patterns
        """
        recent = self.get_recent_incidents(days)
        
        if len(recent) < 3:
            return []
        
        patterns = []
        
        # Pattern 1: Same model-client recurring
        model_client_counts = {}
        for incident in recent:
            key = f"{incident['model']}_{incident['client']}_{incident['type']}"
            model_client_counts[key] = model_client_counts.get(key, 0) + 1
        
        for key, count in model_client_counts.items():
            if count >= 3:
                model, client, itype = key.split('_', 2)
                patterns.append({
                    "type": "recurring_issue",
                    "model": model,
                    "client": client,
                    "issue_type": itype,
                    "count": count,
                    "recommendation": f"Investigate recurring {itype} for {model}/{client}"
                })
        
        # Pattern 2: Time-based patterns (e.g., every Monday)
        from datetime import timedelta
        from collections import Counter
        
        weekday_counts = Counter()
        hour_counts = Counter()
        
        for incident in recent:
            incident_time = datetime.fromisoformat(incident["timestamp"].replace('Z', '+00:00'))
            weekday_counts[incident_time.strftime('%A')] += 1
            hour_counts[incident_time.hour] += 1
        
        # If >50% of incidents on same weekday
        if weekday_counts:
            most_common_day, day_count = weekday_counts.most_common(1)[0]
            if day_count / len(recent) > 0.5:
                patterns.append({
                    "type": "temporal_pattern",
                    "pattern": f"Most incidents on {most_common_day}",
                    "count": day_count,
                    "recommendation": f"Check scheduled jobs or processes running on {most_common_day}"
                })
        
        return patterns


# Global tracker instance
_tracker = None


def get_tracker() -> IncidentTracker:
    """Get global incident tracker instance."""
    global _tracker
    if _tracker is None:
        _tracker = IncidentTracker()
    return _tracker
