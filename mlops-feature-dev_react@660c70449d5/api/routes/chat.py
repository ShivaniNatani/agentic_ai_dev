"""Chat routes: /api/orbit-chat with deterministic analytics fallback for IKS Claims."""
import importlib.util
import json
import logging
import os
from pathlib import Path
import re
import traceback
from typing import Any, Dict, List, Optional, Tuple

from flask import Blueprint, jsonify, request

# Try to import Vertex AI helper
try:
    from Vertex_ai.vertex_ai_helper import get_vertex_model
except Exception as _vertex_import_err:
    try:
        _VERTEX_HELPER_PATH = Path(__file__).resolve().parents[2] / "Vertex_ai" / "vertex_ai_helper.py"
        _VERTEX_SPEC = importlib.util.spec_from_file_location("vertex_ai_helper_fallback", _VERTEX_HELPER_PATH)
        if _VERTEX_SPEC and _VERTEX_SPEC.loader:
            _VERTEX_MODULE = importlib.util.module_from_spec(_VERTEX_SPEC)
            _VERTEX_SPEC.loader.exec_module(_VERTEX_MODULE)
            get_vertex_model = getattr(_VERTEX_MODULE, "get_vertex_model", None)
        else:
            get_vertex_model = None
    except Exception as _vertex_fallback_err:
        print(f"[ASK CLAIM] Vertex AI helper import failed (primary): {_vertex_import_err}")
        print(f"[ASK CLAIM] Vertex AI helper import failed (fallback): {_vertex_fallback_err}")
        get_vertex_model = None

logger = logging.getLogger(__name__)
chat_bp = Blueprint('chat', __name__, url_prefix='/api')

ALLOWED_BQ_TABLES = {
    "iksdev.iks_dwh_gia.ITTT_PP_DailyWorkableUpdate": "Daily/monthly IKS dashboard rollup, forecasts, predictions, responses, workable counts.",
    "iksgcp.iks_dwh_gia.date_phase_analytics_v2": "Validated date/phase operational metrics.",
    "iksgcp.iks_dwh_gia.main_ar_workflow": "Open AR workflow source of truth for WorkPlan, worked status, balances, touches, last activity/payment.",
    "iksgcp.iks_dwh_gia.main_encounter": "Encounter enrichment for payer, financial class, responsible entity, and last bill date.",
    "iksgcp.iks_dwh_gia.ITTT_PP_Output": "ITTT/propensity output with prediction labels, post/payment response dates, billed/payment amounts.",
    "iksgcp.iks_dwh_gia.ITTT_Prediction_Data": "Raw ITTT prediction data.",
    "iksgcp.iks_dwh_gia.Denial_Prediction_Encounter_Data": "Raw denial prediction and posted denial-code data.",
    "iksgcp.iks_dwh_gia.T_Dwh_Transactions": "Transaction/payment detail used for response and payment joins.",
    "iksgcp.iks_dwh_gia.T_Dwh_Patient_Encounter": "Patient encounter detail used for payer/entity enrichments.",
    "iksgcp.iks_dwh_gia.ITTT_ModelAccuracy": "ITTT model accuracy table.",
    "iksgcp.iks_dwh_gia.Denial_ModelAccuracy": "Denial model accuracy table.",
    "iksgcp.iks_dwh_gia.Appeal_Prioritization_Accuracy_Table": "Appeal/denial-prevention accuracy table.",
    "iksgcp.iks_dwh_gia.Appeal_Prioritization_data": "Appeal prioritization operational data.",
}

ALLOWED_INFORMATION_SCHEMA_PATTERNS = (
    "iksgcp.iks_dwh_gia.INFORMATION_SCHEMA.COLUMNS",
    "iksgcp.iks_dwh_gia.INFORMATION_SCHEMA.TABLES",
    "iksdev.iks_dwh_gia.INFORMATION_SCHEMA.COLUMNS",
    "iksdev.iks_dwh_gia.INFORMATION_SCHEMA.TABLES",
)

READ_ONLY_SQL_PREFIXES = ("select", "with")
FORBIDDEN_SQL_TOKENS = (
    "insert", "update", "delete", "merge", "truncate", "drop", "alter",
    "create", "replace", "grant", "revoke", "call", "export", "load",
    "copy", "set", "declare", "execute immediate",
)


def _format_table_catalog() -> str:
    lines = []
    for table_name, description in sorted(ALLOWED_BQ_TABLES.items()):
        lines.append(f"  • `{table_name}` — {description}")
    lines.append("  • INFORMATION_SCHEMA.COLUMNS/TABLES for iksgcp.iks_dwh_gia and iksdev.iks_dwh_gia — schema discovery only.")
    return "\n".join(lines)


# ─── Deep IKS System Prompt ─────────────────────────────────

IKS_SYSTEM_PROMPT = """\
You are ASK CLAIM, the AI claims analytics assistant for the IKS Dashboard, powered by Gemini 2.5 Pro.

─── DATA ACCESS AND SOURCE OF TRUTH ───────────────────────────
You have two levels of data:
1) CURRENT DASHBOARD STATE: exact values already loaded in the UI. Use this first.
2) BigQuery tool: use `execute_bq_query` only when the user asks for data not in the current context.

Never invent data. If a number is not in context, query BigQuery. If the query cannot answer it, say exactly what is missing.
You have full access to the complete database and all tables in the `iksdev` and `iksgcp` projects. You can query any table to form your answer.

Known Key BigQuery sources (you are not limited to these, you can explore other tables):
{table_catalog}

If the user asks what tables or columns exist, inspect INFORMATION_SCHEMA first and then query the relevant table.
When the page persona is WorkPlan, use the live WorkPlan snapshot in context before querying BigQuery.

Daily/monthly ITTT dashboard source: `iksdev.iks_dwh_gia.ITTT_PP_DailyWorkableUpdate`
Key columns:
  • ITTT_Date – the calendar day
  • Total_Billed – total claims billed to payers for that day
  • Total_Prediction – ITTT predicted total incoming claims (incoming prediction volume)
  • ITTT_Workable (alias Workable1) – ITTT-specific predicted workable claims
  • Total_Response – total payer responses received
  • ExactDay_Response – responses received on the exact predicted day
  • First_Prediction, Second_Prediction, Third_Prediction – 1st/2nd/3rd prediction windows
  • First_Response, Second_Response, Third_Response – responses in each window
  • Payment_Prediction – predicted payment count
  • Payment_Actual (alias Payment_Prediction_Actual) – actual payments received
  • Denial_Prediction – predicted denial count
  • Denial_Actual (alias Denial_Prediction_Actual / Denial_Actual2) – actual denials
  • Total_Workable – claims requiring follow-up action
  • ThirdPredictionExpired_NoResponse – claims where 3rd prediction expired with no response
  • Payment_But_Denied – claims predicted as Payment but actually resulted in a denial (AccuracyFlag=0)
  • Is_Forecast – 0 = actual data, 1 = forecast/future prediction

─── KEY FORMULAS ──────────────────────────────────────────────
Total Workable = ThirdPredictionExpired_NoResponse + Denial_Actual + Payment_But_Denied
Payment Accuracy = Payment_Actual / Total_Response × 100
Denial Accuracy = Denial_Actual / Total_Response × 100
ITTT Accuracy = ExactDay_Response / Total_Response × 100

─── OPERATIONS PIPELINE ───────────────────────────────────────
INCOMING (Total_Prediction) → DUE TODAY (Total_Workable) → RESOLVED (Total_Response) → BACKLOG (AR Backlog)
• Incoming = predicted claim volume entering the system
• Due Today = claims that need action (workable)
• Resolved = payer responses received
• Backlog = cumulative AR Workable Backlog

─── WORKPLAN / AR OVERVIEW LOGIC ──────────────────────────────
Total Open AR source: `iksgcp.iks_dwh_gia.main_ar_workflow`.
WorkPlan = Total Open AR minus claims worked in the last 45 days.
Worked in 45D = last_activity_date within the last 45 days.
Today + Later = WorkPlan, not Total Open AR.
WorkPlan + Worked in 45D = Total Open AR.
NPNR = WorkPlan claims with no payment/response transaction, last bill date older than 45 days, and no recent activity.
NPNR details use main_ar_workflow + main_encounter + ITTT_PP_Output and payer mapping logic.
Responsible entity labels: 1 Primary, 2 Secondary, 3 Tertiary, 4 Beyond, 0 Patient Responsibility/excluded from NPNR.

─── DENIAL PATTERN LOGIC ──────────────────────────────────────
Denial-code pattern uses `Denial_Prediction_Encounter_Data`.
If Denial_Codes is blank or no matched posted denial-code row exists, the code is `Unknown`.
Treat Unknown as a data-quality/missing-code bucket, not as an operational top denial reason.

─── AR WORKABLE BACKLOG ───────────────────────────────────────
Source: `iksgcp.iks_dwh_gia.main_ar_workflow`
Backlog = encounters WHERE Follow_Up_Date < TODAY AND (last_Activity_Date IS NULL OR Number_Of_Touches = 0)
Phases: Phase 1 (suffix 1), Phase 2 (2), Phase 3 (3A+3B), Phase 5 (5), Phase 6 (6), Phase 8 (8), Phase 9 (9)

─── GUIDELINES ────────────────────────────────────────────────
• Use the DATA provided in the context to give precise numerical answers
• Perform calculations using the formulas above when asked
• When comparing months or analyzing long-term trends, use the 'All Available Months' totals
• For month-over-month comparisons, compute percentage changes: ((new - old) / old × 100)
• Reference specific numbers and dates from the context
• Use bullet points and markdown formatting for structured answers
• If data for a specific query is not in the context, query BigQuery using read-only SQL
• When querying raw tables, aggregate first. Avoid returning encounter/person-level records unless the user explicitly asks for row-level detail.
• State the source table or dashboard context used for important numbers.
• Be concise, professional, and data-driven
• When asked about trends, analyze the daily_records array chronologically
• ADAPT TO PERSONA: The context payload contains a 'persona' key ('ops-manager', 'sr-leader', or 'work-plan'). If the persona is 'sr-leader', focus on high-level strategy, bottom-line financial impact, and macro trends. If 'ops-manager', focus on execution, actionable backlogs, daily workable queues, and team tasks.
"""

PAYER_SYSTEM_PROMPT = """\
You are ASK CLAIM, the AI claims analytics assistant for the Payer Response Analytics Dashboard, powered by Gemini 2.5 Pro.

─── DASHBOARD CONTEXT ──────────────────────────────────────────
You are helping the user understand their payer performance based on the specific page context provided.
The frontend context provides the exact values you should reference. Always use the numbers given in the frontend context block when answering queries about the current page state.

─── DATA SOURCE ─────────────────────────────────────────────
If the user's query asks for information not explicitly in the frontend context, you may use the database tool:
All payer table data comes from: `iksgcp.iks_dwh_gia.ITTT_PP_Output`
Only mapped parent payers should be analyzed. Unknown or unmapped payer names should be excluded.
Key business columns:
  • Payer_name – The name of the payer (Insurance Company)
  • PP_ActualFlag – 0 for Payment, 1 for Denial
  • Billed_Amount – The charged amount
  • Payment_Amount – The paid amount
  • Last_bill_date / Post_Date / PP_Post_Date – bill and response timing
  • PP_PredictedFlag / PP_AccuracyFlag / ITTT_PredictionLabel – prediction and stage fields

─── GUIDELINES ────────────────────────────────────────────────
• Prioritize answering from the "CURRENT DASHBOARD STATE" context block.
• Reference precise data from the frontend KPIs (Total Volume, Mean Days to Remittance, Collection Rate).
• If the data is absent from the dashboard state, fallback to using the `execute_bq_query` tool, but NEVER hallucinate numbers.
• Use bullet points, keep answers concise and analytical.
"""


# ─── Context serializer ─────────────────────────────────────

def _serialize_context(ctx: Optional[Dict[str, Any]]) -> str:
    """Convert dashboard context dict into a text block for the LLM prompt."""
    if not ctx:
        return "No dashboard context available."

    parts: list[str] = []

    payer = ctx.get("payer")
    if ctx.get("client"):
        parts.append(f"Client/Phase: {ctx['client']}")
    if ctx.get("persona"):
        parts.append(f"Persona: {ctx['persona']}")
    if payer:
        parts.append(f"Payer Scope: {payer}")
    if ctx.get("submitStart") or ctx.get("submitEnd"):
        parts.append(
            "Submit Window: "
            f"{ctx.get('submitStart') or 'Start'} to {ctx.get('submitEnd') or 'End'}"
        )
    if ctx.get("month_label"):
        parts.append(f"Month: {ctx['month_label']}")
    if ctx.get("year"):
        parts.append(f"Year: {ctx['year']}")
    parts.append(f"Is Forecast: {ctx.get('is_forecast', False)}")

    meta = ctx.get("meta")
    if meta and isinstance(meta, dict):
        parts.append("\n── Source Metadata ──")
        for key in ("source_name", "loaded_at", "source_last_modified", "filtered_records", "total_records"):
            value = meta.get(key)
            if value not in (None, "", []):
                parts.append(f"  {key}: {value}")

    payer_kpis = ctx.get("kpis")
    if payer_kpis and isinstance(payer_kpis, dict):
        parts.append("\n── Payer KPI Snapshot ──")
        for key in (
            "total_claims",
            "avg_payment_days",
            "avg_response_days",
            "median_response_days",
            "p90_response_days",
            "collection_rate",
            "same_month_response_rate",
            "next_month_cash_share",
            "prediction_accuracy",
            "denial_rate",
            "first_time_avg_response_days",
            "appeal_avg_response_days",
            "first_time_response_count",
            "appeal_response_count",
        ):
            value = payer_kpis.get(key)
            if value not in (None, "", []):
                parts.append(f"  {key}: {value}")

    # Monthly totals (Selected Month)
    totals = ctx.get("totals")
    if totals and isinstance(totals, dict):
        parts.append("\n── Selected Month Totals ──")
        for key in sorted(totals.keys()):
            parts.append(f"  {key}: {totals[key]}")

    # ALL Months Totals (for trends/comparisons)
    all_months = ctx.get("all_months")
    if all_months and isinstance(all_months, dict):
        parts.append(f"\n── All Available Months ({len(all_months)}) ──")
        for m_key, m_data in sorted(all_months.items()):
            label = m_data.get("label", m_key)
            m_totals = m_data.get("totals", {})
            parts.append(f"  {label}: Billed={m_totals.get('Total_Billed', 0)}, Workable={m_totals.get('Total_Workable', 0)}")

    # KPI cards
    cards = ctx.get("cards")
    if cards and isinstance(cards, dict):
        parts.append("\n── KPI Cards ──")
        for card_name, card_data in cards.items():
            if isinstance(card_data, dict):
                title = card_data.get("title", card_name)
                acc = card_data.get("accuracy_pct", "N/A")
                delta = card_data.get("accuracy_delta_pct_points", "N/A")
                parts.append(f"  {title}: accuracy={acc}%, delta={delta}pp")

    # Selected day data
    day = ctx.get("selected_day")
    if day and isinstance(day, dict):
        parts.append(f"\n── Selected Day: {day.get('date', 'N/A')} ──")
        for key in sorted(day.keys()):
            if key != "date":
                parts.append(f"  {key}: {day[key]}")

    # AR Backlog
    ar = ctx.get("ar_backlog")
    if ar and isinstance(ar, dict):
        parts.append("\n── AR Workable Backlog ──")
        parts.append(f"  Total Count: {ar.get('total_count', 0)}")
        bal = ar.get("total_balance", 0)
        parts.append(f"  Total Balance: ${bal:,.2f}" if isinstance(bal, (int, float)) else f"  Total Balance: {bal}")
        by_phase = ar.get("by_phase", {})
        if by_phase:
            parts.append("  Phase Breakdown:")
            for phase, count in sorted(by_phase.items()):
                parts.append(f"    {phase}: {count}")

    workplan = ctx.get("workplan")
    if workplan and isinstance(workplan, dict):
        parts.append("\n── WorkPlan Snapshot ──")
        for section_name in ("summary", "today", "later", "inventory", "protocol", "npnr_detail_summary", "npnr_detail_filters"):
            section = workplan.get(section_name)
            if isinstance(section, dict):
                parts.append(f"  {section_name}:")
                for key, value in sorted(section.items()):
                    if isinstance(value, (str, int, float, bool)) or value is None:
                        parts.append(f"    {key}: {value}")

    # Daily records
    daily = ctx.get("daily_records", [])
    if daily:
        parts.append(f"\n── Daily Records ({len(daily)} days) ──")
        for rec in daily:
            if isinstance(rec, dict):
                d = rec.get("date", "?")
                parts.append(
                    f"  {d}: billed={rec.get('total_billed',0)}, prediction={rec.get('total_prediction',0)}, "
                    f"response={rec.get('total_response',0)}, workable={rec.get('total_workable',0)}, "
                    f"pay_pred={rec.get('payment_prediction',0)}, pay_act={rec.get('payment_actual',0)}, "
                    f"den_pred={rec.get('denial_prediction',0)}, den_act={rec.get('denial_actual',0)}"
                )

    return "\n".join(parts)


# ─── Mock fallback ───────────────────────────────────────────

MONTH_TOKEN_MAP = {
    "jan": "01", "january": "01",
    "feb": "02", "february": "02",
    "mar": "03", "march": "03",
    "apr": "04", "april": "04",
    "may": "05",
    "jun": "06", "june": "06",
    "jul": "07", "july": "07",
    "aug": "08", "august": "08",
    "sep": "09", "sept": "09", "september": "09",
    "oct": "10", "october": "10",
    "nov": "11", "november": "11",
    "dec": "12", "december": "12",
}


def _to_number(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def _format_count(value: Any) -> str:
    return f"{int(round(_to_number(value))):,}"


def _format_pct(value: Any) -> str:
    try:
        number = float(value)
    except Exception:
        return "N/A"
    if abs(number) <= 1:
        number *= 100
    return f"{number:.2f}%"


def _format_delta_pct(value: float) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.2f}%"


def _get_workable_formula_parts(row: Optional[Dict[str, Any]]) -> Dict[str, float]:
    row = row or {}
    third_expired = _to_number(row.get("third_prediction_expired_no_response", row.get("ThirdPredictionExpired_NoResponse", 0)))
    denial_actual = _to_number(row.get("denial_actual", row.get("Denial_Actual", 0)))
    payment_but_denied = _to_number(row.get("payment_but_denied", row.get("Payment_But_Denied", 0)))
    total_workable = row.get("total_workable", row.get("Total_Workable"))
    actionable = third_expired + denial_actual + payment_but_denied
    return {
        "third_expired": third_expired,
        "denial_actual": denial_actual,
        "payment_but_denied": payment_but_denied,
        "actionable": actionable,
        "displayed_total": _to_number(total_workable) if total_workable is not None else actionable,
    }


def _pick_month_key_from_query(question: str, all_months: Dict[str, Any], fallback_month_key: str) -> str:
    month_keys = sorted(all_months.keys())
    if not month_keys:
        return fallback_month_key

    text = (question or "").lower()
    year_match = re.search(r"\b(20\d{2})\b", text)
    year = year_match.group(1) if year_match else None
    month_num = None

    for token, value in MONTH_TOKEN_MAP.items():
        if token in text:
            month_num = value
            break

    if year and month_num:
        key = f"{year}-{month_num}"
        if key in all_months:
            return key
    if month_num:
        for key in month_keys:
            if key.endswith(f"-{month_num}"):
                return key
    if year:
        for key in month_keys:
            if key.startswith(f"{year}-"):
                return key
    return fallback_month_key or month_keys[-1]


def _get_context_months(question: str, ctx: Dict[str, Any]) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
    fallback_key = str(ctx.get("month_key") or "")
    all_months = ctx.get("all_months") if isinstance(ctx.get("all_months"), dict) else {}
    selected_totals = ctx.get("totals") if isinstance(ctx.get("totals"), dict) else {}
    selected_label = str(ctx.get("month_label") or fallback_key or "Selected Month")
    if fallback_key and fallback_key not in all_months:
        all_months = {**all_months, fallback_key: {"label": selected_label, "totals": selected_totals}}
    elif not fallback_key and selected_totals:
        fallback_key = "selected"
        all_months = {**all_months, fallback_key: {"label": selected_label, "totals": selected_totals}}
    month_key = _pick_month_key_from_query(question, all_months, fallback_key)
    month_data = all_months.get(month_key) or {"label": selected_label, "totals": selected_totals}
    return month_key, month_data, all_months


def _best_month_for_metric(all_months: Dict[str, Any], metric_key: str) -> Optional[Tuple[str, str, float]]:
    best = None
    for key, value in all_months.items():
        totals = value.get("totals") if isinstance(value, dict) else {}
        metric_value = _to_number((totals or {}).get(metric_key, 0))
        if best is None or metric_value > best[2]:
            best = (key, value.get("label", key), metric_value)
    return best


def _build_trend_reply(daily_records: List[Dict[str, Any]]) -> str:
    if not daily_records:
        return "I don’t have daily records in the current context to describe the trend."
    ordered = sorted(daily_records, key=lambda row: str(row.get("date", "")))
    first = ordered[0]
    last = ordered[-1]
    first_workable = _get_workable_formula_parts(first)["displayed_total"]
    last_workable = _get_workable_formula_parts(last)["displayed_total"]
    delta = last_workable - first_workable
    direction = "up" if delta > 0 else "down" if delta < 0 else "flat"
    busiest = max(ordered, key=lambda row: _get_workable_formula_parts(row)["displayed_total"])
    change = _format_delta_pct(delta / first_workable) if first_workable else "n/a"
    return (
        f"- Workable trend is {direction} across the selected daily window.\n"
        f"- It moved from {_format_count(first_workable)} on {first.get('date', 'the first day')} "
        f"to {_format_count(last_workable)} on {last.get('date', 'the last day')} ({change}).\n"
        f"- Peak workable day in the provided context is {busiest.get('date', 'N/A')} with "
        f"{_format_count(_get_workable_formula_parts(busiest)['displayed_total'])}."
    )


def _generate_mock_reply(message: str, context: Optional[Dict[str, Any]]) -> str:
    """Context-aware deterministic fallback when Vertex AI is unavailable."""
    ctx = dict(context or {})
    q = (message or "").strip().lower()
    if not q:
        return "Please type a question so I can help."

    if any(token in q for token in ["source table", "source tables", "tables", "database", "data source", "data sources"]):
        return (
            "ASK Claims can use read-only BigQuery access across the `iksgcp` and `iksdev` projects.\n"
            "Known high-value sources include:\n"
            + "\n".join(f"- `{name}`: {desc}" for name, desc in sorted(ALLOWED_BQ_TABLES.items()))
            + "\n- `INFORMATION_SCHEMA.COLUMNS` / `INFORMATION_SCHEMA.TABLES`: schema discovery for tables and fields."
        )

    if "column" in q or "schema" in q:
        return (
            "ASK Claims can inspect schema metadata through `INFORMATION_SCHEMA.COLUMNS` and `INFORMATION_SCHEMA.TABLES` "
            "in both `iksgcp.iks_dwh_gia` and `iksdev.iks_dwh_gia`, then query the relevant source table in read-only mode."
        )

    workplan_context = ctx.get("workplan") if isinstance(ctx.get("workplan"), dict) else None
    if workplan_context:
        summary = workplan_context.get("summary") if isinstance(workplan_context.get("summary"), dict) else {}
        today = workplan_context.get("today") if isinstance(workplan_context.get("today"), dict) else {}
        later = workplan_context.get("later") if isinstance(workplan_context.get("later"), dict) else {}
        total_open = _to_number(summary.get("ar_total_count", 0))
        workplan_total = _to_number(summary.get("workplan_total_count", 0))
        worked_45 = _to_number(summary.get("worked_last_45_count", 0))
        today_workable = _to_number(today.get("workable_count", 0))
        later_remaining = _to_number(later.get("remaining_count", 0))

        if "npnr" in q:
            return (
                "NPNR logic in WorkPlan:\n"
                "- Starts from WorkPlan claims, not all Total Open AR.\n"
                "- Requires no payment/response transaction.\n"
                "- Requires last bill date older than 45 days.\n"
                "- Excludes claims worked in the last 45 days.\n"
                "- Patient Responsibility/entity 0 is tracked separately and excluded from NPNR."
            )

        if "today" in q or "later" in q or "total open" in q or "workplan" in q:
            return (
                "WorkPlan reconciliation:\n"
                f"- Today queue: {_format_count(today_workable)}\n"
                f"- Later queue: {_format_count(later_remaining)}\n"
                f"- Today + Later = {_format_count(today_workable + later_remaining)}, which equals WorkPlan ({_format_count(workplan_total)}).\n"
                f"- Worked in last 45 days: {_format_count(worked_45)}\n"
                f"- WorkPlan + Worked in 45D = {_format_count(workplan_total + worked_45)}, which reconciles to Total Open AR ({_format_count(total_open)}).\n"
                "So Today + Later should not equal Total Open AR unless recently worked claims are zero."
            )

    if "unknown" in q and "denial" in q:
        return (
            "`Unknown` in the denial pattern means the encounter either has a blank `Denial_Codes` value "
            "or no matched posted denial-code row in `iksgcp.iks_dwh_gia.Denial_Prediction_Encounter_Data`. "
            "ASK Claims treats it as a data-quality bucket, not as an operational top denial reason."
        )

    if "payer" in ctx or "kpis" in ctx:
        kpis = ctx.get("kpis") or {}
        if any(token in q for token in ["hello", "hi", "hey", "help"]):
            return (
                "I can help you analyze Payer Responses.\n"
                "Try asking:\n"
                "- What is the aggregate claim volume?\n"
                "- What is the mean days to remittance?\n"
                "- How many appeal responses are there?\n"
                "- What is the collection rate?"
            )

        if "volume" in q or "total" in q or "claims" in q:
            return f"The total claim volume in the current scope is {kpis.get('total_claims', 0):,}."

        if "remittance" in q or "days" in q or "speed" in q or "slow" in q:
            avg_days = kpis.get("avg_payment_days")
            return f"The mean days to remittance for the selected payer(s) is {avg_days:.1f} days." if avg_days else "I don't have the mean remittance days for this scope."

        if "appeal" in q:
            appeal_days = kpis.get("appeal_avg_response_days")
            return f"The average appeal resolution cycle is {appeal_days:.1f} days." if appeal_days else "There are no appeal responses in this scope."

        if "collection" in q or "rate" in q or "percent" in q:
            rate = kpis.get("collection_rate", 0) * 100
            return f"The collection rate is {rate:.1f}%."

        return (
            f"Context Summary for Payer Response:\n"
            f"- Total Claims: {kpis.get('total_claims', 0):,}\n"
            f"- Collection Rate: {(kpis.get('collection_rate', 0) * 100):.1f}%\n"
            f"- Avg Remittance: {kpis.get('avg_payment_days', 0)} days"
        )

    selected_month_key = str(ctx.get("month_key") or "")
    month_key, month_data, all_months = _get_context_months(message, ctx)
    month_label = str(month_data.get("label") or ctx.get("month_label") or month_key or "Selected Month")
    totals = month_data.get("totals") if isinstance(month_data.get("totals"), dict) else (ctx.get("totals") or {})
    cards = ctx.get("cards") if isinstance(ctx.get("cards"), dict) else {}
    selected_day = ctx.get("selected_day") if isinstance(ctx.get("selected_day"), dict) else None
    daily_records = ctx.get("daily_records") if isinstance(ctx.get("daily_records"), list) else []
    backlog = ctx.get("ar_backlog") if isinstance(ctx.get("ar_backlog"), dict) else {}
    workable = _get_workable_formula_parts(totals)

    if any(token in q for token in ["hello", "hi", "hey", "help"]):
        return (
            "I can help with KPI explanations, month comparisons, workable logic, daily trends, backlog, and phase context.\n"
            "Try asking:\n"
            "- What is total workable this month?\n"
            "- Compare Apr 2026 vs Mar 2026\n"
            "- Explain the workable formula\n"
            "- Which month had the highest denials?\n"
            "- What does the backlog show?"
        )

    if "formula" in q or ("how is" in q and "workable" in q):
        return (
            f"Workable logic for {month_label}:\n"
            f"- Third Prediction Expired No Response: {_format_count(workable['third_expired'])}\n"
            f"- Denial Actual: {_format_count(workable['denial_actual'])}\n"
            f"- Payment But Denied: {_format_count(workable['payment_but_denied'])}\n"
            f"- Total Workable: {_format_count(workable['displayed_total'])}"
        )

    if "backlog" in q or ("ar" in q and "work" in q):
        return (
            f"AR backlog for the current context:\n"
            f"- Total Count: {_format_count(backlog.get('total_count', 0))}\n"
            f"- Total Balance: ${_to_number(backlog.get('total_balance', 0)):,.2f}\n"
            f"- Phase Breakdown: {backlog.get('by_phase', {}) if backlog.get('by_phase') else 'Not provided in current context'}"
        )

    if "accuracy" in q or "kpi" in q or "card" in q:
        if not cards:
            return "I don’t have KPI card context in this payload."
        lines = []
        for _, card in cards.items():
            if not isinstance(card, dict):
                continue
            title = card.get("title") or "Metric"
            accuracy = card.get("accuracy_pct")
            delta = card.get("accuracy_delta_pct_points")
            suffix = f" ({delta:+.2f}pp vs prior)" if isinstance(delta, (int, float)) else ""
            lines.append(f"- {title}: {_format_pct(accuracy)}{suffix}")
        return "\n".join(lines) if lines else "I don’t have KPI card values in the current context."

    if "compare" in q or "month over month" in q or " vs " in q:
        month_keys = sorted(all_months.keys())
        current_key = selected_month_key if selected_month_key in month_keys else month_key
        if len(month_keys) < 2 or current_key not in month_keys:
            return "I need at least two months in context to compare performance."
        compare_key = month_key if month_key != current_key and month_key in month_keys else None
        if compare_key is None:
            current_index = month_keys.index(current_key)
            compare_key = month_keys[max(0, current_index - 1)] if current_index > 0 else month_keys[-1]
        current_month = all_months.get(current_key, {})
        compare_month = all_months.get(compare_key, {})
        current_totals = current_month.get("totals", {})
        compare_totals = compare_month.get("totals", {})
        current_workable = _get_workable_formula_parts(current_totals).get("displayed_total", workable["displayed_total"])
        previous_workable = _get_workable_formula_parts(compare_totals).get("displayed_total", 0)
        current_response = _to_number(current_totals.get("Total_Response", totals.get("Total_Response", 0)))
        previous_response = _to_number(compare_totals.get("Total_Response", 0))
        change = _format_delta_pct((current_workable - previous_workable) / previous_workable) if previous_workable else "n/a"
        return (
            f"{current_month.get('label', month_label)} vs {compare_month.get('label', compare_key)}:\n"
            f"- Workable: {_format_count(current_workable)} vs {_format_count(previous_workable)}\n"
            f"- Total Response: {_format_count(current_response)} vs {_format_count(previous_response)}\n"
            f"- Workable delta: {change}"
        )

    if "highest" in q or "top" in q or "best" in q:
        metric_key = "Total_Workable" if "workable" in q else "Denial_Actual" if "denial" in q else "Payment_Actual" if "payment" in q else "Total_Response"
        best = _best_month_for_metric(all_months, metric_key)
        if not best:
            return "I don’t have enough monthly history in the current context for that ranking."
        return f"Top month for {metric_key} is {best[1]} with {_format_count(best[2])}."

    if "trend" in q or "daily" in q:
        return _build_trend_reply(daily_records)

    if selected_day and ("day" in q or re.search(r"\b20\d{2}-\d{2}-\d{2}\b", q)):
        day_workable = _get_workable_formula_parts(selected_day)
        return (
            f"Selected day summary for {selected_day.get('date', 'N/A')}:\n"
            f"- Total Prediction: {_format_count(selected_day.get('total_prediction', 0))}\n"
            f"- Total Response: {_format_count(selected_day.get('total_response', 0))}\n"
            f"- Denial Actual: {_format_count(selected_day.get('denial_actual', 0))}\n"
            f"- Workable: {_format_count(day_workable['displayed_total'])}"
        )

    if "workable" in q:
        return f"Total Workable for {month_label} is {_format_count(workable['displayed_total'])}."
    if "response" in q:
        return f"Total Response for {month_label} is {_format_count(totals.get('Total_Response', 0))}."
    if "payment" in q:
        return f"Payment Actual for {month_label} is {_format_count(totals.get('Payment_Actual', 0))}."
    if "denial" in q:
        return f"Denial Actual for {month_label} is {_format_count(totals.get('Denial_Actual', 0))}."

    return (
        f"For {month_label}, the current context shows:\n"
        f"- Total Prediction: {_format_count(totals.get('Total_Prediction', 0))}\n"
        f"- Total Response: {_format_count(totals.get('Total_Response', 0))}\n"
        f"- Total Workable: {_format_count(workable['displayed_total'])}\n"
        f"- Denial Actual: {_format_count(totals.get('Denial_Actual', 0))}\n"
        "Ask a more specific question if you want a comparison, trend, formula breakdown, or KPI explanation."
    )


# ─── BigQuery Tool Definition ────────────────────────────────
from google.cloud import bigquery
try:
    from vertexai.generative_models import FunctionDeclaration, Tool, Part
except ImportError:
    FunctionDeclaration = Tool = Part = None

def _strip_sql_comments(sql: str) -> str:
    sql = re.sub(r"--.*?$", "", sql, flags=re.MULTILINE)
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    return sql.strip()


def _extract_referenced_tables(sql: str) -> List[str]:
    quoted = re.findall(r"`([^`]+)`", sql)
    unquoted = re.findall(
        r"\b(?:from|join)\s+((?:iksdev|iksgcp)\.[a-zA-Z0-9_-]+\.(?:[A-Za-z0-9_]+|INFORMATION_SCHEMA\.(?:COLUMNS|TABLES)))",
        sql,
        flags=re.IGNORECASE,
    )
    refs = quoted + unquoted
    return [ref.strip() for ref in refs if ref.strip()]


def _ensure_limit(sql: str, limit: int = 100) -> str:
    if re.search(r"\blimit\s+\d+\b", sql, flags=re.IGNORECASE):
        return sql
    return f"{sql.rstrip(';')}\nLIMIT {limit}"


def _validate_read_only_bq_sql(sql_query: str) -> Tuple[Optional[str], Optional[str]]:
    sql = _strip_sql_comments(sql_query or "")
    if not sql:
        return None, "SQL query is empty."

    statements = [part.strip() for part in sql.split(";") if part.strip()]
    if len(statements) != 1:
        return None, "Only one read-only SELECT statement is allowed."
    sql = statements[0]

    lowered = re.sub(r"\s+", " ", sql.lower()).strip()
    if not lowered.startswith(READ_ONLY_SQL_PREFIXES):
        return None, "Only SELECT/WITH read-only queries are allowed."
    for token in FORBIDDEN_SQL_TOKENS:
        if re.search(rf"\b{re.escape(token)}\b", lowered):
            return None, f"Forbidden SQL operation detected: {token}."

    referenced_tables = _extract_referenced_tables(sql)
    if not referenced_tables:
        return None, "Query must reference a BigQuery table from iksdev or iksgcp."

    allowed = set(ALLOWED_BQ_TABLES) | set(ALLOWED_INFORMATION_SCHEMA_PATTERNS)
    disallowed = [
        table for table in referenced_tables
        if not (table.startswith("iksgcp.") or table.startswith("iksdev.") or table in allowed)
    ]
    if disallowed:
        return None, (
            "Query references databases outside ASK Claims approved projects (iksdev, iksgcp): "
            + ", ".join(disallowed)
        )

    return _ensure_limit(sql), None


def execute_bq_query(sql_query: str) -> str:
    """Executes a SQL query against BigQuery and returns JSON results."""
    try:
        safe_sql, validation_error = _validate_read_only_bq_sql(sql_query)
        if validation_error:
            return json.dumps({
                "error": validation_error,
                "approved_tables": sorted(ALLOWED_BQ_TABLES.keys()),
            })

        try:
            from Vertex_ai.vertex_ai_helper import _get_credentials, _load_config
        except Exception:
            helper_path = Path(__file__).resolve().parents[2] / "Vertex_ai" / "vertex_ai_helper.py"
            helper_spec = importlib.util.spec_from_file_location("vertex_ai_helper_query_fallback", helper_path)
            if not helper_spec or not helper_spec.loader:
                raise ImportError("Vertex AI helper module is unavailable")
            helper_module = importlib.util.module_from_spec(helper_spec)
            helper_spec.loader.exec_module(helper_module)
            _get_credentials = getattr(helper_module, "_get_credentials")
            _load_config = getattr(helper_module, "_load_config")
        creds = _get_credentials()
        config = _load_config()
        project_id = config.get("project_id", creds.project_id)
        client = bigquery.Client(credentials=creds, project=project_id)

        max_bytes_billed = int(os.getenv("ASK_CLAIM_MAX_BYTES_BILLED", "5000000000"))
        job_config = bigquery.QueryJobConfig(
            use_legacy_sql=False,
            maximum_bytes_billed=max_bytes_billed,
        )
        job = client.query(safe_sql, job_config=job_config)
        results = job.result()

        # Convert to list of dicts, format dates to avoid serialization errors
        rows = []
        for row in results:
            row_dict = dict(row)
            for k, v in row_dict.items():
                if hasattr(v, "isoformat"):
                    row_dict[k] = v.isoformat()
            rows.append(row_dict)

        if len(rows) > 100:
            return json.dumps({"error": f"Query returned {len(rows)} rows. Please aggregate or add LIMIT 100."})
        return json.dumps({"rows": rows, "sql_executed": safe_sql})
    except Exception as e:
        return json.dumps({"error": str(e)})

if FunctionDeclaration:
    execute_bq_func = FunctionDeclaration(
        name="execute_bq_query",
        description=(
            "Execute one read-only StandardSQL SELECT/WITH query against approved ASK Claims BigQuery sources. "
            "Use this when the requested data is not present in CURRENT DASHBOARD STATE. "
            "Approved sources include daily ITTT, WorkPlan AR, encounter, payer, transaction, denial, and accuracy tables. "
            "Aggregate whenever possible and include filters for month/phase/payer when relevant."
        ),
        parameters={
            "type": "object",
            "properties": {
                "sql_query": {
                    "type": "string",
                    "description": "The exact standard SQL string to execute."
                }
            },
            "required": ["sql_query"]
        }
    )
    bq_tool = Tool(function_declarations=[execute_bq_func])
else:
    bq_tool = None
    print("[ASK CLAIM] vertexai.generative_models SDK imports unavailable — BQ tool calling disabled, Gemini will still answer from context.")


# ─── Orbit Chat Endpoint (IKS Claims — ASK CLAIM) ───────────

@chat_bp.post("/chat")
@chat_bp.post("/orbit-chat")
def api_orbit_chat():
    """ASK CLAIM endpoint — Gemini 2.5 Pro for IKS Claims data queries."""
    payload = request.get_json() or {}
    message = (payload.get("message") or "").strip()
    context = payload.get("context") or {}

    if not message:
        return jsonify({"error": "Message cannot be empty"}), 400

    context_text = _serialize_context(context)

    # Try Vertex AI (Gemini 2.5 Pro)
    if get_vertex_model is not None:
        try:
            model = get_vertex_model()
            is_payer_page = "payer" in context or "kpis" in context
            table_catalog = _format_table_catalog()
            full_prompt = (
                f"{PAYER_SYSTEM_PROMPT}\n\nApproved BigQuery sources:\n{table_catalog}"
                if is_payer_page
                else IKS_SYSTEM_PROMPT.replace("{table_catalog}", table_catalog)
            )
            full_prompt += f"\n\n── CURRENT DASHBOARD STATE ──\n{context_text}"
            full_prompt += f"\n\n── USER QUESTION ──\n{message}"
            full_prompt += "\n\nProvide a precise, data-driven answer. If the data isn't in the dashboard state"
            if bq_tool is not None:
                full_prompt += ", use the execute_bq_query tool."
            else:
                full_prompt += ", say so honestly."

            chat = model._model.start_chat()

            tools_arg = [bq_tool] if bq_tool is not None else None
            response = chat.send_message(full_prompt, tools=tools_arg) if tools_arg else chat.send_message(full_prompt)

            fc_part = None
            if bq_tool is not None:
                try:
                    for p in response.candidates[0].content.parts:
                        if hasattr(p, 'function_call') and p.function_call and p.function_call.name:
                            fc_part = p.function_call
                            break
                except (IndexError, AttributeError):
                    fc_part = None

            if fc_part and fc_part.name == "execute_bq_query" and Part is not None:
                sql = dict(fc_part.args).get("sql_query", "")
                logger.info("Gemini invoked BQ tool with SQL: %s", sql)

                bq_result = execute_bq_query(sql)

                try:
                    resp_content = json.loads(bq_result)
                except Exception:
                    resp_content = {"result": bq_result}

                part = Part.from_function_response(
                    name="execute_bq_query",
                    response=resp_content
                )

                response = chat.send_message([part], tools=[bq_tool])

            try:
                reply_text = response.text
            except (ValueError, AttributeError):
                try:
                    reply_text = response.candidates[0].content.parts[0].text
                except Exception:
                    reply_text = str(response)

            return jsonify({
                "reply": reply_text,
                "source": "vertex-ai"
            })
        except Exception as exc:
            logger.warning("Vertex AI error in orbit-chat: %s", exc)
            traceback.print_exc()

    # Mock fallback
    reply = _generate_mock_reply(message, context)
    return jsonify({"reply": reply, "source": "mock"})
