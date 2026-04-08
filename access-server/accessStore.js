const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'access.json');

// ─── Load / Save ────────────────────────────────────────────────────────
function loadAccessData() {
    try {
        const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!d.audit_logs) d.audit_logs = [];
        if (!d.telemetry) d.telemetry = {};
        if (d.maintenance_mode === undefined) d.maintenance_mode = false;
        return d;
    } catch (err) {
        console.error('Error loading access data:', err.message);
        return { blacklist: [], users: {}, roles: {}, catalog: { projects: {}, pages: [] }, custom_user_overrides: {}, audit_logs: [], telemetry: {}, maintenance_mode: false };
    }
}

function saveAccessData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Permission Resolution ─────────────────────────────────────────────
function checkAccess(email) {
    const data = loadAccessData();
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Blacklist check
    if (data.blacklist.includes(normalizedEmail)) {
        return { allowed: false, reason: 'Email is blacklisted' };
    }

    // 2. Resolve role
    const userRecord = data.users[normalizedEmail];
    
    // STRICT WHITELISTING ENFORCEMENT
    // User must be explicitly added to the access control panel to be allowed in.
    if (!userRecord) {
        return { allowed: false, reason: 'Access Denied: You must be explicitly provisioned by an Administrator before accessing this platform.' };
    }

    const roleName = userRecord.role;
    const rolePerms = data.roles[roleName];

    // 3. Maintenance check
    if (data.maintenance_mode === true && roleName !== 'admin') {
        return { allowed: false, reason: 'System is currently undergoing scheduled maintenance. Please try again later.' };
    }

    if (!rolePerms) {
        return { allowed: false, reason: `Role "${roleName}" not found in config` };
    }

    // 4. Build effective permissions (role + custom overrides)
    const overrides = data.custom_user_overrides?.[normalizedEmail] || {};

    const projects = [...new Set([...(rolePerms.projects || []), ...(overrides.projects || [])])].sort();
    const agents   = [...new Set([...(rolePerms.agents || []),   ...(overrides.agents || [])])].sort();
    const clients  = [...new Set([...(rolePerms.clients || []),  ...(overrides.clients || [])])].sort();
    const pages    = [...new Set([...(rolePerms.pages || []),    ...(overrides.pages || [])])].sort();

    return {
        allowed: true,
        role: roleName,
        permissions: { projects, agents, clients, pages }
    };
}

// ─── Authentication ────────────────────────────────────────────────────
function authenticateUser(email, password) {
    const data = loadAccessData();
    const normalizedEmail = email.toLowerCase().trim();
    const userRecord = data.users[normalizedEmail];

    if (!userRecord || !userRecord.password) {
        return { success: false, error: 'Invalid credentials or external login not enabled for this user.' };
    }

    if (userRecord.password !== password) {
        return { success: false, error: 'Incorrect password.' };
    }

    // Check permissions if auth succeeds
    const access = checkAccess(normalizedEmail);
    if (!access.allowed) {
        return { success: false, error: access.reason };
    }

    return {
        success: true,
        user: { email: normalizedEmail, role: access.role },
        permissions: access.permissions
    };
}

module.exports = { loadAccessData, saveAccessData, checkAccess, authenticateUser };
