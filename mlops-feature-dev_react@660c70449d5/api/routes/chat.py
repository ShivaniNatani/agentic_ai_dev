"""Chat routes: /api/orbit-chat with Vertex AI (Gemini 2.5 Pro) integration for IKS Claims."""
import logging
import traceback
from typing import Any, Dict, List, Optional

from flask import Blueprint, jsonify, request

# Try to import Vertex AI helper
try:
    from Vertex_ai.vertex_ai_helper import get_vertex_model
except Exception:
    get_vertex_model = None

logger = logging.getLogger(__name__)
chat_bp = Blueprint('chat', __name__, url_prefix='/api')


# ─── Deep IKS System Prompt ─────────────────────────────────

IKS_SYSTEM_PROMPT = """\
You are ASK CLAIM, the AI claims analytics assistant for the IKS Dashboard, powered by Gemini 2.5 Pro.

─── DATA SOURCE ───────────────────────────────────────────────
All data comes from: `iksdev.iks_dwh_gia.ITTT_PP_DailyWorkableUpdate`
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
• If data for a specific query is not in the context, say so honestly
• Be concise, professional, and data-driven
• When asked about trends, analyze the daily_records array chronologically
"""


# ─── Context serializer ─────────────────────────────────────

def _serialize_context(ctx: Optional[Dict[str, Any]]) -> str:
    """Convert dashboard context dict into a text block for the LLM prompt."""
    if not ctx:
        return "No dashboard context available."

    parts: list[str] = []

    if ctx.get("client"):
        parts.append(f"Client/Phase: {ctx['client']}")
    if ctx.get("month_label"):
        parts.append(f"Month: {ctx['month_label']}")
    if ctx.get("year"):
        parts.append(f"Year: {ctx['year']}")
    parts.append(f"Is Forecast: {ctx.get('is_forecast', False)}")

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

def _generate_mock_reply(message: str, context: Optional[Dict[str, Any]]) -> str:
    """Keyword-based mock when Vertex AI is not available."""
    msg_lower = message.lower()

    if "workable" in msg_lower:
        month_label = (context or {}).get("month_label", "this month")
        totals = (context or {}).get("totals", {})
        tw = totals.get("Total_Workable", "N/A")
        return f"Total Workable for {month_label} is {tw:,}." if isinstance(tw, (int, float)) else f"Total Workable for {month_label} is {tw}."

    if "billed" in msg_lower:
        totals = (context or {}).get("totals", {})
        tb = totals.get("Total_Billed", "N/A")
        return f"Total Billed is {tb:,}." if isinstance(tb, (int, float)) else f"Total Billed is {tb}."

    if "denial" in msg_lower:
        return "Denial metrics track predicted vs actual denials. Rising actuals above predictions may signal payer rule changes."

    if "payment" in msg_lower:
        return "Payment metrics compare predicted payments vs actuals. Consistent gaps suggest model calibration is needed."

    return (
        "I can help you understand your claims data. Try asking about:\n"
        "- **Total Workable** or **Total Billed**\n"
        "- **Denial** or **Payment** trends\n"
        "- **Monthly comparisons**\n"
        "- **The workable formula**\n\n"
        "What would you like to explore?"
    )


# ─── BigQuery Tool Definition ────────────────────────────────

import json
from google.cloud import bigquery
try:
    from vertexai.generative_models import FunctionDeclaration, Tool, Part
except ImportError:
    FunctionDeclaration = Tool = Part = None

def execute_bq_query(sql_query: str) -> str:
    """Executes a SQL query against BigQuery and returns JSON results."""
    from Vertex_ai.vertex_ai_helper import _get_credentials, _load_config
    try:
        creds = _get_credentials()
        config = _load_config()
        project_id = config.get("project_id", creds.project_id)
        client = bigquery.Client(credentials=creds, project=project_id)
        
        job = client.query(sql_query)
        results = job.result()
        
        # Convert to list of dicts, format dates to avoid serialization errors
        rows = []
        for row in results:
            row_dict = dict(row)
            for k, v in row_dict.items():
                if hasattr(v, "isoformat"):
                    row_dict[k] = v.isoformat()
            rows.append(row_dict)
            
        if len(rows) > 50:
            return json.dumps({"error": f"Query returned {len(rows)} rows. Please add LIMIT 50 to your SQL to prevent token overflow."})
        return json.dumps({"rows": rows})
    except Exception as e:
        return json.dumps({"error": str(e)})

if FunctionDeclaration:
    execute_bq_func = FunctionDeclaration(
        name="execute_bq_query",
        description="Execute a BigQuery SQL query against the iksdev project. ONLY use this when the requested data is NOT present in the CURRENT DASHBOARD STATE context. The primary table is `iksdev.iks_dwh_gia.ITTT_PP_DailyWorkableUpdate`.",
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


# ─── Orbit Chat Endpoint (IKS Claims — ASK CLAIM) ───────────

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
    if get_vertex_model is not None and bq_tool is not None:
        try:
            model = get_vertex_model()
            full_prompt = IKS_SYSTEM_PROMPT
            full_prompt += f"\n\n── CURRENT DASHBOARD STATE ──\n{context_text}"
            full_prompt += f"\n\n── USER QUESTION ──\n{message}"
            full_prompt += "\n\nProvide a precise, data-driven answer. If the data isn't in the dashboard state, use the execute_bq_query tool."

            # Use the underlying GenerativeModel to start a chat session
            chat = model._model.start_chat()
            
            # 1. Send the initial prompt
            response = chat.send_message(full_prompt, tools=[bq_tool])
            
            # 2. Check if Gemini wants to call a tool (SDK v1.130+ compatible)
            #    In newer SDK, function calls are in response.candidates[0].content.parts
            fc_part = None
            try:
                for p in response.candidates[0].content.parts:
                    if hasattr(p, 'function_call') and p.function_call and p.function_call.name:
                        fc_part = p.function_call
                        break
            except (IndexError, AttributeError):
                fc_part = None
            
            if fc_part and fc_part.name == "execute_bq_query":
                sql = dict(fc_part.args).get("sql_query", "")
                logger.info("Gemini invoked BQ tool with SQL: %s", sql)
                print(f"Executing BQ: {sql}")
                
                bq_result = execute_bq_query(sql)
                
                try:
                    resp_content = json.loads(bq_result)
                except Exception:
                    resp_content = {"result": bq_result}
                    
                # 3. Supply the tool response back to Gemini
                part = Part.from_function_response(
                    name="execute_bq_query",
                    response=resp_content
                )
                
                response = chat.send_message([part], tools=[bq_tool])
            
            # Extract text from response (handle both .text and .candidates)
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
