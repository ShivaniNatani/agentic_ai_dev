"""LDAP Authentication module for IKS Active Directory."""
from flask import Blueprint, jsonify, request

from api.config import LDAP_SERVER, LDAP_DOMAIN, LDAP_USER_ROLES, ROLE_DEFINITIONS

# Try to import ldap3
try:
    from ldap3 import Server, Connection, ALL, core
    LDAP_AVAILABLE = True
except ImportError:
    LDAP_AVAILABLE = False
    Server = None
    Connection = None
    ALL = None
    core = None

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.post("/ldap")
def api_auth_ldap():
    """Authenticate user against IKS Active Directory."""
    if not LDAP_AVAILABLE:
        return jsonify({"success": False, "error": "LDAP module not available"}), 500
    
    payload = request.get_json() or {}
    username = payload.get("username", "").strip().lower()
    password = payload.get("password", "")
    
    if not username or not password:
        return jsonify({"success": False, "error": "Username and password required"}), 400
    
    user_dn = f'{LDAP_DOMAIN}\\{username}'
    
    try:
        server = Server(LDAP_SERVER, get_info=ALL)
        conn = Connection(server, user=user_dn, password=password, auto_bind=True)
        conn.unbind()
        
        # Get role from mapping, default to 'user'
        role = LDAP_USER_ROLES.get(username, 'user')
        role_info = ROLE_DEFINITIONS.get(role, ROLE_DEFINITIONS['user'])
        
        user_data = {
            "username": username,
            "displayName": username.title(),
            "email": f"{username}@ikshealth.com",
            "avatar": username[:2].upper(),
            "role": role,
            "roleLabel": role_info['label'],
            "permissions": role_info['permissions'],
            "canWrite": role_info['canWrite'],
            "authMethod": "ldap"
        }
        
        return jsonify({"success": True, "user": user_data})
        
    except core.exceptions.LDAPBindError:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401
    except Exception as e:
        # Fallback to demo mode if LDAP fails (e.g. no VPN)
        print(f"LDAP Error: {e}. Attempting demo fallback.")
        
        # Check for demo credentials
        DEMO_PASSWORD = "password"
        ADMIN_PASSWORD = "admin"
        
        is_admin_demo = username == "admin" and password == ADMIN_PASSWORD
        is_user_demo = username in LDAP_USER_ROLES and password == DEMO_PASSWORD
        
        if is_admin_demo or is_user_demo:
            role = LDAP_USER_ROLES.get(username, 'user')
            if username == 'admin':
                role = 'admin'
                
            role_info = ROLE_DEFINITIONS.get(role, ROLE_DEFINITIONS['user'])
            
            return jsonify({
                "success": True, 
                "user": {
                    "username": username,
                    "displayName": username.title(),
                    "email": f"{username}@ikshealth.com",
                    "avatar": username[:2].upper(),
                    "role": role,
                    "roleLabel": role_info['label'],
                    "permissions": role_info['permissions'],
                    "canWrite": role_info['canWrite'],
                    "authMethod": "demo"
                }
            })
            
        return jsonify({"success": False, "error": f"LDAP error: {str(e)}"}), 500
