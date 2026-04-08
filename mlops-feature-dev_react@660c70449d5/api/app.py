"""Flask API for the React MLOps dashboard.

This is the main application entry point. Route handlers are organized
in separate blueprint modules under api/routes/.
"""
from __future__ import annotations

from datetime import datetime, timezone
import os
import sys
from pathlib import Path

# Ensure the api package is importable
API_DIR = Path(__file__).resolve().parent
ROOT_DIR = API_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

from api.config import STATIC_DIR, CORS_ORIGIN
from api.utils import NumpyJSONProvider
from api.auth import auth_bp
from api.routes import register_routes


def _public_outage_enabled() -> bool:
    value = os.getenv("PUBLIC_OUTAGE_MODE", "false").strip().lower()
    return value not in {"0", "false", "no", "off"}


def _build_outage_html() -> str:
    checked_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"""<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>503 Service Unavailable</title>
    <style>
        :root {{
            color-scheme: dark;
            --bg-1: #08111f;
            --bg-2: #0f1c33;
            --card: rgba(9, 20, 40, 0.84);
            --border: rgba(148, 163, 184, 0.18);
            --text: #e2e8f0;
            --muted: #94a3b8;
            --accent: #f97316;
            --accent-soft: rgba(249, 115, 22, 0.16);
            --danger: #fb7185;
        }}
        * {{
            box-sizing: border-box;
        }}
        body {{
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
            color: var(--text);
            background:
                radial-gradient(circle at top left, rgba(249, 115, 22, 0.22), transparent 34%),
                radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.18), transparent 28%),
                linear-gradient(145deg, var(--bg-1), var(--bg-2));
        }}
        .panel {{
            width: min(760px, 100%);
            padding: 40px;
            border: 1px solid var(--border);
            border-radius: 28px;
            background: var(--card);
            box-shadow: 0 28px 80px rgba(2, 6, 23, 0.48);
            backdrop-filter: blur(16px);
        }}
        .pill {{
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 10px 16px;
            border-radius: 999px;
            background: var(--accent-soft);
            color: #fdba74;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }}
        .dot {{
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: var(--danger);
            box-shadow: 0 0 16px rgba(251, 113, 133, 0.9);
        }}
        h1 {{
            margin: 28px 0 8px;
            font-size: clamp(64px, 14vw, 108px);
            line-height: 0.9;
            letter-spacing: -0.06em;
        }}
        h2 {{
            margin: 0;
            font-size: clamp(28px, 5vw, 40px);
            line-height: 1.05;
        }}
        p {{
            margin: 18px 0 0;
            color: var(--muted);
            font-size: 18px;
            line-height: 1.65;
        }}
        .grid {{
            display: grid;
            gap: 14px;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            margin-top: 30px;
        }}
        .tile {{
            padding: 18px;
            border-radius: 18px;
            border: 1px solid var(--border);
            background: rgba(15, 23, 42, 0.5);
        }}
        .label {{
            display: block;
            margin-bottom: 8px;
            color: var(--muted);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }}
        .value {{
            color: var(--text);
            font-size: 17px;
            font-weight: 600;
        }}
        .footer {{
            margin-top: 26px;
            font-size: 14px;
            color: var(--muted);
        }}
    </style>
</head>
<body>
    <main class="panel">
        <div class="pill"><span class="dot"></span>Service interruption</div>
        <h1>503</h1>
        <h2>Dashboard temporarily unavailable</h2>
        <p>
            The IKS dashboard is currently unreachable. Our platform team is investigating and
            service will resume automatically once the incident is cleared.
        </p>
        <section class="grid" aria-label="status details">
            <div class="tile">
                <span class="label">Service</span>
                <span class="value">IKS Dashboard</span>
            </div>
            <div class="tile">
                <span class="label">Status</span>
                <span class="value">Unavailable</span>
            </div>
            <div class="tile">
                <span class="label">Last Checked</span>
                <span class="value">{checked_at}</span>
            </div>
        </section>
        <p class="footer">Please retry in a few minutes.</p>
    </main>
</body>
</html>
"""


def _service_unavailable_response():
    headers = {
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "Retry-After": os.getenv("PUBLIC_OUTAGE_RETRY_AFTER", "1800"),
    }
    wants_json = request.path.startswith("/api/") or (
        request.accept_mimetypes["application/json"] > request.accept_mimetypes["text/html"]
    )
    if wants_json:
        response = jsonify(
            {
                "status": "unavailable",
                "message": "IKS dashboard is temporarily unavailable.",
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        response.status_code = 503
    else:
        response = Response(_build_outage_html(), status=503, mimetype="text/html")
    response.headers.update(headers)
    return response


def create_app() -> Flask:
    """Create and configure the Flask application."""
    # Serve assets from /static to avoid clashing with SPA catch-all
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
    app.json = NumpyJSONProvider(app)
    CORS(app, resources={r"/api/*": {"origins": CORS_ORIGIN}})

    @app.before_request
    def simulate_public_outage():
        if not _public_outage_enabled():
            return None
        if request.path == "/api/health":
            return None
        return _service_unavailable_response()
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    register_routes(app)
    
    # Register frontend serving routes
    _register_frontend_routes(app)
    
    return app


def _register_frontend_routes(app: Flask) -> None:
    """Register routes for serving the frontend SPA."""
    
    # Debug route removed for production security
    # @app.route("/debug")
    # ...

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path: str):
        if not STATIC_DIR.exists():
            return jsonify({"error": "Frontend build not found."}), 404

        # Serve static files directly if they exist (CSS/JS/assets)
        target = STATIC_DIR / path
        if path and target.is_file():
            return send_from_directory(STATIC_DIR, path)

        # Landing page: serve broadcast_release.html at root
        if path == "":
            landing = STATIC_DIR / "broadcast_release.html"
            if landing.exists():
                return send_from_directory(STATIC_DIR, "broadcast_release.html")

        # SPA Fallback: return index.html for React routes (login, dashboard, etc.)
        try:
            index_path = STATIC_DIR / "index.html"
            with open(index_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return jsonify({"error": f"Failed to serve index.html: {str(e)}"}), 500

    @app.route("/convergence")
    def serve_convergence():
        """Dedicated endpoint for the launch/landing page."""
        landing = STATIC_DIR / "broadcast_release.html"
        if landing.exists():
            return send_from_directory(STATIC_DIR, "broadcast_release.html")
        return jsonify({"error": "Landing page not found."}), 404

    @app.route("/broadcast")
    def serve_broadcast_explicit():
        # Force serve index.html for /broadcast
        try:
            index_path = STATIC_DIR / "index.html"
            with open(index_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return jsonify({"error": f"Failed to serve index.html: {str(e)}"}), 500


# Create the app instance
app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8510))
    app.run(host="0.0.0.0", port=port)
