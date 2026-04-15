"""Helper utilities for invoking Vertex AI Generative Models with service-account auth."""

from __future__ import annotations

import asyncio
import json
import os
import threading
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

import vertexai
from google.oauth2 import service_account
from vertexai.generative_models import GenerativeModel

_BASE_DIR = Path(__file__).resolve().parent
_CONFIG_PATH = _BASE_DIR / "config.json"
_DEFAULT_GENERATION_CONFIG = {
    "temperature": 0,
    "top_p": 1.0,
    "response_mime_type": "text/plain",
}
_ALLOWED_GENERATION_KEYS = {"temperature", "top_p", "top_k", "max_output_tokens", "response_mime_type"}

_init_lock = threading.Lock()
_model_lock = threading.Lock()
_initialized = False
_model_cache: Dict[str, GenerativeModel] = {}


@lru_cache(maxsize=1)
def _load_config() -> Dict[str, Any]:
    config_candidates = []
    env_config_path = Path(str(os.getenv("VERTEX_AI_CONFIG_PATH", "")).strip()).expanduser() if os.getenv("VERTEX_AI_CONFIG_PATH") else None
    if env_config_path:
        config_candidates.append(env_config_path)
    config_candidates.extend([
        _CONFIG_PATH,
        _BASE_DIR.parent / "vertex.ai" / "config.json",
    ])

    for candidate in config_candidates:
        if candidate.exists():
            with candidate.open("r", encoding="utf-8") as fh:
                return json.load(fh)

    default_service_account = os.getenv("VERTEX_AI_SERVICE_ACCOUNT_FILE", "/app/secrets/mlflow-sa-prod.json")
    return {
        "location": os.getenv("VERTEX_AI_LOCATION", "us-central1"),
        "model_name": os.getenv("VERTEX_AI_MODEL_NAME", "gemini-2.5-pro"),
        "service_account_file": default_service_account,
        "generation_config": dict(_DEFAULT_GENERATION_CONFIG),
    }


def _resolve_service_account_path(key_file: str) -> Path:
    key_path = Path(key_file).expanduser()
    if key_path.is_absolute() and key_path.exists():
        return key_path

    search_candidates = [
        _BASE_DIR / key_file,
        _BASE_DIR.parent / key_file,
        _BASE_DIR.parent / "secrets" / key_file,
        Path("/app/secrets") / key_file,
    ]
    for candidate in search_candidates:
        if candidate.exists():
            return candidate

    return key_path


@lru_cache(maxsize=1)
def _get_credentials() -> service_account.Credentials:
    config = _load_config()
    key_file = config.get("service_account_file")
    if not key_file:
        raise KeyError("`service_account_file` missing from config.json")
    
    key_path = _resolve_service_account_path(str(key_file))
    if not key_path.exists():
         raise FileNotFoundError(f"Service account file not found at {key_path}")
            
    return service_account.Credentials.from_service_account_file(str(key_path))


def _ensure_vertexai_initialized() -> None:
    global _initialized
    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return
        config = _load_config()
        creds = _get_credentials()
        project_id = config.get("project_id") or creds.project_id
        location = config.get("location", "us-central1")
        vertexai.init(project=project_id, location=location, credentials=creds)
        _initialized = True


def _filter_generation_config(config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not config:
        return {}
    return {k: v for k, v in config.items() if k in _ALLOWED_GENERATION_KEYS}


def _get_underlying_model(model_name: str) -> GenerativeModel:
    _ensure_vertexai_initialized()
    with _model_lock:
        cached = _model_cache.get(model_name)
        if cached is None:
            cached = GenerativeModel(model_name)
            _model_cache[model_name] = cached
        return cached


class VertexAIModel:
    """Wrapper mirroring the google.generativeai interface with async helpers."""

    def __init__(self, model_name: Optional[str] = None):
        config = _load_config()
        default_name = config.get("model_name", "gemini-2.5-pro")
        self._model_name = model_name or default_name
        self._default_generation = _filter_generation_config(config.get("generation_config"))
        self._model = _get_underlying_model(self._model_name)

    def _merge_generation(self, overrides: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        merged = dict(self._default_generation)
        if overrides:
            merged.update(_filter_generation_config(overrides))
        return merged or None

    def generate_content(
        self,
        *args: Any,
        generation_config: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ):
        merged_config = self._merge_generation(generation_config)
        return self._model.generate_content(*args, generation_config=merged_config, **kwargs)

    async def generate_content_async(
        self,
        *args: Any,
        generation_config: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ):
        merged_config = self._merge_generation(generation_config)

        def _invoke():
            return self._model.generate_content(*args, generation_config=merged_config, **kwargs)

        return await asyncio.to_thread(_invoke)


@lru_cache(maxsize=None)
def get_vertex_model(model_name: Optional[str] = None) -> VertexAIModel:
    """
    Return a cached VertexAIModel wrapper. Caching keeps a single wrapper per model name.
    """
    return VertexAIModel(model_name)
