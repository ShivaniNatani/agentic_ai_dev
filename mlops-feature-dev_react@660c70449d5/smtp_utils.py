"""Utilities for loading SMTP configuration and dispatching email."""

from __future__ import annotations

from configparser import ConfigParser
from email.message import EmailMessage
from pathlib import Path
from typing import Iterable
import os
import smtplib

DEFAULT_SMTP_CONFIG_PATH = Path(__file__).resolve().parent / "config.ini"


def coerce_recipients(value: str | list[str] | None) -> list[str]:
    """Normalize recipient inputs into a list of clean email strings."""

    if value is None:
        return []
    if isinstance(value, str):
        return [email.strip() for email in value.split(",") if email.strip()]
    return [email.strip() for email in value if isinstance(email, str) and email.strip()]


def resolve_smtp_settings(config_path: Path | None = None) -> dict[str, object]:
    """Load SMTP configuration from config.ini, Streamlit secrets, or environment."""

    settings: dict[str, object] = {
        "host": None,
        "port": None,
        "username": None,
        "password": None,
        "sender": None,
        "recipients": [],
        "use_tls": True,
        "reply_to": None,
    }

    path = config_path or DEFAULT_SMTP_CONFIG_PATH
    if path.exists():
        parser = ConfigParser()
        parser.read(path)
        if parser.has_section("SMTP"):
            section = "SMTP"
            settings["host"] = parser.get(section, "HOST", fallback=settings["host"])
            if parser.has_option(section, "PORT"):
                settings["port"] = parser.getint(section, "PORT")
            if parser.has_option(section, "SENDER"):
                settings["sender"] = parser.get(section, "SENDER")
            if parser.has_option(section, "RECIPIENTS"):
                settings["recipients"] = coerce_recipients(parser.get(section, "RECIPIENTS"))
            if parser.has_option(section, "USERNAME"):
                settings["username"] = parser.get(section, "USERNAME")
            if parser.has_option(section, "PASSWORD"):
                settings["password"] = parser.get(section, "PASSWORD")
            if parser.has_option(section, "USE_TLS"):
                settings["use_tls"] = parser.getboolean(section, "USE_TLS")
            if parser.has_option(section, "REPLY_TO"):
                settings["reply_to"] = parser.get(section, "REPLY_TO")

    # Support Streamlit secrets when available.
    try:
        from streamlit.runtime.secrets import secrets_singleton as _SECRETS_SINGLETON  # type: ignore
    except Exception:  # pragma: no cover - streamlit runtime not always present
        _SECRETS_SINGLETON = None

    secrets_obj = None
    if _SECRETS_SINGLETON is not None:
        try:
            if _SECRETS_SINGLETON.load_if_toml_exists():
                secrets_obj = _SECRETS_SINGLETON._secrets  # type: ignore[attr-defined]
        except Exception:
            secrets_obj = None

    if secrets_obj is None:
        try:
            import streamlit as st  # type: ignore

            secrets_obj = st.secrets
        except Exception:
            secrets_obj = None

    smtp_secret = None
    if secrets_obj is not None:
        try:
            smtp_secret = secrets_obj.get("smtp") if hasattr(secrets_obj, "get") else secrets_obj["smtp"]
        except Exception:
            smtp_secret = None

    if isinstance(smtp_secret, dict):
        settings["host"] = smtp_secret.get("host", settings["host"])
        settings["port"] = smtp_secret.get("port", settings["port"])
        settings["username"] = smtp_secret.get("username", settings["username"])
        settings["password"] = smtp_secret.get("password", settings["password"])
        settings["sender"] = smtp_secret.get("sender", settings["sender"])
        if smtp_secret.get("recipients"):
            settings["recipients"] = coerce_recipients(smtp_secret.get("recipients"))
        if "use_tls" in smtp_secret:
            settings["use_tls"] = bool(smtp_secret.get("use_tls"))
        if smtp_secret.get("reply_to"):
            settings["reply_to"] = smtp_secret.get("reply_to")

    env_host = os.getenv("SMTP_HOST")
    if env_host:
        settings["host"] = env_host
    env_port = os.getenv("SMTP_PORT")
    if env_port:
        try:
            settings["port"] = int(env_port)
        except ValueError:
            pass
    env_sender = os.getenv("SMTP_SENDER")
    if env_sender:
        settings["sender"] = env_sender
    env_recipients = os.getenv("SMTP_RECIPIENTS")
    if env_recipients:
        settings["recipients"] = coerce_recipients(env_recipients)
    env_username = os.getenv("SMTP_USERNAME")
    if env_username:
        settings["username"] = env_username
    env_password = os.getenv("SMTP_PASSWORD")
    if env_password:
        settings["password"] = env_password
    env_use_tls = os.getenv("SMTP_USE_TLS")
    if env_use_tls:
        if env_use_tls.lower() in {"0", "false", "no"}:
            settings["use_tls"] = False
        elif env_use_tls.lower() in {"1", "true", "yes"}:
            settings["use_tls"] = True
    env_reply_to = os.getenv("SMTP_REPLY_TO")
    if env_reply_to:
        settings["reply_to"] = env_reply_to

    return settings


def send_email_via_smtp(
    subject: str,
    body_lines: Iterable[str],
    smtp_settings: dict[str, object],
    *,
    success_message: str,
    is_html: bool = False,
) -> tuple[bool, str]:
    """
    Send an email message using the provided SMTP settings.

    If is_html is True, the body is sent as HTML content.
    """

    recipients = coerce_recipients(smtp_settings.get("recipients"))
    if not recipients:
        return False, "No SMTP recipients configured."

    sender = str(smtp_settings.get("sender") or "").strip()
    if not sender:
        return False, "SMTP sender not configured; update config.ini or environment variables."

    host = smtp_settings.get("host")
    if not host:
        return False, "SMTP host not configured; update config.ini or environment variables."

    port_value = smtp_settings.get("port")
    try:
        port = int(port_value) if port_value is not None else 587
    except (TypeError, ValueError):
        return False, "SMTP port is invalid; ensure it is an integer in config.ini."

    username = smtp_settings.get("username")
    password = smtp_settings.get("password")
    use_tls = bool(smtp_settings.get("use_tls", True))

    message_lines = list(body_lines)
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    body_content = "\n".join(message_lines)
    if is_html:
        msg.set_content(body_content, subtype="html")
    else:
        msg.set_content(body_content)
    reply_to = smtp_settings.get("reply_to")
    if reply_to:
        msg["Reply-To"] = str(reply_to).strip()

    try:
        with smtplib.SMTP(host, port, timeout=20) as server:
            if use_tls:
                server.starttls()
            if username and password:
                server.login(str(username), str(password))
            server.send_message(msg)
        return True, success_message
    except Exception as exc:  # pragma: no cover - surface to caller
        return False, str(exc)
