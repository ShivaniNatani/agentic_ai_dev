"""Health scoring engine for ML models.

Calculates composite health scores based on multiple dimensions:
- Data freshness (0-100)
- Accuracy stability (0-100)
- Prediction volume (0-100)
- Alert severity (0-100)
- System uptime (0-100)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple

import pandas as pd


def calculate_freshness_score(last_refresh: datetime, max_age_days: int = 7) -> float:
    """Calculate freshness score based on data age.
    
    Args:
        last_refresh: Timestamp of last data refresh
        max_age_days: Maximum acceptable age in days (default: 7)
        
    Returns:
        Score from 0-100 (100 = fresh, 0 = stale)
    """
    if pd.isna(last_refresh):
        return 0.0
        
    now = datetime.now(timezone.utc)
    if last_refresh.tzinfo is None:
        last_refresh = last_refresh.replace(tzinfo=timezone.utc)
    
    age_hours = (now - last_refresh).total_seconds() / 3600
    age_days = age_hours / 24
    
    if age_days <= 1:
        return 100.0
    elif age_days >= max_age_days:
        return 0.0
    else:
        # Linear decay from 100 to 0
        return 100.0 * (1 - (age_days - 1) / (max_age_days - 1))


def calculate_accuracy_stability(accuracy_history: List[float], window_days: int = 7) -> float:
    """Calculate stability score based on accuracy variance.
    
    Args:
        accuracy_history: List of recent accuracy values
        window_days: Number of days to consider
        
    Returns:
        Score from 0-100 (100 = very stable, 0 = highly variable)
    """
    if not accuracy_history or len(accuracy_history) < 2:
        return 50.0  # Neutral score if insufficient data
    
    # Calculate coefficient of variation (CV)
    mean_acc = sum(accuracy_history) / len(accuracy_history)
    if mean_acc == 0:
        return 0.0
        
    variance = sum((x - mean_acc) ** 2 for x in accuracy_history) / len(accuracy_history)
    std_dev = variance ** 0.5
    cv = std_dev / mean_acc
    
    # Convert CV to score: lower CV = higher stability
    # CV of 0.05 (5%) or less = 100 score
    # CV of 0.20 (20%) or more = 0 score
    if cv <= 0.05:
        return 100.0
    elif cv >= 0.20:
        return 0.0
    else:
        return 100.0 * (1 - (cv - 0.05) / 0.15)


def calculate_volume_score(current_volume: int, expected_volume: int, tolerance: float = 0.3) -> float:
    """Calculate volume score based on prediction count.
    
    Args:
        current_volume: Current prediction count
        expected_volume: Expected prediction count
        tolerance: Acceptable deviation (0.3 = ±30%)
        
    Returns:
        Score from 0-100
    """
    if expected_volume == 0:
        return 100.0 if current_volume == 0 else 50.0
    
    ratio = current_volume / expected_volume
    
    # Perfect if within tolerance
    if abs(ratio - 1.0) <= tolerance:
        return 100.0
    
    # Score decreases with deviation
    deviation = abs(ratio - 1.0)
    if deviation >= 1.0:  # More than 100% off
        return 0.0
    
    return 100.0 * (1 - deviation)


def calculate_alert_score(critical_count: int, warning_count: int, info_count: int) -> float:
    """Calculate alert score (inverse - fewer alerts = better).
    
    Args:
        critical_count: Number of critical alerts
        warning_count: Number of warning alerts
        info_count: Number of info alerts
        
    Returns:
        Score from 0-100 (100 = no alerts, 0 = many critical alerts)
    """
    # Weighted alert score
    weighted_alerts = (critical_count * 10) + (warning_count * 3) + (info_count * 1)
    
    # Max weighted score of 50 = 0 score, 0 = 100 score
    if weighted_alerts >= 50:
        return 0.0
    
    return 100.0 * (1 - weighted_alerts / 50.0)


def calculate_uptime_score(uptime_percentage: float) -> float:
    """Calculate uptime score.
    
    Args:
        uptime_percentage: Uptime as percentage (0-100)
        
    Returns:
        Score from 0-100
    """
    return max(0.0, min(100.0, uptime_percentage))


def calculate_health_score(
    last_refresh: datetime,
    accuracy_history: List[float],
    current_volume: int = 0,
    expected_volume: int = 0,
    critical_alerts: int = 0,
    warning_alerts: int = 0,
    info_alerts: int = 0,
    uptime_pct: float = 100.0
) -> Tuple[float, Dict[str, float]]:
    """Calculate composite health score.
    
    Args:
        last_refresh: Last data refresh timestamp
        accuracy_history: Recent accuracy values
        current_volume: Current prediction count
        expected_volume: Expected prediction count
        critical_alerts: Critical alert count
        warning_alerts: Warning alert count
        info_alerts: Info alert count
        uptime_pct: System uptime percentage
        
    Returns:
        Tuple of (overall_score, component_scores_dict)
    """
    # Calculate component scores
    freshness = calculate_freshness_score(last_refresh)
    stability = calculate_accuracy_stability(accuracy_history)
    volume = calculate_volume_score(current_volume, expected_volume)
    alerts = calculate_alert_score(critical_alerts, warning_alerts, info_alerts)
    uptime = calculate_uptime_score(uptime_pct)
    
    # Weighted composite score
    weights = {
        "freshness": 0.30,
        "stability": 0.25,
        "volume": 0.20,
        "alerts": 0.15,
        "uptime": 0.10
    }
    
    overall = (
        weights["freshness"] * freshness +
        weights["stability"] * stability +
        weights["volume"] * volume +
        weights["alerts"] * alerts +
        weights["uptime"] * uptime
    )
    
    components = {
        "freshness": freshness,
        "stability": stability,
        "volume": volume,
        "alerts": alerts,
        "uptime": uptime
    }
    
    return overall, components


def get_status_indicator(health_score: float) -> str:
    """Get traffic light status indicator.
    
    Args:
        health_score: Overall health score (0-100)
        
    Returns:
        Status string: "🟢 Healthy", "🟡 Warning", or "🔴 Critical"
    """
    if health_score >= 80:
        return "🟢 Healthy"
    elif health_score >= 60:
        return "🟡 Warning"
    else:
        return "🔴 Critical"


def get_health_color(health_score: float) -> str:
    """Get color code for health score.
    
    Args:
        health_score: Overall health score (0-100)
        
    Returns:
        Color string: "green", "yellow", or "red"
    """
    if health_score >= 80:
        return "green"
    elif health_score >= 60:
        return "yellow"
    else:
        return "red"
