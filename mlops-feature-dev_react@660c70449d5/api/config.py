"""Configuration constants for the Flask API."""
from pathlib import Path
import os
import sys

# Ensure the repository root is on sys.path when running directly
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Check multiple possible locations for frontend build
_POSSIBLE_STATIC_DIRS = [
    ROOT_DIR / "frontend" / "dist",  # Docker location
    ROOT_DIR.parent / "dist",         # Development location (when running from api folder)
    ROOT_DIR / "dist",                 # Alternative dev location
    Path("/Users/shivaninatani/Library/Mobile Documents/com~apple~CloudDocs/Codebase/IKS/dash_v3/dist"),
]
STATIC_DIR = next((d for d in _POSSIBLE_STATIC_DIRS if d.exists()), _POSSIBLE_STATIC_DIRS[0])

# CORS configuration
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")

# Chat/AI configuration
CHAT_SYSTEM_PROMPT = (
    "You are a senior MLOps co-pilot. Use the provided dashboard context to answer questions about "
    "model performance, drift, latency, and incidents. Prefer concrete numbers and dates from the "
    "context; never invent metrics. Be concise (2-6 bullet points or short paragraphs) and outline next "
    "steps when action is needed. If data is missing, say so briefly."
)

# ========== LDAP Configuration ==========
LDAP_SERVER = os.getenv('LDAP_SERVER', 'ldap://10.7.2.50')  # Direct IP to avoid host resolution issues
LDAP_DOMAIN = 'iksad'

# Username to role mapping for LDAP users
LDAP_USER_ROLES = {
    # Admin (full access with writes)
    'shivani': 'admin',
    'argha': 'admin',
    # MLOps Dashboard access
    'bhavin': 'mlops',
    'dinesh': 'mlops',
    'sail': 'mlops',
    # Agentic AI Dashboard access
    'akshay': 'agentic',
    'prathamesh': 'agentic',
    'hrishav': 'agentic',
    'amey': 'agentic',
    'athul': 'agentic',
}

# Role definitions with permissions
ROLE_DEFINITIONS = {
    'admin': {
        'label': 'Administrator',
        'permissions': ['all'],
        'canWrite': True
    },
    'mlops': {
        'label': 'MLOps Engineer',
        'permissions': ['dashboard', 'mlops', 'alerts', 'system-health', 'release-notes'],
        'canWrite': False
    },
    'agentic': {
        'label': 'Agentic AI Engineer',
        'permissions': ['dashboard', 'agents', 'sandbox', 'demos', 'release-notes'],
        'canWrite': False
    },
    'user': {
        'label': 'User',
        'permissions': ['dashboard', 'agents', 'release-notes'],
        'canWrite': False
    }
}
