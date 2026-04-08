"""Root cause analysis for alert diagnostics.

Automatically diagnoses issues when alerts fire.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import pandas as pd


def _normalize_accuracy_values(values):
    """Coerce accuracy values into 0-1 range, handling percentages gracefully."""
    cleaned = []
    for v in values or []:
        try:
            cleaned.append(float(v))
        except (TypeError, ValueError):
            continue

    if not cleaned:
        return []

    # If any value looks like a percentage (>1), scale all by 100.
    if any(abs(v) > 1 for v in cleaned):
        cleaned = [v / 100.0 for v in cleaned]

    # Clamp to valid probability range
    return [min(max(v, 0.0), 1.0) for v in cleaned]


def analyze_data_freshness(last_refresh: datetime, threshold_hours: int = 48) -> Dict[str, any]:
    """Check if data freshness is the issue.
    
    Args:
        last_refresh: Last data refresh timestamp
        threshold_hours: Maximum acceptable age in hours
        
    Returns:
        Analysis dict with issue status and recommendation
    """
    if pd.isna(last_refresh):
        return {
            "issue": True,
            "severity": "critical",
            "description": "No data refresh timestamp found",
            "recommendation": "Check data pipeline connectivity"
        }
    
    now = datetime.now(timezone.utc)
    if last_refresh.tzinfo is None:
        last_refresh = last_refresh.replace(tzinfo=timezone.utc)
    
    age_hours = (now - last_refresh).total_seconds() / 3600
    
    if age_hours > threshold_hours:
        return {
            "issue": True,
            "severity": "warning" if age_hours < threshold_hours * 2 else "critical",
            "description": f"Data is {age_hours:.1f} hours old (threshold: {threshold_hours}h)",
            "recommendation": "Retrain model with recent data or check data pipeline"
        }
    
    return {
        "issue": False,
        "severity": "none",
        "description": f"Data freshness OK ({age_hours:.1f} hours)",
        "recommendation": None
    }


def analyze_data_volume(current_volume: int, expected_volume: int, tolerance: float = 0.3) -> Dict[str, any]:
    """Check if prediction volume is the issue.
    
    Args:
        current_volume: Current prediction count
        expected_volume: Expected prediction count
        tolerance: Acceptable deviation
        
    Returns:
        Analysis dict
    """
    if expected_volume == 0:
        return {
            "issue": False,
            "severity": "none",
            "description": "No expected volume baseline",
            "recommendation": None
        }
    
    ratio = current_volume / expected_volume
    deviation = abs(ratio - 1.0)
    
    if deviation > tolerance:
        if ratio < 1.0:
            severity = "warning" if ratio > 0.5 else "critical"
            description = f"Low prediction volume: {current_volume} (expected: {expected_volume})"
            recommendation = "Check input data availability or model serving status"
        else:
            severity = "warning"
            description = f"High prediction volume: {current_volume} (expected: {expected_volume})"
            recommendation = "Verify data quality and check for duplicate submissions"
        
        return {
            "issue": True,
            "severity": severity,
            "description": description,
            "recommendation": recommendation
        }
    
    return {
        "issue": False,
        "severity": "none",
        "description": f"Volume OK: {current_volume} predictions",
        "recommendation": None
    }


def analyze_feature_completeness(feature_stats: Dict[str, float]) -> Dict[str, any]:
    """Check for missing or null features.
    
    Args:
        feature_stats: Dict of feature_name -> null_percentage
        
    Returns:
        Analysis dict
    """
    if not feature_stats:
        return {
            "issue": False,
            "severity": "none",
            "description": "Feature statistics not available",
            "recommendation": None
        }
    
    high_null_features = {k: v for k, v in feature_stats.items() if v > 10.0}
    
    if high_null_features:
        features_list = ", ".join([f"{k} ({v:.1f}%)" for k, v in high_null_features.items()])
        return {
            "issue": True,
            "severity": "warning" if len(high_null_features) <= 2 else "critical",
            "description": f"High null percentage in features: {features_list}",
            "recommendation": "Check data quality and feature engineering pipeline"
        }
    
    return {
        "issue": False,
        "severity": "none",
        "description": "Feature completeness OK",
        "recommendation": None
    }


def analyze_accuracy_drop(
    current_accuracy: float,
    historical_accuracy: List[float],
    threshold_drop: float = 0.05
) -> Dict[str, any]:
    """Analyze accuracy drop causes with enhanced trend detection.
    
    Args:
        current_accuracy: Current accuracy value
        historical_accuracy: Historical accuracy values (chronological order)
        threshold_drop: Significant drop threshold (0.05 = 5%)
        
    Returns:
        Analysis dict with detailed recommendations
    """
    if not historical_accuracy:
        return {
            "issue": False,
            "severity": "none",
            "description": "Insufficient historical data for comparison",
            "recommendation": None
        }
    
    avg_historical = sum(historical_accuracy) / len(historical_accuracy)
    drop = avg_historical - current_accuracy
    
    # Enhanced: Check for consecutive degradation (persistent drift)
    consecutive_drops = 0
    if len(historical_accuracy) >= 3:
        # Count how many recent days show degradation
        recent_values = historical_accuracy[-7:] if len(historical_accuracy) >= 7 else historical_accuracy[-3:]
        for i in range(len(recent_values) - 1):
            if recent_values[i+1] < recent_values[i]:
                consecutive_drops += 1
    
    # Enhanced: Detect trend (improving vs degrading)
    is_degrading_trend = consecutive_drops >= 3
    
    # Enhanced: Check if current drop is persistent (not a one-time spike)
    recent_avg = sum(historical_accuracy[-3:]) / min(3, len(historical_accuracy)) if len(historical_accuracy) >= 1 else avg_historical
    recent_drop = recent_avg - current_accuracy
    is_persistent = recent_drop > (threshold_drop * 0.5)  # At least half the threshold
    
    # Stricter criteria: Only flag as drift if significant AND persistent
    if drop > threshold_drop and (is_degrading_trend or is_persistent):
        # Determine severity
        if drop > threshold_drop * 3:  # 15% drop
            severity = "critical"
        elif drop > threshold_drop * 2:  # 10% drop
            severity = "warning"
        else:
            severity = "info"
        
        drop_pct = drop * 100
        
        # Build detailed recommendation based on pattern
        if is_degrading_trend:
            primary_cause = "Persistent degradation trend"
            recommendations = [
                "**Immediate:**",
                "1. Compare current vs training data distributions (check for data drift)",
                "2. Review recent operational/workflow changes",
                "3. Validate input feature quality and completeness",
                "",
                "**Follow-up:**",
                "1. Analyze feature importance shifts",
                "2. Consider model retraining if drift persists > 7 days",
                "3. Review similar clients for system-wide vs isolated issue"
            ]
        else:
            primary_cause = "Sudden accuracy drop"
            recommendations = [
                "**Immediate:**",
                "1. Check for data quality issues in recent predictions",
                "2. Verify no system changes or updates were deployed",
                "3. Review input data completeness (missing features?)",
                "",
                "**If issue persists:**",
                "1. Investigate external factors (regulatory changes, workflow updates)",
                "2. Compare prediction volume and distribution vs baseline",
                "3. Escalate to ML engineering team"
            ]
        
        recommendation_text = "\n".join(recommendations)
        
        return {
            "issue": True,
            "severity": severity,
            "description": f"{primary_cause}: {drop_pct:.1f}% drop (current: {current_accuracy:.1%}, baseline: {avg_historical:.1%})",
            "recommendation": recommendation_text,
            "details": {
                "consecutive_drops": consecutive_drops,
                "is_degrading_trend": is_degrading_trend,
                "is_persistent": is_persistent,
                "drop_percentage": drop_pct
            }
        }
    
    # Minor drop or temporary spike - don't flag
    return {
        "issue": False,
        "severity": "none",
        "description": f"Accuracy within acceptable range ({current_accuracy:.1%}, baseline: {avg_historical:.1%})",
        "recommendation": None
    }


def analyze_absolute_accuracy(current_accuracy: float, threshold: float = 0.60) -> Dict[str, any]:
    """Check if accuracy is below absolute critical threshold."""
    if current_accuracy < threshold:
        return {
            "issue": True,
            "severity": "critical",
            "description": f"Critical: Accuracy {current_accuracy:.1%} is below minimal threshold ({threshold:.0%})",
            "recommendation": "IMMEDIATE: Model performance is unacceptable. Trigger retraining or fallback to manual process."
        }
    return {
        "issue": False,
        "severity": "none",
        "description": f"Accuracy above minimal threshold ({threshold:.0%})",
        "recommendation": None
    }


def generate_root_cause_report(
    model_name: str,
    client_name: str,
    alert_type: str,
    last_refresh: Optional[datetime] = None,
    current_accuracy: Optional[float] = None,
    historical_accuracy: Optional[List[float]] = None,
    current_volume: Optional[int] = None,
    expected_volume: Optional[int] = None,
    feature_stats: Optional[Dict[str, float]] = None
) -> Dict[str, any]:
    """Generate comprehensive root cause analysis report.
    
    Args:
        model_name: Name of the model
        client_name: Name of the client
        alert_type: Type of alert triggered
        last_refresh: Last data refresh timestamp
        current_accuracy: Current accuracy value
        historical_accuracy: Historical accuracy values
        current_volume: Current prediction volume
        expected_volume: Expected prediction volume
        feature_stats: Feature null percentages
        
    Returns:
        Comprehensive analysis report
    """
    checks = []
    
    # Check data freshness
    if last_refresh:
        freshness_analysis = analyze_data_freshness(last_refresh)
        checks.append(("Data Freshness", freshness_analysis))
    
    # Check data volume
    if current_volume is not None and expected_volume is not None:
        volume_analysis = analyze_data_volume(current_volume, expected_volume)
        checks.append(("Prediction Volume", volume_analysis))
    
    # Check feature completeness
    if feature_stats:
        feature_analysis = analyze_feature_completeness(feature_stats)
        checks.append(("Feature Completeness", feature_analysis))
    
    # Check accuracy drop
    normalized_history = _normalize_accuracy_values(historical_accuracy or [])
    normalized_current_list = _normalize_accuracy_values([current_accuracy] if current_accuracy is not None else [])
    normalized_current = normalized_current_list[0] if normalized_current_list else None

    if normalized_current is not None:
        # Check 1: Drift/Drop Analysis
        if normalized_history:
            accuracy_analysis = analyze_accuracy_drop(normalized_current, normalized_history)
            checks.append(("Accuracy Drift Analysis", accuracy_analysis))
        
        # Check 2: Absolute Threshold Analysis (New)
        # Assuming typical threshold if not provided, or deriving from alert content if possible
        # For now, using default 0.60 or trying to contextually guess
        # Ideally this function would accept a threshold argument, but for now we defaults or 60%
        abs_analysis = analyze_absolute_accuracy(normalized_current)
        if abs_analysis["issue"]:
             checks.append(("Absolute Accuracy Check", abs_analysis))
    
    # Identify root cause (highest severity issue)
    root_cause = None
    all_recommendations = []
    
    # Include "info" to avoid KeyErrors when low-severity analyses are returned.
    severity_order = {"critical": 3, "warning": 2, "info": 1.5, "none": 1}
    
    for check_name, analysis in checks:
        if analysis["issue"]:
            if not root_cause or severity_order[analysis["severity"]] > severity_order[root_cause["severity"]]:
                root_cause = {
                    "check": check_name,
                    **analysis
                }
        
        if analysis["recommendation"]:
            all_recommendations.append(analysis["recommendation"])
    
    return {
        "model": model_name,
        "client": client_name,
        "alert": alert_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks_performed": len(checks),
        "root_cause": root_cause,
        "all_checks": dict(checks),
"recommendations": all_recommendations[:3]  # Top 3
    }


def format_diagnosis_html(report: Dict[str, any]) -> str:
    """Format diagnosis report as HTML for display.
    
    Args:
        report: Root cause analysis report
        
    Returns:
        HTML formatted diagnosis
    """
    model = report["model"]
    client = report["client"]
    alert = report["alert"]
    
    card_bg = "#0f172a"           # dark base for contrast
    card_border = "#f97316"       # bright amber border
    text_primary = "#e5e7eb"      # light gray text
    title_color = "#f97316"
    detail_muted = "#cbd5e1"

    html = f"""<div style="
        border: 1px solid {card_border};
        border-radius: 12px;
        padding: 16px 18px;
        margin: 12px 0;
        background-color: {card_bg};
        color: {text_primary};
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    ">
    <h4 style="margin: 0 0 10px 0; color: {title_color}; font-weight: 700;">🔍 Automated Root Cause Analysis</h4>
    <p style="margin: 6px 0; color: {detail_muted};"><strong>Model:</strong> {model} &nbsp;|&nbsp; <strong>Client:</strong> {client}</p>
    <p style="margin: 6px 0; color: {detail_muted};"><strong>Alert:</strong> {alert}</p>"""
    
    if report["root_cause"]:
        rc = report["root_cause"]
        severity_colors = {"critical": "#f87171", "warning": "#fbbf24", "info": "#93c5fd", "none": "#34d399"}
        color = severity_colors.get(rc["severity"], "#93c5fd")
        
        html += f"""<div style="
        margin-top: 14px;
        padding: 12px 14px;
        background-color: #111827;
        border-left: 4px solid {color};
        border-radius: 10px;
    ">
    <p style="margin: 4px 0; color: {color}; font-weight: 700;"><strong>❌ Root Cause Identified: {rc['check']}</strong></p>
    <p style="margin: 4px 0; color: {text_primary};">{rc['description']}</p>
    <p style="margin: 4px 0; color: {text_primary};"><strong style="color: #fbbf24;">💡 Recommendation:</strong> {rc['recommendation']}</p>
</div>"""
    else:
        html += """<p style="margin-top: 15px; color: #388e3c;">✅ All automated checks passed. Manual investigation may be needed.</p>"""
    
    html += "</div>"
    
    return html
