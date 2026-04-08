"""
Orbit AI Backend Server
=======================
FastAPI server that provides the /api/orbit-chat endpoint for the IKS Dashboard.
Integrates with Google Vertex AI (Gemini) for intelligent responses.

Usage:
    pip install fastapi uvicorn google-cloud-aiplatform
    python orbit_server.py

Configuration:
    Place a config.json file in the Vertex_ai/ directory with:
    {
        "project_id": "<your-gcp-project-id>",
        "location": "us-central1",
        "model_name": "gemini-2.5-pro",
        "service_account_file": "<relative-path-to-service-account-key.json>"
    }
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Resolve the Vertex AI helper from the existing codebase
_BASE_DIR = Path(__file__).resolve().parent
_VERTEX_DIR = _BASE_DIR / "Vertex_ai"

# Add `Vertex_ai/` so `vertex_ai_helper` can be imported
sys.path.insert(0, str(_VERTEX_DIR))

# Attempt to import the Vertex AI helper
_vertex_available = False
try:
    from vertex_ai_helper import get_vertex_model  # type: ignore[import-untyped]
    _vertex_available = True
except Exception as exc:
    print(f"[orbit-server] Vertex AI helper not available: {exc}")
    print("[orbit-server] Running in MOCK mode — responses will be generated locally")


# ─── FastAPI Definition ──────────────────────────────────────

app = FastAPI(title="Orbit AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request/Response Models ─────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    context: dict | None = None  # optional dashboard context (month, client, KPIs)


class ChatResponse(BaseModel):
    reply: str
    source: str  # "vertex-ai" | "mock"


# ─── Hardcoded System Prompt ────────────────────────────────

SYSTEM_PROMPT = """\
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
Denial Prevention Accuracy = Denial_Actual / Total_Workable × 100

─── OPERATIONS PIPELINE ───────────────────────────────────────
The dashboard shows this flow:
  INCOMING (Total_Prediction) → DUE TODAY (Total_Workable) → RESOLVED (Total_Response) → BACKLOG (AR Backlog)
• Incoming = predicted claim volume entering the system
• Due Today = claims that need action (workable)
• Resolved = payer responses received
• Backlog = cumulative AR Workable Backlog (encounters with Follow_Up_Date < today, no activity/touches)

─── AR WORKABLE BACKLOG ───────────────────────────────────────
Source: `iksgcp.iks_dwh_gia.main_ar_workflow`
Backlog = encounters WHERE Follow_Up_Date < TODAY AND (last_Activity_Date IS NULL OR Number_Of_Touches = 0)
Phases are determined by encounter_number suffix:
  Phase 1 (suffix 1), Phase 2 (2), Phase 3 (3A+3B combined), Phase 5 (5), Phase 6 (6), Phase 8 (8), Phase 9 (9)

─── FORECAST LOGIC ────────────────────────────────────────────
• Any BQ row with ITTT_Date > today is marked Is_Forecast = 1
• Month with mix of actual + forecast → "Partial Forecast"
• Month with all forecast rows → fully forecast
• Forecast values for Total_Billed and Total_Prediction are suppressed to 0

─── GUIDELINES ────────────────────────────────────────────────
• Use the DATA provided in the context to give precise numerical answers
• Perform calculations using the formulas above when asked
• When comparing months, compute percentage changes: ((new - old) / old × 100)
• Reference specific numbers and dates from the context
• Use bullet points and markdown formatting for structured answers
• If data for a specific query is not in the context, say so honestly
• Be concise, professional, and data-driven
• When asked about trends, analyze the daily_records array chronologically
"""


# ─── Mock response generator (fallback) ─────────────────────

def _generate_mock_reply(message: str, context: dict | None) -> str:
    """Simple keyword-based mock responses when Vertex AI is offline."""

    msg_lower = message.lower()

    if "total billed" in msg_lower or "billed" in msg_lower:
        return (
            "**Total Billed** represents the overall predicted claim volume for the period. "
            "It includes all claim lines submitted to payers, before any adjudication. "
            "This is the starting denominator for all downstream metrics like Response, Workable, and Payment."
        )
    if "workable" in msg_lower:
        month_label = (context or {}).get("month_label", "the selected month")
        return (
            f"**Total Workable** for {month_label} represents claims that require follow-up action. "
            "The formula is: Third-Prediction-Expired (No Response) + Denial Actual + Payment But Denied. "
            "A rising workable trend signals growing backlog that needs immediate attention."
        )
    if "denial" in msg_lower:
        return (
            "**Denial metrics** track predicted vs actual denials. Watch for:\n"
            "- Denial Prediction > Actual → Model may be over-estimating risk\n"
            "- Denial Actual > Prediction → Potential payer rule change or coding issue\n"
            "- Sustained spikes → Investigate specific payer or CPT code patterns"
        )
    if "payment" in msg_lower:
        return (
            "**Payment** metrics compare predicted payments against actuals. Key signals:\n"
            "- Consistent gap → Model calibration needed\n"
            "- Sudden drops → Possible payer policy change\n"
            "- Review payment recovery alongside denial rates for full picture"
        )

    return (
        "I can help you understand your claims data. Try asking about:\n"
        "- **Total Billed** or **Total Workable** definitions\n"
        "- **Denial** or **Payment** trends\n"
        "- **Monthly comparisons** and accuracy deltas\n"
        "- **The workable formula** and how day values are calculated\n\n"
        "What would you like to explore?"
    )


# ─── Context serializer ─────────────────────────────────────

def _serialize_context(ctx: dict | None) -> str:
    """Convert dashboard context dict into a text block for the LLM prompt."""
    if not ctx:
        return "No dashboard context available."

    parts: list[str] = []

    # Basic info
    if ctx.get("client"):
        parts.append(f"Client/Phase: {ctx['client']}")
    if ctx.get("month_label"):
        parts.append(f"Month: {ctx['month_label']}")
    if ctx.get("year"):
        parts.append(f"Year: {ctx['year']}")
    parts.append(f"Is Forecast: {ctx.get('is_forecast', False)}")

    # Monthly totals
    totals = ctx.get("totals")
    if totals and isinstance(totals, dict):
        parts.append("\n── Monthly Totals ──")
        for key in sorted(totals.keys()):
            parts.append(f"  {key}: {totals[key]}")

    # KPI cards
    cards = ctx.get("cards")
    if cards and isinstance(cards, dict):
        parts.append("\n── KPI Cards ──")
        for card_name, card_data in cards.items():
            if isinstance(card_data, dict):
                title = card_data.get("title", card_name)
                acc = card_data.get("accuracy_pct", "N/A")
                delta = card_data.get("accuracy_delta_pct_points", "N/A")
                pred = card_data.get("prediction", "N/A")
                parts.append(f"  {title}: accuracy={acc}%, delta={delta}pp, prediction={pred}")

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
        parts.append(f"\n── AR Workable Backlog ──")
        parts.append(f"  Total Count: {ar.get('total_count', 0)}")
        parts.append(f"  Total Balance: ${ar.get('total_balance', 0):,.2f}")
        by_phase = ar.get("by_phase", {})
        if by_phase:
            parts.append("  Phase Breakdown:")
            for phase, count in sorted(by_phase.items()):
                parts.append(f"    {phase}: {count}")

    # Daily records summary (first 31 days)
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
                    f"den_pred={rec.get('denial_prediction',0)}, den_act={rec.get('denial_actual',0)}, "
                    f"forecast={rec.get('is_forecast', False)}"
                )

    return "\n".join(parts)


# ─── Chat Endpoint ──────────────────────────────────────────

@app.post("/api/orbit-chat", response_model=ChatResponse)
async def orbit_chat(req: ChatRequest):
    """Process a chat message — route to Vertex AI or fall back to mock."""

    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Serialize the full dashboard context
    context_text = _serialize_context(req.context)

    # Try Vertex AI first
    if _vertex_available:
        try:
            model = get_vertex_model()
            full_prompt = SYSTEM_PROMPT
            full_prompt += f"\n\n── CURRENT DASHBOARD STATE ──\n{context_text}"
            full_prompt += f"\n\n── USER QUESTION ──\n{req.message}"
            full_prompt += "\n\nProvide a precise, data-driven answer using the numbers from the dashboard state above."

            response = await model.generate_content_async(full_prompt)
            return ChatResponse(reply=response.text, source="vertex-ai")
        except Exception as exc:
            print(f"[orbit-server] Vertex AI error: {exc}")
            traceback.print_exc()
            # Fall through to mock

    # Mock fallback
    reply = _generate_mock_reply(req.message, req.context)
    return ChatResponse(reply=reply, source="mock")


# ─── Health Check ────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "vertex_ai": _vertex_available,
    }


# ─── Entrypoint ──────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("ORBIT_PORT", "8510"))
    print(f"\n✦ Orbit AI Backend starting on http://localhost:{port}")
    print(f"  Vertex AI: {'✓ available' if _vertex_available else '✗ mock mode'}")
    print(f"  Endpoints: POST /api/orbit-chat, GET /api/health\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
