const express = require('express');
const cors = require('cors');
const { loadAccessData, saveAccessData, checkAccess, authenticateUser } = require('./accessStore');

const app = express();
const port = Number(process.env.ACCESS_PORT ?? 3001);

app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Serve the standalone Admin UI on 3001

// --- Helper ---
function sendError(res, status, message) {
    return res.status(status).json({ success: false, message });
}

function logAudit(data, adminEmail, action, details) {
    if (!data.audit_logs) data.audit_logs = [];
    data.audit_logs.unshift({
        timestamp: new Date().toISOString(),
        adminEmail,
        action,
        details
    });
    if (data.audit_logs.length > 500) data.audit_logs.pop();
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/access-control/login — authenticate a user against access.json passwords
app.post('/api/access-control/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 400, 'Email and password required');

    const authResult = authenticateUser(email, password);
    if (!authResult.success) {
        // Use generic message to prevent username enumeration
        return sendError(res, 401, authResult.error);
    }

    // Record login in both audit log and telemetry
    const data = loadAccessData();
    const e = email.toLowerCase().trim();
    logAudit(data, e, 'USER_LOGIN', `User ${e} authenticated successfully`);
    if (!data.telemetry) data.telemetry = {};
    if (!data.telemetry[e]) data.telemetry[e] = { last_login: null, pages_visited: [] };
    data.telemetry[e].last_login = new Date().toISOString();
    saveAccessData(data);

    // For simplicity, session management is handled externally. Returning the verified user data.
    res.json({
        success: true,
        user: authResult.user,
        permissions: authResult.permissions
    });
});

// Admin authentication gate (simple token verifier for UI)
// The token is just a base64 encoded "email:role" after a successful login.  
// In a full production system, use JWT. For this static tool, this prevents casual access.
const authenticateAdminUI = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return sendError(res, 401, 'Unauthorized Access Admin Panel');
    
    try {
        const tokenStr = Buffer.from(authHeader.replace('Bearer ', ''), 'base64').toString('ascii');
        const [email, role] = tokenStr.split(':');
        
        // Ensure the token specifies admin
        if (role !== 'admin') return sendError(res, 403, 'Requires Admin privileges');

        // Check if the user is still valid and still an admin
        const data = loadAccessData();
        const user = data.users[email.toLowerCase().trim()];
        if (!user || user.role !== 'admin') {
            return sendError(res, 403, 'Privileges revoked');
        }

        req.adminEmail = email;
        next();
    } catch (e) {
        return sendError(res, 401, 'Invalid authentication token');
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC/READ-ONLY ENDPOINTS (Main app fetch these over 8510)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/access-control/check?email=xxx — permission check
app.get('/api/access-control/check', (req, res) => {
    const email = req.query.email;
    if (!email) return sendError(res, 400, 'Email is required');
    res.json(checkAccess(email));
});

// GET /api/access-control/catalog — just the catalog (for dropdowns)
app.get('/api/access-control/catalog', (req, res) => {
    const data = loadAccessData();
    res.json(data.catalog || {});
});

// POST /api/access-control/telemetry
app.post('/api/access-control/telemetry', (req, res) => {
    const { email, action, detail } = req.body;
    if (!email || !action) return res.status(200).json({ success: true });

    const data = loadAccessData();
    const e = email.toLowerCase().trim();
    if (!data.telemetry) data.telemetry = {};
    if (!data.telemetry[e]) data.telemetry[e] = { last_login: null, pages_visited: [] };
    
    if (action === 'login') {
        data.telemetry[e].last_login = new Date().toISOString();
    } else if (action === 'navigate') {
        data.telemetry[e].pages_visited.unshift({ page: detail || 'unknown', timestamp: new Date().toISOString() });
        if (data.telemetry[e].pages_visited.length > 20) data.telemetry[e].pages_visited.pop();
    }
    
    saveAccessData(data);
    res.status(200).json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROTECTED ADMIN ENDPOINTS (Reachable from port 3001 UI)
// ═══════════════════════════════════════════════════════════════════════════
// Apply the admin middleware to the endpoints below
app.use(authenticateAdminUI);

// GET /api/access-control/config — full config for admin UI (PROTECTED)
app.get('/api/access-control/config', (req, res) => {
    // Hide passwords from configuration pulls for security
    const data = loadAccessData();
    const safeData = JSON.parse(JSON.stringify(data));
    for (const email in safeData.users) {
        if (safeData.users[email].password) {
            safeData.users[email].hasPassword = true;
            delete safeData.users[email].password;
        }
    }
    res.json(safeData);
});

app.put('/api/access-control/maintenance', (req, res) => {
    const data = loadAccessData();
    data.maintenance_mode = !!req.body.enabled;
    logAudit(data, req.adminEmail, 'MAINTENANCE_TOGGLE', `Maintenance mode set to ${data.maintenance_mode}`);
    saveAccessData(data);
    res.json({ success: true, enabled: data.maintenance_mode });
});

app.put('/api/access-control/restore', (req, res) => {
    try {
        const newData = req.body;
        if (!newData || !newData.users || !newData.roles) return sendError(res, 400, 'Invalid matrix backup schema');
        logAudit(newData, req.adminEmail, 'SYSTEM_RESTORE', 'Restored access.json from a backup JSON payload');
        saveAccessData(newData);
        res.json({ success: true });
    } catch(err) { return sendError(res, 500, 'Failed to process payload'); }
});

// POST /api/access-control/users — add or update a user
app.post('/api/access-control/users', (req, res) => {
    const { email, role, password } = req.body;
    if (!email || !role) return sendError(res, 400, 'email and role required');
    const data = loadAccessData();
    if (!data.roles[role]) return sendError(res, 400, `Role "${role}" does not exist`);
    
    const e = email.toLowerCase().trim();
    const isNew = !data.users[e];
    if (isNew) data.users[e] = {};
    data.users[e].role = role;

    let pwdMsg = "";
    if (password) {
        data.users[e].password = password;
        pwdMsg = " (Password explicitly set)";
    } else if (password === "") {
        delete data.users[e].password;
        pwdMsg = " (Password cleared)";
    }

    logAudit(data, req.adminEmail, isNew ? 'CREATE_USER' : 'UPDATE_USER', `Set ${e} to role ${role}${pwdMsg}`);
    saveAccessData(data);
    res.json({ success: true });
});

// DELETE /api/access-control/users/:email
app.delete('/api/access-control/users/:email', (req, res) => {
    const data = loadAccessData();
    const e = req.params.email.toLowerCase().trim();
    delete data.users[e];
    
    // Also clean up overrides
    if (data.custom_user_overrides && data.custom_user_overrides[e]) {
        delete data.custom_user_overrides[e];
    }
    
    logAudit(data, req.adminEmail, 'DELETE_USER', `Revoked all access for ${e}`);
    saveAccessData(data);
    res.json({ success: true });
});

// PUT /api/access-control/users/:email/overrides — update explicit scope overrides
app.put('/api/access-control/users/:email/overrides', (req, res) => {
    const data = loadAccessData();
    const e = req.params.email.toLowerCase().trim();
    if (!data.users[e]) return sendError(res, 404, 'User not found');
    
    if (!data.custom_user_overrides) data.custom_user_overrides = {};
    
    // Store the precise overrides explicitly provided
    data.custom_user_overrides[e] = {
        projects: req.body.projects || [],
        agents: req.body.agents || [],
        clients: req.body.clients || [],
        pages: req.body.pages || []
    };
    
    logAudit(data, req.adminEmail, 'UPDATE_OVERRIDES', `Modified custom explicit scope overrides for ${e}`);
    saveAccessData(data);
    res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROLE & CATALOG MANAGEMENT (PROTECTED)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/access-control/roles — create a new role
app.post('/api/access-control/roles', (req, res) => {
    const { role, permissions } = req.body;
    if (!role) return sendError(res, 400, 'role name is required');
    const data = loadAccessData();
    if (data.roles[role]) return sendError(res, 409, 'Role already exists');
    data.roles[role] = permissions || { projects: [], agents: [], clients: [], pages: [] };
    logAudit(data, req.adminEmail, 'CREATE_ROLE', `Created new role schema: ${role}`);
    saveAccessData(data);
    res.json({ success: true });
});

// PUT /api/access-control/roles/:role — update a role's permissions
app.put('/api/access-control/roles/:role', (req, res) => {
    const data = loadAccessData();
    const role = req.params.role;
    if (!data.roles[role]) return sendError(res, 404, 'Role not found');
    data.roles[role] = { ...data.roles[role], ...req.body };
    logAudit(data, req.adminEmail, 'UPDATE_ROLE', `Modified permissions matrix for role: ${role}`);
    saveAccessData(data);
    res.json({ success: true });
});

// DELETE /api/access-control/roles/:role
app.delete('/api/access-control/roles/:role', (req, res) => {
    const data = loadAccessData();
    if (['admin', 'user'].includes(req.params.role)) return sendError(res, 400, 'Cannot delete built-in roles');
    delete data.roles[req.params.role];
    logAudit(data, req.adminEmail, 'DELETE_ROLE', `Deleted role schema: ${req.params.role}`);
    saveAccessData(data);
    res.json({ success: true });
});

app.post('/api/access-control/blacklist', (req, res) => {
    const { email } = req.body;
    if (!email) return sendError(res, 400, 'email required');
    const data = loadAccessData();
    const e = email.toLowerCase().trim();
    if (!data.blacklist.includes(e)) data.blacklist.push(e);
    saveAccessData(data);
    res.json({ success: true });
});

app.delete('/api/access-control/blacklist/:email', (req, res) => {
    const data = loadAccessData();
    data.blacklist = data.blacklist.filter(e => e !== req.params.email.toLowerCase().trim());
    saveAccessData(data);
    res.json({ success: true });
});

app.post('/api/access-control/catalog/project', (req, res) => {
    const { id, label } = req.body;
    if (!id || !label) return sendError(res, 400, 'id and label required');
    const data = loadAccessData();
    if (!data.catalog) data.catalog = { projects: {}, pages: [] };
    if (data.catalog.projects[id]) return sendError(res, 409, 'Project already exists');
    data.catalog.projects[id] = { label, agents: {}, clients: [] };
    saveAccessData(data);
    res.json({ success: true });
});

app.post('/api/access-control/catalog/agent', (req, res) => {
    const { projectId, agentId, label } = req.body;
    if (!projectId || !agentId || !label) return sendError(res, 400, 'projectId, agentId, label required');
    const data = loadAccessData();
    const proj = data.catalog?.projects?.[projectId];
    if (!proj) return sendError(res, 404, 'Project not found in catalog');
    if (!proj.agents) proj.agents = {};
    if (proj.agents[agentId]) return sendError(res, 409, 'Agent already exists under this project');
    proj.agents[agentId] = { label, clients: [], subProjects: [] };
    saveAccessData(data);
    res.json({ success: true });
});

app.post('/api/access-control/catalog/client', (req, res) => {
    const { projectId, agentId, clientName } = req.body;
    if (!projectId || !clientName) return sendError(res, 400, 'projectId, clientName required');
    const data = loadAccessData();
    const proj = data.catalog?.projects?.[projectId];
    if (!proj) return sendError(res, 404, 'Project not found');

    if (agentId && proj.agents?.[agentId]) {
        if (!proj.agents[agentId].clients) proj.agents[agentId].clients = [];
        if (!proj.agents[agentId].clients.includes(clientName)) {
            proj.agents[agentId].clients.push(clientName);
        }
    } else {
        if (!proj.clients) proj.clients = [];
        if (!proj.clients.includes(clientName)) {
            proj.clients.push(clientName);
        }
    }
    saveAccessData(data);
    res.json({ success: true });
});

app.post('/api/access-control/catalog/subproject', (req, res) => {
    const { projectId, agentId, subProjectId, subProjectName } = req.body;
    if (!projectId || !agentId || !subProjectId || !subProjectName) return sendError(res, 400, 'All fields required');
    const data = loadAccessData();
    const agent = data.catalog?.projects?.[projectId]?.agents?.[agentId];
    if (!agent) return sendError(res, 404, 'Agent not found');
    if (!agent.subProjects) agent.subProjects = [];
    agent.subProjects.push({ id: subProjectId, name: subProjectName });
    saveAccessData(data);
    res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════
app.listen(port, '0.0.0.0', () => {
    console.log(`Access Control Server running on port ${port}`);
});
