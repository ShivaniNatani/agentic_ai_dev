import os
import math
import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="Claim Response Analytics", layout="wide")

# ---------------------------
# Config
# ---------------------------
DATA_FILE = "GIA_Data_Analysis_New.csv"

PAYER_COL = "Payer_name"
SUBMIT_COL = "Last_bill_date"   # submission date
RESP_COL   = "Post_Date"        # response date
RESP_DAYS_COL = "DaysBetween"   # optional

CHARGED_COL = "Charged_Amt"
PAID_COL    = "Paid_Amount"

DOW_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# ---------------------------
# Helpers
# ---------------------------
def to_dt(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s, errors="coerce")

def wom_7day(dt: pd.Series) -> pd.Series:
    # Week-of-month: [1-7]=1, [8-14]=2, [15-21]=3, [22-28]=4, [29-31]=5
    return ((dt.dt.day - 1) // 7 + 1).astype("Int64")

def month_lag(submit_dt: pd.Series, resp_dt: pd.Series) -> pd.Series:
    return ((resp_dt.dt.year - submit_dt.dt.year) * 12 + (resp_dt.dt.month - submit_dt.dt.month)).astype("Int64")

def quantiles(s: pd.Series) -> dict:
    s = s.dropna()
    if len(s) == 0:
        return {"p10": np.nan, "p50": np.nan, "p75": np.nan, "p90": np.nan}
    return {
        "p10": float(np.nanpercentile(s, 10)),
        "p50": float(np.nanpercentile(s, 50)),
        "p75": float(np.nanpercentile(s, 75)),
        "p90": float(np.nanpercentile(s, 90)),
    }

def safe_expected_needed(desired: int, p: float):
    if p is None or np.isnan(p) or p <= 0:
        return None
    return int(math.ceil(desired / p))

def lag_label(k: int) -> str:
    if k == 0:
        return "Same month"
    if k == 1:
        return "Next month"
    return f"{k} months later"

def fmt_date_for_metric(ts: pd.Timestamp) -> str:
    # Streamlit st.metric cannot accept datetime.date objects in some versions, so return a string
    if pd.isna(ts):
        return "—"
    return ts.strftime("%Y-%m-%d")

def fmt_date_long(ts: pd.Timestamp) -> str:
    if pd.isna(ts):
        return "—"
    return ts.strftime("%a %d %b %Y")

def week_of_month_from_ts(ts: pd.Timestamp) -> int:
    return int(((ts.day - 1) // 7) + 1)

@st.cache_data(show_spinner=False)
def load_and_prepare(csv_path: str) -> pd.DataFrame:
    df_raw = pd.read_csv(csv_path)
    df_raw.columns = df_raw.columns.astype(str).str.strip()

    required = [PAYER_COL, SUBMIT_COL, RESP_COL]
    missing = [c for c in required if c not in df_raw.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df_raw.copy()

    # normalize payer (prevents sorting errors)
    df[PAYER_COL] = df[PAYER_COL].fillna("Unknown").astype(str).str.strip()

    # parse dates
    df[SUBMIT_COL] = to_dt(df[SUBMIT_COL])
    df[RESP_COL]   = to_dt(df[RESP_COL])

    # response days
    if RESP_DAYS_COL in df.columns:
        df["response_days"] = pd.to_numeric(df[RESP_DAYS_COL], errors="coerce")
    else:
        df["response_days"] = (df[RESP_COL] - df[SUBMIT_COL]).dt.days

    # amounts (optional but used for payment analytics / collection planner)
    if CHARGED_COL in df.columns:
        df["charged_amt"] = pd.to_numeric(df[CHARGED_COL], errors="coerce")
    else:
        df["charged_amt"] = np.nan

    if PAID_COL in df.columns:
        df["paid_amt"] = pd.to_numeric(df[PAID_COL], errors="coerce")
    else:
        df["paid_amt"] = np.nan

    # collection rate per row (paid/charged)
    df["collect_rate"] = np.where(df["charged_amt"] > 0, df["paid_amt"] / df["charged_amt"], np.nan)

    # keep valid rows
    df = df[df[SUBMIT_COL].notna() & df[RESP_COL].notna() & df["response_days"].notna()].copy()

    # derived fields
    df["submit_wom"] = wom_7day(df[SUBMIT_COL])
    df["resp_wom"]   = wom_7day(df[RESP_COL])
    df["month_lag"]  = month_lag(df[SUBMIT_COL], df[RESP_COL])

    df["submit_dom"] = df[SUBMIT_COL].dt.day.astype("Int64")
    df["submit_dow"] = df[SUBMIT_COL].dt.day_name()

    df["submit_month"] = df[SUBMIT_COL].dt.to_period("M").astype(str)  # "YYYY-MM"
    df["resp_month"]   = df[RESP_COL].dt.to_period("M").astype(str)

    df["resp_dow"] = df[RESP_COL].dt.day_name()

    # lag buckets for payment receipt analysis
    df["week_lag"] = (df["response_days"] // 7).astype("Int64")
    df["resp_week"] = df[RESP_COL].dt.to_period("W-MON").astype(str)  # ISO-ish weeks starting Monday

    return df

# ---------------------------
# Load data
# ---------------------------
st.title("Claim Response Analytics (Business View)")
st.caption("Default view = overall (all payers, all months). Use filters and click **Apply filters**.")

base_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(base_dir, DATA_FILE)

if not os.path.exists(csv_path):
    st.error(f"Could not find {DATA_FILE} in the same folder as app.py.\nExpected path:\n{csv_path}")
    st.stop()

try:
    df = load_and_prepare(csv_path)
except Exception as e:
    st.error(f"Failed to load/prepare data: {e}")
    st.stop()

if df.empty:
    st.warning("No valid rows after parsing dates/response_days.")
    st.stop()

# ---------------------------
# Sidebar filters with Apply button (kept clean)
# ---------------------------
st.sidebar.header("Filters")

all_payers = sorted(df[PAYER_COL].unique().tolist())
all_months = sorted(df["submit_month"].unique().tolist())

if "applied" not in st.session_state:
    st.session_state.applied = {
        "enable_filters": False,
        "payer_mode": "All payers",
        "selected_payers": all_payers,
        "submit_month": "All months",
        "date_range": (df[SUBMIT_COL].min().date(), df[SUBMIT_COL].max().date()),
        "lag_range": (int(df["month_lag"].min()), int(df["month_lag"].max())),
    }

ap = st.session_state.applied

with st.sidebar.expander("Filter controls", expanded=True):
    enable_filters = st.toggle("Enable filters", value=ap["enable_filters"])

    submit_month = st.selectbox(
        "Submission month",
        options=["All months"] + all_months,
        index=(["All months"] + all_months).index(ap["submit_month"]) if ap["submit_month"] in (["All months"] + all_months) else 0
    )

    payer_mode = st.selectbox(
        "Payer selection",
        options=["All payers", "Choose payers"],
        index=0 if ap["payer_mode"] == "All payers" else 1
    )

    if payer_mode == "Choose payers":
        selected_payers = st.multiselect(
            "Pick payer(s)",
            options=all_payers,
            default=ap["selected_payers"] if ap["payer_mode"] == "Choose payers" else all_payers[:10],
        )
        if not selected_payers:
            st.warning("Select at least one payer (or switch back to All payers).")
    else:
        selected_payers = all_payers

    submit_min, submit_max = df[SUBMIT_COL].min(), df[SUBMIT_COL].max()
    date_range = st.date_input(
        "Submission date range (optional)",
        value=ap["date_range"],
        min_value=submit_min.date(),
        max_value=submit_max.date(),
        help="If you select a specific Submission month above, that month filter overrides this range.",
    )

    lag_min = int(df["month_lag"].min()) if df["month_lag"].notna().any() else 0
    lag_max = int(df["month_lag"].max()) if df["month_lag"].notna().any() else 0
    lag_range = st.slider(
        "Month lag (response month - submit month)",
        min_value=lag_min,
        max_value=lag_max,
        value=ap["lag_range"],
        help="0 = response in same month, 1 = next month, etc.",
    )

    apply_filters = st.button("Apply filters", type="primary")

if apply_filters:
    st.session_state.applied = {
        "enable_filters": enable_filters,
        "payer_mode": payer_mode,
        "selected_payers": selected_payers,
        "submit_month": submit_month,
        "date_range": date_range,
        "lag_range": lag_range,
    }
    ap = st.session_state.applied

# ---------------------------
# Apply filters (overall by default)
# ---------------------------
if not ap["enable_filters"]:
    dff = df.copy()
else:
    dff = df.copy()
    dff = dff[dff[PAYER_COL].isin(ap["selected_payers"])].copy()

    if ap["submit_month"] != "All months":
        dff = dff[dff["submit_month"] == ap["submit_month"]].copy()
    else:
        start = pd.to_datetime(ap["date_range"][0])
        end = pd.to_datetime(ap["date_range"][1]) + pd.Timedelta(days=1)
        dff = dff[(dff[SUBMIT_COL] >= start) & (dff[SUBMIT_COL] < end)].copy()

    dff = dff[(dff["month_lag"] >= ap["lag_range"][0]) & (dff["month_lag"] <= ap["lag_range"][1])].copy()

if dff.empty:
    st.warning("No rows match the applied filters.")
    st.stop()

# ---------------------------
# KPIs
# ---------------------------
st.subheader("Overall KPIs" if not ap["enable_filters"] else "KPIs for Applied Filters")
k1, k2, k3, k4 = st.columns(4)
k1.metric("Claims", f"{len(dff):,}")
k2.metric("Avg response days", f"{dff['response_days'].mean():.2f}")
k3.metric("Median response days", f"{dff['response_days'].median():.2f}")
k4.metric("90th pct response days", f"{np.nanpercentile(dff['response_days'], 90):.2f}")

st.divider()

# ---------------------------
# 1) Payer performance
# ---------------------------
st.subheader("1) Which payers respond slowest / fastest?")
payer_stats = (
    dff.groupby(PAYER_COL)["response_days"]
    .agg(claims="count", avg_days="mean", p90=lambda s: np.nanpercentile(s, 90))
    .reset_index()
)

min_claims_default = min(50, int(payer_stats["claims"].max())) if len(payer_stats) else 1
min_claims = st.slider("Minimum claims to include payer in chart", 1, int(payer_stats["claims"].max()), value=min_claims_default)

payer_stats = payer_stats[payer_stats["claims"] >= min_claims].copy()
payer_stats = payer_stats.sort_values("avg_days", ascending=True).head(25)

fig_payer = px.bar(
    payer_stats,
    x=PAYER_COL,
    y="avg_days",
    hover_data=["claims", "p90"],
    title="Top 25 payers by average response days",
    labels={PAYER_COL: "Payer", "avg_days": "Avg response days"},
)
st.plotly_chart(fig_payer, use_container_width=True)

st.divider()

# ---------------------------
# Payment analytics (Charged / Paid / Collections)
# ---------------------------
st.subheader("Payment analytics")

if dff["charged_amt"].notna().any() or dff["paid_amt"].notna().any():
    c1, c2 = st.columns(2)

    # --- Top payers by charged & paid ---
    payers_amt = (
        dff.groupby(PAYER_COL)
        .agg(
            claims=("response_days", "size"),
            charged_amt=("charged_amt", "sum"),
            paid_amt=("paid_amt", "sum"),
        )
        .reset_index()
    )
    payers_amt["charged_amt"] = payers_amt["charged_amt"].fillna(0.0)
    payers_amt["paid_amt"] = payers_amt["paid_amt"].fillna(0.0)
    payers_amt["collect_rate"] = np.where(payers_amt["charged_amt"] > 0, payers_amt["paid_amt"] / payers_amt["charged_amt"], np.nan)

    top_n = st.slider("Top N payers", min_value=5, max_value=50, value=15, step=5)

    with c1:
        top_charged = payers_amt.sort_values("charged_amt", ascending=False).head(top_n)
        fig_top_charged = px.bar(
            top_charged,
            x=PAYER_COL,
            y="charged_amt",
            hover_data=["paid_amt", "collect_rate", "claims"],
            title=f"Top {top_n} payers by total CHARGED amount",
            labels={PAYER_COL: "Payer", "charged_amt": "Charged amount"},
        )
        st.plotly_chart(fig_top_charged, use_container_width=True)

    with c2:
        top_paid = payers_amt.sort_values("paid_amt", ascending=False).head(top_n)
        fig_top_paid = px.bar(
            top_paid,
            x=PAYER_COL,
            y="paid_amt",
            hover_data=["charged_amt", "collect_rate", "claims"],
            title=f"Top {top_n} payers by total PAID amount",
            labels={PAYER_COL: "Payer", "paid_amt": "Paid amount"},
        )
        st.plotly_chart(fig_top_paid, use_container_width=True)

    st.divider()

    # --- Weekly % of received amount ---
    st.markdown("### % of total paid amount received each week")
    wk = (
        dff.dropna(subset=["resp_week"])
        .groupby("resp_week")["paid_amt"]
        .sum()
        .reset_index()
        .sort_values("resp_week")
    )
    wk["paid_amt"] = wk["paid_amt"].fillna(0.0)
    total_paid = float(wk["paid_amt"].sum()) if len(wk) else 0.0
    wk["pct_of_total_paid"] = (wk["paid_amt"] / total_paid) if total_paid > 0 else 0.0

    fig_week_pct = px.bar(
        wk,
        x="resp_week",
        y="pct_of_total_paid",
        title="% of total PAID amount received by week",
        labels={"resp_week": "Response week", "pct_of_total_paid": "Share of total paid"},
    )
    fig_week_pct.update_traces(hovertemplate="Week %{x}<br>%{y:.1%}<extra></extra>")
    st.plotly_chart(fig_week_pct, use_container_width=True)

    st.divider()

    # --- Monthly collection ---
    st.markdown("### Monthly collection (paid) trend")
    mon = (
        dff.groupby("resp_month")
        .agg(
            paid_amt=("paid_amt", "sum"),
            charged_amt=("charged_amt", "sum"),
            claims=("response_days", "size"),
        )
        .reset_index()
        .sort_values("resp_month")
    )
    mon["paid_amt"] = mon["paid_amt"].fillna(0.0)
    mon["charged_amt"] = mon["charged_amt"].fillna(0.0)
    mon["collect_rate"] = np.where(mon["charged_amt"] > 0, mon["paid_amt"] / mon["charged_amt"], np.nan)

    fig_month_paid = px.line(
        mon,
        x="resp_month",
        y="paid_amt",
        markers=True,
        title="Total PAID amount by response month",
        labels={"resp_month": "Response month", "paid_amt": "Paid amount"},
    )
    st.plotly_chart(fig_month_paid, use_container_width=True)

    with st.expander("Show monthly collection table"):
        st.dataframe(mon, use_container_width=True)

    st.divider()

    # --- Submission week -> receipt week lag (% paid) ---
    st.markdown("### If we submit in Week X, how is PAID amount received in subsequent weeks? (amount-weighted)")
    lag = dff.copy()
    lag = lag[lag["paid_amt"].notna() & (lag["paid_amt"] > 0) & lag["week_lag"].notna()].copy()
    if len(lag) == 0:
        st.info("No paid amount rows available to compute week-lag receipt pattern.")
    else:
        max_lag = int(lag["week_lag"].max())
        cap = st.slider("Max week lag bucket (>= is grouped into last bucket)", 2, max(2, min(20, max_lag)), value=min(8, max_lag))
        lag["week_lag_bucket"] = np.where(lag["week_lag"] >= cap, f"{cap}+", lag["week_lag"].astype(int).astype(str))

        lag_sum = (
            lag.groupby(["submit_wom", "week_lag_bucket"])["paid_amt"]
            .sum()
            .reset_index()
        )
        lag_sum["pct_paid"] = lag_sum["paid_amt"] / lag_sum.groupby("submit_wom")["paid_amt"].transform("sum")
        totals_by_week = lag.groupby("submit_wom").agg(
            total_paid_for_week=("paid_amt", "sum"),
            total_charged_for_week=("charged_amt", "sum"),
            claims=("paid_amt", "size"),
            ).reset_index()

        lag_sum = lag_sum.merge(totals_by_week, on="submit_wom", how="left")
        # order buckets numerically with cap+ at end
        def _key(x):
            return 10**9 if x.endswith("+") else int(x)
        bucket_order = sorted(lag_sum["week_lag_bucket"].unique().tolist(), key=_key)

        fig_lag_paid = px.bar(
            lag_sum,
            x="submit_wom",
            y="pct_paid",
            color="week_lag_bucket",
            barmode="stack",
            title="Paid amount receipt distribution by submission week-of-month",
            labels={"submit_wom": "Submit week-of-month", "pct_paid": "Share of paid amount", "week_lag_bucket": "Week lag (payment after submit)"},
            category_orders={"week_lag_bucket": bucket_order},
            hover_data={
                "paid_amt": ":,.2f",
                "total_charged_for_week": ":,.2f",
                "total_paid_for_week": ":,.2f",
                "pct_paid": ":.1%",
                "claims": True,
            }
        )
        st.plotly_chart(fig_lag_paid, use_container_width=True)

else:
    st.info("Charged_Amt / Paid_Amount columns were not found (or are entirely empty), so payment analytics are hidden.")

st.divider()


# ---------------------------
# 2) Same month vs later (stacked)
# ---------------------------
st.subheader("2) If we submit in Week X, do we get response in same month or later?")
tmp = dff.copy()
tmp["resp_timing"] = np.where(tmp["month_lag"] == 0, "Same month", "Next month or later")

lag_summary = tmp.groupby(["submit_wom", "resp_timing"]).size().reset_index(name="claims")
lag_summary["pct"] = lag_summary["claims"] / lag_summary.groupby("submit_wom")["claims"].transform("sum")

fig_lag_bucket = px.bar(
    lag_summary,
    x="submit_wom",
    y="pct",
    color="resp_timing",
    barmode="stack",
    title="Response timing bucket by submission week-of-month",
    labels={"submit_wom": "Submit week-of-month", "pct": "Share of claims", "resp_timing": "Response timing"},
)
st.plotly_chart(fig_lag_bucket, use_container_width=True)

st.divider()

# ---------------------------
# 3) Month+Week context (stacked) — FIXED ordering, no KeyError
# ---------------------------
st.subheader("3) If we submit in Week X, which week (and which month) do we usually get the response?")

cohort = dff.copy()
cohort["month_lag_num"] = pd.to_numeric(cohort["month_lag"], errors="coerce").fillna(0).astype(int)
cohort["resp_wom_num"] = pd.to_numeric(cohort["resp_wom"], errors="coerce").fillna(0).astype(int)

cohort["resp_bucket"] = cohort["month_lag_num"].map(lag_label) + " - Week " + cohort["resp_wom_num"].astype(str)

bucket_counts = (
    cohort.groupby(["submit_wom", "month_lag_num", "resp_wom_num", "resp_bucket"])
    .size()
    .reset_index(name="claims")
)
bucket_counts["pct"] = bucket_counts["claims"] / bucket_counts.groupby("submit_wom")["claims"].transform("sum")

bucket_counts = bucket_counts.sort_values(["month_lag_num", "resp_wom_num"])

bucket_order = (
    bucket_counts[["month_lag_num", "resp_wom_num", "resp_bucket"]]
    .drop_duplicates()
    .sort_values(["month_lag_num", "resp_wom_num"])["resp_bucket"]
    .tolist()
)

fig_bucket = px.bar(
    bucket_counts,
    x="submit_wom",
    y="pct",
    color="resp_bucket",
    barmode="stack",
    title="Response timing by submission week (month + week shown in legend)",
    labels={"submit_wom": "Submit week-of-month", "pct": "Share of claims", "resp_bucket": "Response timing (month + week)"},
    category_orders={"resp_bucket": bucket_order},
)
st.plotly_chart(fig_bucket, use_container_width=True)

st.divider()

# ---------------------------
# 4) Submission week trend
# ---------------------------
st.subheader("4) How response days change by submission week")
week_trend = dff.groupby("submit_wom")["response_days"].mean().reset_index()
fig_week_trend = px.line(
    week_trend,
    x="submit_wom",
    y="response_days",
    markers=True,
    title="Average response days by submission week-of-month",
    labels={"submit_wom": "Submit week-of-month", "response_days": "Avg response days"},
)
fig_week_trend.update_yaxes(dtick=1, title_text="Average response days")
st.plotly_chart(fig_week_trend, use_container_width=True)

st.divider()

# ---------------------------
# 5) Daily breakdown (business-friendly)
# ---------------------------
st.subheader("5) Daily breakdown: which day is best to submit?")

metric_choice = st.radio(
    "Metric",
    options=["Average response days", "Median response days"],
    horizontal=True,
    index=0
)

agg_func = "mean" if metric_choice.startswith("Average") else "median"

c1, c2 = st.columns(2)

with c1:
    dom = (
        dff.groupby("submit_dom")["response_days"]
        .agg(agg_func)
        .reset_index()
        .sort_values("submit_dom")
    )

    fig_dom = px.line(
        dom,
        x="submit_dom",
        y="response_days",
        markers=True,
        title=f"{metric_choice} by submission day-of-month",
        labels={"submit_dom": "Submission day-of-month", "response_days": metric_choice},
    )
    fig_dom.update_yaxes(dtick=1, title_text="Average response days")
    st.plotly_chart(fig_dom, use_container_width=True)

with c2:
    # Ensure consistent weekday order
    dtmp = dff.copy()
    dtmp["submit_dow"] = pd.Categorical(dtmp["submit_dow"], categories=DOW_ORDER, ordered=True)

    # Week-of-month x weekday summary + counts
    grid = (
        dtmp.groupby(["submit_wom", "submit_dow"])
        .agg(
            response_days=( "response_days", agg_func),
            claims=("response_days", "size")
        )
        .reset_index()
        .sort_values(["submit_wom", "submit_dow"])
    )

    # Business-friendly grouped bar:
    # x = weekday, color = week-of-month (so they can compare week1 vs week2 on Monday etc.)
    fig_grid = px.bar(
        grid,
        x="submit_dow",
        y="response_days",
        color="submit_wom",
        barmode="group",
        title=f"{metric_choice} by weekday (split by week-of-month)",
        labels={
            "submit_dow": "Submission day-of-week",
            "response_days": metric_choice,
            "submit_wom": "Submit week-of-month"
        },
        hover_data={"claims": True, "submit_wom": True}
    )

    st.plotly_chart(fig_grid, use_container_width=True)

    # Optional: show low-volume warning table
    low_vol = grid[grid["claims"] < 20].copy()
    if len(low_vol) > 0:
        with st.expander("Low-volume combinations (interpret carefully)"):
            st.dataframe(low_vol.sort_values("claims"), use_container_width=True)

st.divider()


# ---------------------------
# 5.5) Response receipt pattern
# ---------------------------
st.subheader("6) Response receipt pattern: when do responses arrive?")

# Ensure response date parts exist
tmp = dff.copy()
tmp[RESP_COL] = pd.to_datetime(tmp[RESP_COL], errors="coerce")
tmp = tmp[tmp[RESP_COL].notna()].copy()

tmp["resp_dom"] = tmp[RESP_COL].dt.day
tmp["resp_dow"] = tmp[RESP_COL].dt.day_name()
tmp["resp_wom"] = ((tmp[RESP_COL].dt.day - 1) // 7 + 1).astype(int)

# For ordering weekdays
tmp["resp_dow"] = pd.Categorical(tmp["resp_dow"], categories=DOW_ORDER, ordered=True)

c1, c2 = st.columns(2)

with c1:
    # % responses by day-of-month
    dom_cnt = tmp["resp_dom"].value_counts().sort_index()
    dom_pct = (dom_cnt / dom_cnt.sum()).reset_index()
    dom_pct.columns = ["resp_dom", "pct"]

    fig_resp_dom = px.bar(
        dom_pct,
        x="resp_dom",
        y="pct",
        title="% of responses received by day-of-month",
        labels={"resp_dom": "Response day-of-month", "pct": "% of responses"},
    )
    fig_resp_dom.update_traces(hovertemplate="Day %{x}<br>%{y:.1%}<extra></extra>")
    st.plotly_chart(fig_resp_dom, use_container_width=True)

with c2:
    # % responses by (week-of-month x day-of-week)
    grid = (
        tmp.groupby(["resp_wom", "resp_dow"])
        .size()
        .reset_index(name="n")
    )
    grid["pct"] = grid["n"] / grid["n"].sum()

    # Business-friendly grouped bar: x=weekday, color=week-of-month
    fig_resp_grid = px.bar(
        grid.sort_values(["resp_wom", "resp_dow"]),
        x="resp_dow",
        y="pct",
        color="resp_wom",
        barmode="group",
        title="% responses by day-of-week (split by response week-of-month)",
        labels={"resp_dow": "Response day-of-week", "pct": "% of responses", "resp_wom": "Response week-of-month"},
        hover_data={"n": True}
    )
    fig_resp_grid.update_traces(hovertemplate="%{x}<br>Week %{legendgroup}<br>%{y:.1%}<br>Count=%{customdata[0]}<extra></extra>")
    st.plotly_chart(fig_resp_grid, use_container_width=True)

# ---------------------------
# 6) Forecast planner (Prev month Week 5 → Target month) + daily calendar hover breakdown
#   - Forecasting ignores dashboard filters (uses df, not dff)
#   - Training = last 3 months submissions ending previous month end
#   - Plan window = prev month day 29..end (Week 5) + all target month
#   - Hover shows breakdown OUT OF THAT DAY'S planned_submissions (e.g., 530)
#   - Response windows are 2–3 day bins (default 3 -> "Apr 04–Apr 06")
# ---------------------------
st.subheader("6) Collection planner (plan submissions to collect a target amount)")

import numpy as np
import pandas as pd
import math
import plotly.express as px

# -------------------------
# Controls
# -------------------------
boxc = st.container(border=True)
with boxc:
    c1, c2, c3 = st.columns([1.2, 1.4, 1.6])

    with c1:
        payer_options = ["All payers"] + sorted(df[PAYER_COL].dropna().astype(str).unique().tolist())
        plan_payer_amt = st.selectbox("Planner payer (optional)", payer_options, index=0, key="plan_payer_amt")

    with c2:
        default_target = pd.Timestamp.today().to_period("M").strftime("%Y-%m")
        target_month_str_amt = st.text_input("Target COLLECTION month (YYYY-MM)", value=default_target, key="target_month_str_amt")
        try:
            target_month_amt = pd.Period(target_month_str_amt, "M")
        except Exception:
            st.error("Invalid month format. Use YYYY-MM (e.g., 2026-04).")
            st.stop()

        target_paid_amt = st.number_input(
            "Target PAID amount in target month",
            min_value=1.0,
            value=100000.0,
            step=5000.0,
            help="Planner will estimate how much CHARGED amount to submit in the plan window to collect this PAID amount in the target month."
        )

    with c3:
        min_rows_slot_amt = st.slider(
            "Min rows for slot-specific probabilities (fallback below this)",
            min_value=10,
            max_value=500,
            value=50,
            key="min_rows_slot_amt"
        )
        st.caption("Plan window = previous month Week 5 (day 29+) + target month (same as response planner below).")

# -------------------------
# Build forecasting base (IGNORE dff filters)
# -------------------------
base_amt = df.copy()
base_amt[PAYER_COL] = base_amt[PAYER_COL].fillna("Unknown").astype(str).str.strip()
if plan_payer_amt != "All payers":
    base_amt = base_amt[base_amt[PAYER_COL] == plan_payer_amt].copy()

# require amounts
base_amt["charged_amt"] = pd.to_numeric(base_amt.get(CHARGED_COL, np.nan), errors="coerce")
base_amt["paid_amt"] = pd.to_numeric(base_amt.get(PAID_COL, np.nan), errors="coerce")
base_amt = base_amt[base_amt["charged_amt"].notna() & (base_amt["charged_amt"] > 0)].copy()
base_amt = base_amt[base_amt[SUBMIT_COL].notna() & base_amt[RESP_COL].notna()].copy()
base_amt["submit_dt"] = pd.to_datetime(base_amt[SUBMIT_COL], errors="coerce")
base_amt["resp_dt"] = pd.to_datetime(base_amt[RESP_COL], errors="coerce")
base_amt = base_amt[base_amt["submit_dt"].notna() & base_amt["resp_dt"].notna()].copy()
base_amt["submit_period"] = base_amt["submit_dt"].dt.to_period("M")
base_amt["resp_period"] = base_amt["resp_dt"].dt.to_period("M")
base_amt["month_lag_num"] = ((base_amt["resp_dt"].dt.year - base_amt["submit_dt"].dt.year) * 12 + (base_amt["resp_dt"].dt.month - base_amt["submit_dt"].dt.month)).astype(int)
base_amt["submit_wom"] = ((base_amt["submit_dt"].dt.day - 1) // 7 + 1).astype(int)
base_amt["submit_dow"] = base_amt["submit_dt"].dt.day_name().astype(str)
base_amt["collect_rate"] = np.where(base_amt["charged_amt"] > 0, base_amt["paid_amt"] / base_amt["charged_amt"], np.nan)

if base_amt.empty:
    st.warning("No rows with Charged_Amt found for the chosen payer/data. Collection planner is hidden.")
else:
    # target + planning window
    prev_month_amt = target_month_amt - 1
    target_start_amt = target_month_amt.to_timestamp(how="start").normalize()
    target_end_amt = target_month_amt.to_timestamp(how="end").normalize()
    prev_end_amt = prev_month_amt.to_timestamp(how="end").normalize()
    if prev_end_amt.day >= 29:
        plan_start_amt = pd.Timestamp(prev_end_amt.year, prev_end_amt.month, 29)
    else:
        plan_start_amt = prev_end_amt - pd.Timedelta(days=6)
    plan_end_amt = target_end_amt

    plan_days_amt = pd.date_range(plan_start_amt, plan_end_amt, freq="D")
    plan_df_amt = pd.DataFrame({"submit_date": plan_days_amt})
    plan_df_amt["submit_period"] = plan_df_amt["submit_date"].dt.to_period("M")
    plan_df_amt["submit_wom"] = ((plan_df_amt["submit_date"].dt.day - 1) // 7 + 1).astype(int)
    plan_df_amt["submit_dow"] = plan_df_amt["submit_date"].dt.day_name()
    plan_df_amt["needed_lag"] = np.where(plan_df_amt["submit_period"] == target_month_amt, 0, 1).astype(int)

    # training data: last 3 months submissions ending previous month end
    prev_month_end_plus1_amt = (prev_end_amt + pd.Timedelta(days=1))
    train_start_amt = (prev_month_amt - 2).to_timestamp(how="start").normalize()
    train_end_amt = prev_month_end_plus1_amt
    train_amt = base_amt[(base_amt["submit_dt"] >= train_start_amt) & (base_amt["submit_dt"] < train_end_amt)].copy()
    if train_amt.empty:
        st.warning("No training data in the last 3 months window. Widen data range for collection planner.")
    else:
        # slot stats for lag0/lag1 (count-based) + collection rate (amount-based)
        slot_amt = (
            train_amt.groupby(["submit_wom", "submit_dow"])
            .agg(
                n=("month_lag_num", "size"),
                lag0=("month_lag_num", lambda s: int((s == 0).sum())),
                lag1=("month_lag_num", lambda s: int((s == 1).sum())),
                sum_charged=("charged_amt", "sum"),
                sum_paid=("paid_amt", "sum"),
            )
            .reset_index()
        )
        slot_amt["p_lag0"] = np.where(slot_amt["n"] > 0, slot_amt["lag0"] / slot_amt["n"], 0.0)
        slot_amt["p_lag1"] = np.where(slot_amt["n"] > 0, slot_amt["lag1"] / slot_amt["n"], 0.0)
        slot_amt["slot_collect_rate"] = np.where(slot_amt["sum_charged"] > 0, slot_amt["sum_paid"] / slot_amt["sum_charged"], np.nan)

        overall_p0_amt = float((train_amt["month_lag_num"] == 0).mean())
        overall_p1_amt = float((train_amt["month_lag_num"] == 1).mean())
        overall_collect_rate_amt = float((train_amt["paid_amt"].sum() / train_amt["charged_amt"].sum())) if train_amt["charged_amt"].sum() > 0 else np.nan
        avg_charge_per_claim = float(train_amt["charged_amt"].mean())

        plan_df_amt = plan_df_amt.merge(
            slot_amt[["submit_wom", "submit_dow", "n", "p_lag0", "p_lag1", "slot_collect_rate", "sum_charged"]],
            on=["submit_wom", "submit_dow"],
            how="left"
        )
        small_amt = (plan_df_amt["n"].fillna(0) < min_rows_slot_amt)
        plan_df_amt.loc[small_amt, "p_lag0"] = overall_p0_amt
        plan_df_amt.loc[small_amt, "p_lag1"] = overall_p1_amt
        plan_df_amt.loc[small_amt, "slot_collect_rate"] = overall_collect_rate_amt

        plan_df_amt["hit_prob"] = np.where(plan_df_amt["needed_lag"] == 0, plan_df_amt["p_lag0"], plan_df_amt["p_lag1"]).astype(float)
        plan_df_amt["eff_paid_per_charged"] = (plan_df_amt["hit_prob"] * plan_df_amt["slot_collect_rate"]).astype(float)

        # weights by historical charged submitted in slot (fallback to 1)
        plan_df_amt["w"] = plan_df_amt["sum_charged"].fillna(1.0)
        plan_df_amt["w_norm"] = plan_df_amt["w"] / plan_df_amt["w"].sum()

        overall_eff = float((plan_df_amt["eff_paid_per_charged"] * plan_df_amt["w_norm"]).sum())

        m1a, m2a, m3a, m4a = st.columns(4)
        m1a.metric("Target paid amount", f"{target_paid_amt:,.2f}")
        m2a.metric("Est. paid per $ charged (plan window)", f"{overall_eff:.2%}")
        m3a.metric("Est. collection rate (train)", f"{overall_collect_rate_amt:.2%}" if not np.isnan(overall_collect_rate_amt) else "—")
        m4a.metric("Avg charged / claim (train)", f"{avg_charge_per_claim:,.2f}")

        if overall_eff <= 0.0001:
            st.error("Estimated paid-per-charged in target month is extremely low (likely many payments occur after >1 month). Extend planner to lag2/lag3 if needed.")
        else:
            total_charged_needed = float(target_paid_amt / overall_eff)
            plan_df_amt["planned_charged"] = (plan_df_amt["w_norm"] * total_charged_needed)

            # weekly summary
            weekly_amt = (
                plan_df_amt.groupby(["submit_period", "submit_wom"])
                .agg(
                    planned_charged=("planned_charged", "sum"),
                    avg_eff=("eff_paid_per_charged", "mean"),
                )
                .reset_index()
            )
            weekly_amt["submit_month"] = weekly_amt["submit_period"].astype(str)
            weekly_amt.rename(columns={"submit_wom": "Submit week-of-month"}, inplace=True)
            weekly_amt["expected_paid_in_target"] = weekly_amt["planned_charged"] * weekly_amt["avg_eff"]

            t1a, t2a, t3a = st.columns(3)
            t1a.metric("Estimated CHARGED to submit (total)", f"{total_charged_needed:,.2f}")
            t2a.metric("Implied # claims (approx)", f"{(total_charged_needed / avg_charge_per_claim):,.0f}" if avg_charge_per_claim > 0 else "—")
            t3a.metric("Expected PAID from plan",f"{float((plan_df_amt['planned_charged'] * plan_df_amt['eff_paid_per_charged']).sum()):,.2f}")
            st.markdown("### A) Weekly collection planner (charged to submit)")
            st.dataframe(
                weekly_amt[["submit_month", "Submit week-of-month", "planned_charged", "avg_eff", "expected_paid_in_target"]],
                use_container_width=True
            )

            fig_week_amt = px.bar(
                weekly_amt,
                x="Submit week-of-month",
                y="planned_charged",
                color="submit_month",
                barmode="stack",
                title="Planned CHARGED submissions by week-of-month (stacked by month)"
            )
            st.plotly_chart(fig_week_amt, use_container_width=True)

            st.markdown("### B) Daily charged submission plan")
            fig_daily_amt = px.bar(
                plan_df_amt,
                x="submit_date",
                y="planned_charged",
                color=plan_df_amt["submit_period"].astype(str),
                title=f"Daily CHARGED submission plan (from {plan_start_amt.date()} to {plan_end_amt.date()}) for collections in {target_month_amt}"
            )
            st.plotly_chart(fig_daily_amt, use_container_width=True)

            with st.expander("Show daily charged plan table"):
                show_amt = plan_df_amt[["submit_date", "submit_period", "submit_wom", "submit_dow", "planned_charged", "eff_paid_per_charged"]].copy()
                show_amt["submit_period"] = show_amt["submit_period"].astype(str)
                st.dataframe(show_amt, use_container_width=True)

st.divider()

st.subheader("7) Forecast planner (Prev month Week 5 → Target month calendar + response windows)")

import numpy as np
import pandas as pd
import math
import plotly.express as px

# -------------------------
# Controls
# -------------------------
box = st.container(border=True)
with box:
    c1, c2, c3 = st.columns([1.2, 1.2, 1.8])

    with c1:
        payer_options = ["All payers"] + sorted(df[PAYER_COL].dropna().astype(str).unique().tolist())
        plan_payer = st.selectbox("Planner payer (optional)", payer_options, index=0)

    with c2:
        default_target = pd.Timestamp.today().to_period("M").strftime("%Y-%m")
        target_month_str = st.text_input("Target response month (YYYY-MM)", value=default_target)
        try:
            target_month = pd.Period(target_month_str, "M")
        except Exception:
            st.error("Invalid month format. Use YYYY-MM (e.g., 2026-04).")
            st.stop()

        target_responses = st.number_input(
            "Target # responses in target month",
            min_value=1,
            value=10000,
            step=500
        )

    with c3:
        bin_days = st.slider(
            "Response window size (days)",
            min_value=2,
            max_value=3,
            value=3,
            help="3 days gives windows like Apr 04–Apr 06."
        )

        min_rows_slot = st.slider(
            "Min rows for slot-specific probabilities (fallback below this)",
            min_value=10,
            max_value=500,
            value=50
        )

        st.caption(
            "Plan window = previous month Week 5 (day 29+) + target month. "
            "Hover breakdown uses the planned submissions for that day."
        )

# -------------------------
# Helpers
# -------------------------
def week_of_month_from_ts(ts: pd.Timestamp) -> int:
    return int(((ts.day - 1) // 7) + 1)

def safe_prob(num, den):
    return float(num) / float(den) if den and den > 0 else 0.0

def build_bin_windows_for_target_month(target_start: pd.Timestamp, target_end: pd.Timestamp, bin_days: int):
    last_dom = target_end.day
    max_bin = int(((last_dom - 1) // bin_days))
    bin_to_window = {}
    for b in range(0, max_bin + 1):
        start_dom = b * bin_days + 1
        end_dom = min((b + 1) * bin_days, last_dom)
        s = pd.Timestamp(target_start.year, target_start.month, start_dom)
        e = pd.Timestamp(target_start.year, target_start.month, end_dom)
        bin_to_window[b] = (s, e)
    return bin_to_window

def fmt_window(s: pd.Timestamp, e: pd.Timestamp) -> str:
    return f"{s.strftime('%b %d')}–{e.strftime('%b %d')}"

# -------------------------
# Build forecasting base (IGNORE dff filters)
# -------------------------
base = df.copy()
base[PAYER_COL] = base[PAYER_COL].fillna("Unknown").astype(str).str.strip()

if plan_payer != "All payers":
    base = base[base[PAYER_COL] == plan_payer].copy()

if base.empty:
    st.warning("No rows for chosen payer in df.")
    st.stop()

base["submit_dt"] = pd.to_datetime(base[SUBMIT_COL], errors="coerce")
base["resp_dt"] = pd.to_datetime(base[RESP_COL], errors="coerce")
base = base[base["submit_dt"].notna() & base["resp_dt"].notna()].copy()

base["submit_period"] = base["submit_dt"].dt.to_period("M")
base["resp_period"] = base["resp_dt"].dt.to_period("M")
base["month_lag_num"] = pd.to_numeric(base["month_lag"], errors="coerce").fillna(0).astype(int)
base["submit_wom"] = pd.to_numeric(base["submit_wom"], errors="coerce").fillna(0).astype(int)
base["submit_dow"] = base["submit_dow"].astype(str)

# -------------------------
# Define target + planning window
# Planning window: prev month Week 5 + target month
# -------------------------
prev_month = target_month - 1
target_start = target_month.to_timestamp(how="start").normalize()
target_end = target_month.to_timestamp(how="end").normalize()

prev_end = prev_month.to_timestamp(how="end").normalize()

# Week 5 start: day 29..end. If month doesn't have 29, fallback last 7 days.
if prev_end.day >= 29:
    plan_start = pd.Timestamp(prev_end.year, prev_end.month, 29)
else:
    plan_start = prev_end - pd.Timedelta(days=6)

plan_end = target_end

plan_days = pd.date_range(plan_start, plan_end, freq="D")
plan_df = pd.DataFrame({"submit_date": plan_days})
plan_df["submit_period"] = plan_df["submit_date"].dt.to_period("M")
plan_df["submit_wom"] = plan_df["submit_date"].apply(week_of_month_from_ts).astype(int)
plan_df["submit_dow"] = plan_df["submit_date"].dt.day_name()

# needed lag:
# - submit in target month => lag 0
# - submit in prev month (week 5) => lag 1
plan_df["needed_lag"] = np.where(plan_df["submit_period"] == target_month, 0, 1).astype(int)

# -------------------------
# Training data: last 3 months submissions ending previous month end
# Example: target=Apr => train=Jan+Feb+Mar
# -------------------------
prev_month_end_plus1 = (prev_end + pd.Timedelta(days=1))
train_start = (prev_month - 2).to_timestamp(how="start").normalize()
train_end = prev_month_end_plus1

train = base[(base["submit_dt"] >= train_start) & (base["submit_dt"] < train_end)].copy()
if train.empty:
    st.warning("No training data in the last 3 months window. Widen data range.")
    st.stop()

# -------------------------
# Slot hit probabilities: P(lag=0 | slot), P(lag=1 | slot)
# slot = (submit_wom, submit_dow), with fallback to overall if low sample
# -------------------------
slot = (
    train.groupby(["submit_wom", "submit_dow"])["month_lag_num"]
    .agg(
        n="size",
        lag0=lambda s: int((s == 0).sum()),
        lag1=lambda s: int((s == 1).sum()),
    )
    .reset_index()
)
slot["p_lag0"] = slot.apply(lambda r: safe_prob(r["lag0"], r["n"]), axis=1)
slot["p_lag1"] = slot.apply(lambda r: safe_prob(r["lag1"], r["n"]), axis=1)

overall_n = len(train)
overall_p0 = safe_prob(int((train["month_lag_num"] == 0).sum()), overall_n)
overall_p1 = safe_prob(int((train["month_lag_num"] == 1).sum()), overall_n)

plan_df = plan_df.merge(
    slot[["submit_wom", "submit_dow", "n", "p_lag0", "p_lag1"]],
    on=["submit_wom", "submit_dow"],
    how="left"
)

small = (plan_df["n"].fillna(0) < min_rows_slot)
plan_df.loc[small, "p_lag0"] = overall_p0
plan_df.loc[small, "p_lag1"] = overall_p1

plan_df["hit_prob"] = np.where(plan_df["needed_lag"] == 0, plan_df["p_lag0"], plan_df["p_lag1"]).astype(float)

# -------------------------
# Allocate planned submissions across days using training submit volume weights by slot
# -------------------------
slot_w = train.groupby(["submit_wom", "submit_dow"]).size().reset_index(name="w")
plan_df = plan_df.merge(slot_w, on=["submit_wom", "submit_dow"], how="left")
plan_df["w"] = plan_df["w"].fillna(1)

plan_df["w_norm"] = plan_df["w"] / plan_df["w"].sum()

overall_hit_prob = float((plan_df["hit_prob"] * plan_df["w_norm"]).sum())

m1, m2, m3 = st.columns(3)
m1.metric("Target responses", f"{int(target_responses):,}")
m2.metric("Estimated hit probability (plan window)", f"{overall_hit_prob:.2%}")

if overall_hit_prob <= 0.001:
    m3.metric("Estimated submissions needed (total)", "—")
    st.error(
        "Hit probability is extremely low for lag0/lag1 in recent data. "
        "This suggests responses often take >1 month. To support that, the planner needs lag2/lag3 windows."
    )
    st.stop()

total_submissions_needed = int(math.ceil(target_responses / overall_hit_prob))
m3.metric("Estimated submissions needed (total)", f"{total_submissions_needed:,}")

plan_df["planned_submissions"] = (plan_df["w_norm"] * total_submissions_needed).round().astype(int)

# Fix rounding drift
drift = total_submissions_needed - int(plan_df["planned_submissions"].sum())
if drift != 0 and len(plan_df) > 0:
    plan_df = plan_df.sort_values("w_norm", ascending=False).copy()
    idxs = plan_df.index.tolist()
    step = 1 if drift > 0 else -1
    for i in range(abs(drift)):
        plan_df.loc[idxs[i % len(idxs)], "planned_submissions"] += step
    plan_df = plan_df.sort_values("submit_date")

# -------------------------
# Weekly summary (month + week-of-month)
# -------------------------
weekly = (
    plan_df.groupby(["submit_period", "submit_wom"])
    .agg(
        planned_submissions=("planned_submissions", "sum"),
        avg_hit_prob=("hit_prob", "mean"),
    )
    .reset_index()
)
weekly["submit_month"] = weekly["submit_period"].astype(str)
weekly.rename(columns={"submit_wom": "Submit week-of-month"}, inplace=True)
weekly["expected_responses_in_target"] = weekly["planned_submissions"] * weekly["avg_hit_prob"]

st.markdown("### A) Weekly planner (Prev month Week 5 + Target month)")
st.dataframe(
    weekly[["submit_month", "Submit week-of-month", "planned_submissions", "avg_hit_prob", "expected_responses_in_target"]],
    use_container_width=True
)

fig_week = px.bar(
    weekly,
    x="Submit week-of-month",
    y="planned_submissions",
    color="submit_month",
    barmode="stack",
    title="Planned submissions by week-of-month (stacked by month)"
)
st.plotly_chart(fig_week, use_container_width=True)

# -------------------------
# Response window distributions for hover
# For needed_lag:
#   0 => use lag0 distribution
#   1 => use lag1 distribution
# Conditioned on slot (submit_wom, submit_dow) with fallback to submit_wom then global.
# -------------------------
train["resp_dom"] = train["resp_dt"].dt.day
train["resp_bin"] = ((train["resp_dom"] - 1) // bin_days).astype(int)

lag0_rows = train[train["month_lag_num"] == 0].copy()
lag1_rows = train[train["month_lag_num"] == 1].copy()

def build_dist(df_sub: pd.DataFrame, keys: list):
    if df_sub.empty:
        return pd.DataFrame(columns=keys + ["resp_bin", "cnt", "total", "p"])
    d = df_sub.groupby(keys + ["resp_bin"]).size().reset_index(name="cnt")
    d["total"] = d.groupby(keys)["cnt"].transform("sum")
    d["p"] = d["cnt"] / d["total"]
    return d

dist0_slot = build_dist(lag0_rows, ["submit_wom", "submit_dow"])
dist1_slot = build_dist(lag1_rows, ["submit_wom", "submit_dow"])
dist0_wom  = build_dist(lag0_rows, ["submit_wom"])
dist1_wom  = build_dist(lag1_rows, ["submit_wom"])

def global_dist(df_sub):
    if df_sub.empty:
        return pd.DataFrame(columns=["resp_bin", "p"])
    g = df_sub.groupby("resp_bin").size().reset_index(name="cnt")
    g["p"] = g["cnt"] / g["cnt"].sum()
    return g[["resp_bin", "p"]]

dist0_g = global_dist(lag0_rows)
dist1_g = global_dist(lag1_rows)

bin_to_window = build_bin_windows_for_target_month(target_start, target_end, bin_days)

def expected_breakdown(needed_lag: int, submit_wom: int, submit_dow: str, n_submit: int):
    # pick best distribution available
    if needed_lag == 0:
        dslot = dist0_slot[(dist0_slot["submit_wom"] == submit_wom) & (dist0_slot["submit_dow"] == submit_dow)].copy()
        if not dslot.empty and int(dslot["total"].iloc[0]) >= min_rows_slot:
            use = dslot[["resp_bin", "p"]].copy()
        else:
            dw = dist0_wom[dist0_wom["submit_wom"] == submit_wom].copy()
            if not dw.empty and int(dw["total"].iloc[0]) >= min_rows_slot:
                use = dw[["resp_bin", "p"]].copy()
            else:
                use = dist0_g.copy()
    else:
        dslot = dist1_slot[(dist1_slot["submit_wom"] == submit_wom) & (dist1_slot["submit_dow"] == submit_dow)].copy()
        if not dslot.empty and int(dslot["total"].iloc[0]) >= min_rows_slot:
            use = dslot[["resp_bin", "p"]].copy()
        else:
            dw = dist1_wom[dist1_wom["submit_wom"] == submit_wom].copy()
            if not dw.empty and int(dw["total"].iloc[0]) >= min_rows_slot:
                use = dw[["resp_bin", "p"]].copy()
            else:
                use = dist1_g.copy()

    if use is None or use.empty:
        return []

    # keep bins that exist in target month
    use = use[use["resp_bin"].isin(list(bin_to_window.keys()))].copy()

    # expected counts OUT OF n_submit
    use["expected"] = (use["p"] * float(n_submit)).round().astype(int)

    # Sort chronologically (resp_bin) so it reads like a timeline
    use = use.sort_values("resp_bin")

    # Keep bins with non-trivial counts
    use = use[use["expected"] > 0].copy()

    out = []
    for _, r in use.iterrows():
        b = int(r["resp_bin"])
        s, e = bin_to_window[b]
        out.append((fmt_window(s, e), int(r["expected"])))
    return out

def format_breakdown_lines(lines):
    if not lines:
        return "<i>Not enough data to estimate response windows.</i>"
    return "<br>".join([f"• {w}: <b>{cnt:,}</b>" for w, cnt in lines])

# -------------------------
# Hover text: breakdown OUT OF THAT DAY'S planned_submissions
# -------------------------
plan_df["hover_text"] = plan_df.apply(
    lambda r: (
        f"<b>Submit date:</b> {pd.Timestamp(r['submit_date']).strftime('%Y-%m-%d')} ({r['submit_dow']})"
        f"<br><b>Plan window:</b> {'Target month' if int(r['needed_lag'])==0 else 'Prev month Week 5'}"
        f"<br><b>Planned submissions (this day):</b> <b>{int(r['planned_submissions']):,}</b>"
        f"<br><br><b>Expected responses in {target_month_str} (out of {int(r['planned_submissions']):,}):</b><br>"
        + format_breakdown_lines(
            expected_breakdown(
                int(r["needed_lag"]),
                int(r["submit_wom"]),
                str(r["submit_dow"]),
                int(r["planned_submissions"])  # <-- key: use planned submissions
            )
        )
    ),
    axis=1
)

# -------------------------
# Daily chart
# -------------------------
st.markdown("### B) Daily calendar view (Prev month Week 5 → Target month)")

fig_daily = px.bar(
    plan_df,
    x="submit_date",
    y="planned_submissions",
    color=plan_df["submit_period"].astype(str),
    title=f"Daily submission plan (from {plan_start.date()} to {plan_end.date()}) — hover shows response windows in {target_month}"
)
fig_daily.update_traces(
    customdata=plan_df[["hover_text"]].to_numpy(),
    hovertemplate="%{customdata[0]}<extra></extra>"
)
st.plotly_chart(fig_daily, use_container_width=True)

with st.expander("Show daily plan table"):
    show = plan_df[["submit_date", "submit_period", "submit_wom", "submit_dow", "planned_submissions", "hit_prob"]].copy()
    show["submit_period"] = show["submit_period"].astype(str)
    st.dataframe(show, use_container_width=True)

# -------------------------
# Totals check
# -------------------------
expected_total = float((plan_df["planned_submissions"] * plan_df["hit_prob"]).sum())

t1, t2, t3 = st.columns(3)
t1.metric("Target responses", f"{int(target_responses):,}")
t2.metric("Planned submissions (total)", f"{int(plan_df['planned_submissions'].sum()):,}")
t3.metric("Expected responses (from plan)", f"{expected_total:,.0f}")

