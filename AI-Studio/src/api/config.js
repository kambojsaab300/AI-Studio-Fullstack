// ============================================================
// AI Studio: API & Cloud Configuration Constants
// Powered by .NET Core 9 Web API & MonsterASP IIS
// ============================================================

// Dynamic API URL resolver: automatically switches between local .NET API (port 5005)
// and production MonsterASP API (https://aistudio.runasp.net), or reads from localStorage override.
export const getApiUrl = () => {
    if (typeof window !== 'undefined') {
        const customUrl = localStorage.getItem('aistudio_api_url');
        if (customUrl) return customUrl.replace(/\/$/, '');
        // When running Vite dev or preview locally, route directly to local .NET API
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:5005';
        }
        if (window.location.origin && window.location.origin.includes('runasp.net')) {
            return window.location.origin;
        }
    }
    return 'https://aistudio.runasp.net';
};

export const API_URL = getApiUrl();
export const API_KEY = "aistudio_admin_local_key";

export const CLOUDINARY_CLOUD_NAME = "draaqjcre";
export const CLOUDINARY_UPLOAD_PRESET = "ml_default";
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const REFRESH_MS = 2000;

export const API = {
    IS_ADMIN: 'is_ai_studio_admin',
    CREATE_TASK: 'upload_ai_studio_task',
    SET_WORKER_TOOLS: 'ai_studio_set_worker_tools',
    SET_WORKER_TASK_TYPES: 'ai_studio_set_worker_task_types',
    RELEASE_TASKS: 'ai_studio_release_tasks',
    CLEAR_FAILED: 'ai_studio_clear_failed',
    GET_CATALOG: 'get_task_catalog',
    GET_CONFIG: 'get_worker_config',
    GET_PROMPTS: 'get_task_prompts',
    GET_FAMILY_ROLES: 'get_family_roles',
    GET_APPS: 'get_app_list'
};

export const TABLES = {
    TASKS: 'ai_studio_tasks',
    WORKERS: 'ai_studio_workers',
    WORKER_LOAD: 'ai_studio_worker_load',
    SETTINGS: 'ai_studio_settings',
    SECRETS: 'ai_studio_secrets',
    MODELS: 'ai_studio_models',
    PROMPTS: 'ai_studio_prompts',
    LOG: 'ai_studio_action_log',
    TOOLS: 'ai_studio_tools',
    TOOL_TYPES: 'ai_studio_tool_types',
    WORKER_TOOLS: 'ai_studio_worker_tools',
    CATALOG: 'ai_studio_task_catalog',
    FAMILY_ROLES: 'ai_studio_family_roles',
    APPS: 'ai_studio_apps',
    APP_TASKS: 'ai_studio_app_tasks'
};
