"""Routes package - Blueprint registration for Flask API."""
from flask import Blueprint

from api.routes.data import data_bp
from api.routes.alerts import alerts_bp
from api.routes.health import health_bp
from api.routes.incidents import incidents_bp
from api.routes.email import email_bp
from api.routes.chat import chat_bp
from api.routes.optimix import optimix_bp
from api.routes.optimix_iks import optimix_iks_bp
from api.routes.optimix_payer import optimix_payer_bp
from api.routes.releases import releases_bp


def register_routes(app):
    """Register all route blueprints with the Flask app."""
    app.register_blueprint(data_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(incidents_bp)
    app.register_blueprint(email_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(optimix_bp)
    app.register_blueprint(optimix_iks_bp)
    app.register_blueprint(optimix_payer_bp)
    app.register_blueprint(releases_bp)
