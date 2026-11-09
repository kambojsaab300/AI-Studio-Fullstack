// ============================================================
// AI Studio: Admin API client (.NET /api/admin/* endpoints)
// Every call needs a signed admin JWT (Authorization: Bearer, stored at login).
// Each function resolves to { data, error } (and `count` for task lists), never throws.
// ============================================================

import { API_URL } from './config';

function authHeaders() {
    let token = '';
    try { token = localStorage.getItem('aistudio_token') || ''; } catch { /* storage blocked */ }
    return {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

async function request(method, path, body) {
    try {
        const res = await fetch(`${API_URL}${path}`, {
            method,
            headers: authHeaders(),
            credentials: 'same-origin',
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        });
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }

        if (!res.ok) {
            const message = (json && (json.error || json.message)) || text || `HTTP ${res.status}`;
            const hint = res.status === 401 ? ' (admin login karein)' : '';
            return { data: null, error: { message: message + hint, status: res.status } };
        }
        return { data: json, error: null };
    } catch (err) {
        return { data: null, error: { message: err.message || 'Network error' } };
    }
}

const enc = encodeURIComponent;

function query(params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export const adminApi = {
    // Auth
    isAdmin: async () => {
        const res = await request('GET', '/api/auth/is-admin');
        return { data: !!res.data?.is_admin, error: res.error };
    },

    // Workers
    listWorkers: () => request('GET', '/api/admin/workers'),
    listWorkerLoad: () => request('GET', '/api/admin/worker-load'),
    setWorkerPaused: (workerId, paused, pauseReason = null) =>
        request('POST', `/api/admin/workers/${enc(workerId)}/pause`, { paused, pause_reason: pauseReason }),
    releaseTasks: async (workerId = null) => {
        const res = await request('POST', `/api/admin/release-tasks${query({ workerId })}`);
        return { data: res.data?.released ?? 0, error: res.error };
    },
    clearFailed: async (workerId = null) => {
        const res = await request('POST', `/api/admin/clear-failed${query({ workerId })}`);
        return { data: res.data?.cleared ?? 0, error: res.error };
    },

    // Tasks
    listTasks: async ({ status, appId, limit = 20, offset = 0 } = {}) => {
        const res = await request('GET', `/api/admin/tasks${query({ status, appId, limit, offset })}`);
        return { data: res.data?.data || null, count: res.data?.total ?? null, error: res.error };
    },
    getTask: (id) => request('GET', `/api/admin/tasks/${enc(id)}`),
    createTask: (payload) => request('POST', '/api/admin/tasks', payload),
    stopTask: (id) => request('POST', `/api/admin/tasks/${enc(id)}/stop`),
    deleteTask: (id) => request('DELETE', `/api/admin/tasks/${enc(id)}`),

    // Catalog (tools)
    listCatalog: () => request('GET', '/api/admin/catalog'),
    createCatalogItem: (row) => request('POST', '/api/admin/catalog', row),
    updateCatalogItem: (taskType, fields) => request('PUT', `/api/admin/catalog/${enc(taskType)}`, fields),
    setToolType: (taskType, tool) => request('PUT', `/api/admin/tool-types/${enc(taskType)}`, { tool }),

    // Apps
    listApps: () => request('GET', '/api/admin/apps'),
    getApp: (appId) => request('GET', `/api/admin/apps/${enc(appId)}`),
    createApp: (row) => request('POST', '/api/admin/apps', row),
    updateApp: (appId, fields) => request('PUT', `/api/admin/apps/${enc(appId)}`, fields),
    deleteApp: (appId) => request('DELETE', `/api/admin/apps/${enc(appId)}`),

    // App <-> tool links
    listAppTasks: (appId) => request('GET', `/api/admin/app-tasks${query({ appId })}`),
    linkAppTasks: (appId, taskTypes) =>
        request('POST', '/api/admin/app-tasks', { app_id: appId, task_types: [].concat(taskTypes) }),
    // Without taskTypes every link of the app is removed.
    unlinkAppTasks: (appId, taskTypes) =>
        request('DELETE', `/api/admin/app-tasks${query({ appId, taskTypes: taskTypes ? [].concat(taskTypes).join(',') : '' })}`),

    // Family roles, models, prompts
    listFamilyRoles: () => request('GET', '/api/admin/family-roles'),
    listModels: () => request('GET', '/api/admin/models'),
    listPrompts: () => request('GET', '/api/admin/prompts'),
    createPrompt: (row) => request('POST', '/api/admin/prompts', row),
    updatePrompt: (taskType, fields) => request('PUT', `/api/admin/prompts/${enc(taskType)}`, fields),

    // Settings & secrets ({ settings, secrets })
    getSettings: () => request('GET', '/api/admin/settings'),
    updateSettings: (fields) => request('PUT', '/api/admin/settings', fields),

    // API usage per client app ({ days, tools })
    getUsage: (days) => request('GET', `/api/admin/usage${query({ days })}`)
};

export default adminApi;
