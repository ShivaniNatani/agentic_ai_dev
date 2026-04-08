"""Anomaly detection for ML model metrics.

Detects unusual patterns in model performance using statistical methods.
"""
from __future__ import annotations

from typing import Dict, List, Tuple
import pandas as pd
import numpy as np


def calculate_z_score(values: List[float], current_value: float) -> float:
    """Calculate Z-score for anomaly detection.
    
    Args:
        values: Historical values
        current_value: Current value to check
        
    Returns:
        Z-score (number of standard deviations from mean)
    """
    if not values or len(values) < 3:
        return 0.0
    
    mean = np.mean(values)
    std = np.std(values)
    
    if std == 0:
        return 0.0
    
    return (current_value - mean) / std


def is_anomaly(z_score: float, threshold: float = 2.0) -> bool:
    """Check if Z-score indicates an anomaly.
    
    Args:
        z_score: Calculated Z-score
        threshold: Threshold for anomaly (default: 2.0 = 95% confidence)
        
    Returns:
        True if anomalous, False otherwise
    """
    return abs(z_score) > threshold


def detect_trend(values: List[float], window: int = 7) -> Dict[str, any]:
    """Detect trends in metric values using linear regression.
    
    Args:
        values: List of metric values (chronological order)
        window: Number of recent values to consider
        
    Returns:
        Dict with trend info: {slope, direction, strength, prediction}
    """
    if not values or len(values) < 3:
        return {"slope": 0.0, "direction": "stable", "strength": "weak", "prediction": None}
    
    # Use last N values
    recent_values = values[-window:] if len(values) > window else values
    n = len(recent_values)
    
    if n < 2:
        return {"slope": 0.0, "direction": "stable", "strength": "weak", "prediction": None}
    
    # Simple linear regression
    x = np.arange(n)
    y = np.array(recent_values)
    
    # Calculate slope
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    
    numerator = np.sum((x - x_mean) * (y - y_mean))
    denominator = np.sum((x - x_mean) ** 2)
    
    if denominator == 0:
        slope = 0.0
    else:
        slope = numerator / denominator
    
    intercept = y_mean - slope * x_mean
    
    # Determine direction and strength
    if abs(slope) < 0.01:
        direction = "stable"
        strength = "none"
    elif slope > 0:
        direction = "improving"
        strength = "strong" if slope > 0.1 else "moderate" if slope > 0.05 else "weak"
    else:
        direction = "declining"
        strength = "strong" if slope < -0.1 else "moderate" if slope < -0.05 else "weak"
    
    # Predict next value
    next_x = n
    prediction = slope * next_x + intercept
    
    return {
        "slope": slope,
        "direction": direction,
        "strength": strength,
        "prediction": prediction
    }


def calculate_moving_average(values: List[float], window: int = 7) -> List[float]:
    """Calculate moving average for smoothing.
    
    Args:
        values: List of values
        window: Window size for moving average
        
    Returns:
        List of moving average values
    """
    if not values or len(values) < window:
        return values
    
    ma = []
    for i in range(len(values)):
        if i < window - 1:
            ma.append(np.mean(values[:i+1]))
        else:
            ma.append(np.mean(values[i-window+1:i+1]))
    
    return ma


def detect_sudden_change(values: List[float], sensitivity: float = 0.2) -> Dict[str, any]:
    """Detect sudden changes (jumps or drops) in metrics.
    
    Args:
        values: List of metric values
        sensitivity: Threshold for detecting change (0.2 = 20%)
        
    Returns:
        Dict with change info: {detected, magnitude, direction, position}
    """
    if not values or len(values) < 2:
        return {"detected": False, "magnitude": 0.0, "direction": "none", "position": -1}
    
    # Compare last value to recent average
    last_value = values[-1]
    if len(values) >= 7:
        recent_avg = np.mean(values[-7:-1])
    else:
        recent_avg = np.mean(values[:-1])
    
    if recent_avg == 0:
        return {"detected": False, "magnitude": 0.0, "direction": "none", "position": -1}
    
    change = (last_value - recent_avg) / recent_avg
    
    if abs(change) > sensitivity:
        return {
            "detected": True,
            "magnitude": abs(change),
            "direction": "increase" if change > 0 else "decrease",
            "position": len(values) - 1
        }
    
    return {"detected": False, "magnitude": abs(change), "direction": "none", "position": -1}


def predict_threshold_breach(
    values: List[float],
    threshold: float,
    trend_window: int = 14
) -> Dict[str, any]:
    """Predict when a metric will breach a threshold.
    
    Args:
        values: Historical values
        threshold: Threshold value to check
        trend_window: Days to use for trend calculation
        
    Returns:
        Dict with prediction: {will_breach, days_to_breach, confidence}
    """
    if not values or len(values) < 3:
        return {"will_breach": False, "days_to_breach": None, "confidence": "low"}
    
    trend_info = detect_trend(values, trend_window)
    
    # If stable or improving, no breach expected
    if trend_info["direction"] == "stable":
        return {"will_breach": False, "days_to_breach": None, "confidence": "high"}
    
    current_value = values[-1]
    slope = trend_info["slope"]
    
    # Calculate days to breach
    if slope != 0:
        days_to_breach = (threshold - current_value) / slope
    else:
        days_to_breach = float('inf')
    
    # Only predict breach if trend is toward threshold
    if (slope > 0 and threshold > current_value) or (slope < 0 and threshold < current_value):
        will_breach = days_to_breach > 0 and days_to_breach < 30  # Within 30 days
        
        # Determine confidence based on trend strength
        confidence = trend_info["strength"]
        if confidence == "strong":
            confidence = "high"
        elif confidence == "moderate":
            confidence = "medium"
        else:
            confidence = "low"
        
        return {
            "will_breach": will_breach,
            "days_to_breach": int(days_to_breach) if days_to_breach < 1000 else None,
            "confidence": confidence
        }
    
    return {"will_breach": False, "days_to_breach": None, "confidence": "low"}


def analyze_seasonality(values: List[float], period: int = 7) -> Dict[str, any]:
    """Detect seasonal patterns in metrics.
    
    Args:
        values: List of values (should span multiple periods)
        period: Expected period length (default: 7 for weekly)
        
    Returns:
        Dict with seasonality info: {has_pattern, period, strength}
    """
    if not values or len(values) < 2 * period:
        return {"has_pattern": False, "period": period, "strength": "insufficient_data"}
    
    # Simple autocorrelation check
    n = len(values)
    mean = np.mean(values)
    variance = np.var(values)
    
    if variance == 0:
        return {"has_pattern": False, "period": period, "strength": "no_variance"}
    
    # Calculate autocorrelation at lag = period
    autocorr = 0.0
    for i in range(n - period):
        autocorr += (values[i] - mean) * (values[i + period] - mean)
    
    autocorr /= (n - period) * variance
    
    # Strong pattern if autocorr > 0.5
    if autocorr > 0.7:
        strength = "strong"
    elif autocorr > 0.5:
        strength = "moderate"
    elif autocorr > 0.3:
        strength = "weak"
    else:
        strength = "none"
    
    has_pattern = autocorr > 0.5
    
    return {
        "has_pattern": has_pattern,
        "period": period,
        "strength": strength,
        "autocorrelation": autocorr
    }
