# System Health Tab Implementation
# This code will be inserted into main.py before the "Performance" tab section

import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import sys
from pathlib import Path

# Import our new monitoring modules
sys.path.append(str(Path(__file__).parent))
from health_engine import (
    calculate_health_score,
    get_status_indicator,
    get_health_color,
    calculate_freshness_score
)
from anomaly_detector import (
    detect_trend,
    predict_threshold_breach,
    detect_sudden_change
)
from root_cause_analyzer import generate_root_cause_report, format_diagnosis_html

# System Health Tab Content
elif selected_tab == "System Health":
    st.markdown("<div class='badge'>System Health Dashboard</div>", unsafe_allow_html=True)
    st.caption("Real-time health monitoring, predictive insights, and automated diagnostics")

    # Calculate health scores for all models
    model_health_data = []
    
    for model in raw_data.query('model_name.notna()')['model_name'].unique():
        for client in raw_data.query('client_name.notna()')['client_name'].unique():
            model_client_data = raw_data[
                (raw_data['model_name'] == model) &
                (raw_data['client_name'] == client)
            ]
            
            if model_client_data.empty:
                continue
            
            # Get recent accuracy history (last 7 days)
            recent_data = model_client_data.sort_values('date_of_model_refresh', ascending=False).head(7)
            accuracy_col = 'accuracy_pct' if 'accuracy_pct' in recent_data.columns else 'accuracy'
            accuracy_history = recent_data[accuracy_col].dropna().tolist() if accuracy_col in recent_data.columns else []
            
            # Get last refresh
            last_refresh = model_client_data['date_of_model_refresh'].max()
            
            # Calculate health score
            if accuracy_history:
                health_score, components = calculate_health_score(
                    last_refresh=last_refresh,
                    accuracy_history=accuracy_history,
                    current_volume=len(model_client_data),
                    expected_volume=max(10, len(model_client_data)),
                    critical_alerts=0,
                    warning_alerts=0,
                    info_alerts=0,
                    uptime_pct=100.0
                )
                
                status = get_status_indicator(health_score)
                
                model_health_data.append({
                    'Model': model,
                    'Client': client,
                    'Health Score': health_score,
                    'Status': status,
                    'Freshness': components['freshness'],
                    'Stability': components['stability'],
                    'Last Update': last_refresh.strftime('%Y-%m-%d') if pd.notna(last_refresh) else 'N/A'
                })
    
    if model_health_data:
        health_df = pd.DataFrame(model_health_data)
        
        # Display overall system health
        avg_health = health_df['Health Score'].mean()
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric(
                label="Overall System Health",
                value=f"{avg_health:.1f}/100",
                delta="Good" if avg_health >= 80 else "Needs Attention"
            )
        
        with col2:
            healthy_count = len(health_df[health_df['Health Score'] >= 80])
            st.metric(
                label="Healthy Models",
                value=f"{healthy_count}/{len(health_df)}",
                delta=f"{(healthy_count/len(health_df)*100):.0f}%"
            )
        
        with col3:
            fresh_count = len(health_df[health_df['Freshness'] >= 80])
            st.metric(
                label="Fresh Data",
                value=f"{fresh_count}/{len(health_df)}",
                delta=f"{(fresh_count/len(health_df)*100):.0f}%"
            )
        
        with col4:
            stable_count = len(health_df[health_df['Stability'] >= 80])
            st.metric(
                label="Stable Models",
                value=f"{stable_count}/{len(health_df)}",
                delta=f"{(stable_count/len(health_df)*100):.0f}%"
            )
        
        st.markdown("---")
        
        # Health Leaderboard
        st.subheader("📊 Model Health Leaderboard")
        
        # Sort by health score
        health_df_sorted = health_df.sort_values('Health Score', ascending=False)
        
        # Display as styled dataframe
        def color_health_score(val):
            if val >= 80:
                color = '#4caf50'
            elif val >= 60:
                color = '#ff9800'
            else:
                color = '#f44336'
            return f'background-color: {color}; color: white'
        
        styled_health = health_df_sorted.style.applymap(
            color_health_score,
            subset=['Health Score']
        ).format({'Health Score': '{:.1f}', 'Freshness': '{:.1f}', 'Stability': '{:.1f}'})
        
        st.dataframe(styled_health, use_container_width=True)
        
        st.markdown("---")
        
        # Predictive Alerts Section
        st.subheader("🔮 Predictive Insights")
        
        for _, row in health_df_sorted.head(3).iterrows():  # Top 3 models
            model = row['Model']
            client = row['Client']
            
            # Get trend data
            model_data = raw_data[
                (raw_data['model_name'] == model) &
                (raw_data['client_name'] == client)
            ].sort_values('date_of_model_refresh')
            
            accuracy_col = 'accuracy_pct' if 'accuracy_pct' in model_data.columns else 'accuracy'
            if accuracy_col in model_data.columns:
                accuracy_vals = model_data[accuracy_col].dropna().tolist()
                
                if len(accuracy_vals) >= 3:
                    trend = detect_trend(accuracy_vals, window=min(7, len(accuracy_vals)))
                    
                    if trend['direction'] == 'declining' and trend['strength'] in ['moderate', 'strong']:
                        with st.expander(f"⚠️ {model} - {client}: Declining Trend Detected", expanded=False):
                            st.warning(f"**Direction**: {trend['direction'].title()} ({trend['strength']})")
                            st.write(f"**Slope**: {trend['slope']:.4f}")
                            if trend['prediction']:
                                st.write(f"**Predicted Next Value**: {trend['prediction']:.2f}%")
                            
                            # Breach prediction
                            breach = predict_threshold_breach(accuracy_vals, threshold=60.0)
                            if breach['will_breach']:
                                st.error(f"🚨 May breach 60% threshold in ~{breach['days_to_breach']} days (confidence: {breach['confidence']})")
    else:
        st.info("No model health data available")

